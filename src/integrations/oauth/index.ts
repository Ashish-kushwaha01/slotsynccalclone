import { createLovableAuth as createSlotSyncAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";

const cloudAuth = createSlotSyncAuth();

type OAuthProvider = "google" | "apple" | "microsoft" | "slotsync";

const providerMap: Record<OAuthProvider, "google" | "apple" | "microsoft" | "lovable"> = {
  google: "google",
  apple: "apple",
  microsoft: "microsoft",
  slotsync: "lovable",
};

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
      const result = await cloudAuth.signInWithOAuth(providerMap[provider], {
        redirect_uri: opts?.redirect_uri,
        extraParams: {
          ...opts?.extraParams,
        },
      });

      if (result.redirected) {
        return result;
      }

      if (result.error) {
        return result;
      }

      try {
        await supabase.auth.setSession(result.tokens);
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
      return result;
    },
  },
};
