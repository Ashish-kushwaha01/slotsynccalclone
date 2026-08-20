import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Contact } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({ meta: [{ title: "Contacts — Valence" }] }),
  component: () => (
    <AppShell>
      <div className="mx-auto max-w-5xl p-10">
        <h1 className="text-2xl font-semibold text-foreground">Contacts</h1>
        <div className="card-surface mt-6 flex flex-col items-center justify-center gap-3 p-14 text-center">
          <Contact className="h-10 w-10 text-muted-foreground" />
          <div className="text-lg font-semibold text-foreground">Coming soon</div>
          <p className="max-w-sm text-sm text-muted-foreground">Manage everyone you've booked with in one place.</p>
        </div>
      </div>
    </AppShell>
  ),
});

