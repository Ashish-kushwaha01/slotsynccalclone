import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createBookingCore } from "@/lib/booking-core.server";
import { requireApiUser } from "@/lib/api-auth.server";
import { getIdempotencyResponse, hashRequestBody, storeIdempotencyResponse } from "@/lib/security.server";

const bookSchema = z.object({
  eventTypeId: z.string().uuid(),
  startAtIso: z.string().datetime(),
  inviteeName: z.string().min(1).max(120),
  inviteeEmail: z.string().email(),
  inviteeNotes: z.string().max(2000).optional().nullable(),
  inviteeTimezone: z.string().max(64).optional().nullable(),
});

export const Route = createFileRoute("/api/bookings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = requireApiUser(request);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const rawBody = await request.text();
        const requestHash = hashRequestBody(rawBody);
        const idempotencyKey = request.headers.get("idempotency-key") ?? "";
        if (idempotencyKey) {
          const cached = await getIdempotencyResponse({
            key: idempotencyKey,
            route: "api/bookings",
            requestHash,
          });
          if (cached.found) {
            return Response.json(cached.response);
          }
        }

        let payload: z.infer<typeof bookSchema>;
        try {
          payload = bookSchema.parse(JSON.parse(rawBody));
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "invalid payload" },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: eventType } = await supabaseAdmin
          .from("event_types")
          .select("id, user_id")
          .eq("id", payload.eventTypeId)
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (!eventType) {
          return Response.json({ ok: false, error: "event_type_not_found" }, { status: 404 });
        }

        const result = await createBookingCore({
          eventTypeId: payload.eventTypeId,
          startAtIso: payload.startAtIso,
          inviteeName: payload.inviteeName,
          inviteeEmail: payload.inviteeEmail,
          inviteeNotes: payload.inviteeNotes ?? null,
          inviteeTimezone: payload.inviteeTimezone ?? "UTC",
          source: "api",
        });

        const response = {
          ok: true,
          bookingId: result.bookingId,
          cancelToken: result.cancelToken,
          rescheduleToken: result.rescheduleToken,
          meetingUrl: result.meetingUrl,
        };
        if (idempotencyKey) {
          await storeIdempotencyResponse({
            key: idempotencyKey,
            route: "api/bookings",
            requestHash,
            response,
          });
        }
        return Response.json(response);
      },
    },
  },
});
