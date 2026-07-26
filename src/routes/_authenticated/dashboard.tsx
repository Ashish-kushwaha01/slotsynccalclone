import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBookings } from "@/lib/host.functions";
import { getMyProfile } from "@/lib/host.functions";
import { CalendarClock, ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Bookings — SlotSync" }] }),
  component: Dashboard,
});

function Dashboard() {
  const fetchBookings = useServerFn(listMyBookings);
  const fetchProfile = useServerFn(getMyProfile);
  const bookingsQ = useQuery({ queryKey: ["my-bookings"], queryFn: () => fetchBookings() });
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const [copied, setCopied] = useState(false);

  const now = new Date();
  const upcoming = (bookingsQ.data ?? []).filter(
    (b) => b.status === "confirmed" && new Date(b.start_at) >= now,
  );
  const past = (bookingsQ.data ?? []).filter(
    (b) => b.status !== "confirmed" || new Date(b.start_at) < now,
  );

  const bookingUrl =
    typeof window !== "undefined" && profileQ.data
      ? `${window.location.origin}/${profileQ.data.username}`
      : "";

  async function copyLink() {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Your bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything scheduled on your calendar.</p>
        </div>
        {profileQ.data && (
          <div className="card-surface flex items-center gap-3 px-4 py-3">
            <div>
              <div className="text-xs text-muted-foreground">Your booking link</div>
              <div className="font-mono text-sm font-medium text-foreground">
                /{profileQ.data.username}
              </div>
            </div>
            <button
              onClick={copyLink}
              className="rounded-md border border-border p-2 text-muted-foreground hover:bg-secondary"
              title="Copy link"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
            <Link
              to="/$username"
              params={{ username: profileQ.data.username }}
              className="rounded-md border border-border p-2 text-muted-foreground hover:bg-secondary"
              title="Open public page"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Upcoming ({upcoming.length})
        </h2>
        <div className="space-y-2">
          {bookingsQ.isLoading && <SkeletonCards />}
          {!bookingsQ.isLoading && upcoming.length === 0 && (
            <EmptyState message="No upcoming bookings yet. Share your link to get started." />
          )}
          {upcoming.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Past & cancelled
        </h2>
        <div className="space-y-2">
          {past.slice(0, 20).map((b) => (
            <BookingRow key={b.id} booking={b} muted />
          ))}
          {past.length === 0 && <EmptyState message="Nothing here yet." />}
        </div>
      </section>
    </AppShell>
  );
}

function BookingRow({ booking, muted = false }: { booking: any; muted?: boolean }) {
  const start = new Date(booking.start_at);
  return (
    <div
      className={
        "card-surface flex flex-wrap items-center justify-between gap-4 p-4 " +
        (muted ? "opacity-70" : "")
      }
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 flex-col items-center justify-center rounded-md text-primary-foreground"
          style={{ backgroundColor: booking.event_types?.color ?? "var(--color-primary)" }}
        >
          <div className="text-[10px] font-bold uppercase leading-none">
            {start.toLocaleDateString(undefined, { month: "short" })}
          </div>
          <div className="text-lg font-bold leading-tight">{start.getDate()}</div>
        </div>
        <div>
          <div className="font-semibold text-foreground">
            {booking.event_types?.title ?? "Meeting"}
          </div>
          <div className="text-sm text-muted-foreground">
            {start.toLocaleString(undefined, {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · with {booking.invitee_name} ({booking.invitee_email})
          </div>
        </div>
      </div>
      <span
        className={
          "rounded-full px-2.5 py-1 text-xs font-medium " +
          (booking.status === "confirmed"
            ? "bg-success/10 text-success"
            : "bg-muted text-muted-foreground")
        }
      >
        {booking.status}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="card-surface flex items-center gap-3 p-6 text-sm text-muted-foreground">
      <CalendarClock className="h-5 w-5" />
      {message}
    </div>
  );
}

function SkeletonCards() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card-surface h-20 animate-pulse" />
      ))}
    </>
  );
}
