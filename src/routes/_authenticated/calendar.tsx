import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — SlotSync" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-10">
        <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
        <div className="card-surface mt-6 flex flex-col items-center justify-center gap-3 p-14 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground" />
          <div className="text-lg font-semibold text-foreground">Coming soon</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Once you connect Google Calendar in Settings → Calendar, your events will render here.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
