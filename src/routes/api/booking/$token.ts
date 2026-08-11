import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/booking/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: booking, error } = await supabaseAdmin
          .from("bookings")
          .select("*, event_types(title, duration_min, location)")
          .eq("cancel_token", params.token)
          .maybeSingle();
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        if (!booking) {
          return Response.json({ ok: false, error: "booking_not_found" }, { status: 404 });
        }

        const { data: host } = await supabaseAdmin
          .from("profiles")
          .select("display_name, username, timezone")
          .eq("id", booking.host_user_id)
          .maybeSingle();

        return Response.json({ ok: true, booking: { ...booking, host } });
      },
    },
  },
});
