import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, Minus, Plus, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/site/EmptyState";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/owner/live")({
  head: () => ({ meta: [{ title: "Live score entry — Owner" }] }),
  component: OwnerLive,
});

type Match = {
  id: string;
  team_a: string;
  team_b: string;
  score_a: number;
  score_b: number;
  status: "scheduled" | "live" | "completed";
  turf_id: string | null;
  started_at: string | null;
  ended_at: string | null;
};

function OwnerLive() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [turfId, setTurfId] = useState("");
  const [creating, setCreating] = useState(false);

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
  const activeTurfId = turfId || turfIds[0] || "";

  const { data: matches } = useQuery({
    queryKey: ["owner-live-matches", activeTurfId],
    queryFn: async () => {
      if (!activeTurfId) return [] as Match[];
      const { data } = await supabase
        .from("live_matches")
        .select("id, team_a, team_b, score_a, score_b, status, turf_id, started_at, ended_at")
        .eq("turf_id", activeTurfId)
        .order("created_at", { ascending: false })
        .limit(60);
      return (data ?? []) as Match[];
    },
    enabled: !!activeTurfId,
  });

  // Realtime
  useEffect(() => {
    if (!activeTurfId) return;
    const ch = supabase
      .channel(`owner-live-${activeTurfId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_matches", filter: `turf_id=eq.${activeTurfId}` }, () => {
        qc.invalidateQueries({ queryKey: ["owner-live-matches", activeTurfId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeTurfId, qc]);

  async function createMatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeTurfId) return toast.error("Pick a turf first");
    setCreating(true);
    try {
      const fd = new FormData(e.currentTarget);
      const { error } = await supabase.from("live_matches").insert({
        turf_id: activeTurfId,
        team_a: String(fd.get("team_a") ?? "").trim(),
        team_b: String(fd.get("team_b") ?? "").trim(),
        status: "scheduled",
      });
      if (error) throw error;
      (e.target as HTMLFormElement).reset();
      qc.invalidateQueries({ queryKey: ["owner-live-matches", activeTurfId] });
      toast.success("Match added");
    } catch (err) { toast.error((err as Error).message); }
    finally { setCreating(false); }
  }

  async function setScore(m: Match, side: "a" | "b", delta: number) {
    const nextA = side === "a" ? Math.max(0, m.score_a + delta) : m.score_a;
    const nextB = side === "b" ? Math.max(0, m.score_b + delta) : m.score_b;
    const patch: {
      score_a: number;
      score_b: number;
      status?: "live";
      started_at?: string;
    } = { score_a: nextA, score_b: nextB };
    if (m.status === "scheduled") { patch.status = "live"; patch.started_at = new Date().toISOString(); }
    const { error } = await supabase.from("live_matches").update(patch).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("live_score_events").insert({
      match_id: m.id,
      event_type: delta > 0 ? `${side}_score+${delta}` : `${side}_score${delta}`,
      payload: { score_a: nextA, score_b: nextB, side, delta } as never,
    });
  }

  async function startMatch(m: Match) {
    const { error } = await supabase.from("live_matches").update({ status: "live", started_at: new Date().toISOString() }).eq("id", m.id);
    if (error) toast.error(error.message);
  }

  async function endMatch(m: Match) {
    if (!confirm("End this match? Final score will be locked in.")) return;
    const { error } = await supabase.from("live_matches").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", m.id);
    if (error) toast.error(error.message);
  }

  if (!turfs || turfs.length === 0) {
    return (
      <DashShell area="owner" title="Live score entry">
        <EmptyState icon={<Activity className="h-4 w-4" />} title="No turfs yet" description="Add a turf to start running matches." />
      </DashShell>
    );
  }

  return (
    <DashShell
      area="owner"
      title="Live score entry"
      subtitle="Run matches at your turf — taps update spectator screens in real time."
      actions={
        <Select value={activeTurfId} onValueChange={setTurfId}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(turfs ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      <form onSubmit={createMatch} className="surface-card mb-6 flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1 min-w-[160px]"><Label htmlFor="team_a">Team A</Label><Input id="team_a" name="team_a" required className="mt-1.5" /></div>
        <div className="grid place-items-center pb-2 text-muted-foreground">vs</div>
        <div className="flex-1 min-w-[160px]"><Label htmlFor="team_b">Team B</Label><Input id="team_b" name="team_b" required className="mt-1.5" /></div>
        <Button type="submit" disabled={creating}>{creating ? "Adding…" : "Add match"}</Button>
      </form>

      {!matches || matches.length === 0 ? (
        <EmptyState icon={<Activity className="h-4 w-4" />} title="No matches yet" description="Add a match above to start tracking the score." />
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <div key={m.id} className="surface-card p-5">
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                  m.status === "live" ? "bg-destructive/15 text-destructive animate-pulse" :
                  m.status === "completed" ? "bg-muted text-muted-foreground" :
                  "bg-warning/15 text-warning-foreground"
                }`}>{m.status}</span>
                <p className="text-xs text-muted-foreground">
                  {m.started_at ? `Started ${formatDateTime(m.started_at)}` : "Not started"}
                  {m.ended_at ? ` · Ended ${formatDateTime(m.ended_at)}` : ""}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <ScoreSide name={m.team_a} score={m.score_a} disabled={m.status === "completed"} onDelta={(d) => setScore(m, "a", d)} />
                <div className="text-center text-xs uppercase tracking-wide text-muted-foreground">vs</div>
                <ScoreSide name={m.team_b} score={m.score_b} disabled={m.status === "completed"} onDelta={(d) => setScore(m, "b", d)} />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                {m.status === "scheduled" && (
                  <Button size="sm" variant="outline" onClick={() => startMatch(m)}>Start</Button>
                )}
                {m.status === "live" && (
                  <Button size="sm" variant="outline" onClick={() => endMatch(m)}><Square className="h-3.5 w-3.5 mr-1" />End match</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashShell>
  );
}

function ScoreSide({ name, score, disabled, onDelta }: { name: string; score: number; disabled: boolean; onDelta: (d: number) => void }) {
  return (
    <div className="text-center">
      <p className="font-display text-sm font-semibold truncate">{name}</p>
      <p className="my-2 font-display text-5xl font-bold tabular-nums">{score}</p>
      <div className="flex justify-center gap-2">
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onDelta(-1)}><Minus className="h-3.5 w-3.5" /></Button>
        <Button size="sm" disabled={disabled} onClick={() => onDelta(1)}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
