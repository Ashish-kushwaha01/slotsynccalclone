import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireApiUser } from "@/lib/api-auth.server";
import { getIdempotencyResponse, hashRequestBody, storeIdempotencyResponse } from "@/lib/security.server";

const cancelSchema = z.object({
  bookingId: z.string().uuid().optional(),
  reminderId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/reminders/cancel")({
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
            route: "api/reminders/cancel",
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

        if (!payload.bookingId && !payload.reminderId) {
          return Response.json({ ok: false, error: "missing_identifier" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let cancelled = 0;

        if (payload.reminderId) {
          const { data: job } = await supabaseAdmin
            .from("reminder_jobs")
            .select("id, booking_id, bookings(host_user_id)")
            .eq("id", payload.reminderId)
            .maybeSingle();
          const hostId = (job as any)?.bookings?.host_user_id ?? null;
          if (!job || hostId !== auth.userId) {
            return Response.json({ ok: false, error: "reminder_not_found" }, { status: 404 });
          }

          const { error } = await supabaseAdmin
            .from("reminder_jobs")
            .update({ status: "cancelled" })
            .eq("id", job.id)
            .eq("status", "pending");
          if (error) {
            return Response.json({ ok: false, error: error.message }, { status: 500 });
          }
          cancelled = 1;
        } else if (payload.bookingId) {
          const { data: booking } = await supabaseAdmin
            .from("bookings")
            .select("id, host_user_id")
            .eq("id", payload.bookingId)
            .eq("host_user_id", auth.userId)
            .maybeSingle();
          if (!booking) {
            return Response.json({ ok: false, error: "booking_not_found" }, { status: 404 });
          }

          const { error, count } = await supabaseAdmin
            .from("reminder_jobs")
            .update({ status: "cancelled" }, { count: "exact" })
            .eq("booking_id", payload.bookingId)
            .eq("status", "pending");
          if (error) {
            return Response.json({ ok: false, error: error.message }, { status: 500 });
          }
          cancelled = count ?? 0;
        }

        const response = { ok: true, cancelled };
        if (idempotencyKey) {
          await storeIdempotencyResponse({
            key: idempotencyKey,
            route: "api/reminders/cancel",
            requestHash,
            response,
          });
        }
        return Response.json(response);
      },
    },
  },
});
