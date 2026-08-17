import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireApiUser } from "@/lib/api-auth.server";
import { getIdempotencyResponse, hashRequestBody, storeIdempotencyResponse } from "@/lib/security.server";

const reminderSchema = z.object({
  bookingId: z.string().uuid(),
  sendAtIso: z.string().datetime(),
  template: z.enum(["1h", "15m", "1m"]),
});

export const Route = createFileRoute("/api/reminders/create")({
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
            route: "api/reminders/create",
            requestHash,
          });
          if (cached.found) {
            return Response.json(cached.response);
          }
        }

        let payload: z.infer<typeof reminderSchema>;
        try {
          payload = reminderSchema.parse(JSON.parse(rawBody));
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
          .maybeSingle();
        if (!booking) {
          return Response.json({ ok: false, error: "booking_not_found" }, { status: 404 });
        }

        const { data: reminder, error } = await supabaseAdmin
          .from("reminder_jobs")
          .insert({
            booking_id: payload.bookingId,
            send_at: payload.sendAtIso,
            template: payload.template,
            status: "pending",
          })
          .select("id")
          .single();
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const response = { ok: true, reminderId: reminder.id };
        if (idempotencyKey) {
          await storeIdempotencyResponse({
            key: idempotencyKey,
            route: "api/reminders/create",
            requestHash,
            response,
          });
        }
        return Response.json(response);
      },
    },
  },
});
