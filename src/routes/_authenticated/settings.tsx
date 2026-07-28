import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyProfile,
  updateMyProfile,
  getMyAvailability,
  replaceAvailabilityRules,
} from "@/lib/host.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  User,
  Calendar as CalendarIcon,
  Palette,
  Link2,
  Lock,
  Sparkles,
  Users as UsersIcon,
  Briefcase,
  LayoutDashboard,
  UserCog,
  Key,
  Shield,
  CreditCard,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";

const searchSchema = z.object({ tab: z.string().optional() });

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SlotSync" }] }),
  validateSearch: (raw) => searchSchema.parse(raw),
  component: SettingsPage,
});

type TabKey = "profile" | "calendar" | "availability" | "branding" | "mylink" | "privacy" | "ai" | "contacts" | "workspace" | "dashboard" | "people" | "access" | "security" | "billing" | "managed";

const GROUPS: { title: string; items: { key: TabKey; label: string; icon: any }[] }[] = [
  {
    title: "My account",
    items: [
      { key: "profile", label: "Profile", icon: User },
      { key: "calendar", label: "Calendar", icon: CalendarIcon },
      { key: "availability", label: "Availability", icon: Clock },
      { key: "branding", label: "Branding", icon: Palette },
      { key: "mylink", label: "My link", icon: Link2 },
      { key: "privacy", label: "Privacy", icon: Lock },
    ],
  },
  {
    title: "Features",
    items: [
      { key: "ai", label: "AI", icon: Sparkles },
      { key: "contacts", label: "Contacts settings", icon: UsersIcon },
    ],
  },
  {
    title: "Admin",
    items: [
      { key: "workspace", label: "Workspace", icon: Briefcase },
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "people", label: "People", icon: UserCog },
      { key: "access", label: "Access", icon: Key },
      { key: "security", label: "Security", icon: Shield },
      { key: "billing", label: "Billing", icon: CreditCard },
      { key: "managed", label: "Managed events", icon: CalendarIcon },
    ],
  },
];

function SettingsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const active = (search.tab as TabKey) || "profile";
  const setActive = (k: TabKey) => navigate({ search: { tab: k } });

  return (
    <AppShell>
      <div className="flex min-h-screen">
        <aside className="w-64 shrink-0 border-r border-border bg-surface px-3 py-6">
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-4">
              <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.title}
              </div>
              {g.items.map((it) => {
                const Icon = it.icon;
                const isActive = active === it.key;
                return (
                  <button
                    key={it.key}
                    onClick={() => setActive(it.key)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition",
                      isActive
                        ? "bg-sidebar-active text-sidebar-active-foreground"
                        : "text-sidebar-foreground hover:bg-secondary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {it.label}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        <div className="flex-1 overflow-y-auto p-8 md:p-10">
          {active === "profile" && <ProfileTab />}
          {active === "calendar" && <CalendarTab />}
          {active === "availability" && <AvailabilityTab />}
          {(["branding", "mylink", "privacy", "ai", "contacts", "workspace", "dashboard", "people", "access", "security", "billing", "managed"] as TabKey[]).includes(active) && (
            <ComingSoonTab title={GROUPS.flatMap((g) => g.items).find((i) => i.key === active)?.label ?? "Section"} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------- Profile ---------------- */

function ProfileTab() {
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const [sub, setSub] = useState<"general" | "login">("general");
  const q = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const [form, setForm] = useState({
    username: "",
    display_name: "",
    bio: "Welcome to my scheduling page. Please follow the instructions to add an event to my calendar.",
    timezone: "UTC",
    language: "English",
    date_format: "DD/MM/YYYY",
    time_format: "12h (am/pm)",
    country: "India",
  });

  useEffect(() => {
    if (q.data) {
      setForm((f) => ({
        ...f,
        username: q.data!.username,
        display_name: q.data!.display_name,
        bio: q.data!.bio ?? f.bio,
        timezone: q.data!.timezone,
      }));
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          username: form.username,
          display_name: form.display_name,
          bio: form.bio || null,
          timezone: form.timezone,
        },
      }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const timezones =
    typeof Intl !== "undefined" && (Intl as any).supportedValuesOf
      ? ((Intl as any).supportedValuesOf("timeZone") as string[])
      : ["UTC"];

  return (
    <SettingsCard title="Profile">
      <div className="mb-6 flex gap-6 border-b border-border">
        {(["general", "login"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSub(t)}
            className={cn(
              "-mb-px border-b-2 px-1 py-2.5 text-sm font-medium capitalize",
              sub === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {sub === "login" ? (
        <p className="text-sm text-muted-foreground">Password &amp; login settings — coming soon.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
          className="space-y-5"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <button
                type="button"
                onClick={() => toast.info("Avatar upload coming soon")}
                className="btn-outline"
              >
                Upload picture
              </button>
              <p className="mt-1 text-xs text-muted-foreground">JPG, GIF or PNG. Max size of 5MB.</p>
            </div>
          </div>

          <Field label="Username">
            <div className="flex overflow-hidden rounded-md border border-input">
              <span className="bg-muted px-3 py-2 text-sm text-muted-foreground">slotsync.app/</span>
              <input
                required
                pattern="[a-z0-9][a-z0-9-]{2,39}"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                className="flex-1 bg-surface px-3 py-2 text-sm outline-none"
              />
            </div>
          </Field>
          <Field label="Name">
            <input
              required
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Welcome message">
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Language">
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="input">
                <option>English</option>
                <option>Spanish</option>
                <option>French</option>
              </select>
            </Field>
            <Field label="Country">
              <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input">
                <option>India</option>
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Germany</option>
              </select>
            </Field>
            <Field label="Date format">
              <select value={form.date_format} onChange={(e) => setForm({ ...form, date_format: e.target.value })} className="input">
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </Field>
            <Field label="Time format">
              <select value={form.time_format} onChange={(e) => setForm({ ...form, time_format: e.target.value })} className="input">
                <option>12h (am/pm)</option>
                <option>24h</option>
              </select>
            </Field>
          </div>
          <Field label="Time zone">
            <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="input">
              {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>

          <div className="sticky bottom-0 -mx-8 flex justify-end gap-2 border-t border-border bg-surface px-8 py-3">
            <button type="button" onClick={() => q.refetch()} className="btn-outline">Cancel</button>
            <button type="submit" disabled={saveMut.isPending} className="btn-primary">
              {saveMut.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      <style>{`.input{width:100%;border-radius:.375rem;border:1px solid var(--input);background:var(--surface);padding:.5rem .75rem;font-size:.875rem;outline:none;}
      .input:focus{border-color:var(--brand);box-shadow:0 0 0 2px oklch(0.55 0.18 255 / 0.3);}`}</style>
    </SettingsCard>
  );
}

/* ---------------- Calendar ---------------- */

function CalendarTab() {
  const [sub, setSub] = useState<"calendar" | "advanced">("calendar");
  const connected = false; // Placeholder until Google OAuth wired

  return (
    <SettingsCard title="Calendar">
      <div className="mb-6 flex gap-6 border-b border-border">
        {(["calendar", "advanced"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSub(t)}
            className={cn(
              "-mb-px border-b-2 px-1 py-2.5 text-sm font-medium capitalize",
              sub === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {sub === "advanced" ? (
        <p className="text-sm text-muted-foreground">Advanced sync settings — coming soon.</p>
      ) : (
        <div className="space-y-8">
          <div>
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-foreground">Calendars to check for conflicts</div>
                <div className="text-xs text-muted-foreground">These calendars will be used to prevent double bookings</div>
              </div>
              <button
                onClick={() => toast.info("Add GOOGLE_CALENDAR_CLIENT_ID / SECRET to connect")}
                className="btn-outline"
              >
                <Plus className="h-4 w-4" /> Connect calendar account
              </button>
            </div>
            {connected ? (
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-soft text-brand">📅</div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Google Calendar</div>
                    <div className="text-xs text-muted-foreground">you@example.com</div>
                    <a className="text-xs text-brand hover:underline" href="#">Checking 1 calendar</a>
                  </div>
                </div>
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"><Trash2 className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No calendar connected yet.
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-foreground">Calendar to add events to</div>
            <select className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm" disabled>
              <option>Connect a calendar first</option>
            </select>
            <div className="mt-3 text-sm font-semibold text-foreground">Sync settings</div>
            <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" disabled /> Include buffers on this calendar
            </label>
            <label className="mt-1 flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" disabled defaultChecked /> Automatically sync changes from this calendar to SlotSync
            </label>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}

/* ---------------- Availability ---------------- */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Rule = { day_of_week: number; start_time: string; end_time: string };

function AvailabilityTab() {
  const fetchAv = useServerFn(getMyAvailability);
  const saveAv = useServerFn(replaceAvailabilityRules);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-availability"], queryFn: () => fetchAv() });
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    if (q.data) setRules(q.data.rules.map((r: any) => ({ day_of_week: r.day_of_week, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) })));
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => saveAv({ data: { rules } }),
    onSuccess: () => {
      toast.success("Availability saved");
      qc.invalidateQueries({ queryKey: ["my-availability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SettingsCard title="Availability">
      <div className="space-y-2">
        {DAYS.map((day, idx) => {
          const dayRules = rules.filter((r) => r.day_of_week === idx);
          return (
            <div key={idx} className="flex items-start gap-4 rounded-md border border-border px-4 py-3">
              <div className="w-14 pt-1.5 text-sm font-medium text-foreground">{day}</div>
              <div className="flex-1 space-y-2">
                {dayRules.length === 0 && <div className="pt-1.5 text-sm text-muted-foreground">Unavailable</div>}
                {dayRules.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={r.start_time}
                      onChange={(e) => setRules(rules.map((x) => x === r ? { ...x, start_time: e.target.value } : x))}
                      className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
                    />
                    <span className="text-muted-foreground">–</span>
                    <input
                      type="time"
                      value={r.end_time}
                      onChange={(e) => setRules(rules.map((x) => x === r ? { ...x, end_time: e.target.value } : x))}
                      className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => setRules(rules.filter((x) => x !== r))}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setRules([...rules, { day_of_week: idx, start_time: "09:00", end_time: "17:00" }])}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary">
          {save.isPending ? "Saving…" : "Save availability"}
        </button>
      </div>
    </SettingsCard>
  );
}

/* ---------------- Coming soon ---------------- */

function ComingSoonTab({ title }: { title: string }) {
  return (
    <SettingsCard title={title}>
      <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {title} is coming soon.
      </div>
    </SettingsCard>
  );
}

/* ---------------- Shared ---------------- */

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">{title}</h1>
      <div className="rounded-lg bg-surface p-8 shadow-soft">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
