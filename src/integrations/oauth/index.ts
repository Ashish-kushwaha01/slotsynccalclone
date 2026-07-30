import { supabase } from "../supabase/client";

type OAuthProvider = "google" | "apple" | "microsoft";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const oauth = {
  auth: {
    signInWithOAuth: async (
      provider: OAuthProvider,
      opts?: SignInOptions,
    ) => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: opts?.redirect_uri,
          skipBrowserRedirect: true,
          queryParams: opts?.extraParams,
        },
      });

      if (error) {
        return { error };
      }

      if (data?.url) {
        window.location.assign(data.url);
        return { redirected: true };
      }

      return { error: new Error("Missing OAuth redirect URL.") };
    },
  },
};
