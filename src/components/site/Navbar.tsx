import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/browse", label: "Browse turfs" },
  { to: "/open-games", label: "Open games" },
  { to: "/tournaments", label: "Tournaments" },
  { to: "/live-scores", label: "Live scores" },
];

export function Navbar() {
  const { user, primaryRole, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const dashHref =
    primaryRole === "owner"
      ? "/owner/dashboard"
      : primaryRole === "admin"
        ? "/admin/dashboard"
        : "/dashboard";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm">T</span>
          </span>
          Bowlie
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm text-ink-soft transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/owner-onboarding"
            className="text-sm text-ink-soft transition-colors hover:text-foreground"
          >
            List your turf
          </Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to={dashHref}>Dashboard</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => signOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth" search={{ mode: "signin" }}>Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth" search={{ mode: "signup" }}>Get started</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="grid h-9 w-9 place-items-center rounded-md border border-border md:hidden"
          onClick={() => setOpen((s) => !s)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/owner-onboarding"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              List your turf
            </Link>
            <div className="mt-2 flex gap-2">
              {user ? (
                <>
                  <Button asChild size="sm" className="flex-1">
                    <Link to={dashHref} onClick={() => setOpen(false)}>Dashboard</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      signOut();
                      setOpen(false);
                    }}
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link to="/auth" search={{ mode: "signin" }} onClick={() => setOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1">
                    <Link to="/auth" search={{ mode: "signup" }} onClick={() => setOpen(false)}>
                      Get started
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
