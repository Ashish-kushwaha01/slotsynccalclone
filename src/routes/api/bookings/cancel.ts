import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { cancelBookingCore } from "@/lib/booking-core.server";
import { requireApiUser } from "@/lib/api-auth.server";
import { getIdempotencyResponse, hashRequestBody, storeIdempotencyResponse } from "@/lib/security.server";

const cancelSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
});

export const Route = createFileRoute("/api/bookings/cancel")({
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
            route: "api/bookings/cancel",
            requestHash,
          });
          if (cached.found) {
            return Response.json(cached.response);
          }
        }

        let payload: z.infer<typeof cancelSchema>;
        try {
          payload = cancelSchema.parse(JSON.parse(rawBody));
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "invalid payload" },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: booking } = await supabaseAdmin
          .from("bookings")
          .select("id, host_user_id")
          .eq("id", payload.bookingId)
          .eq("host_user_id", auth.userId)
          .eq("status", "confirmed")
          .maybeSingle();
        if (!booking) {
          return Response.json({ ok: false, error: "booking_not_found" }, { status: 404 });
        }

        const result = await cancelBookingCore({
          bookingId: booking.id,
          reason: payload.reason ?? null,
          source: "api",
        });
        if (!result.ok) {
          return Response.json({ ok: false, error: result.error }, { status: 400 });
        }

        const response = { ok: true };
        if (idempotencyKey) {
          await storeIdempotencyResponse({
            key: idempotencyKey,
            route: "api/bookings/cancel",
            requestHash,
            response,
          });
        }
        return Response.json(response);
      },
    },
  },
});
