import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Valence" },
      {
        name: "description",
        content:
          "How Valence collects, uses, and protects scheduling data for hosts and invitees.",
      },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
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
        <h1 className="text-3xl font-semibold text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026-08-19</p>

        <section className="mt-8 space-y-4 text-sm text-muted-foreground">
          <p>
            Valence helps hosts share booking links and lets invitees schedule meetings without
            back-and-forth. This policy explains what data we collect, how we use it, and your
            choices.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Information we collect</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Account data (name, email, avatar, and time zone) for hosts who create booking pages.
            </li>
            <li>
              Scheduling data such as event type details, availability windows, and booking
              timestamps.
            </li>
            <li>
              Invitee details provided at booking time (name, email, and optional notes).
            </li>
            <li>
              Calendar integration metadata (e.g., connected calendar IDs and access tokens stored
              securely) to check availability and place events.
            </li>
            <li>
              Usage and diagnostic data (page views, errors) to keep the service reliable.
            </li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">How we use information</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Provide scheduling, confirmations, reminders, and webhook notifications.</li>
            <li>Prevent double-bookings by checking connected calendars.</li>
            <li>Maintain security, prevent abuse, and improve product performance.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">Sharing</h2>
          <p>
            Booking details are shared with the host whose link was used. We share data with
            infrastructure providers that help us operate Valence (hosting, email delivery, and
            calendar providers) under strict confidentiality obligations. We do not sell personal
            data.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Retention</h2>
          <p>
            We retain scheduling records as long as the host account is active or as needed to
            provide the service and meet legal obligations. Hosts can remove event types or delete
            their account to remove data.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Your choices</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Hosts can update profile details and availability in Settings.</li>
            <li>Invitees can request corrections by contacting the host directly.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">Security</h2>
          <p>
            We use modern security controls to protect data in transit and at rest. No system is
            perfectly secure, but we continuously monitor and improve our safeguards.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p>
            Questions about privacy can be sent to <span className="text-foreground">bda@brithaai.com</span>.
          </p>
        </section>
      </main>
    </div>
  );
}

