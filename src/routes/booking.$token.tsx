import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelBookingByToken, getBookingByToken } from "@/lib/booking.functions";
import { BrandMark } from "@/components/BrandMark";
import { CheckCircle2, XCircle, Calendar, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/booking/$token")({
  head: () => ({ meta: [{ title: "Your booking — SlotSync" }] }),
  component: BookingDetail,
});

function BookingDetail() {
  const { token } = Route.useParams();
  const fetchBooking = useServerFn(getBookingByToken);
  const cancel = useServerFn(cancelBookingByToken);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["booking", token],
    queryFn: () => fetchBooking({ data: { token } }),
  });
  const [reason, setReason] = useState("");

  const cancelMut = useMutation({
    mutationFn: () => cancel({ data: { token, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["booking", token] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Shell><div className="h-64 animate-pulse rounded-lg bg-muted" /></Shell>;
  if (!q.data) {
    return (
      <Shell>
        <div className="card-surface p-10 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Booking not found</h1>
        </div>
      </Shell>
    );
  }

  const b: any = q.data;
  const cancelled = b.status === "cancelled";
  const start = new Date(b.start_at);

  return (
    <Shell>
      <div className="card-surface p-8">
        <div className="mb-6 flex items-center gap-3">
          {cancelled ? (
            <XCircle className="h-8 w-8 text-muted-foreground" />
          ) : (
            <CheckCircle2 className="h-8 w-8 text-success" />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {cancelled ? "Booking cancelled" : "You're booked!"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {cancelled
                ? "This booking has been cancelled."
                : "A confirmation is on its way."}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-border p-4">
          <div className="text-lg font-semibold text-foreground">
            {b.event_types?.title ?? "Meeting"}
          </div>
          <div className="text-sm text-muted-foreground">
            with {b.host?.display_name ?? "your host"}
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {start.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} ·{" "}
            {b.event_types?.duration_min ?? ""} min
          </div>
        </div>

        {!cancelled && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-foreground">Need to cancel?</h2>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason for cancellation"
              className="mt-2 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
            <button
              onClick={() => confirm("Cancel this booking?") && cancelMut.mutate()}
              disabled={cancelMut.isPending}
              className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              {cancelMut.isPending ? "Cancelling…" : "Cancel booking"}
            </button>
          </div>
        )}
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
      <main className="container-app max-w-2xl py-12">{children}</main>
    </div>
  );
}
