import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/owner/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Owner" }] }),
  component: OwnerAnalytics,
});

function OwnerAnalytics() {
  const { user } = useAuth();
  const [range, setRange] = useState<"7" | "30" | "90">("30");

  const { data: turfs } = useQuery({
    queryKey: ["owner-turfs-min", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("turfs").select("id, name").eq("owner_id", user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const turfIds = (turfs ?? []).map((t) => t.id);
  const since = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - Number(range)); d.setHours(0, 0, 0, 0); return d;
  }, [range]);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["analytics-bookings", turfIds.join(","), range],
    queryFn: async () => {
      if (turfIds.length === 0) return [];
      const { data } = await supabase
        .from("bookings")
        .select("id, turf_id, start_at, total_amount, status, payment_status")
        .in("turf_id", turfIds)
        .in("status", ["confirmed", "completed"])
        .gte("start_at", since.toISOString())
        .limit(2000);
      return data ?? [];
    },
    enabled: turfIds.length > 0,
  });

  const stats = useMemo(() => {
    const list = bookings ?? [];
    const revenue = list.reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const paidRevenue = list.filter((b) => b.payment_status === "paid").reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const perTurf = new Map<string, { count: number; revenue: number }>();
    for (const b of list) {
      const t = perTurf.get(b.turf_id) ?? { count: 0, revenue: 0 };
      t.count += 1; t.revenue += Number(b.total_amount || 0);
      perTurf.set(b.turf_id, t);
    }
    // Group by day
    const byDay = new Map<string, number>();
    const days = Number(range);
    for (let i = 0; i < days; i++) {
      const d = new Date(since); d.setDate(d.getDate() + i);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const b of list) {
      const key = b.start_at.slice(0, 10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + Number(b.total_amount || 0));
    }
    return { revenue, paidRevenue, count: list.length, perTurf, byDay };
  }, [bookings, range, since]);

  const maxDay = Math.max(1, ...Array.from(stats.byDay.values()));
  const turfsById = Object.fromEntries((turfs ?? []).map((t) => [t.id, t.name]));

  return (
    <DashShell
      area="owner"
      title="Analytics"
      subtitle="Revenue and booking volume across your turfs."
      actions={
        <Select value={range} onValueChange={(v) => setRange(v as "7" | "30" | "90")}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Confirmed revenue" value={formatPrice(stats.revenue)} />
        <Stat label="Paid revenue" value={formatPrice(stats.paidRevenue)} />
        <Stat label="Bookings" value={String(stats.count)} />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold mb-3">Daily revenue</h2>
        <div className="surface-card p-5">
          {isLoading ? (
            <div className="h-40 animate-pulse bg-muted rounded" />
          ) : (
            <div className="flex items-end gap-1 h-40">
              {Array.from(stats.byDay.entries()).map(([day, val]) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1" title={`${day}: ${formatPrice(val)}`}>
                  <div className="w-full rounded-t bg-accent/80 hover:bg-accent transition-colors" style={{ height: `${(val / maxDay) * 100}%`, minHeight: val > 0 ? 2 : 0 }} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>{since.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
            <span>Today</span>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold mb-3">By turf</h2>
        <div className="surface-card divide-y divide-border">
          {stats.perTurf.size === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No bookings in this range.</p>
          ) : Array.from(stats.perTurf.entries()).sort((a, b) => b[1].revenue - a[1].revenue).map(([id, s]) => (
            <div key={id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{turfsById[id] ?? "Turf"}</p>
                <p className="text-xs text-muted-foreground">{s.count} bookings</p>
              </div>
              <p className="font-semibold">{formatPrice(s.revenue)}</p>
            </div>
          ))}
        </div>
      </section>
    </DashShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}
