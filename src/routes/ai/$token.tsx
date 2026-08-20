import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getLandingPage } from "@/lib/ai/landing.functions";
import { BrandMark } from "@/components/BrandMark";
import { CalendarCheck, Clock, Globe, Video } from "lucide-react";

export const Route = createFileRoute("/ai/$token")({
  head: () => ({
    meta: [
      { title: "Valence — Quick Overview" },
      { name: "description", content: "A short overview before booking a meeting." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { token } = Route.useParams();
  const fetchLanding = useServerFn(getLandingPage);
  const query = useQuery({
    queryKey: ["ai-landing", token],
    queryFn: () => fetchLanding({ data: { token } }),
  });

  if (query.isLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl">
          <div className="h-80 animate-pulse rounded-3xl bg-muted" />
        </div>
      </PageShell>
    );
  }

  if (!query.data || !query.data.eventType) {
    return (
      <PageShell>
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-10 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Page unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This overview may have expired. Please reply to the email to get a fresh link.
          </p>
        </div>
      </PageShell>
    );
  }

  const { landing, eventType, host } = query.data;
  const bookingUrl = host?.username && eventType.slug ? `/${host.username}/${eventType.slug}` : "/";
  const timezone = host?.timezone ?? "UTC";

  return (
    <PageShell>
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-lift">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="grid gap-8 p-10 md:grid-cols-[1.1fr_0.9fr] md:p-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
              Valence overview
            </div>
            <h1 className="mt-5 text-3xl font-semibold leading-tight md:text-4xl">
              Hi {landing.invitee_name}, here is a quick look before we meet
            </h1>
            <p className="mt-4 max-w-xl text-sm text-slate-200 md:text-base">
              {landing.intro_message ||
                "This short overview walks you through the agenda, expectations, and what you will leave with."}
            </p>

            <div className="mt-8 grid gap-3 text-sm text-slate-100 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-sky-200" /> {eventType.title}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-sky-200" /> {eventType.duration_min} minutes
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-sky-200" /> {timezone}
              </div>
              {eventType.location ? (
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-sky-200" /> {eventType.location}
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={bookingUrl}
                className="rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-soft transition hover:bg-sky-300"
              >
                Choose a time
              </Link>
              <span className="text-xs text-slate-300">
                Hosted by {host?.display_name ?? "your host"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            {landing.video_url ? (
              <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10">
                <iframe
                  src={landing.video_url}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Overview video"
                />
              </div>
            ) : (
              <div className="flex h-full min-h-[220px] flex-col justify-center gap-4 rounded-xl border border-dashed border-white/20 p-6 text-sm text-slate-200">
                <p className="text-base font-semibold text-white">What to expect</p>
                <ul className="space-y-2 text-sm text-slate-200">
                  <li>• Quick introductions and context.</li>
                  <li>• Walkthrough of the main goal for the meeting.</li>
                  <li>• Next steps and follow-ups.</li>
                </ul>
              </div>
            )}
            {eventType.description ? (
              <p className="mt-5 text-sm text-slate-200">{eventType.description}</p>
            ) : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="container-app flex h-16 items-center">
          <BrandMark />
        </div>
      </header>
      <main className="container-app py-12">{children}</main>
    </div>
  );
}

