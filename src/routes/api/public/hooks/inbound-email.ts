import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { zonedDateToUtc } from "@/lib/slots";
import { extractGeminiDecision } from "@/lib/ai/gemini.server";
import {
  createBookingCore,
  cancelBookingCore,
  findNearestAvailableSlot,
  rescheduleBookingCore,
} from "@/lib/booking-core.server";
import {
  sendAlternativeSlotEmail,
  sendBookingClarificationEmail,
  sendCancellationConfirmationEmail,
  sendLandingPageEmail,
  sendLowConfidenceEmail,
} from "@/lib/email.server";
import {
  checkRateLimit,
  getIdempotencyResponse,
  hashRequestBody,
  storeIdempotencyResponse,
  verifyTimezone,
  verifyWebhookSignature,
} from "@/lib/security.server";

const inboundSchema = z.object({
  eventTypeId: z.string().uuid(),
  threadKey: z.string().min(4),
  messageId: z.string().min(4),
  fromEmail: z.string().email(),
  fromName: z.string().max(120).optional().nullable(),
  toEmail: z.string().email(),
  subject: z.string().max(200).optional().nullable(),
  bodyText: z.string().max(20000).optional().nullable(),
  senderTimeZone: z.string().max(64).optional().nullable(),
  rawPayload: z.unknown().optional(),
});

type InboundPayload = z.infer<typeof inboundSchema>;

type TimeParseResult = { minutes: number } | null;

function parseTimeToMinutes(raw: string): TimeParseResult {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)?$/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59 || hour < 0 || hour > 23) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    const base = hour % 12;
    const adjusted = meridiem === "pm" ? base + 12 : base;
    return { minutes: adjusted * 60 + minute };
  }

  return { minutes: hour * 60 + minute };
}

function formatZonedLabel(iso: string, timeZone: string): string {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
  return `${date} at ${time}`;
}

function getPublicBaseUrl(): string | null {
  const raw = process.env.PUBLIC_APP_URL ?? process.env.VITE_PUBLIC_APP_URL;
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function resolveInviteeName(payload: InboundPayload): string {
  if (payload.fromName?.trim()) return payload.fromName.trim();
  const localPart = payload.fromEmail.split("@")[0] ?? "there";
  return localPart.replace(/[^a-z0-9._-]+/gi, " ").trim() || "there";
}

function resolveStartIso(params: {
  meetingDate: string | null;
  meetingTime: string | null;
  timeZone: string | null;
}): string | null {
  if (!params.meetingDate || !params.meetingTime || !params.timeZone) return null;
  const parsed = parseTimeToMinutes(params.meetingTime);
  if (!parsed) return null;
  return zonedDateToUtc(params.meetingDate, parsed.minutes, params.timeZone).toISOString();
}

async function sendClarification(params: {
  eventTypeId: string;
  inviteeEmail: string;
  inviteeName: string;
  reason?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: et } = await supabaseAdmin
    .from("event_types")
    .select("title, slug, user_id")
    .eq("id", params.eventTypeId)
    .maybeSingle();
  if (!et) return;

  const { data: hostProfile } = await supabaseAdmin
    .from("profiles")
    .select("display_name, username")
    .eq("id", et.user_id)
    .maybeSingle();

  const baseUrl = getPublicBaseUrl();
  const rescheduleUrl = baseUrl && hostProfile?.username
    ? `${baseUrl}/${hostProfile.username}/${et.slug}`
    : undefined;
  if (!rescheduleUrl) return;

  await sendBookingClarificationEmail({
    toEmail: params.inviteeEmail,
    toName: params.inviteeName,
    hostName: hostProfile?.display_name ?? "Host",
    eventTitle: et.title,
    rescheduleUrl,
    reason: params.reason,
  });
}

async function createLandingPage(params: {
  threadId: string;
  eventTypeId: string;
  inviteeEmail: string;
  inviteeName: string;
  introMessage: string;
}): Promise<{ token: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = randomBytes(20).toString("hex");
  const { error } = await supabaseAdmin.from("ai_landing_pages").insert({
    thread_id: params.threadId,
    event_type_id: params.eventTypeId,
    token,
    invitee_email: params.inviteeEmail,
    invitee_name: params.inviteeName,
    intro_message: params.introMessage,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) return null;
  return { token };
}

export const Route = createFileRoute("/api/public/hooks/inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
        const rawBody = await request.text();
        if (secret) {
          const verify = verifyWebhookSignature({
            request,
            bodyText: rawBody,
            secret,
          });
          if (!verify.ok) {
            return Response.json({ ok: false, error: verify.error }, { status: 401 });
          }
        }

        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "invalid payload" },
            { status: 400 },
          );
        }

        let payload: InboundPayload;
        try {
          payload = inboundSchema.parse(parsedBody);
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "invalid payload" },
            { status: 400 },
          );
        }

        const limitKey = `inbound:${payload.fromEmail}`;
        const limit = checkRateLimit({ key: limitKey, limit: 30, windowMs: 5 * 60 * 1000 });
        if (!limit.ok) {
          return Response.json(
            { ok: false, error: limit.error, retryAfterMs: limit.retryAfterMs },
            { status: 429 },
          );
        }

        const requestHash = hashRequestBody(rawBody);
        const idempotencyKey = request.headers.get("idempotency-key") ?? payload.messageId;
        if (idempotencyKey) {
          const cached = await getIdempotencyResponse({
            key: idempotencyKey,
            route: "inbound-email",
            requestHash,
          });
          if (cached.found) {
            return Response.json(cached.response);
          }
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: eventType, error: etErr } = await supabaseAdmin
          .from("event_types")
          .select("id, title, slug, user_id, location")
          .eq("id", payload.eventTypeId)
          .maybeSingle();
        if (etErr || !eventType) {
          return Response.json({ ok: false, error: "event_type_not_found" }, { status: 404 });
        }

        const { data: hostProfile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, username, timezone")
          .eq("id", eventType.user_id)
          .maybeSingle();
        const hostName = hostProfile?.display_name ?? "Host";
        const hostTimezone = hostProfile?.timezone ?? "UTC";

        const { data: thread } = await supabaseAdmin
          .from("email_threads")
          .upsert(
            {
              thread_key: payload.threadKey,
              host_user_id: eventType.user_id,
              event_type_id: eventType.id,
              status: "open",
            },
            { onConflict: "thread_key" },
          )
          .select("id")
          .single();
        if (!thread) {
          return Response.json({ ok: false, error: "thread_create_failed" }, { status: 500 });
        }

        const { error: inboundErr } = await supabaseAdmin.from("inbound_emails").insert({
          thread_id: thread.id,
          message_id: payload.messageId,
          from_email: payload.fromEmail,
          to_email: payload.toEmail,
          subject: payload.subject ?? null,
          body_text: payload.bodyText ?? null,
          raw_payload: payload.rawPayload ?? parsedBody,
        });
        if (inboundErr && !String(inboundErr.message).toLowerCase().includes("duplicate")) {
          return Response.json({ ok: false, error: inboundErr.message }, { status: 500 });
        }

        const inviteeName = resolveInviteeName(payload);
        const senderTimezone = verifyTimezone(payload.senderTimeZone) ?? hostTimezone;

        let decisionRecordId: string | null = null;
        try {
          const { decision, promptVersion, raw } = await extractGeminiDecision({
            emailText: payload.bodyText ?? "",
            senderTimezone,
            subject: payload.subject ?? undefined,
          });

          const { data: decisionRow } = await supabaseAdmin
            .from("ai_decisions")
            .insert({
              thread_id: thread.id,
              message_id: payload.messageId,
              model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
              prompt_version: promptVersion,
              response_json: raw as any,
              intent: decision.intent,
              confidence: decision.confidence,
              decision_status: "pending",
            })
            .select("id")
            .single();
          decisionRecordId = decisionRow?.id ?? null;

          const decisionTimezone = decision.timezone ?? senderTimezone;
          const startAtIso = resolveStartIso({
            meetingDate: decision.meeting_date,
            meetingTime: decision.meeting_time,
            timeZone: decisionTimezone,
          });
          const isLowConfidence = decision.confidence < 0.7 || decision.uncertain;

          if (decision.intent === "CANCEL") {
            const { data: existing } = await supabaseAdmin
              .from("bookings")
              .select("id, start_at, invitee_email")
              .eq("event_type_id", eventType.id)
              .eq("invitee_email", payload.fromEmail)
              .eq("status", "confirmed")
              .gte("start_at", new Date().toISOString())
              .order("start_at", { ascending: true })
              .maybeSingle();

            if (!existing) {
              await sendClarification({
                eventTypeId: eventType.id,
                inviteeEmail: payload.fromEmail,
                inviteeName,
                reason: "I could not find the booking to cancel. Please confirm the time or book a new slot.",
              });
              if (decisionRecordId) {
                await supabaseAdmin
                  .from("ai_decisions")
                  .update({ decision_status: "clarification" })
                  .eq("id", decisionRecordId);
              }
              const response = { ok: true, action: "clarification" };
              if (idempotencyKey) {
                await storeIdempotencyResponse({
                  key: idempotencyKey,
                  route: "inbound-email",
                  requestHash,
                  response,
                });
              }
              return Response.json(response);
            }

            const cancelResult = await cancelBookingCore({
              bookingId: existing.id,
              reason: "cancelled-via-email",
              source: "email",
            });
            if (cancelResult.ok) {
              await sendCancellationConfirmationEmail({
                toEmail: payload.fromEmail,
                toName: inviteeName,
                hostName,
                eventTitle: eventType.title,
                whenLabel: formatZonedLabel(existing.start_at, hostTimezone),
              });
            }
            if (decisionRecordId) {
              await supabaseAdmin
                .from("ai_decisions")
                .update({ decision_status: cancelResult.ok ? "booked" : "error" })
                .eq("id", decisionRecordId);
            }
            const response = { ok: true, action: "cancelled" };
            if (idempotencyKey) {
              await storeIdempotencyResponse({
                key: idempotencyKey,
                route: "inbound-email",
                requestHash,
                response,
              });
            }
            return Response.json(response);
          }

          if (decision.intent === "QUESTION" || decision.intent === "NEEDS_INFORMATION") {
            const landing = await createLandingPage({
              threadId: thread.id,
              eventTypeId: eventType.id,
              inviteeEmail: payload.fromEmail,
              inviteeName,
              introMessage: "Here is a quick overview so you can decide if this meeting is right for you.",
            });
            const baseUrl = getPublicBaseUrl();
            const landingUrl = landing && baseUrl ? `${baseUrl}/ai/${landing.token}` : null;
            if (landingUrl) {
              await sendLandingPageEmail({
                toEmail: payload.fromEmail,
                toName: inviteeName,
                hostName,
                eventTitle: eventType.title,
                landingUrl,
              });
            } else {
              await sendClarification({
                eventTypeId: eventType.id,
                inviteeEmail: payload.fromEmail,
                inviteeName,
                reason: "Happy to share more details. What would you like to know?",
              });
            }

            if (decisionRecordId) {
              await supabaseAdmin
                .from("ai_decisions")
                .update({ decision_status: "landing" })
                .eq("id", decisionRecordId);
            }
            const response = { ok: true, action: "landing" };
            if (idempotencyKey) {
              await storeIdempotencyResponse({
                key: idempotencyKey,
                route: "inbound-email",
                requestHash,
                response,
              });
            }
            return Response.json(response);
          }

          if (decision.intent === "NOT_READY" || decision.intent === "UNCLEAR") {
            const landing = await createLandingPage({
              threadId: thread.id,
              eventTypeId: eventType.id,
              inviteeEmail: payload.fromEmail,
              inviteeName,
              introMessage: "I put together a short overview before you pick a time.",
            });
            const baseUrl = getPublicBaseUrl();
            const landingUrl = landing && baseUrl ? `${baseUrl}/ai/${landing.token}` : null;
            if (landingUrl) {
              await sendLandingPageEmail({
                toEmail: payload.fromEmail,
                toName: inviteeName,
                hostName,
                eventTitle: eventType.title,
                landingUrl,
              });
            }

            if (decisionRecordId) {
              await supabaseAdmin
                .from("ai_decisions")
                .update({ decision_status: "landing" })
                .eq("id", decisionRecordId);
            }
            const response = { ok: true, action: "landing" };
            if (idempotencyKey) {
              await storeIdempotencyResponse({
                key: idempotencyKey,
                route: "inbound-email",
                requestHash,
                response,
              });
            }
            return Response.json(response);
          }

          if (decision.intent === "RESCHEDULE") {
            if (!startAtIso) {
              await sendClarification({
                eventTypeId: eventType.id,
                inviteeEmail: payload.fromEmail,
                inviteeName,
                reason: "What day and time should I move the meeting to?",
              });
              if (decisionRecordId) {
                await supabaseAdmin
                  .from("ai_decisions")
                  .update({ decision_status: "clarification" })
                  .eq("id", decisionRecordId);
              }
              const response = { ok: true, action: "clarification" };
              if (idempotencyKey) {
                await storeIdempotencyResponse({
                  key: idempotencyKey,
                  route: "inbound-email",
                  requestHash,
                  response,
                });
              }
              return Response.json(response);
            }

            if (isLowConfidence) {
              await sendLowConfidenceEmail({
                toEmail: payload.fromEmail,
                toName: inviteeName,
                hostName,
                eventTitle: eventType.title,
                proposedLabel: formatZonedLabel(startAtIso, decisionTimezone),
              });
              if (decisionRecordId) {
                await supabaseAdmin
                  .from("ai_decisions")
                  .update({ decision_status: "clarification" })
                  .eq("id", decisionRecordId);
              }
              const response = { ok: true, action: "low_confidence" };
              if (idempotencyKey) {
                await storeIdempotencyResponse({
                  key: idempotencyKey,
                  route: "inbound-email",
                  requestHash,
                  response,
                });
              }
              return Response.json(response);
            }

            const { data: existing } = await supabaseAdmin
              .from("bookings")
              .select("id, invitee_timezone")
              .eq("event_type_id", eventType.id)
              .eq("invitee_email", payload.fromEmail)
              .eq("status", "confirmed")
              .gte("start_at", new Date().toISOString())
              .order("start_at", { ascending: true })
              .maybeSingle();
            if (!existing) {
              await sendClarification({
                eventTypeId: eventType.id,
                inviteeEmail: payload.fromEmail,
                inviteeName,
                reason: "I could not find an existing booking. Please pick a time here.",
              });
              if (decisionRecordId) {
                await supabaseAdmin
                  .from("ai_decisions")
                  .update({ decision_status: "clarification" })
                  .eq("id", decisionRecordId);
              }
              const response = { ok: true, action: "clarification" };
              if (idempotencyKey) {
                await storeIdempotencyResponse({
                  key: idempotencyKey,
                  route: "inbound-email",
                  requestHash,
                  response,
                });
              }
              return Response.json(response);
            }

            await rescheduleBookingCore({
              bookingId: existing.id,
              newStartIso: startAtIso,
              inviteeTimezone: existing.invitee_timezone ?? decisionTimezone,
              source: "email",
            });
            if (decisionRecordId) {
              await supabaseAdmin
                .from("ai_decisions")
                .update({ decision_status: "booked" })
                .eq("id", decisionRecordId);
            }
            const response = { ok: true, action: "rescheduled" };
            if (idempotencyKey) {
              await storeIdempotencyResponse({
                key: idempotencyKey,
                route: "inbound-email",
                requestHash,
                response,
              });
            }
            return Response.json(response);
          }

          if (!startAtIso) {
            await sendClarification({
              eventTypeId: eventType.id,
              inviteeEmail: payload.fromEmail,
              inviteeName,
              reason: "Could you confirm the day and time?",
            });
            if (decisionRecordId) {
              await supabaseAdmin
                .from("ai_decisions")
                .update({ decision_status: "clarification" })
                .eq("id", decisionRecordId);
            }
            const response = { ok: true, action: "clarification" };
            if (idempotencyKey) {
              await storeIdempotencyResponse({
                key: idempotencyKey,
                route: "inbound-email",
                requestHash,
                response,
              });
            }
            return Response.json(response);
          }

          if (isLowConfidence) {
            await sendLowConfidenceEmail({
              toEmail: payload.fromEmail,
              toName: inviteeName,
              hostName,
              eventTitle: eventType.title,
              proposedLabel: formatZonedLabel(startAtIso, decisionTimezone),
            });
            if (decisionRecordId) {
              await supabaseAdmin
                .from("ai_decisions")
                .update({ decision_status: "clarification" })
                .eq("id", decisionRecordId);
            }
            const response = { ok: true, action: "low_confidence" };
            if (idempotencyKey) {
              await storeIdempotencyResponse({
                key: idempotencyKey,
                route: "inbound-email",
                requestHash,
                response,
              });
            }
            return Response.json(response);
          }

          try {
            const result = await createBookingCore({
              eventTypeId: eventType.id,
              startAtIso,
              inviteeName,
              inviteeEmail: payload.fromEmail,
              inviteeNotes: payload.bodyText ?? null,
              inviteeTimezone: decisionTimezone,
              source: "email",
            });
            if (decisionRecordId) {
              await supabaseAdmin
                .from("ai_decisions")
                .update({ decision_status: "booked" })
                .eq("id", decisionRecordId);
            }
            const response = { ok: true, action: "booked", bookingId: result.bookingId };
            if (idempotencyKey) {
              await storeIdempotencyResponse({
                key: idempotencyKey,
                route: "inbound-email",
                requestHash,
                response,
              });
            }
            return Response.json(response);
          } catch (err) {
            const nearest = await findNearestAvailableSlot({
              eventTypeId: eventType.id,
              startAt: new Date(startAtIso),
            });
            if (nearest) {
              const requestedLabel = formatZonedLabel(startAtIso, decisionTimezone);
              const alternativeLabel = formatZonedLabel(nearest.toISOString(), decisionTimezone);
              await sendAlternativeSlotEmail({
                toEmail: payload.fromEmail,
                toName: inviteeName,
                hostName,
                eventTitle: eventType.title,
                requestedLabel,
                alternativeLabel,
              });
            } else {
              await sendClarification({
                eventTypeId: eventType.id,
                inviteeEmail: payload.fromEmail,
                inviteeName,
                reason: err instanceof Error ? err.message : "That time was not available.",
              });
            }
            if (decisionRecordId) {
              await supabaseAdmin
                .from("ai_decisions")
                .update({ decision_status: "clarification" })
                .eq("id", decisionRecordId);
            }
            const response = { ok: true, action: "clarification" };
            if (idempotencyKey) {
              await storeIdempotencyResponse({
                key: idempotencyKey,
                route: "inbound-email",
                requestHash,
                response,
              });
            }
            return Response.json(response);
          }
        } catch (err) {
          if (decisionRecordId) {
            await supabaseAdmin
              .from("ai_decisions")
              .update({
                decision_status: "error",
                error_text: err instanceof Error ? err.message : "unknown_error",
              })
              .eq("id", decisionRecordId);
          }
          await sendClarification({
            eventTypeId: payload.eventTypeId,
            inviteeEmail: payload.fromEmail,
            inviteeName: resolveInviteeName(payload),
            reason: "I had trouble understanding the request. Could you share the time and day?",
          });
          const response = { ok: true, action: "clarification" };
          if (idempotencyKey) {
            await storeIdempotencyResponse({
              key: idempotencyKey,
              route: "inbound-email",
              requestHash,
              response,
            });
          }
          return Response.json(response);
        }
      },
    },
  },
});
