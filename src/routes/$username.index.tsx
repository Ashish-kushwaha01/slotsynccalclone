import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublicHostPage } from "@/lib/booking.functions";
import { BrandMark } from "@/components/BrandMark";
import { Clock, MapPin, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/$username/")({
  head: ({ params }) => ({
    meta: [
      { title: `Book time with @${params.username} — Valence` },
      {
        name: "description",
        content: `Schedule a meeting with @${params.username} using Valence.`,
      },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const { username } = Route.useParams();
  const fetchPage = useServerFn(getPublicHostPage);
  const q = useQuery({
    queryKey: ["public-host", username],
    queryFn: () => fetchPage({ data: { username } }),
  });

  if (q.isLoading) {
    return <PublicShell><div className="h-64 animate-pulse rounded-lg bg-muted" /></PublicShell>;
  }
  if (!q.data) {
    return (
      <PublicShell>
        <div className="card-surface p-10 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Host not found</h1>
          <p className="mt-2 text-muted-foreground">No Valence account uses @{username}.</p>
        </div>
      </PublicShell>
    );
  }

  const { profile, eventTypes } = q.data;
  return (
    <PublicShell>
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={`${profile.display_name} avatar`}
              className="h-full w-full object-cover"
            />
          ) : (
            profile.display_name.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{profile.display_name}</h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
        </div>
      </div>
      {profile.bio && <p className="mb-8 max-w-xl text-muted-foreground">{profile.bio}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {eventTypes.length === 0 && (
          <div className="card-surface p-6 text-sm text-muted-foreground sm:col-span-2">
            This host doesn't have any bookable event types yet.
          </div>
        )}
        {eventTypes.map((et) => (
          <Link
            key={et.id}
            to="/$username/$slug"
            params={{ username, slug: et.slug }}
            className="card-surface group flex items-center justify-between gap-4 p-5 transition hover:border-primary hover:shadow-lift"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: et.color }} />
                <h3 className="font-semibold text-foreground">{et.title}</h3>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {et.duration_min} min
                </span>
                {et.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {et.location}
                  </span>
                )}
              </div>
              {et.description && (
                <p className="mt-2 text-sm text-muted-foreground">{et.description}</p>
              )}
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="container-app flex h-16 items-center justify-between">
          <BrandMark />
        </div>
      </header>
      <main className="container-app max-w-3xl py-12">{children}</main>
    </div>
  );
}

