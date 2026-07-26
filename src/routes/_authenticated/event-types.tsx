import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteEventType,
  listMyEventTypes,
  upsertEventType,
} from "@/lib/host.functions";
import { useState } from "react";
import { Plus, Pencil, Trash2, Clock, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/event-types")({
  head: () => ({ meta: [{ title: "Event types — SlotSync" }] }),
  component: EventTypesPage,
});

type EventType = Awaited<ReturnType<typeof listMyEventTypes>>[number];

function EventTypesPage() {
  const fetchList = useServerFn(listMyEventTypes);
  const upsert = useServerFn(upsertEventType);
  const del = useServerFn(deleteEventType);
  const qc = useQueryClient();
  const listQ = useQuery({ queryKey: ["event-types"], queryFn: () => fetchList() });
  const [editing, setEditing] = useState<Partial<EventType> | null>(null);

  const saveMut = useMutation({
    mutationFn: (data: any) => upsert({ data }),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["event-types"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["event-types"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Event types</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Meeting formats invitees can book with you.
          </p>
        </div>
        <button
          onClick={() =>
            setEditing({
              title: "",
              slug: "",
              duration_min: 30,
              buffer_before_min: 0,
              buffer_after_min: 0,
              min_notice_min: 120,
              max_advance_days: 60,
              active: true,
              color: "#0f6d8a",
            })
          }
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New event type
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {listQ.isLoading && [0, 1].map((i) => <div key={i} className="card-surface h-40 animate-pulse" />)}
        {listQ.data?.length === 0 && (
          <div className="card-surface p-8 text-center text-sm text-muted-foreground md:col-span-2">
            No event types yet. Create your first one to start receiving bookings.
          </div>
        )}
        {listQ.data?.map((et) => (
          <div key={et.id} className="card-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className="mt-1 h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: et.color }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{et.title}</h3>
                    {!et.active && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {et.duration_min} min
                    </span>
                    {et.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {et.location}
                      </span>
                    )}
                    <span className="font-mono text-xs">/{et.slug}</span>
                  </div>
                  {et.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{et.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditing(et)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => confirm("Delete this event type?") && delMut.mutate(et.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditorDialog
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(data) => saveMut.mutate(data)}
          saving={saveMut.isPending}
        />
      )}
    </AppShell>
  );
}

function EditorDialog({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<EventType>;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    id: initial.id,
    title: initial.title ?? "",
    slug: initial.slug ?? "",
    description: initial.description ?? "",
    duration_min: initial.duration_min ?? 30,
    buffer_before_min: initial.buffer_before_min ?? 0,
    buffer_after_min: initial.buffer_after_min ?? 0,
    min_notice_min: initial.min_notice_min ?? 120,
    max_advance_days: initial.max_advance_days ?? 60,
    location: initial.location ?? "",
    active: initial.active ?? true,
    color: initial.color ?? "#0f6d8a",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...form,
            description: form.description || null,
            location: form.location || null,
          });
        }}
        className="card-surface w-full max-w-lg space-y-4 p-6"
      >
        <h2 className="text-xl font-semibold text-foreground">
          {initial.id ? "Edit event type" : "New event type"}
        </h2>
        <Field label="Title">
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="URL slug" hint="What appears in your booking URL, e.g. /you/intro-call">
          <input
            required
            pattern="[a-z0-9][a-z0-9-]{0,49}"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
            className={inputCls}
          />
        </Field>
        <Field label="Description">
          <textarea
            rows={2}
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration (min)">
            <input
              type="number"
              min={5}
              max={480}
              value={form.duration_min}
              onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Color">
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="h-10 w-full rounded-md border border-input"
            />
          </Field>
          <Field label="Buffer before (min)">
            <input
              type="number"
              min={0}
              max={120}
              value={form.buffer_before_min}
              onChange={(e) => setForm({ ...form, buffer_before_min: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Buffer after (min)">
            <input
              type="number"
              min={0}
              max={120}
              value={form.buffer_after_min}
              onChange={(e) => setForm({ ...form, buffer_after_min: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Min notice (min)">
            <input
              type="number"
              min={0}
              value={form.min_notice_min}
              onChange={(e) => setForm({ ...form, min_notice_min: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Max advance (days)">
            <input
              type="number"
              min={1}
              max={365}
              value={form.max_advance_days}
              onChange={(e) => setForm({ ...form, max_advance_days: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Location (optional)">
          <input
            value={form.location ?? ""}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Google Meet, phone number, address…"
            className={inputCls}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Active (visible on your booking page)
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
