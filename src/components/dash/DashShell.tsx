import { Link, useLocation } from "@tanstack/react-router";
import {
  CalendarCheck2,
  Heart,
  Home,
  UserRound,
  Users2,
  ShieldCheck,
  CalendarRange,
  LineChart,
  Trophy,
  Activity,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const playerNav: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: <Home className="h-4 w-4" /> },
  { to: "/bookings", label: "Bookings", icon: <CalendarCheck2 className="h-4 w-4" /> },
  { to: "/squad-fill", label: "Squad fill", icon: <Users2 className="h-4 w-4" /> },
  { to: "/teams", label: "My teams", icon: <Trophy className="h-4 w-4" /> },
  { to: "/favorites", label: "Favorites", icon: <Heart className="h-4 w-4" /> },
  { to: "/profile", label: "Profile", icon: <UserRound className="h-4 w-4" /> },
];

const ownerNav: NavItem[] = [
  { to: "/owner/dashboard", label: "Overview", icon: <Home className="h-4 w-4" /> },
  { to: "/owner/bookings", label: "Bookings", icon: <CalendarCheck2 className="h-4 w-4" /> },
  { to: "/owner/calendar", label: "Calendar", icon: <CalendarRange className="h-4 w-4" /> },
  { to: "/owner/live", label: "Live scores", icon: <Activity className="h-4 w-4" /> },
  { to: "/owner/tournaments", label: "Tournaments", icon: <Trophy className="h-4 w-4" /> },
  { to: "/owner/analytics", label: "Analytics", icon: <LineChart className="h-4 w-4" /> },
];

const adminNav: NavItem[] = [
  { to: "/admin/dashboard", label: "Overview", icon: <Home className="h-4 w-4" /> },
  { to: "/admin/turfs", label: "Turf approvals", icon: <ShieldCheck className="h-4 w-4" /> },
  { to: "/admin/users", label: "Users", icon: <Users2 className="h-4 w-4" /> },
  { to: "/admin/tickets", label: "Support", icon: <CalendarCheck2 className="h-4 w-4" /> },
  { to: "/admin/payments", label: "Refunds", icon: <LineChart className="h-4 w-4" /> },
  { to: "/admin/tournaments", label: "Tournaments", icon: <Trophy className="h-4 w-4" /> },
  { to: "/admin/announcements", label: "Announcements", icon: <Activity className="h-4 w-4" /> },
  { to: "/admin/reports", label: "Reports", icon: <CalendarRange className="h-4 w-4" /> },
];

export function DashShell({
  children,
  area = "player",
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  area?: "player" | "owner" | "admin";
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { primaryRole, roles } = useAuth();
  const location = useLocation();
  const nav = area === "owner" ? ownerNav : area === "admin" ? adminNav : playerNav;

  const areas: { key: "player" | "owner" | "admin"; label: string; to: string; visible: boolean }[] = [
    { key: "player", label: "Player", to: "/dashboard", visible: true },
    { key: "owner", label: "Owner", to: "/owner/dashboard", visible: roles.includes("owner") || roles.includes("admin") },
    { key: "admin", label: "Admin", to: "/admin/dashboard", visible: roles.includes("admin") },
  ];
  const visibleAreas = areas.filter((a) => a.visible);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Navbar />

      {/* Role-aware secondary nav */}
      <div className="border-b border-border bg-surface/60 backdrop-blur">
        <div className="container-page flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          {visibleAreas.length > 1 ? (
            <nav aria-label="Switch dashboard area" className="inline-flex self-start rounded-lg border border-border bg-background p-1">
              {visibleAreas.map((a) => {
                const isCurrent = area === a.key;
                const isPrimary = primaryRole === a.key;
                return (
                  <Link
                    key={a.key}
                    to={a.to}
                    className={`relative rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      isCurrent ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {a.label}
                    {isPrimary && (
                      <span aria-label="Primary role" className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
                    )}
                  </Link>
                );
              })}
            </nav>
          ) : <span />}

          <div className="-mx-2 flex gap-1 overflow-x-auto px-2 sm:mx-0 sm:px-0">
            {nav.map((item) => {
              const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to + item.label}
                  to={item.to}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {(title || actions) && (
        <div className="border-b border-border bg-background">
          <div className="container-page flex flex-col gap-4 py-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {title && (
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                  {primaryRole && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${
                        primaryRole === "admin"
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : primaryRole === "owner"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {primaryRole}
                    </span>
                  )}
                </div>
              )}
              {subtitle && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </div>
      )}

      <main className="container-page flex-1 py-8">{children}</main>

      <Footer />
    </div>
  );
}
