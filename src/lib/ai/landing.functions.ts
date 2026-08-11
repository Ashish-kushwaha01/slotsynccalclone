import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const landingSchema = z.object({ token: z.string().min(4) });

export const getLandingPage = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => landingSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: landing } = await supabaseAdmin
      .from("ai_landing_pages")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (!landing) return null;

    if (landing.expires_at && new Date(landing.expires_at).getTime() < Date.now()) {
      return null;
    }

    await supabaseAdmin
      .from("ai_landing_pages")
      .update({ view_count: (landing.view_count ?? 0) + 1 })
      .eq("id", landing.id);

    const { data: eventType } = await supabaseAdmin
      .from("event_types")
      .select("id, slug, title, description, duration_min, location, user_id")
      .eq("id", landing.event_type_id)
      .maybeSingle();
    if (!eventType) return null;

    const { data: host } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username, bio, avatar_url, timezone")
      .eq("id", eventType.user_id)
      .maybeSingle();

    return {
      landing,
      eventType,
      host,
    };
  });
