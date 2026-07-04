import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/site/EmptyState";
import { formatPrice } from "@/lib/format";

type Range = "7" | "30" | "90";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — Admin" }] }),
  component: AdminReports,
});

function AdminReports() {
  const { roles } = useAuth();
  const [range, setRange] = useState<Range>("30");

  const since = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - Number(range)); d.setHours(0, 0, 0, 0); return d;
  }, [range]);

  const { data: bookings } = useQuery({
    queryKey: ["admin-report-bookings", range],
    enabled: roles.includes("admin"),
    queryFn: async () => {
      const { data } = await supabase.from("bookings")
        .select("id, turf_id, total_amount, status, start_at, end_at")
        .gte("start_at", since.toISOString())
        .limit(10000);
      return data ?? [];
    },
  });

  const { data: squad } = useQuery({
    queryKey: ["admin-report-squad", range],
    enabled: roles.includes("admin"),
    queryFn: async () => {
      const { data } = await supabase.from("squad_fill_posts")
        .select("id, spots_needed, spots_filled, created_at, status")
        .gte("created_at", since.toISOString())
        .limit(5000);
      return data ?? [];
    },
  });

  const { data: activeVenues } = useQuery({
    queryKey: ["admin-report-venues"],
    enabled: roles.includes("admin"),
    queryFn: async () => {
      const { data } = await supabase.from("turfs").select("id, name, city").eq("status", "approved").order("name");
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const list = bookings ?? [];
    const total = list.length;
    const cancelled = list.filter((b) => b.status === "cancelled" || b.status === "refunded").length;
    const completed = list.filter((b) => b.status === "completed").length;
    const confirmed = list.filter((b) => b.status === "confirmed").length;
    const gmv = list.filter((b) => ["confirmed", "completed"].includes(b.status)).reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const cancelRate = total ? Math.round((cancelled / total) * 100) : 0;

    // per-turf revenue
    const byTurf = new Map<string, { count: number; revenue: number }>();
    for (const b of list) {
      if (!["confirmed", "completed"].includes(b.status)) continue;
      const t = byTurf.get(b.turf_id) ?? { count: 0, revenue: 0 };
      t.count += 1; t.revenue += Number(b.total_amount || 0);
      byTurf.set(b.turf_id, t);
    }
    return { total, cancelled, completed, confirmed, gmv, cancelRate, byTurf };
  }, [bookings]);

  const fillStats = useMemo(() => {
    const list = squad ?? [];
    const totalNeeded = list.reduce((s, p) => s + (p.spots_needed ?? 0), 0);
    const totalFilled = list.reduce((s, p) => s + (p.spots_filled ?? 0), 0);
    const fillRate = totalNeeded ? Math.round((totalFilled / totalNeeded) * 100) : 0;
    return { posts: list.length, fillRate, totalNeeded, totalFilled };
  }, [squad]);

  const venuesById = Object.fromEntries((activeVenues ?? []).map((v) => [v.id, v]));
  const topVenues = Array.from(stats.byTurf.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10);

  if (!roles.includes("admin")) {
    return <DashShell area="admin" title="Reports"><EmptyState icon={<ShieldCheck className="h-4 w-4" />} title="Admin access required" description="" /></DashShell>;
  }

  return (
    <DashShell
      area="admin"
      title="Platform reports"
      subtitle="Bookings, cancellations, squad fill rate, and active venues."
      actions={
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Bookings" value={stats.total} />
        <Kpi label="GMV" value={formatPrice(stats.gmv)} />
        <Kpi label="Cancellation rate" value={`${stats.cancelRate}%`} hint={`${stats.cancelled} of ${stats.total}`} />
        <Kpi label="Active venues" value={activeVenues?.length ?? 0} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Completed" value={stats.completed} />
        <Kpi label="Confirmed (upcoming)" value={stats.confirmed} />
        <Kpi label="Squad-fill posts" value={fillStats.posts} />
        <Kpi label="Squad fill rate" value={`${fillStats.fillRate}%`} hint={`${fillStats.totalFilled}/${fillStats.totalNeeded} spots`} />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold mb-3">Top venues by revenue</h2>
        <div className="surface-card overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topVenues.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No revenue in this range.</TableCell></TableRow>
              ) : topVenues.map(([id, v]) => (
                <TableRow key={id}>
                  <TableCell className="font-medium">{venuesById[id]?.name ?? "Unknown"}</TableCell>
                  <TableCell>{venuesById[id]?.city ?? "—"}</TableCell>
                  <TableCell>{v.count}</TableCell>
                  <TableCell className="text-right font-semibold">{formatPrice(v.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </DashShell>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
