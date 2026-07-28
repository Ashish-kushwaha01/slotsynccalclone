import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelBookingByToken, getBookingByToken } from "@/lib/booking.functions";
import { BrandMark } from "@/components/BrandMark";
import { CheckCircle2, XCircle, Calendar, Clock, Globe, Video, User, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/booking/$token")({
  head: () => ({ meta: [{ title: "You are scheduled — SlotSync" }] }),
  component: BookingDetail,
});

function BookingDetail() {
  const { token } = Route.useParams();
  const fetchBooking = useServerFn(getBookingByToken);
  const cancel = useServerFn(cancelBookingByToken);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["booking", token], queryFn: () => fetchBooking({ data: { token } }) });
  const [reason, setReason] = useState("");

  const cancelMut = useMutation({
    mutationFn: () => cancel({ data: { token, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["booking", token] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Shell><div className="mx-auto h-64 max-w-lg animate-pulse rounded-lg bg-muted" /></Shell>;
  if (!q.data) {
    return (
      <Shell>
        <div className="card-surface mx-auto max-w-lg p-10 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Booking not found</h1>
        </div>
      </Shell>
    );
  }

  const b: any = q.data;
  const cancelled = b.status === "cancelled";
  const start = new Date(b.start_at);
  const end = new Date(b.end_at);

  const timeRange = `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "")} - ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "")}, ${start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`;

  return (
    <Shell>
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          {cancelled ? (
            <XCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          ) : (
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-success">
              <CheckCircle2 className="h-6 w-6 text-success-foreground" />
            </div>
          )}
          <h1 className="mt-3 text-2xl font-semibold text-foreground">
            {cancelled ? "Booking cancelled" : "You are scheduled!"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cancelled
              ? "This booking has been cancelled."
              : "A calendar invitation has been sent to your email address."}
          </p>
          {!cancelled && (
            <button
              onClick={() => toast.info("Calendar invite is delivered via email.")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
            >
              Open Invitation <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="card-surface p-6">
          <div className="mb-4 text-lg font-semibold text-foreground">
            {b.event_types?.title ?? "Meeting"}
          </div>
          <div className="space-y-2.5 text-sm text-foreground">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {b.host?.display_name ?? "your host"}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {timeRange}
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              {b.invitee_timezone || b.host?.timezone || "UTC"}
            </div>
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              Web conferencing details to follow.
            </div>
          </div>
        </div>

        {!cancelled && (
          <div className="mt-8 text-center">
            <details className="text-sm">
              <summary className="cursor-pointer text-brand hover:underline">Need to cancel or reschedule?</summary>
              <div className="mx-auto mt-4 max-w-md">
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Optional reason"
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-ring/30"
                />
                <button
                  onClick={() => confirm("Cancel this booking?") && cancelMut.mutate()}
                  disabled={cancelMut.isPending}
                  className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                >
                  {cancelMut.isPending ? "Cancelling…" : "Cancel booking"}
                </button>
              </div>
            </details>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> A reminder will be sent 24 hours before the meeting.
            </div>
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
      <main className="container-app py-12">{children}</main>
    </div>
  );
}
