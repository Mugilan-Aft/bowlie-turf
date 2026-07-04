import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, formatPrice } from "@/lib/format";

type Filter = "upcoming" | "past" | "all";

export const Route = createFileRoute("/_authenticated/owner/bookings")({
  head: () => ({ meta: [{ title: "Bookings — Owner" }] }),
  component: OwnerBookings,
});

function OwnerBookings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [turfId, setTurfId] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("upcoming");

  const { data: turfs } = useQuery({
    queryKey: ["owner-turfs-min", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("turfs").select("id, name").eq("owner_id", user.id).order("name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const turfIds = (turfs ?? []).map((t) => t.id);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["owner-bookings", user?.id, turfId, filter, turfIds.join(",")],
    queryFn: async () => {
      if (turfIds.length === 0) return [];
      const ids = turfId === "all" ? turfIds : [turfId];
      let q = supabase
        .from("bookings")
        .select("id, start_at, end_at, total_amount, status, payment_status, notes, turf_id, user_id, is_offline")
        .in("turf_id", ids)
        .neq("status", "refunded")
        .order("start_at", { ascending: filter !== "past" });

      const now = new Date().toISOString();
      if (filter === "upcoming") q = q.gte("start_at", now);
      if (filter === "past") q = q.lt("start_at", now);

      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && turfIds.length > 0,
  });

  const turfsById = Object.fromEntries((turfs ?? []).map((t) => [t.id, t.name]));

  async function updateStatus(id: string, status: "confirmed" | "cancelled" | "completed") {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Booking ${status}`);
    qc.invalidateQueries({ queryKey: ["owner-bookings"] });
  }

  return (
    <DashShell area="owner" title="Bookings" subtitle="All bookings across your turfs.">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select value={turfId} onValueChange={setTurfId}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All turfs</SelectItem>
            {(turfs ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : !bookings || bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck2 className="h-4 w-4" />}
          title="No bookings"
          description="When players book your turfs, they'll appear here."
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium truncate">{turfsById[b.turf_id] ?? "Turf"}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(b.start_at)} — {new Date(b.end_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </p>
                {b.notes && <p className="text-xs text-muted-foreground mt-1 truncate">Note: {b.notes}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-right">
                  <p className="font-semibold">{formatPrice(b.total_amount)}</p>
                  <div className="flex gap-1.5 mt-0.5">
                    <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                    <Badge tone={b.payment_status === "paid" ? "success" : "muted"}>{b.payment_status}</Badge>
                    {b.is_offline && <Badge tone="muted">offline</Badge>}
                  </div>
                </div>
                {b.status === "pending" && (
                  <Button size="sm" onClick={() => updateStatus(b.id, "confirmed")}>Confirm</Button>
                )}
                {(b.status === "pending" || b.status === "confirmed") && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "cancelled")}>Cancel</Button>
                )}
                {b.status === "confirmed" && new Date(b.end_at) < new Date() && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "completed")}>Mark complete</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-sm text-muted-foreground">
        Need to edit pitches, slots, or blackouts? <Link to="/owner/dashboard" className="text-accent hover:underline">Go to turfs →</Link>
      </div>
    </DashShell>
  );
}

function statusTone(s: string): "success" | "warning" | "destructive" | "muted" {
  if (s === "confirmed" || s === "completed") return "success";
  if (s === "pending") return "warning";
  if (s === "cancelled") return "destructive";
  return "muted";
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "success" | "warning" | "destructive" | "muted" }) {
  const cls = tone === "success" ? "bg-success/10 text-success"
    : tone === "warning" ? "bg-warning/10 text-warning-foreground"
    : tone === "destructive" ? "bg-destructive/10 text-destructive"
    : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>{children}</span>;
}
