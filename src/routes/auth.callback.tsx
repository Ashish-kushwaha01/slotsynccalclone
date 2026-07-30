import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { ensureProfileForUser } from "@/lib/profile-client";
import { toast } from "sonner";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth/callback")({
  validateSearch: searchSchema,
  component: AuthCallback,
});

function AuthCallback() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    const finalize = async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        toast.error(error.message);
        navigate({ to: "/auth", replace: true });
        return;
      }

      await ensureProfileForUser(data?.session?.user);

      navigate({ to: search.redirect ?? "/dashboard", replace: true });
    };

    void finalize();
  }, [navigate, search.redirect]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card-surface w-full max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">Completing sign-in</h1>
        <p className="mt-2 text-sm text-muted-foreground">One moment while we finish signing you in.</p>
      </div>
    </div>
  );
}
