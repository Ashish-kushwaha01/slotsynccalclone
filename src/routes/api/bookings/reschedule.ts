import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { rescheduleBookingCore } from "@/lib/booking-core.server";
import { requireApiUser } from "@/lib/api-auth.server";
import { getIdempotencyResponse, hashRequestBody, storeIdempotencyResponse } from "@/lib/security.server";

const rescheduleSchema = z.object({
  bookingId: z.string().uuid(),
  newStartIso: z.string().datetime(),
  inviteeTimezone: z.string().max(64).optional().nullable(),
});

export const Route = createFileRoute("/api/bookings/reschedule")({
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
            route: "api/bookings/reschedule",
            requestHash,
          });
          if (cached.found) {
            return Response.json(cached.response);
          }
        }

        let payload: z.infer<typeof rescheduleSchema>;
        try {
          payload = rescheduleSchema.parse(JSON.parse(rawBody));
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "invalid payload" },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: booking } = await supabaseAdmin
          .from("bookings")
          .select("id, host_user_id, invitee_timezone")
          .eq("id", payload.bookingId)
          .eq("host_user_id", auth.userId)
          .eq("status", "confirmed")
          .maybeSingle();
        if (!booking) {
          return Response.json({ ok: false, error: "booking_not_found" }, { status: 404 });
        }

        const result = await rescheduleBookingCore({
          bookingId: booking.id,
          newStartIso: payload.newStartIso,
          inviteeTimezone: payload.inviteeTimezone ?? booking.invitee_timezone ?? "UTC",
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
            route: "api/bookings/reschedule",
            requestHash,
            response,
          });
        }
        return Response.json(response);
      },
    },
  },
});
