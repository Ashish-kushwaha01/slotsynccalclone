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
import { ChevronLeft, ChevronRight, Clock, Video, Globe, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$username/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Book with @${params.username} — SlotSync` },
      { name: "description", content: `Schedule a meeting with @${params.username}.` },
    ],
  }),
  component: BookingFlow,
});

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", notes: "" });

  const eventType = eventQ.data?.eventType;
  const inviteeTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  const slotsQ = useQuery({
    queryKey: ["slots", eventType?.id, selectedDate],
    queryFn: () => fetchSlots({ data: { eventTypeId: eventType!.id, date: selectedDate! } }),
    enabled: !!eventType && !!selectedDate,
  });

  const bookMut = useMutation({
    mutationFn: async () => {
      if (!eventType || !confirmedSlot) throw new Error("Pick a time first");
      return book({
        data: {
          eventTypeId: eventType.id,
          startAtIso: confirmedSlot,
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
    const startWeekday = (first.getDay() + 6) % 7; // Monday-start
    const days: { date: Date; ymd: string; inMonth: boolean }[] = [];
    const start = new Date(first);
    start.setDate(first.getDate() - startWeekday);
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({ date: d, ymd: ymd(d), inMonth: d.getMonth() === first.getMonth() });
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
          <Link to="/$username" params={{ username }} className="mt-4 inline-block link-brand">
            ← Back to @{username}
          </Link>
        </div>
      </Shell>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const step: "pick" | "details" = confirmedSlot ? "details" : "pick";

  return (
    <Shell>
      <div className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface shadow-soft">
          {/* SlotSync corner ribbon */}
          <div className="pointer-events-none absolute right-0 top-0 z-10 hidden sm:block">
            <div className="w-32 -translate-y-3 translate-x-8 rotate-45 bg-primary py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
              Powered by SlotSync
            </div>
          </div>

          <div className="grid gap-0 md:grid-cols-[320px_1fr]">
            {/* Left column — host / event info */}
            <div className="border-b border-border p-8 md:border-b-0 md:border-r">
              {step === "details" && (
                <button
                  onClick={() => setConfirmedSlot(null)}
                  className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-brand hover:bg-secondary"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="text-sm text-muted-foreground">{eventQ.data.profile.display_name}</div>
              <h1 className="mt-1 text-2xl font-semibold text-foreground">{eventType.title}</h1>
              <div className="mt-5 space-y-3 text-sm text-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" /> {eventType.duration_min} min
                </div>
                {eventType.location && (
                  <div className="flex items-start gap-2">
                    <Video className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span>Web conferencing details provided upon confirmation.</span>
                  </div>
                )}
                {step === "details" && confirmedSlot && (
                  <>
                    <div className="flex items-center gap-2 pt-1">
                      📅 <span>
                        {new Date(confirmedSlot).toLocaleString(undefined, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" /> {inviteeTz}
                    </div>
                  </>
                )}
              </div>
              {eventType.description && step === "pick" && (
                <p className="mt-4 text-sm text-muted-foreground">{eventType.description}</p>
              )}
            </div>

            {/* Right column */}
            <div className="p-8">
              {step === "pick" ? (
                <div className="grid gap-8 md:grid-cols-[1fr_auto]">
                  {/* Calendar */}
                  <div>
                    <div className="mb-4 flex items-center justify-center gap-4">
                      <button onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))} className="rounded p-1 hover:bg-secondary">
                        <ChevronLeft className="h-5 w-5 text-brand" />
                      </button>
                      <div className="text-lg font-semibold text-foreground">
                        {monthStart.toLocaleString(undefined, { month: "long", year: "numeric" })}
                      </div>
                      <button onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))} className="rounded p-1 hover:bg-secondary">
                        <ChevronRight className="h-5 w-5 text-brand" />
                      </button>
                    </div>
                    <h2 className="mb-4 text-xl font-semibold text-foreground">Select a Date &amp; Time</h2>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-muted-foreground">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (<div key={d} className="py-1">{d}</div>))}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                      {calendarDays.map((d) => {
                        const disabled = !d.inMonth || d.date < today;
                        const isSelected = selectedDate === d.ymd;
                        const isToday = ymd(new Date()) === d.ymd;
                        return (
                          <button
                            key={d.ymd}
                            disabled={disabled}
                            onClick={() => { setSelectedDate(d.ymd); setPendingSlot(null); }}
                            className={cn(
                              "flex aspect-square items-center justify-center rounded-full text-sm transition",
                              disabled && "text-muted-foreground/30",
                              !disabled && !isSelected && "bg-brand-soft/60 font-medium text-brand hover:bg-brand-soft",
                              isSelected && "bg-brand font-semibold text-brand-foreground",
                              isToday && !isSelected && "ring-1 ring-brand/50",
                            )}
                          >
                            {d.date.getDate()}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-6">
                      <div className="mb-1 text-sm font-semibold text-foreground">Time zone</div>
                      <div className="inline-flex items-center gap-1.5 text-sm text-foreground">
                        <Globe className="h-4 w-4" /> {inviteeTz}
                      </div>
                    </div>
                  </div>

                  {/* Time slots */}
                  {selectedDate && (
                    <div className="w-56">
                      <div className="mb-3 text-sm font-semibold text-foreground">
                        {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                          weekday: "long", month: "long", day: "numeric",
                        })}
                      </div>
                      {slotsQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
                      {slotsQ.data?.slots.length === 0 && (
                        <div className="text-sm text-muted-foreground">No times available.</div>
                      )}
                      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                        {slotsQ.data?.slots.map((iso) => {
                          const isPending = pendingSlot === iso;
                          return (
                            <div key={iso} className={cn("flex gap-2", isPending && "gap-2")}>
                              <button
                                onClick={() => setPendingSlot(isPending ? null : iso)}
                                className={cn(
                                  "flex-1 rounded-md border-2 py-2.5 text-sm font-semibold transition",
                                  isPending
                                    ? "border-muted-foreground bg-muted text-muted-foreground"
                                    : "border-brand text-brand hover:bg-brand-soft",
                                )}
                              >
                                {new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "")}
                              </button>
                              {isPending && (
                                <button
                                  onClick={() => setConfirmedSlot(iso)}
                                  className="flex-1 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
                                >
                                  Next
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); bookMut.mutate(); }} className="max-w-md">
                  <h2 className="mb-5 text-xl font-semibold text-foreground">Enter Details</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Name <span className="text-brand">*</span></label>
                      <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Email <span className="text-brand">*</span></label>
                      <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <button type="button" onClick={() => toast.info("Add guests — coming soon")} className="rounded-full border border-brand px-4 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft">
                      Add guests
                    </button>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Please share anything that will help prepare for our meeting.</label>
                      <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      By proceeding, you confirm that you have read and agree to SlotSync's Participant Terms and Privacy Notice.
                    </p>
                    <button type="submit" disabled={bookMut.isPending} className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60">
                      {bookMut.isPending ? "Scheduling…" : "Schedule Event"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-between px-2 text-xs text-muted-foreground">
          <div className="flex gap-4">
            <a className="link-brand" href="#">Cookie settings</a>
            <a className="link-brand" href="#">Privacy Policy</a>
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
      <main className="container-app py-10">{children}</main>
    </div>
  );
}
