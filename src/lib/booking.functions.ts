import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { computeAvailableSlots, type BusyInterval, zonedDateToUtc } from "./slots";
import {
  createGoogleCalendarEvent,
  decryptRefreshToken,
  fetchGoogleBusyIntervals,
  getAccessTokenFromRefresh,
} from "./google-calendar.server";

// Public server functions used by the invitee booking flow.
// No auth middleware — anyone can call. Use supabaseAdmin to bypass RLS
// (bookings insert has no anon policy by design).

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// --- Fetch host public profile + one event type by slug ---
export const getPublicEventType = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ username: z.string(), slug: z.string() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url, timezone")
      .eq("username", data.username)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) return null;
    const { data: et, error: etErr } = await supabaseAdmin
      .from("event_types")
      .select("*")
      .eq("user_id", profile.id)
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (etErr) throw new Error(etErr.message);
    if (!et) return null;
    return { profile, eventType: et };
  });

// --- Fetch host profile + all active event types ---
export const getPublicHostPage = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ username: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url, timezone")
      .eq("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) return null;
    const { data: eventTypes, error: etErr } = await supabaseAdmin
      .from("event_types")
      .select("id, slug, title, description, duration_min, color, location")
      .eq("user_id", profile.id)
      .eq("active", true)
      .order("duration_min");
    if (etErr) throw new Error(etErr.message);
    return { profile, eventTypes: eventTypes ?? [] };
  });

// --- Compute slots for a given day ---
export const getAvailableSlots = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ eventTypeId: z.string().uuid(), date: dateSchema }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: et, error: etErr } = await supabaseAdmin
      .from("event_types")
      .select("*")
      .eq("id", data.eventTypeId)
      .eq("active", true)
      .maybeSingle();
    if (etErr) throw new Error(etErr.message);
    if (!et) return { slots: [] as string[] };
    const { data: hostProfile } = await supabaseAdmin
      .from("profiles")
      .select("timezone")
      .eq("id", et.user_id)
      .maybeSingle();
    const hostTimezone = hostProfile?.timezone ?? "UTC";

    const [{ data: rules }, { data: overrides }, { data: existing }] = await Promise.all([
      supabaseAdmin.from("availability_rules").select("*").eq("user_id", et.user_id),
      supabaseAdmin.from("date_overrides").select("*").eq("user_id", et.user_id),
      supabaseAdmin
        .from("bookings")
        .select("start_at, end_at")
        .eq("host_user_id", et.user_id)
        .eq("status", "confirmed")
        .gte("start_at", new Date(data.date + "T00:00:00Z").toISOString())
        .lte("start_at", new Date(data.date + "T23:59:59Z").toISOString()),
    ]);

    const busy: BusyInterval[] = (existing ?? []).map((b) => ({
      start: new Date(b.start_at),
      end: new Date(b.end_at),
    }));

    const dayStartUtc = zonedDateToUtc(data.date, 0, hostTimezone);
    const dayEndUtc = zonedDateToUtc(addDaysYmd(data.date, 1), 0, hostTimezone);
    const googleBusy = await getGoogleCalendarBusyIntervals({
      supabaseAdmin,
      userId: et.user_id,
      timeMinIso: dayStartUtc.toISOString(),
      timeMaxIso: dayEndUtc.toISOString(),
    });
    if (googleBusy.length > 0) busy.push(...googleBusy);

    const slots = computeAvailableSlots({
      date: data.date,
      hostTimezone,
      durationMin: et.duration_min,
      bufferBeforeMin: et.buffer_before_min,
      bufferAfterMin: et.buffer_after_min,
      minNoticeMin: et.min_notice_min,
      maxAdvanceDays: et.max_advance_days,
      rules: rules ?? [],
      overrides: overrides ?? [],
      busy,
    });
    return { slots: slots.map((d) => d.toISOString()) };
  });

// --- Create a booking ---
const bookSchema = z.object({
  eventTypeId: z.string().uuid(),
  startAtIso: z.string().datetime(),
  inviteeName: z.string().min(1).max(120),
  inviteeEmail: z.string().email(),
  inviteeNotes: z.string().max(2000).optional().nullable(),
  inviteeTimezone: z.string().max(64).default("UTC"),
});

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => bookSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: et, error: etErr } = await supabaseAdmin
      .from("event_types")
      .select("*")
      .eq("id", data.eventTypeId)
      .eq("active", true)
      .maybeSingle();
    if (etErr) throw new Error(etErr.message);
    if (!et) throw new Error("Event type not found");

    const startAt = new Date(data.startAtIso);
    const endAt = new Date(startAt.getTime() + et.duration_min * 60_000);

    const { data: hostProfile } = await supabaseAdmin
      .from("profiles")
      .select("timezone, display_name")
      .eq("id", et.user_id)
      .maybeSingle();
    const hostTimezone = hostProfile?.timezone ?? "UTC";

    // Conflict check
    const { data: conflicts } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("host_user_id", et.user_id)
      .eq("status", "confirmed")
      .lt("start_at", endAt.toISOString())
      .gt("end_at", startAt.toISOString());
    if (conflicts && conflicts.length > 0) {
      throw new Error("That time was just taken. Please pick another slot.");
    }

    const googleBusy = await getGoogleCalendarBusyIntervals({
      supabaseAdmin,
      userId: et.user_id,
      timeMinIso: startAt.toISOString(),
      timeMaxIso: endAt.toISOString(),
    });
    const googleConflict = googleBusy.some((b) => b.start < endAt && b.end > startAt);
    if (googleConflict) {
      throw new Error("That time is busy on the host's calendar. Please pick another slot.");
    }

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        event_type_id: et.id,
        host_user_id: et.user_id,
        invitee_name: data.inviteeName,
        invitee_email: data.inviteeEmail,
        invitee_notes: data.inviteeNotes ?? null,
        invitee_timezone: data.inviteeTimezone,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
      })
      .select("id, cancel_token, start_at, end_at")
      .single();
    if (error) throw new Error(error.message);

    // Fire webhook (best-effort)
    const { logAndDispatch } = await import("./webhook.server");
    await logAndDispatch({
      event: "booking.confirmed",
      bookingId: booking.id,
      data: {
        hostUserId: et.user_id,
        eventTypeId: et.id,
        eventTitle: et.title,
        inviteeName: data.inviteeName,
        inviteeEmail: data.inviteeEmail,
        inviteeNotes: data.inviteeNotes,
        startAt: booking.start_at,
        endAt: booking.end_at,
        cancelToken: booking.cancel_token,
      },
    });

    // Send confirmation email to invitee (best-effort).
    const { sendBookingConfirmationEmail } = await import("./email.server");
    const emailResult = await sendBookingConfirmationEmail({
      toEmail: data.inviteeEmail,
      toName: data.inviteeName,
      hostName: hostProfile?.display_name ?? "Host",
      eventTitle: et.title,
      startAtIso: booking.start_at,
      endAtIso: booking.end_at,
      timeZone: data.inviteeTimezone || hostTimezone,
    });
    if (!emailResult.ok) {
      console.warn("Booking confirmation email failed", emailResult.error);
    }

    try {
      const google = await getGoogleCalendarAccessToken({
        supabaseAdmin,
        userId: et.user_id,
      });
      if (google) {
        const description = [
          `Invitee: ${data.inviteeName} <${data.inviteeEmail}>`,
          data.inviteeNotes ? `Notes: ${data.inviteeNotes}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        await createGoogleCalendarEvent({
          accessToken: google.accessToken,
          calendarId: google.calendarId,
          summary: et.title,
          description,
          startIso: startAt.toISOString(),
          endIso: endAt.toISOString(),
          timeZone: hostTimezone,
        });
      }
    } catch (err) {
      console.warn("Google Calendar event create failed", err);
    }

    return { bookingId: booking.id, cancelToken: booking.cancel_token };
  });

async function getGoogleCalendarAccessToken(params: {
  supabaseAdmin: any;
  userId: string;
}): Promise<{ accessToken: string; calendarId?: string } | null> {
  const { data: connection } = await params.supabaseAdmin
    .from("google_calendar_connections")
    .select("connection_key_ciphertext, calendar_id")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (!connection?.connection_key_ciphertext) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const refreshToken = decryptRefreshToken(connection.connection_key_ciphertext);
  const accessToken = await getAccessTokenFromRefresh({
    clientId,
    clientSecret,
    refreshToken,
  });

  return { accessToken, calendarId: connection.calendar_id ?? "primary" };
}

async function getGoogleCalendarBusyIntervals(params: {
  supabaseAdmin: any;
  userId: string;
  timeMinIso: string;
  timeMaxIso: string;
}): Promise<BusyInterval[]> {
  try {
    const google = await getGoogleCalendarAccessToken({
      supabaseAdmin: params.supabaseAdmin,
      userId: params.userId,
    });
    if (!google) return [];

    const busy = await fetchGoogleBusyIntervals({
      accessToken: google.accessToken,
      calendarId: google.calendarId,
      timeMinIso: params.timeMinIso,
      timeMaxIso: params.timeMaxIso,
    });

    return busy.map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }));
  } catch (err) {
    console.warn("Google Calendar freebusy failed", err);
    return [];
  }
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

// --- Look up booking by cancel token (invitee page) ---
export const getBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ token: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("*, event_types(title, duration_min)")
      .eq("cancel_token", data.token)
      .maybeSingle();
    if (!booking) return null;
    const { data: host } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username, timezone")
      .eq("id", booking.host_user_id)
      .maybeSingle();
    return { ...booking, host };
  });

// --- Cancel booking by token ---
export const cancelBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ token: z.string(), reason: z.string().max(500).optional() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled", cancel_reason: data.reason ?? null })
      .eq("cancel_token", data.token)
      .eq("status", "confirmed")
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) throw new Error("Booking not found or already cancelled");

    const { logAndDispatch } = await import("./webhook.server");
    await logAndDispatch({
      event: "booking.cancelled",
      bookingId: booking.id,
      data: {
        hostUserId: booking.host_user_id,
        inviteeEmail: booking.invitee_email,
        startAt: booking.start_at,
        reason: data.reason,
      },
    });
    return { ok: true };
  });
