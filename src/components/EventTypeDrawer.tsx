import { useEffect, useState } from "react";
import { X, ChevronDown, ChevronUp, Clock, Video, MapPin, Users, Calendar as CalIcon, Info, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type EventTypeDraft = {
  id?: string;
  slug: string;
  title: string;
  description?: string | null;
  duration_min: number;
  buffer_before_min: number;
  buffer_after_min: number;
  min_notice_min: number;
  max_advance_days: number;
  location?: string | null;
  color: string;
  active: boolean;
};

const LOCATIONS = [
  { key: "Google Meet", icon: "🟢" },
  { key: "Zoom", icon: "🔵" },
  { key: "Microsoft Teams", icon: "🟣" },
  { key: "Webex", icon: "🟢" },
  { key: "GoToMeeting", icon: "🟠" },
  { key: "Phone call", icon: "📞" },
  { key: "In-person", icon: "📍" },
  { key: "Custom", icon: "✏️" },
  { key: "Ask invitee", icon: "❓" },
];

export function EventTypeDrawer({
  open,
  initial,
  hostName,
  onClose,
  onSave,
  onDelete,
  onPreview,
  saving,
}: {
  open: boolean;
  initial: EventTypeDraft | null;
  hostName: string;
  onClose: () => void;
  onSave: (draft: EventTypeDraft) => void;
  onDelete?: () => void;
  onPreview?: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<EventTypeDraft | null>(initial);
  const [showMore, setShowMore] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    setDraft(initial);
    setShowMore(false);
    setSlugManuallyEdited(false);
  }, [initial, open]);

  if (!open || !draft) return null;

  const update = (patch: Partial<EventTypeDraft>) => setDraft({ ...draft, ...patch });

  const toSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="flex h-full w-full max-w-[420px] flex-col bg-surface shadow-drawer">
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Event type</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: draft.color }} />
              <div className="min-w-0 flex-1 text-xl font-semibold text-foreground">
                {draft.title || "Untitled event"}
              </div>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">One-on-One</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-border px-5 py-4">
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Event name</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => {
                const nextTitle = e.target.value;
                if (!slugManuallyEdited) {
                  const nextSlug = toSlug(nextTitle);
                  update({ title: nextTitle, slug: nextSlug || draft.slug });
                  return;
                }
                update({ title: nextTitle });
              }}
              className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-ring/30"
              placeholder="Event name"
            />
          </div>
          <Section title="Duration" icon={<Clock className="h-4 w-4" />} value={`${draft.duration_min} min`} defaultOpen>
            <div className="flex flex-wrap gap-2">
              {[15, 30, 45, 60, 90].map((n) => (
                <button
                  key={n}
                  onClick={() => update({ duration_min: n })}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm",
                    draft.duration_min === n
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  {n} min
                </button>
              ))}
              <input
                type="number"
                min={5}
                max={480}
                value={draft.duration_min}
                onChange={(e) => update({ duration_min: Number(e.target.value) || 30 })}
                className="w-20 rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
              />
            </div>
          </Section>

          <Section title="Location" icon={<Video className="h-4 w-4" />} value={draft.location ?? "Select location"} defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              {LOCATIONS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => update({ location: l.key })}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
                    draft.location === l.key
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  <span>{l.icon}</span>
                  <span className="truncate">{l.key}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Conferencing details provided after booking completion.
            </p>
          </Section>

          <Section title="Availability" icon={<CalIcon className="h-4 w-4" />} value="Weekdays, hours vary">
            <p className="text-sm text-muted-foreground">
              Manage your working hours from{" "}
              <a href="/settings" className="link-brand">Settings → Availability</a>.
            </p>
          </Section>

          <Section title="Host" icon={<Users className="h-4 w-4" />} value={`${hostName} (you)`}>
            <p className="text-sm text-muted-foreground">Only you can be the host on One-on-One events.</p>
          </Section>

          {/* More options */}
          <button
            onClick={() => setShowMore((v) => !v)}
            className="flex w-full items-center justify-between border-t border-border px-5 py-3 text-sm font-medium text-brand hover:bg-brand-soft/50"
          >
            <span>{showMore ? "Hide" : "More"} options</span>
            {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showMore && (
            <>
              <Section title="Description" icon={<Info className="h-4 w-4" />} value="Tell your invitees what this meeting is about" defaultOpen>
                <textarea
                  rows={3}
                  value={draft.description ?? ""}
                  onChange={(e) => update({ description: e.target.value })}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-ring/30"
                  placeholder="Add a short description…"
                />
              </Section>

              <Section title="Limits and buffers" icon={<Clock className="h-4 w-4" />} value="Buffer times, max limits" defaultOpen>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Buffer before (min)" value={draft.buffer_before_min} onChange={(v) => update({ buffer_before_min: v })} />
                  <NumberField label="Buffer after (min)" value={draft.buffer_after_min} onChange={(v) => update({ buffer_after_min: v })} />
                  <NumberField label="Min notice (min)" value={draft.min_notice_min} onChange={(v) => update({ min_notice_min: v })} />
                  <NumberField label="Max advance (days)" value={draft.max_advance_days} onChange={(v) => update({ max_advance_days: v })} />
                </div>
              </Section>

              <Section title="Booking page options" icon={<ExternalLink className="h-4 w-4" />} value={`/${draft.slug} · ${draft.duration_min} min increments`} defaultOpen>
                <label className="mb-1 block text-xs font-medium text-foreground">URL slug</label>
                <div className="flex overflow-hidden rounded-md border border-input">
                  <span className="bg-muted px-2.5 py-2 text-xs text-muted-foreground">slotsync.app/…/</span>
                  <input
                    value={draft.slug}
                    onChange={(e) => {
                      setSlugManuallyEdited(true);
                      update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") });
                    }}
                    className="flex-1 bg-surface px-2 py-2 text-sm outline-none"
                  />
                </div>
                <label className="mt-3 mb-1 block text-xs font-medium text-foreground">Event color</label>
                <div className="flex flex-wrap gap-2">
                  {["#6366f1", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#0ea5e9"].map((c) => (
                    <button
                      key={c}
                      onClick={() => update({ color: c })}
                      className={cn(
                        "h-6 w-6 rounded-full border-2",
                        draft.color === c ? "border-foreground" : "border-transparent",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </Section>

              <ComingSoonSection title="Free/busy rules" hint="Allow invitees to book over selected meetings on your calendar." />
              <ComingSoonSection title="Invitee form" hint="Asking for name, email, +1 question" />
              <ComingSoonSection title="Payment" hint="Collect payment for your event" />
              <ComingSoonSection title="Notifications and automations" hint="Calendar invitations" />
              <ComingSoonSection title="Confirmation page" hint="Display confirmation page" />
            </>
          )}
        </div>

        {/* Sticky footer */}
        <div className="flex items-center justify-between border-t border-border bg-surface px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onPreview}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Preview
            </button>
            {onDelete && (
              <button
                onClick={() => confirm("Delete this event type?") && onDelete()}
                className="ml-4 text-sm text-destructive hover:underline"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-outline">
              Cancel
            </button>
            <button
              disabled={saving}
              onClick={() => {
                if (!draft.title.trim() || !draft.slug.trim()) {
                  toast.error("Title and URL slug are required");
                  return;
                }
                onSave(draft);
              }}
              className="btn-primary"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  value,
  defaultOpen,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  value?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-t border-border">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-secondary/40">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {value && <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{value}</span></div>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

function ComingSoonSection({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="border-t border-border px-5 py-3 opacity-70">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">Soon</span>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-md border border-input bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-ring/30"
      />
    </div>
  );
}
