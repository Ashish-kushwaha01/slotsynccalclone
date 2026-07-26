import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAvailability, replaceAvailabilityRules } from "@/lib/host.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/availability")({
  head: () => ({ meta: [{ title: "Availability — SlotSync" }] }),
  component: AvailabilityPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface RuleRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

function AvailabilityPage() {
  const fetchAvail = useServerFn(getMyAvailability);
  const save = useServerFn(replaceAvailabilityRules);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["availability"], queryFn: () => fetchAvail() });
  const [rules, setRules] = useState<RuleRow[]>([]);

  useEffect(() => {
    if (q.data) {
      setRules(
        q.data.rules.map((r) => ({
          day_of_week: r.day_of_week,
          start_time: r.start_time.slice(0, 5),
          end_time: r.end_time.slice(0, 5),
        })),
      );
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: { rules } }),
    onSuccess: () => {
      toast.success("Availability saved");
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addRule(day: number) {
    setRules([...rules, { day_of_week: day, start_time: "09:00", end_time: "17:00" }]);
  }

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Availability</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            When are you open to accept meetings?
          </p>
        </div>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || q.isLoading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saveMut.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="card-surface divide-y divide-border">
        {DAYS.map((label, day) => {
          const dayRules = rules.filter((r) => r.day_of_week === day);
          return (
            <div key={day} className="flex flex-wrap items-start gap-4 p-4">
              <div className="w-16 pt-2 text-sm font-semibold text-foreground">{label}</div>
              <div className="flex-1 space-y-2">
                {dayRules.length === 0 && (
                  <div className="text-sm text-muted-foreground">Unavailable</div>
                )}
                {dayRules.map((r, idx) => {
                  const globalIdx = rules.indexOf(r);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={r.start_time}
                        onChange={(e) => {
                          const next = [...rules];
                          next[globalIdx] = { ...r, start_time: e.target.value };
                          setRules(next);
                        }}
                        className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
                      />
                      <span className="text-muted-foreground">–</span>
                      <input
                        type="time"
                        value={r.end_time}
                        onChange={(e) => {
                          const next = [...rules];
                          next[globalIdx] = { ...r, end_time: e.target.value };
                          setRules(next);
                        }}
                        className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
                      />
                      <button
                        onClick={() => setRules(rules.filter((_, i) => i !== globalIdx))}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => addRule(day)}
                className="rounded-md border border-border p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
