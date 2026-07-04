import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { History, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/owner/tournaments/$id")({
  head: () => ({ meta: [{ title: "Manage tournament — Owner" }] }),
  component: ManageTournament,
});

type Status = "draft" | "open" | "closed" | "live" | "completed" | "cancelled";

function ManageTournament() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: t, isLoading } = useQuery({
    queryKey: ["owner-tournament", id],
    queryFn: async () => {
      const { data } = await supabase.from("tournaments").select("*, turfs(name)").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: regs } = useQuery({
    queryKey: ["owner-tournament-regs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_registrations")
        .select("id, status, team_id, user_id, teams(id, name)")
        .eq("tournament_id", id)
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: fixtures } = useQuery({
    queryKey: ["owner-tournament-fixtures", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_fixtures")
        .select("*, team_a:teams!tournament_fixtures_team_a_id_fkey(id, name), team_b:teams!tournament_fixtures_team_b_id_fkey(id, name)")
        .eq("tournament_id", id)
        .order("round").order("position");
      return data ?? [];
    },
  });

  // Realtime: refresh fixtures and events when anything changes for this tournament
  useEffect(() => {
    const ch = supabase
      .channel(`owner-tournament-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_fixtures", filter: `tournament_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["owner-tournament-fixtures", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "fixture_score_events", filter: `tournament_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["fixture-events", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (isLoading) return <DashShell area="owner"><div className="h-40 animate-pulse bg-muted rounded" /></DashShell>;
  if (!t) return <DashShell area="owner" title="Not found"><p className="text-sm text-muted-foreground">Tournament not found.</p></DashShell>;
  if (user && t.owner_id !== user.id) return <DashShell area="owner" title="Unauthorized"><p className="text-sm text-muted-foreground">You do not own this tournament.</p></DashShell>;

  async function setStatus(status: Status) {
    const { error } = await supabase.from("tournaments").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Status: ${status}`);
    qc.invalidateQueries({ queryKey: ["owner-tournament", id] });
  }

  async function setRegStatus(regId: string, status: "approved" | "rejected" | "pending") {
    const { error } = await supabase.from("tournament_registrations").update({ status }).eq("id", regId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["owner-tournament-regs", id] });
  }

  async function deleteTournament() {
    if (!confirm("Delete this tournament and all fixtures/registrations?")) return;
    const { error } = await supabase.from("tournaments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    window.location.href = "/owner/tournaments";
  }

  async function generateBracket() {
    const approved = (regs ?? []).filter((r) => r.status === "approved" && r.team_id);
    if (approved.length < 2) return toast.error("Need at least 2 approved teams with a team assigned");
    if ((fixtures ?? []).length > 0 && !confirm("Replace existing bracket?")) return;
    await supabase.from("tournament_fixtures").delete().eq("tournament_id", id);

    // Pad to next power of two
    const teams = approved.map((r) => r.team_id as string);
    let size = 1;
    while (size < teams.length) size *= 2;
    const padded: (string | null)[] = [...teams];
    while (padded.length < size) padded.push(null);
    // Shuffle
    for (let i = padded.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [padded[i], padded[j]] = [padded[j], padded[i]];
    }

    const rows: any[] = [];
    // Round 1
    for (let i = 0; i < size / 2; i++) {
      rows.push({
        tournament_id: id, round: 1, position: i,
        team_a_id: padded[i * 2], team_b_id: padded[i * 2 + 1],
        status: "scheduled",
      });
    }
    // Empty later rounds
    let cur = size / 2;
    let round = 2;
    while (cur > 1) {
      cur = cur / 2;
      for (let i = 0; i < cur; i++) {
        rows.push({ tournament_id: id, round, position: i, status: "scheduled" });
      }
      round += 1;
    }

    const { error } = await supabase.from("tournament_fixtures").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Bracket generated (${teams.length} teams)`);
    qc.invalidateQueries({ queryKey: ["owner-tournament-fixtures", id] });
  }

  return (
    <DashShell
      area="owner"
      title={t.name}
      subtitle={`${t.turfs?.name} · ${formatDate(t.start_date)} · ${formatPrice(t.entry_fee)} entry`}
      actions={
        <>
          <Button asChild variant="outline"><Link to="/tournaments/$id" params={{ id }}>Public page</Link></Button>
          <Select value={t.status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["draft", "open", "closed", "live", "completed", "cancelled"] as const).map((s) =>
                <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={deleteTournament}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
        </>
      }
    >
      <Tabs defaultValue="registrations">
        <TabsList>
          <TabsTrigger value="registrations">Registrations ({(regs ?? []).length})</TabsTrigger>
          <TabsTrigger value="bracket">Bracket</TabsTrigger>
        </TabsList>

        <TabsContent value="registrations" className="mt-6">
          {(regs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No registrations yet.</p>
          ) : (
            <div className="space-y-2">
              {(regs ?? []).map((r: any) => (
                <div key={r.id} className="surface-card flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{r.teams?.name ?? "Solo player"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.status}</p>
                  </div>
                  <div className="flex gap-2">
                    {r.status !== "approved" && <Button size="sm" onClick={() => setRegStatus(r.id, "approved")}>Approve</Button>}
                    {r.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => setRegStatus(r.id, "rejected")}>Reject</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bracket" className="mt-6">
          <div className="mb-4 flex items-center gap-3">
            <Button onClick={generateBracket}>
              {(fixtures ?? []).length > 0 ? "Regenerate bracket" : "Generate bracket"}
            </Button>
            <p className="text-xs text-muted-foreground">Single-elimination from approved teams with a team assigned.</p>
          </div>
          {(fixtures ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No fixtures. Approve teams, then generate the bracket.</p>
          ) : (
            <BracketEditor fixtures={fixtures ?? []} tournamentId={id} userId={user?.id ?? null} />
          )}
        </TabsContent>
      </Tabs>
    </DashShell>
  );
}

function BracketEditor({ fixtures, tournamentId, userId }: { fixtures: any[]; tournamentId: string; userId: string | null }) {
  const qc = useQueryClient();
  const rounds = new Map<number, any[]>();
  for (const f of fixtures) {
    const arr = rounds.get(f.round) ?? [];
    arr.push(f); rounds.set(f.round, arr);
  }

  async function saveScore(f: any, scoreA: number, scoreB: number, note: string) {
    const winner_team_id = scoreA === scoreB ? null : scoreA > scoreB ? f.team_a_id : f.team_b_id;
    const status = scoreA === scoreB ? "live" : "completed";
    const { error } = await supabase.from("tournament_fixtures").update({
      score_a: scoreA, score_b: scoreB, winner_team_id, status,
    }).eq("id", f.id);
    if (error) return toast.error(error.message);

    // Audit
    if (userId) {
      await supabase.from("fixture_score_events").insert({
        fixture_id: f.id,
        tournament_id: tournamentId,
        score_a: scoreA,
        score_b: scoreB,
        status,
        note: note || null,
        created_by: userId,
      });
    }

    // Advance winner to next round
    if (winner_team_id) {
      const nextRound = f.round + 1;
      const nextPos = Math.floor(f.position / 2);
      const next = fixtures.find((x) => x.round === nextRound && x.position === nextPos);
      if (next) {
        const patch = f.position % 2 === 0
          ? { team_a_id: winner_team_id }
          : { team_b_id: winner_team_id };
        await supabase.from("tournament_fixtures").update(patch).eq("id", next.id);
      }
    }
    toast.success("Score saved");
    qc.invalidateQueries({ queryKey: ["owner-tournament-fixtures", tournamentId] });
  }

  return (
    <div className="flex gap-4 overflow-x-auto">
      {Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]).map(([round, fs]) => (
        <div key={round} className="min-w-[280px] space-y-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Round {round}</p>
          {fs.map((f) => <FixtureCard key={f.id} f={f} tournamentId={tournamentId} onSave={saveScore} />)}
        </div>
      ))}
    </div>
  );
}

function FixtureCard({ f, tournamentId, onSave }: { f: any; tournamentId: string; onSave: (f: any, a: number, b: number, note: string) => void }) {
  const [a, setA] = useState<string>(f.score_a?.toString() ?? "");
  const [b, setB] = useState<string>(f.score_b?.toString() ?? "");
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const playable = f.team_a_id && f.team_b_id;

  const { data: events } = useQuery({
    queryKey: ["fixture-events", tournamentId, f.id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("fixture_score_events")
        .select("id, score_a, score_b, status, note, created_at, created_by")
        .eq("fixture_id", f.id)
        .order("created_at", { ascending: false })
        .limit(20);
      const list = rows ?? [];
      const ids = Array.from(new Set(list.map((r) => r.created_by).filter(Boolean))) as string[];
      let names = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        names = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
      }
      return list.map((r) => ({ ...r, author: r.created_by ? names.get(r.created_by) ?? "Unknown" : "System" }));
    },
    enabled: showHistory,
  });

  return (
    <div className="surface-card p-3 text-sm">
      <Row name={f.team_a?.name ?? "TBD"} score={a} setScore={setA} winner={f.winner_team_id === f.team_a_id} />
      <Row name={f.team_b?.name ?? "TBD"} score={b} setScore={setB} winner={f.winner_team_id === f.team_b_id} />
      {playable && (
        <>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (e.g. 'HT 1-0')"
            className="mt-2 h-7 text-xs"
          />
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" variant="outline" className="flex-1"
              onClick={() => { onSave(f, Number(a || 0), Number(b || 0), note); setNote(""); }}>
              Save score
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowHistory((s) => !s)} title="History">
              <History className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
      {showHistory && (
        <div className="mt-2 border-t border-border pt-2 space-y-1.5">
          {!events || events.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No updates yet.</p>
          ) : events.map((ev: any) => (
            <div key={ev.id} className="text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="font-medium tabular-nums">{ev.score_a ?? "—"} : {ev.score_b ?? "—"}</span>
                <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <p className="text-muted-foreground">
                {ev.author}
                {ev.note && <span> — {ev.note}</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ name, score, setScore, winner }: { name: string; score: string; setScore: (s: string) => void; winner: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1 ${winner ? "font-semibold text-success" : ""}`}>
      <span className="truncate flex-1">{name}</span>
      <Input value={score} onChange={(e) => setScore(e.target.value)} type="number" min={0} className="h-7 w-14 text-right" />
    </div>
  );
}
