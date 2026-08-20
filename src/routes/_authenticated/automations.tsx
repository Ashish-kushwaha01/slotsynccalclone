import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Workflow } from "lucide-react";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({ meta: [{ title: "Automations — Valence" }] }),
  component: () => (
    <AppShell>
      <div className="mx-auto max-w-5xl p-10">
        <h1 className="text-2xl font-semibold text-foreground">Automations</h1>
        <div className="card-surface mt-6 flex flex-col items-center justify-center gap-3 p-14 text-center">
          <Workflow className="h-10 w-10 text-muted-foreground" />
          <div className="text-lg font-semibold text-foreground">Coming soon</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Connect n8n workflows to send reminders, follow-ups and more.
          </p>
        </div>
      </div>
    </AppShell>
  ),
});

