import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cancelMyBooking, listMyBookings } from "@/lib/host.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarClock,
  Search,
  Filter,
  X,
  MapPin,
  Mail,
  Clock,
  User,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type BookingItem = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  invitee_name: string;
  invitee_email: string;
  invitee_notes: string | null;
  invitee_timezone: string;
  meeting_url?: string | null;
  event_types?: {
    title: string;
    slug: string;
    color: string;
    location?: string | null;
  } | null;
};

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendar — SlotSync" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listMyBookings);
  const [checkingSession, setCheckingSession] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        navigate({ to: "/auth", search: { redirect: "/calendar" }, replace: true });
        return;
      }
      setCheckingSession(false);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  const q = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => listFn(),
    enabled: !checkingSession,
  });

  const now = Date.now();
  const bookings = (q.data ?? []) as BookingItem[];

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return bookings;
    return bookings.filter((b) => {
      const title = b.event_types?.title?.toLowerCase() ?? "";
      return (
        title.includes(term) ||
        b.invitee_name.toLowerCase().includes(term) ||
        b.invitee_email.toLowerCase().includes(term)
      );
    });
  }, [bookings, query]);

  const upcoming = useMemo(
    () =>
      filtered
        .filter((b) => new Date(b.start_at).getTime() >= now)
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [filtered, now],
  );

  const past = useMemo(
    () =>
      filtered
        .filter((b) => new Date(b.start_at).getTime() < now)
        .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()),
    [filtered, now],
  );

  useEffect(() => {
    if (!selectedId) {
      const first = upcoming[0] ?? past[0];
      if (first) setSelectedId(first.id);
    }
  }, [selectedId, upcoming, past]);

  if (checkingSession) {
    return <div className="min-h-screen bg-background" />;
  }

  const selected = bookings.find((b) => b.id === selectedId) ?? null;

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-6xl gap-6 p-6">
        <section className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              Upcoming and past bookings
            </div>
          </div>

          <div className="card-surface mb-5 flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search meetings"
                className="w-full rounded-md border border-input bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <button className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" /> Filter
            </button>
          </div>

          {q.isLoading ? (
            <div className="card-surface p-6 text-sm text-muted-foreground">Loading bookings...</div>
          ) : (
            <div className="space-y-6">
              <BookingGroup
                title="Upcoming"
                items={upcoming}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              <BookingGroup
                title="Past"
                items={past}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          )}
        </section>

        <aside className="w-full max-w-xs shrink-0">
          <div className="card-surface h-full min-h-[420px] p-4">
            {selected ? (
              <BookingPanel booking={selected} onClear={() => setSelectedId(null)} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select a booking to view details.
              </div>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function BookingGroup({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  items: BookingItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="card-surface px-4 py-5 text-sm text-muted-foreground">
        <div className="mb-1 font-semibold text-foreground">{title}</div>
        No meetings to show.
      </div>
    );
  }

  const grouped = items.reduce<Record<string, BookingItem[]>>((acc, item) => {
    const dateKey = new Date(item.start_at).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    acc[dateKey] ??= [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {Object.entries(grouped).map(([date, dayItems]) => (
        <div key={date} className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">{date}</div>
          <div className="space-y-2">
            {dayItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full rounded-md border px-4 py-3 text-left shadow-soft transition",
                  selectedId === item.id
                    ? "border-brand bg-brand-soft"
                    : "border-border bg-surface hover:border-brand/50",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {item.event_types?.title ?? "Meeting"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatTimeRange(item.start_at, item.end_at)} · with {item.invitee_name}
                    </div>
                  </div>
                  <div
                    className="h-8 w-1.5 rounded-full"
                    style={{ backgroundColor: item.event_types?.color ?? "#cbd5f5" }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BookingPanel({ booking, onClear }: { booking: BookingItem; onClear: () => void }) {
  const qc = useQueryClient();
  const cancelFn = useServerFn(cancelMyBooking);
  const [cancelReason, setCancelReason] = useState("");
  const cancelMut = useMutation({
    mutationFn: () =>
      cancelFn({
        data: { bookingId: booking.id, reason: cancelReason.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      setCancelReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startDate = new Date(booking.start_at);
  const date = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = formatTimeRange(booking.start_at, booking.end_at, booking.invitee_timezone);
  const locationLabel = booking.event_types?.location ?? "No location";
  const locationUrl =
    booking.meeting_url ??
    (/^https?:\/\//i.test(locationLabel) ? locationLabel : undefined);
  const isCancelled = booking.status === "cancelled";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {booking.event_types?.title ?? "Meeting"}
          </div>
          <div className="text-xs text-muted-foreground">{date}</div>
          <div className="text-xs text-muted-foreground">{time}</div>
        </div>
        {isCancelled ? (
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
            Cancelled
          </span>
        ) : null}
        <button
          onClick={onClear}
          className="rounded-md border border-border p-1 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground"
          disabled={isCancelled}
        >
          Reschedule
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-destructive"
              disabled={isCancelled}
            >
              Cancel
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the booking as cancelled and store the reason.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Optional reason"
              className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-ring/30"
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelMut.isPending}>Close</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => cancelMut.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={cancelMut.isPending}
              >
                {cancelMut.isPending ? "Cancelling..." : "Cancel booking"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Tabs defaultValue="details" className="pt-1">
        <TabsList className="w-full">
          <TabsTrigger className="flex-1" value="details">
            Details
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="notes">
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <div className="border-t border-border pt-3">
            <div className="text-xs font-semibold text-muted-foreground">Invitee</div>
            <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                {(booking.invitee_name.charAt(0) || "I").toUpperCase()}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{booking.invitee_name}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {booking.invitee_email}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" /> {booking.invitee_timezone || "UTC"}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-3 text-xs">
            <div className="mb-1 font-semibold text-muted-foreground">Location</div>
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                {locationUrl ? (
                  <a
                    href={locationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  >
                    {locationLabel}
                  </a>
                ) : (
                  <span>{locationLabel}</span>
                )}
              </div>
              {locationUrl ? (
                <a
                  href={locationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand-soft px-2 py-1 text-xs font-semibold text-brand"
                >
                  Join meeting <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="mb-1 font-semibold text-muted-foreground">Hosts</div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                You
              </span>
              Host (you)
            </div>
          </div>

          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="mb-1 font-semibold text-muted-foreground">Timeline</div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Event booked by {booking.invitee_name}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="mb-1 font-semibold text-muted-foreground">Questions</div>
            {booking.invitee_notes ? booking.invitee_notes : "No notes"}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatTimeRange(startIso: string, endIso: string, timeZone?: string) {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  const start = new Date(startIso);
  const end = new Date(endIso);
  const tz = timeZone && timeZone.trim().length > 0 ? timeZone : undefined;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", tz ? { ...opts, timeZone: tz } : opts);
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", opts);
  }
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}
