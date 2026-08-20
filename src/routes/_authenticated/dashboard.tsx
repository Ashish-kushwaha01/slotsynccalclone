import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyEventTypes,
  upsertEventType,
  deleteEventType,
  getMyProfile,
} from "@/lib/host.functions";
import { getGoogleCalendarConnection } from "@/lib/calendar.functions";
import { EventTypeDrawer, type EventTypeDraft } from "@/components/EventTypeDrawer";
import { CreateMenu } from "@/components/CreateMenu";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ExternalLink,
  Link2,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Eye,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Scheduling — Valence" }] }),
  component: SchedulingPage,
});

const TABS = ["Event types", "Single-use links", "Meeting polls", "Routing forms"] as const;

function newDraft(googleConnected: boolean): EventTypeDraft {
  return {
    slug: "new-meeting-" + Math.floor(Math.random() * 1000),
    title: "New Meeting",
    description: "",
    duration_min: 30,
    buffer_before_min: 0,
    buffer_after_min: 0,
    min_notice_min: 60,
    max_advance_days: 60,
    location: googleConnected ? "Google Meet" : "Ask invitee",
    color: "#6366f1",
    active: true,
  };
}

function SchedulingPage() {
  const listFn = useServerFn(listMyEventTypes);
  const saveFn = useServerFn(upsertEventType);
  const delFn = useServerFn(deleteEventType);
  const profFn = useServerFn(getMyProfile);
  const calendarFn = useServerFn(getGoogleCalendarConnection);
  const qc = useQueryClient();

  const [tab, setTab] = useState<typeof TABS[number]>("Event types");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<EventTypeDraft | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!menuFor) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-event-menu]")) return;
      setMenuFor(null);
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuFor]);

  const q = useQuery({ queryKey: ["my-event-types"], queryFn: () => listFn() });
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profFn() });
  const calendarQ = useQuery({ queryKey: ["google-calendar-connection"], queryFn: () => calendarFn() });
  const googleConnected = Boolean(calendarQ.data);

  const save = useMutation({
    mutationFn: (draft: EventTypeDraft) => saveFn({ data: draft }),
    onSuccess: () => {
      toast.success("Saved");
      setDrawer(null);
      qc.invalidateQueries({ queryKey: ["my-event-types"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      setDrawer(null);
      qc.invalidateQueries({ queryKey: ["my-event-types"] });
    },
  });

  const filtered = useMemo(
    () => (q.data ?? []).filter((e) => e.title.toLowerCase().includes(search.toLowerCase())),
    [q.data, search],
  );

  useEffect(() => {
    if (!q.data) return;
    const next = new Set<string>();
    q.data.forEach((e) => {
      if (selectedIds.has(e.id)) next.add(e.id);
    });
    if (next.size !== selectedIds.size) setSelectedIds(next);
  }, [q.data, selectedIds]);

  const selectedEvents = useMemo(
    () => (q.data ?? []).filter((e) => selectedIds.has(e.id)),
    [q.data, selectedIds],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelected = () => setSelectedIds(new Set());

  const allSelectedActive = selectedEvents.length > 0 && selectedEvents.every((e) => e.active);
  const allSelectedInactive = selectedEvents.length > 0 && selectedEvents.every((e) => !e.active);
  const nextActive = allSelectedActive ? false : true;
  const toggleLabel = allSelectedActive
    ? "Turn off"
    : allSelectedInactive
      ? "Turn on"
      : "Toggle on/off";

  const username = profileQ.data?.username ?? "";
  const displayName = profileQ.data?.display_name ?? "You";
  const avatarUrl = profileQ.data?.avatar_url ?? null;
  const publicUrl = (slug: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/${username}/${slug}` : "";

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-6 md:p-10">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            Scheduling
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </h1>
          <div className="flex items-center gap-2">
            <Link
              to="/settings"
              search={{ tab: "availability" }}
              className="btn-outline"
            >
              📅 Manage availability
            </Link>
            <CreateMenu
              onCreateOneOnOne={() => setDrawer(newDraft(googleConnected))}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 border-b border-border">
          <div className="flex gap-6">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  if (t !== "Event types") toast.info(`${t} coming soon`);
                }}
                className={cn(
                  "-mb-px border-b-2 px-1 py-2.5 text-sm font-medium transition",
                  t === tab
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event types"
            className="w-full rounded-md border border-input bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {tab !== "Event types" ? (
          <EmptyTab label={tab} />
        ) : (
          <div className="card-surface overflow-visible">
            {/* Host row */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-sm font-semibold text-brand">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${displayName} avatar`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="text-sm font-semibold text-foreground">{displayName}</div>
              </div>
              {username && (
                <a
                  href={`/${username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                >
                  View landing page <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {/* Cards */}
            {q.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-muted-foreground">No event types yet.</p>
                <button className="btn-brand mt-4" onClick={() => setDrawer(newDraft(googleConnected))}>
                  Create your first event type
                </button>
              </div>
            ) : (
              <>
                {selectedIds.size > 0 && (
                  <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
                    <div className="text-muted-foreground">
                      {selectedIds.size} selected
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!confirm("Delete selected event types?")) return;
                          try {
                            await Promise.all(selectedEvents.map((e) => delFn({ data: { id: e.id } })));
                            toast.success("Deleted");
                            clearSelected();
                            qc.invalidateQueries({ queryKey: ["my-event-types"] });
                          } catch (e) {
                            const message = e instanceof Error ? e.message : "Delete failed";
                            toast.error(message);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await Promise.all(
                              selectedEvents.map((e) =>
                                saveFn({ data: { ...(e as EventTypeDraft), active: nextActive } }),
                              ),
                            );
                            toast.success("Updated");
                            clearSelected();
                            qc.invalidateQueries({ queryKey: ["my-event-types"] });
                          } catch (e) {
                            const message = e instanceof Error ? e.message : "Update failed";
                            toast.error(message);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
                      >
                        <Eye className="h-3.5 w-3.5" /> {toggleLabel}
                      </button>
                    </div>
                  </div>
                )}
                <ul className="divide-y divide-border p-4">
                {filtered.map((et) => (
                  <li
                    key={et.id}
                    className={cn(
                      "relative flex items-center gap-4 rounded-md border-l-4 bg-surface px-4 py-4 my-1.5 shadow-soft hover:cursor-pointer",
                      !et.active && "opacity-50",
                    )}
                    style={{ borderLeftColor: et.color }}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input cursor-pointer"
                      checked={selectedIds.has(et.id)}
                      onChange={() => toggleSelected(et.id)}
                    />
                    <button
                      onClick={() => setDrawer({ ...(et as EventTypeDraft) })}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <div className="text-sm font-semibold text-foreground">{et.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {et.duration_min} min · {et.location || "No location"} · One-on-One
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Weekdays, hours vary
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5">
                      {et.active && (
                        <>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(publicUrl(et.slug));
                              toast.success("Link copied");
                            }}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
                          >
                            <Link2 className="h-3.5 w-3.5" /> Copy link
                          </button>
                          <a
                            href={`/${username}/${et.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="cursor-pointer rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <div className="relative" data-event-menu>
                            <button
                              onClick={() => setMenuFor(menuFor === et.id ? null : et.id)}
                              className={cn(
                                "cursor-pointer rounded-md border p-1.5",
                                menuFor === et.id
                                  ? "border-brand bg-brand-soft text-brand"
                                  : "border-border text-muted-foreground hover:bg-secondary",
                              )}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {menuFor === et.id && (
                              <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-md border border-border bg-popover shadow-lift">
                                <MenuItem icon={<Eye className="h-4 w-4" />} onClick={() => window.open(`/${username}/${et.slug}`, "_blank")}>View booking page</MenuItem>
                                <MenuItem icon={<Edit className="h-4 w-4" />} onClick={() => { setMenuFor(null); setDrawer({ ...(et as EventTypeDraft) }); }}>Edit</MenuItem>
                                <MenuItem icon={<Copy className="h-4 w-4" />} onClick={() => {
                                  setMenuFor(null);
                                  setDrawer({ ...(et as EventTypeDraft), id: undefined, slug: et.slug + "-copy", title: et.title + " (copy)" });
                                }}>Duplicate</MenuItem>
                                <div className="border-t border-border" />
                                <MenuItem icon={<Trash2 className="h-4 w-4 text-destructive" />} onClick={() => { setMenuFor(null); if (confirm("Delete this event type?")) del.mutate(et.id); }}>
                                  <span className="text-destructive">Delete</span>
                                </MenuItem>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      <label className="ml-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={et.active}
                          onChange={(e) =>
                            save.mutate({ ...(et as EventTypeDraft), active: e.target.checked })
                          }
                          className="peer sr-only"
                        />
                        <span
                          className={cn(
                            "relative inline-block h-5 w-9 rounded-full border transition",
                            et.active
                              ? "border-brand/30 bg-brand"
                              : "border-border bg-muted",
                          )}
                        >
                          <span className={cn(
                            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition",
                            et.active
                              ? "translate-x-4 bg-surface"
                              : "bg-foreground/30",
                          )} />
                        </span>
                      </label>
                    </div>
                  </li>
                ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      <EventTypeDrawer
        open={!!drawer}
        initial={drawer}
        hostName={displayName}
        onClose={() => setDrawer(null)}
        onSave={(d) => save.mutate(d)}
        onDelete={drawer?.id ? () => del.mutate(drawer.id!) : undefined}
        onPreview={() => drawer && username && window.open(`/${username}/${drawer.slug}`, "_blank")}
        saving={save.isPending}
        googleConnected={googleConnected}
      />
    </AppShell>
  );
}

function MenuItem({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-secondary">
      {icon}
      {children}
    </button>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="card-surface flex flex-col items-center justify-center gap-2 p-14 text-center">
      <div className="text-lg font-semibold text-foreground">{label}</div>
      <p className="max-w-sm text-sm text-muted-foreground">
        This section is on the way. We'll enable it in a future update.
      </p>
    </div>
  );
}

