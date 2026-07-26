import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile } from "@/lib/host.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SlotSync" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const [form, setForm] = useState({ username: "", display_name: "", bio: "", timezone: "UTC" });

  useEffect(() => {
    if (q.data) {
      setForm({
        username: q.data.username,
        display_name: q.data.display_name,
        bio: q.data.bio ?? "",
        timezone: q.data.timezone,
      });
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

  const commonTimezones =
    typeof Intl !== "undefined" && (Intl as any).supportedValuesOf
      ? (Intl as any).supportedValuesOf("timeZone") as string[]
      : ["UTC"];

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your public profile and timezone.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMut.mutate();
        }}
        className="card-surface max-w-2xl space-y-4 p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Username</label>
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
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Display name</label>
          <input
            required
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Bio</label>
          <textarea
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Timezone</label>
          <select
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          >
            {commonTimezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saveMut.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saveMut.isPending ? "Saving…" : "Save profile"}
        </button>
      </form>
    </AppShell>
  );
}
