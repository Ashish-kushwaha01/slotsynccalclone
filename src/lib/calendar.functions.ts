import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildGoogleAuthUrl } from "@/lib/google-calendar.server";
import { signOAuthState } from "@/lib/oauth-state.server";

const connectInputSchema = z.object({
  origin: z.string().url(),
  redirectTo: z.string().optional(),
});

export const getGoogleCalendarConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("google_calendar_connections")
      .select("email, calendar_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

export const getGoogleCalendarAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => connectInputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error("Missing env GOOGLE_CLIENT_ID for Google Calendar connect.");
    }

    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ?? `${data.origin}/api/oauth/google/callback`;

    const redirectTo = data.redirectTo?.startsWith("/")
      ? data.redirectTo
      : "/settings?tab=calendar";

    const state = signOAuthState({
      userId: context.userId,
      redirectTo,
    });

    return {
      url: buildGoogleAuthUrl({
        clientId,
        redirectUri,
        state,
      }),
    };
  });
