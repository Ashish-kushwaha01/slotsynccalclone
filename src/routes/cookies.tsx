import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — SlotSync" },
      {
        name: "description",
        content:
          "Details on how SlotSync uses cookies and similar technologies to operate the service.",
      },
    ],
  }),
  component: CookiePolicy,
});

function CookiePolicy() {
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
        <h1 className="text-3xl font-semibold text-foreground">Cookie Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026-08-19</p>

        <section className="mt-8 space-y-4 text-sm text-muted-foreground">
          <p>
            SlotSync uses cookies and similar technologies to keep the service secure and working
            correctly. This policy explains what we use and why.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Essential cookies</h2>
          <p>
            These cookies are required for sign-in, session persistence, and security protections.
            You cannot disable them without breaking core functionality.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
          <p>
            We use limited analytics to understand performance and reliability (e.g., page load
            times and error rates). We do not use these cookies to track you across unrelated
            sites.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Managing cookies</h2>
          <p>
            You can manage cookies in your browser settings. If you block cookies, you may be
            unable to sign in or book meetings.
          </p>

          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p>
            Questions about cookies can be sent to <span className="text-foreground">bda@brithaai.com</span>.
          </p>
        </section>
      </main>
    </div>
  );
}
