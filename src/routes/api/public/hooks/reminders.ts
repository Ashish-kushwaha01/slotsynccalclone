// Reminder cron: called by pg_cron every N minutes. For every confirmed booking
// starting within the next 24h that hasn't been reminded, dispatch a
// `booking.reminder` webhook and flip reminder_sent.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { logAndDispatch } = await import("@/lib/webhook.server");
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const formatZonedDateTime = (iso: string, timeZone: string): string => {
          const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).formatToParts(new Date(iso));
          const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
          return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}`;
        };

        const { data: bookings, error } = await supabaseAdmin
          .from("bookings")
          .select("*, event_types(title, duration_min)")
          .eq("status", "confirmed")
          .eq("reminder_sent", false)
          .gte("start_at", now.toISOString())
          .lte("start_at", in24h.toISOString());
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let sent = 0;
        for (const b of bookings ?? []) {
          const { data: hostProfile } = await supabaseAdmin
            .from("profiles")
            .select("timezone")
            .eq("id", b.host_user_id)
            .maybeSingle();
          const hostTimezone = hostProfile?.timezone ?? "UTC";

          await logAndDispatch({
            event: "booking.reminder",
            bookingId: b.id,
            data: {
              hostUserId: b.host_user_id,
              eventTitle: (b as any).event_types?.title,
              inviteeName: b.invitee_name,
              inviteeEmail: b.invitee_email,
              startAt: b.start_at,
              endAt: b.end_at,
              startAtHostLocal: formatZonedDateTime(b.start_at, hostTimezone),
              endAtHostLocal: formatZonedDateTime(b.end_at, hostTimezone),
              hostTimezone,
              cancelToken: b.cancel_token,
            },
          });
          await supabaseAdmin
            .from("bookings")
            .update({ reminder_sent: true })
            .eq("id", b.id);
          sent++;
        }
        return Response.json({ ok: true, processed: sent });
      },
    },
  },
});
