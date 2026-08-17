import { createFileRoute } from "@tanstack/react-router";
import { requireApiUser } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/bookings/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = requireApiUser(request);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: booking, error } = await supabaseAdmin
          .from("bookings")
          .select("*, event_types(title, duration_min, location)")
          .eq("id", params.id)
          .eq("host_user_id", auth.userId)
          .maybeSingle();
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        if (!booking) {
          return Response.json({ ok: false, error: "booking_not_found" }, { status: 404 });
        }

        return Response.json({ ok: true, booking });
      },
    },
  },
});
