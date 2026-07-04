import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).default("signin"),
  role: z.enum(["player", "owner"]).default("player"),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in or sign up — Bowlie" }] }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const { mode, role, redirect } = search;
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { user, primaryRole, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  // Redirect signed-in users away from this page
  useEffect(() => {
    if (loading || !user) return;
    if (redirect) {
      router.navigate({ to: redirect });
      return;
    }
    if (primaryRole === "admin") router.navigate({ to: "/admin/dashboard" });
    else if (primaryRole === "owner") router.navigate({ to: "/owner/dashboard" });
    else router.navigate({ to: "/dashboard" });
  }, [user, primaryRole, loading, redirect, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const fullName = String(fd.get("full_name") ?? "").trim();

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;
        toast.success("Account created");
        if (role === "owner") {
          router.navigate({ to: "/owner-onboarding" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <div className="container-page grid min-h-[calc(100vh-4rem)] gap-12 py-10 lg:grid-cols-2 lg:items-center">
        <div className="hidden lg:block">
          <p className="eyebrow">Welcome</p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
            One account.
            <br />
            All your turf time.
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Discover venues, book slots, and fill squads. Owners get a full operations suite.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Dot /> Real-time availability and slot locking</li>
            <li className="flex items-center gap-2"><Dot /> Verified-booking reviews</li>
            <li className="flex items-center gap-2"><Dot /> Squad fill with emergency mode</li>
          </ul>
        </div>

        <div className="mx-auto w-full max-w-md surface-card p-7">
          <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => navigate({ search: { ...search, mode: "signin" as const } })}
              className={`rounded-md py-2 ${mode === "signin" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => navigate({ search: { ...search, mode: "signup" as const } })}
              className={`rounded-md py-2 ${mode === "signup" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>

          {mode === "signup" && (
            <div className="mt-5">
              <Label className="mb-2 block text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                I'm signing up as
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(["player", "owner"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => navigate({ search: { ...search, role: r } })}
                    className={`rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                      role === r
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <p className="font-medium capitalize">{r}</p>
                    <p className="text-xs opacity-75">
                      {r === "player" ? "Book turfs and join squads" : "List and operate turfs"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" required placeholder="Aarav Mehta" className="mt-1.5" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={6} className="mt-1.5" />
              {mode === "signin" && (
                <Link
                  to="/forgot-password"
                  className="mt-1.5 block text-right text-xs text-accent hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            By continuing you agree to our terms and privacy policy.
          </p>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Looking to list a turf?{" "}
            <Link to="/owner-onboarding" className="text-accent hover:underline">
              Owner onboarding
            </Link>
          </p>
        </div>
      </div>
    </PublicShell>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-accent" />;
}
