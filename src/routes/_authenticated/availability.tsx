import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/availability")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { tab: "availability" } });
  },
});
