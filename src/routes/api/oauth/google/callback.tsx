import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import {
  exchangeGoogleCode,
  fetchGoogleEmail,
  encryptRefreshToken,
} from "@/lib/google-calendar.server";
import { verifyOAuthState } from "@/lib/oauth-state.server";

export const Route = createFileRoute("/api/oauth/google/callback")({
  server: {
    handlers: {
      GET: async () => {
        const request = getRequest();
        if (!request) {
          return new Response("Missing request", { status: 500 });
        }

        const url = new URL(request.url);
        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");
        const stateParam = url.searchParams.get("state");

        const fallbackRedirect = "/settings?tab=calendar";
        const fallbackUrl = new URL(fallbackRedirect, url.origin).toString();

        if (error) {
          return Response.redirect(
            new URL(`${fallbackRedirect}&error=${encodeURIComponent(error)}`, url.origin).toString(),
            302,
          );
        }

        if (!code || !stateParam) {
          return Response.redirect(
            new URL(`${fallbackRedirect}&error=missing_code`, url.origin).toString(),
            302,
          );
        }

        const state = verifyOAuthState(stateParam);
        if (!state) {
          return Response.redirect(
            new URL(`${fallbackRedirect}&error=invalid_state`, url.origin).toString(),
            302,
          );
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri =
          process.env.GOOGLE_REDIRECT_URI ?? `${url.origin}/api/oauth/google/callback`;

        if (!clientId || !clientSecret) {
          return Response.redirect(
            new URL(`${fallbackRedirect}&error=missing_credentials`, url.origin).toString(),
            302,
          );
        }

        try {
          const tokens = await exchangeGoogleCode({
            clientId,
            clientSecret,
            redirectUri,
            code,
          });

          if (!tokens.refresh_token) {
            return Response.redirect(
              new URL(`${fallbackRedirect}&error=no_refresh_token`, url.origin).toString(),
              302,
            );
          }

          const email = await fetchGoogleEmail(tokens.access_token);
          const encrypted = encryptRefreshToken(tokens.refresh_token);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error: upsertError } = await supabaseAdmin
            .from("google_calendar_connections")
            .upsert(
              {
                user_id: state.userId,
                connection_key_ciphertext: encrypted,
                calendar_id: "primary",
                email,
              },
              { onConflict: "user_id" },
            );

          if (upsertError) {
            return Response.redirect(
              new URL(`${fallbackRedirect}&error=save_failed`, url.origin).toString(),
              302,
            );
          }

          const safeRedirect = state.redirectTo.startsWith("/")
            ? state.redirectTo
            : fallbackRedirect;
          return Response.redirect(
            new URL(`${safeRedirect}&connected=google`, url.origin).toString(),
            302,
          );
        } catch {
          return Response.redirect(
            new URL(`${fallbackRedirect}&error=oauth_failed`, url.origin).toString(),
            302,
          );
        }
      },
    },
  },
});
