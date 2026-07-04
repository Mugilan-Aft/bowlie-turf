import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/unauthorized")({
  head: () => ({ meta: [{ title: "Access denied — Bowlie" }] }),
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  const { primaryRole } = useAuth();
  const home =
    primaryRole === "admin"
      ? "/admin/dashboard"
      : primaryRole === "owner"
        ? "/owner/dashboard"
        : "/dashboard";
  return (
    <PublicShell>
      <div className="container-page flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Access denied</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Your account doesn't have permission to view that area. Head back to your dashboard or
          sign in with the right account.
        </p>
        <div className="mt-6 flex gap-3">
          <Button asChild>
            <Link to={home}>Go to my dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Home</Link>
          </Button>
        </div>
      </div>
    </PublicShell>
  );
}
