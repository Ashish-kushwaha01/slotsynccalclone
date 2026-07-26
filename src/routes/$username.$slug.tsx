import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createBooking,
  getAvailableSlots,
  getPublicEventType,
} from "@/lib/booking.functions";
import { BrandMark } from "@/components/BrandMark";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/$username/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Book with @${params.username} — SlotSync` },
      { name: "description", content: `Schedule a meeting.` },
    ],
  }),
  component: BookingFlow,
});

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function BookingFlow() {
  const { username, slug } = Route.useParams();
  const navigate = useNavigate();
  const fetchEvent = useServerFn(getPublicEventType);
  const fetchSlots = useServerFn(getAvailableSlots);
  const book = useServerFn(createBooking);

  const eventQ = useQuery({
    queryKey: ["public-event", username, slug],
    queryFn: () => fetchEvent({ data: { username, slug } }),
  });

  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", notes: "" });

  const eventType = eventQ.data?.eventType;
  const inviteeTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  const slotsQ = useQuery({
    queryKey: ["slots", eventType?.id, selectedDate],
    queryFn: () =>
      fetchSlots({ data: { eventTypeId: eventType!.id, date: selectedDate! } }),
    enabled: !!eventType && !!selectedDate,
  });

  const bookMut = useMutation({
    mutationFn: async () => {
      if (!eventType || !selectedSlot) throw new Error("Pick a time first");
      return book({
        data: {
          eventTypeId: eventType.id,
          startAtIso: selectedSlot,
          inviteeName: form.name,
          inviteeEmail: form.email,
          inviteeNotes: form.notes || null,
          inviteeTimezone: inviteeTz,
        },
      });
    },
    onSuccess: (res) => {
      navigate({ to: "/booking/$token", params: { token: res.cancelToken } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const calendarDays = useMemo(() => {
    const first = monthStart;
    const startWeekday = first.getDay();
    const days: Array<{ date: Date; ymd: string; inMonth: boolean }> = [];
    const start = new Date(first);
    start.setDate(first.getDate() - startWeekday);
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({
        date: d,
        ymd: ymd(d),
        inMonth: d.getMonth() === first.getMonth(),
      });
    }
    return days;
  }, [monthStart]);

  if (eventQ.isLoading) {
    return <Shell><div className="h-96 animate-pulse rounded-lg bg-muted" /></Shell>;
  }
  if (!eventQ.data || !eventType) {
    return (
      <Shell>
        <div className="card-surface p-10 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Event not found</h1>
          <Link
            to="/$username"
            params={{ username }}
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            ← Back to @{username}
          </Link>
        </div>
      </Shell>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Shell>
      <Link
        to="/$username"
        params={{ username }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to @{username}
      </Link>

      <div className="card-surface overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[280px_1fr]">
          <div className="border-b border-border p-6 md:border-b-0 md:border-r">
            <div className="text-sm text-muted-foreground">{eventQ.data.profile.display_name}</div>
            <h1 className="mt-1 text-xl font-semibold text-foreground">{eventType.title}</h1>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> {eventType.duration_min} minutes
              </div>
              {eventType.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {eventType.location}
                </div>
              )}
            </div>
            {eventType.description && (
              <p className="mt-4 text-sm text-muted-foreground">{eventType.description}</p>
            )}
          </div>

          <div className="p-6">
            {!selectedSlot ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-semibold text-foreground">
                    {monthStart.toLocaleString(undefined, { month: "long", year: "numeric" })}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))
                      }
                      className="rounded-md border border-border p-1.5 hover:bg-secondary"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() =>
                        setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))
                      }
                      className="rounded-md border border-border p-1.5 hover:bg-secondary"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i} className="py-1">{d}</div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {calendarDays.map((d) => {
                    const disabled = !d.inMonth || d.date < today;
                    const isSelected = selectedDate === d.ymd;
                    return (
                      <button
                        key={d.ymd}
                        disabled={disabled}
                        onClick={() => setSelectedDate(d.ymd)}
                        className={
                          "aspect-square rounded-md text-sm transition " +
                          (disabled
                            ? "text-muted-foreground/40"
                            : isSelected
                              ? "bg-primary font-semibold text-primary-foreground"
                              : "hover:bg-secondary text-foreground")
                        }
                      >
                        {d.date.getDate()}
                      </button>
                    );
                  })}
                </div>

                {selectedDate && (
                  <div className="mt-6">
                    <div className="mb-3 text-sm font-semibold text-foreground">
                      {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                    {slotsQ.isLoading && <div className="text-sm text-muted-foreground">Loading times…</div>}
                    {slotsQ.data?.slots.length === 0 && (
                      <div className="text-sm text-muted-foreground">
                        No available times on this day.
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slotsQ.data?.slots.map((iso) => (
                        <button
                          key={iso}
                          onClick={() => setSelectedSlot(iso)}
                          className="rounded-md border border-border py-2 text-sm font-medium text-foreground transition hover:border-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          {new Date(iso).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Times shown in {inviteeTz}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  bookMut.mutate();
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" /> Change time
                </button>
                <div className="mb-5 rounded-md bg-secondary p-3 text-sm">
                  <div className="font-semibold text-foreground">
                    {new Date(selectedSlot).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                  <div className="text-muted-foreground">
                    {new Date(selectedSlot).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    · {eventType.duration_min} min
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Notes (optional)
                    </label>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={bookMut.isPending}
                    className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {bookMut.isPending ? "Booking…" : "Confirm booking"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="container-app flex h-16 items-center">
          <BrandMark />
        </div>
      </header>
      <main className="container-app max-w-4xl py-10">{children}</main>
    </div>
  );
}
