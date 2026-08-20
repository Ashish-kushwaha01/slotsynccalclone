import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — SlotSync" },
      {
        name: "description",
        content: "The terms that govern use of SlotSync scheduling services.",
      },
    ],
  }),
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/80 backdrop-blur">
        <div className="container-app flex h-16 items-center justify-between">
          <BrandMark />
          <Link
            to="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Home
          </Link>
        </div>
      </header>

      <main className="container-app max-w-3xl py-12">
        <h1 className="text-3xl font-semibold text-foreground">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026-08-19</p>

        <section className="mt-8 space-y-4 text-sm text-muted-foreground">
          <p>
            These terms govern use of SlotSync. By creating an account or booking a meeting, you
            agree to these terms.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Service overview</h2>
          <p>
            SlotSync provides booking links, availability management, and calendar integration to
            schedule meetings between hosts and invitees.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Accounts</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>You are responsible for the accuracy of your profile and availability.</li>
            <li>Keep login credentials and connected calendar access secure.</li>
            <li>You must be at least 16 years old to create an account.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">Acceptable use</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Do not use SlotSync for unlawful, harmful, or deceptive activity.</li>
            <li>Do not attempt to disrupt or reverse engineer the service.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">Bookings</h2>
          <p>
            Hosts control availability windows and meeting settings. Invitees are responsible for
            providing accurate contact information. Scheduling errors may occur if calendars are
            disconnected or settings are misconfigured.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
          <p>
            When you connect a calendar, you authorize SlotSync to read availability and create
            events on your behalf. You can disconnect integrations at any time.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Availability of service</h2>
          <p>
            We aim for reliable uptime, but the service may be interrupted for maintenance or
            unexpected issues. We are not liable for losses caused by downtime.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Termination</h2>
          <p>
            You may stop using SlotSync at any time. We may suspend accounts that violate these
            terms or present security risks.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Changes</h2>
          <p>
            We may update these terms as the product evolves. If changes are material, we will
            provide notice through the product or email.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p>
            Questions about these terms can be sent to <span className="text-foreground">bda@brithaai.com</span>.
          </p>
        </section>
      </main>
    </div>
  );
}
