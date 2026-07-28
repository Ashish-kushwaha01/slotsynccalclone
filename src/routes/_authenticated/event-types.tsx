import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/event-types")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
