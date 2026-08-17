import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

function buildUsername(seed: string, userId: string): string {
  const cleaned = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (cleaned.length >= 3) {
    return cleaned.slice(0, 40);
  }

  return `user-${userId.slice(0, 8)}`;
}

function buildDisplayName(user: User): string {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const name =
    (metadata?.full_name as string | undefined) ??
    (metadata?.name as string | undefined) ??
    user.email?.split("@")[0];

  return name?.trim() || "SlotSync user";
}

export async function ensureProfileForUser(user: User | null | undefined): Promise<void> {
  if (!user) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[profiles] load failed", error);
    return;
  }

  if (data) return;

  const displayName = buildDisplayName(user);
  const usernameSeed = user.email?.split("@")[0] ?? displayName;
  const username = buildUsername(usernameSeed, user.id);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const avatarUrl = (user.user_metadata as Record<string, unknown> | undefined)
    ?.avatar_url as string | undefined;

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    display_name: displayName,
    username,
    timezone,
    avatar_url: avatarUrl ?? null,
  });

  if (insertError) {
    console.error("[profiles] insert failed", insertError);
  }
}
