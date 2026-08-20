import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ArrowRight, CalendarCheck, Clock, Zap, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Valence — Scheduling without the back-and-forth" },
      {
        name: "description",
        content:
          "Share one link, sync your Google Calendar, and let invitees book meetings that respect your real availability. No double-bookings, ever.",
      },
      { property: "og:title", content: "Valence — Scheduling without the back-and-forth" },
      {
        property: "og:description",
        content: "Share one link, sync your Google Calendar, and let invitees book meetings that respect your real availability. No double-bookings, ever.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setCheckingSession(false);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (checkingSession) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/80 backdrop-blur">
        <div className="container-app flex h-16 items-center justify-between">
          <BrandMark />
          <nav className="flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="container-app grid gap-16 py-20 md:grid-cols-2 md:py-28">
        <div className="flex flex-col justify-center">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Now in Phase 1 · Free while in beta
          </span>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-6xl">
            Scheduling that respects
            <span className="block text-primary">your real calendar.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Share a single booking link. Valence syncs with your Google Calendar,
            enforces your availability rules, and hands off confirmations and
            reminders to your own automation stack.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lift transition-colors hover:bg-primary/90"
            >
              Create your booking link
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              I already have an account
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Email + Google sign-in · No credit card · Cancel anytime
          </p>
        </div>

        <div className="relative">
          <div className="card-surface relative overflow-hidden p-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/SlotSync_Logo.png" alt="" className="h-10 w-10 rounded-lg" />
                <div>
                  <div className="text-sm font-semibold text-foreground">30-min intro call</div>
                  <div className="text-xs text-muted-foreground">with Alex Rivera</div>
                </div>
              </div>
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                Available
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["9:00", "9:30", "10:00", "10:30", "11:00", "13:00", "13:30", "14:00"].map((t, i) => (
                <div
                  key={t}
                  className={
                    i === 3
                      ? "rounded-md bg-primary py-2 text-center text-xs font-semibold text-primary-foreground"
                      : "rounded-md border border-border py-2 text-center text-xs font-medium text-foreground hover:border-primary/50"
                  }
                >
                  {t}
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-md bg-secondary p-4 text-xs text-secondary-foreground">
              <div className="mb-1 font-semibold">Wednesday · Oct 8, 2026</div>
              <div className="text-muted-foreground">Times shown in your timezone (UTC+05:30)</div>
            </div>
          </div>
          <div className="absolute -right-6 -top-6 -z-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 -z-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="container-app grid gap-8 py-16 md:grid-cols-3">
          {[
            {
              icon: CalendarCheck,
              title: "Never double-book",
              desc: "Real-time Google Calendar busy/free check on every slot request.",
            },
            {
              icon: Zap,
              title: "Automate everything after the booking",
              desc: "Every confirmation, reschedule, and reminder fires an HMAC-signed webhook straight to your n8n workflow.",
            },
            {
              icon: ShieldCheck,
              title: "Secure by default",
              desc: "Row-level security, encrypted connection keys, and no shared credentials.",
            },
          ].map((f) => (
            <div key={f.title} className="card-surface p-6">
              <f.icon className="mb-4 h-6 w-6 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="container-app flex flex-col items-center justify-between gap-4 py-8 md:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            © {new Date().getFullYear()} Valence
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/cookies" className="hover:text-foreground">Cookies</Link>
          </div>
          <div className="text-xs text-muted-foreground">Built with care for solo founders and busy teams.</div>
        </div>
      </footer>
    </div>
  );
}


