import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Building2, CalendarCheck2, Wallet, TrendingUp, Activity, AlertCircle, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/site/EmptyState";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/owner/dashboard")({
  head: () => ({ meta: [{ title: "Owner dashboard — Bowlie" }] }),
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const { user, roles } = useAuth();
  const { data: turfs, isLoading } = useQuery({
    queryKey: ["owner-turfs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("turfs")
        .select("id, slug, name, city, status, base_price, rating, total_reviews, cover_image_url")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const turfIds = useMemo(() => (turfs ?? []).map((t) => t.id), [turfs]);
  const now = useMemo(() => new Date(), []);
  const startOf30 = useMemo(() => { const d = new Date(now); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d; }, [now]);
  const startOf7 = useMemo(() => { const d = new Date(now); d.setDate(d.getDate() - 7); d.setHours(0,0,0,0); return d; }, [now]);

  const { data: bookings30 } = useQuery({
    queryKey: ["owner-dash-bookings", user?.id, turfIds.join(",")],
    queryFn: async () => {
      if (turfIds.length === 0) return [];
      const { data } = await supabase
        .from("bookings")
        .select("id, turf_id, start_at, end_at, total_amount, status, payment_status, is_offline")
        .in("turf_id", turfIds)
        .gte("start_at", startOf30.toISOString())
        .limit(2000);
      return data ?? [];
    },
    enabled: turfIds.length > 0,
  });

  const stats = useMemo(() => {
    const list = bookings30 ?? [];
    const settled = list.filter((b) => ["confirmed", "completed"].includes(b.status));
    const revenue30 = settled.reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const revenue7 = settled
      .filter((b) => new Date(b.start_at) >= startOf7)
      .reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const upcoming = list.filter((b) => new Date(b.start_at) >= now && ["pending", "confirmed"].includes(b.status)).length;
    const offlineShare = settled.length === 0 ? 0 : Math.round((settled.filter((b) => b.is_offline).length / settled.length) * 100);
    // Occupancy: booked hours / available hours (assume 12 operating hours/day × turfs × 30)
    const bookedHours = settled.reduce((s, b) => s + Math.max(0, (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 3.6e6), 0);
    const capacityHours = Math.max(1, turfIds.length * 12 * 30);
    const occupancy = Math.min(100, Math.round((bookedHours / capacityHours) * 100));
    return { revenue30, revenue7, upcoming, offlineShare, occupancy };
  }, [bookings30, startOf7, now, turfIds]);

  if (!roles.includes("owner") && !roles.includes("admin")) {
    return (
      <DashShell area="owner" title="Owner dashboard">
        <EmptyState
          icon={<Building2 className="h-4 w-4" />}
          title="You don't have an owner account yet"
          description="Complete owner onboarding to start listing your turfs."
          action={<Button asChild><Link to="/owner-onboarding">Start onboarding</Link></Button>}
        />
      </DashShell>
    );
  }

  const approvedCount = turfs?.filter((t) => t.status === "approved").length ?? 0;
  const pendingCount = turfs?.filter((t) => t.status === "pending").length ?? 0;
  const rejectedTurfs = turfs?.filter((t) => t.status === "rejected") ?? [];

  return (
    <DashShell
      area="owner"
      title="Operations overview"
      subtitle="Revenue, occupancy, and the state of every turf you run."
      actions={
        <>
          <Button asChild variant="outline"><Link to="/owner/bookings/new">+ Manual booking</Link></Button>
          <Button asChild><Link to="/owner-onboarding">+ New turf</Link></Button>
        </>
      }
    >
      {/* Revenue / occupancy KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Wallet className="h-4 w-4" />}
          label="Revenue · 30d"
          value={formatPrice(stats.revenue30)}
          hint={`${formatPrice(stats.revenue7)} in last 7d`}
        />
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label="Occupancy · 30d"
          value={`${stats.occupancy}%`}
          hint={`${turfIds.length} turf${turfIds.length === 1 ? "" : "s"} · ~12h/day`}
        />
        <Kpi
          icon={<CalendarCheck2 className="h-4 w-4" />}
          label="Upcoming bookings"
          value={String(stats.upcoming)}
          hint={`${stats.offlineShare}% recorded offline`}
        />
        <Kpi
          icon={<Building2 className="h-4 w-4" />}
          label="Turfs"
          value={`${approvedCount} live`}
          hint={pendingCount > 0 ? `${pendingCount} pending review` : "All reviewed"}
        />
      </div>

      {/* Approval status callouts */}
      {(pendingCount > 0 || rejectedTurfs.length > 0) && (
        <div className="mt-6 space-y-2">
          {pendingCount > 0 && (
            <div className="surface-card flex items-start gap-3 p-4 border-warning/40">
              <AlertCircle className="h-4 w-4 mt-0.5 text-warning-foreground" />
              <div className="text-sm">
                <p className="font-medium">{pendingCount} turf{pendingCount === 1 ? "" : "s"} awaiting admin approval</p>
                <p className="text-xs text-muted-foreground">Pending turfs are not bookable by players yet.</p>
              </div>
            </div>
          )}
          {rejectedTurfs.map((t) => (
            <div key={t.id} className="surface-card flex items-start gap-3 p-4 border-destructive/40">
              <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
              <div className="text-sm flex-1">
                <p className="font-medium">{t.name} was rejected</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/owner/turfs/$id" params={{ id: t.id }}>Update</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Turfs list */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Your turfs</h2>
        {isLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : !turfs || turfs.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<Building2 className="h-4 w-4" />}
              title="No turfs yet"
              description="Submit your first turf to start receiving bookings."
              action={<Button asChild><Link to="/owner-onboarding">Add a turf</Link></Button>}
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {turfs.map((t) => (
              <div key={t.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-3">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {t.cover_image_url && <img src={t.cover_image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.city}</p>
                  <p className="mt-1 text-xs">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                      t.status === "approved" ? "bg-success/10 text-success" :
                      t.status === "pending" ? "bg-warning/10 text-warning-foreground" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {t.status}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <p className="text-sm font-semibold">{formatPrice(t.base_price)}/hr</p>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/owner/turfs/$id" params={{ id: t.id }}>Manage</Link>
                    </Button>
                    {t.status === "approved" && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/turfs/$slug" params={{ slug: t.slug }}>View</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/owner/bookings" icon={<CalendarCheck2 className="h-4 w-4" />} title="Bookings" desc="Review, confirm, cancel." />
        <QuickLink to="/owner/calendar" icon={<ClipboardList className="h-4 w-4" />} title="Calendar" desc="Slots, blackouts, occupancy." />
        <QuickLink to="/owner/live" icon={<Activity className="h-4 w-4" />} title="Live scores" desc="Run matches at your venue." />
        <QuickLink to="/owner/analytics" icon={<TrendingUp className="h-4 w-4" />} title="Analytics" desc="Revenue and volume trends." />
      </section>
    </DashShell>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-[11px] uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function QuickLink({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} className="surface-card p-5 hover:border-accent transition-colors">
      <div className="flex items-center gap-2 text-accent">{icon}<p className="font-display font-semibold text-foreground">{title}</p></div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}
