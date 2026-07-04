import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/owner/")({
  beforeLoad: () => {
    throw redirect({ to: "/owner/dashboard" });
  },
});
