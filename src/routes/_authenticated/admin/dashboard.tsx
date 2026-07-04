import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Users2, Building2, Wallet, Ticket, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/site/EmptyState";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({ meta: [{ title: "Admin overview — Bowlie" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    enabled: isAdmin,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const sinceISO = since.toISOString();
      const [pendingTurfs, openTickets, banned, totalUsers, owners, refundsPending, gmv, cancellations] = await Promise.all([
        supabase.from("turfs").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "owner"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "cancelled").eq("payment_status", "paid"),
        supabase.from("bookings").select("total_amount").in("status", ["confirmed","completed"]).gte("start_at", sinceISO).limit(5000),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "cancelled").gte("start_at", sinceISO),
      ]);
      const gmv30 = (gmv.data ?? []).reduce((s, b) => s + Number(b.total_amount || 0), 0);
      return {
        pendingTurfs: pendingTurfs.count ?? 0,
        openTickets: openTickets.count ?? 0,
        banned: banned.count ?? 0,
        users: totalUsers.count ?? 0,
        owners: owners.count ?? 0,
        refundsPending: refundsPending.count ?? 0,
        gmv30,
        cancellations30: cancellations.count ?? 0,
      };
    },
  });

  if (!isAdmin) {
    return (
      <DashShell area="admin" title="Admin">
        <EmptyState
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Admin access required"
          description="The admin role is assigned manually. Talk to the platform owner if you need access."
          action={<Button asChild variant="outline"><Link to="/dashboard">Go to dashboard</Link></Button>}
        />
      </DashShell>
    );
  }

  return (
    <DashShell area="admin" title="Operations console" subtitle="Approvals, moderation, payouts, and platform health.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Building2 className="h-4 w-4" />} label="Turfs awaiting review" value={counts?.pendingTurfs ?? "—"} link="/admin/turfs" />
        <Kpi icon={<Ticket className="h-4 w-4" />} label="Open support tickets" value={counts?.openTickets ?? "—"} link="/admin/tickets" />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Refund queue" value={counts?.refundsPending ?? "—"} link="/admin/payments" />
        <Kpi icon={<AlertCircle className="h-4 w-4" />} label="Banned users" value={counts?.banned ?? "—"} link="/admin/users" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Wallet className="h-4 w-4" />} label="GMV · last 30d" value={counts ? formatPrice(counts.gmv30) : "—"} />
        <Kpi icon={<AlertCircle className="h-4 w-4" />} label="Cancellations · 30d" value={counts?.cancellations30 ?? "—"} />
        <Kpi icon={<Users2 className="h-4 w-4" />} label="Total users" value={counts?.users ?? "—"} />
        <Kpi icon={<Building2 className="h-4 w-4" />} label="Owners" value={counts?.owners ?? "—"} />
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Quick to="/admin/turfs" title="Approve turfs" desc="Review submitted venues." />
        <Quick to="/admin/users" title="Moderate users" desc="Investigate accounts, ban repeat offenders." />
        <Quick to="/admin/tournaments" title="Featured tournaments" desc="Curate what appears across the platform." />
        <Quick to="/admin/reports" title="Reports" desc="Bookings, cancellations, fill rate, active venues." />
      </section>
    </DashShell>
  );
}

function Kpi({ icon, label, value, link }: { icon: React.ReactNode; label: string; value: number | string; link?: string }) {
  const body = (
    <div className="surface-card p-5 hover:border-accent transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<p className="text-[11px] uppercase tracking-[0.18em]">{label}</p></div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
  return link ? <Link to={link}>{body}</Link> : body;
}

function Quick({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="surface-card p-5 hover:border-accent transition-colors">
      <p className="font-display font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}
