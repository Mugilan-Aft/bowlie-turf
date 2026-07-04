import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/owner/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Owner" }] }),
  component: OwnerCalendar,
});

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am - 10pm
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function OwnerCalendar() {
  const { user } = useAuth();
  const [turfId, setTurfId] = useState<string>("");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const { data: turfs } = useQuery({
    queryKey: ["owner-turfs-min", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("turfs").select("id, name").eq("owner_id", user.id).order("name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const activeTurfId = turfId || turfs?.[0]?.id || "";
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: bookings } = useQuery({
    queryKey: ["calendar-bookings", activeTurfId, weekStart.toISOString()],
    queryFn: async () => {
      if (!activeTurfId) return [];
      const { data } = await supabase
        .from("bookings")
        .select("id, start_at, end_at, status, total_amount")
        .eq("turf_id", activeTurfId)
        .in("status", ["pending", "confirmed", "completed"])
        .gte("start_at", weekStart.toISOString())
        .lt("start_at", weekEnd.toISOString());
      return data ?? [];
    },
    enabled: !!activeTurfId,
  });

  const { data: blackouts } = useQuery({
    queryKey: ["calendar-blackouts", activeTurfId, weekStart.toISOString()],
    queryFn: async () => {
      if (!activeTurfId) return [];
      const { data } = await supabase
        .from("blackout_periods")
        .select("id, start_at, end_at, reason")
        .eq("turf_id", activeTurfId)
        .lt("start_at", weekEnd.toISOString())
        .gte("end_at", weekStart.toISOString());
      return data ?? [];
    },
    enabled: !!activeTurfId,
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  }), [weekStart]);

  return (
    <DashShell area="owner" title="Calendar" subtitle="Weekly bookings and blackouts across one turf.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Select value={activeTurfId} onValueChange={setTurfId}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select turf" /></SelectTrigger>
          <SelectContent>
            {(turfs ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {new Date(weekEnd.getTime() - 1).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
        </div>
      </div>

      {!activeTurfId ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">Select a turf to view its calendar.</div>
      ) : (
        <div className="surface-card overflow-x-auto p-0">
          <div className="grid min-w-[800px]" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
            <div className="border-b border-r border-border p-2 text-xs text-muted-foreground" />
            {days.map((d) => (
              <div key={d.toISOString()} className="border-b border-r border-border p-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{DAYS[d.getDay()]}</p>
                <p className="text-sm font-semibold">{d.getDate()}</p>
              </div>
            ))}
            {HOURS.map((h) => (
              <Fragment key={`row-${h}`}>
                <div key={`h-${h}`} className="border-b border-r border-border p-1 text-[10px] text-muted-foreground text-right pr-2">{h}:00</div>
                {days.map((d) => {
                  const cellStart = new Date(d); cellStart.setHours(h, 0, 0, 0);
                  const cellEnd = new Date(cellStart); cellEnd.setHours(h + 1);
                  const cellBookings = (bookings ?? []).filter((b) => {
                    const s = new Date(b.start_at), e = new Date(b.end_at);
                    return s < cellEnd && e > cellStart;
                  });
                  const cellBlackouts = (blackouts ?? []).filter((b) => {
                    const s = new Date(b.start_at), e = new Date(b.end_at);
                    return s < cellEnd && e > cellStart;
                  });
                  return (
                    <div key={`${d.toISOString()}-${h}`} className="relative border-b border-r border-border min-h-[44px] p-0.5">
                      {cellBlackouts.map((bo) => (
                        <div key={bo.id} className="absolute inset-0.5 rounded bg-destructive/15 border border-destructive/30 text-[9px] text-destructive p-1 truncate">
                          {bo.reason ?? "Blackout"}
                        </div>
                      ))}
                      {cellBookings.map((b) => (
                        <div key={b.id} className={`rounded px-1 py-0.5 text-[9px] truncate ${b.status === "confirmed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"}`} title={`${formatPrice(b.total_amount)} — ${b.status}`}>
                          {new Date(b.start_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-success/40 inline-block" /> Confirmed</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-warning/40 inline-block" /> Pending</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-destructive/30 inline-block" /> Blackout</span>
      </div>
    </DashShell>
  );
}
