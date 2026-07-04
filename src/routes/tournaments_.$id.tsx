import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, MapPin, Trophy, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/tournaments_/$id")({
  head: () => ({ meta: [{ title: "Tournament — Bowlie" }] }),
  component: TournamentDetail,
});

function TournamentDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [teamId, setTeamId] = useState<string>("");
  const [registering, setRegistering] = useState(false);

  const { data: t, isLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*, turfs(name, city, address, slug)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: capacity } = useQuery({
    queryKey: ["tournament-capacity", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tournament_capacity", { _tournament_id: id });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { approved_count: number; max_teams: number | null; is_full: boolean } | null;
    },
    refetchInterval: 15000,
  });

  const { data: regs } = useQuery({
    queryKey: ["tournament-regs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_registrations")
        .select("id, status, team_id, user_id, teams(id, name, logo_url)")
        .eq("tournament_id", id);
      return data ?? [];
    },
  });

  const { data: fixtures } = useQuery({
    queryKey: ["tournament-fixtures", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_fixtures")
        .select("*, team_a:teams!tournament_fixtures_team_a_id_fkey(id, name), team_b:teams!tournament_fixtures_team_b_id_fkey(id, name)")
        .eq("tournament_id", id)
        .order("round").order("position");
      return data ?? [];
    },
  });


  const { data: myTeams } = useQuery({
    queryKey: ["my-teams", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("teams").select("id, name").eq("captain_id", user.id).order("name");
      return data ?? [];
    },
    enabled: !!user,
  });

  // Realtime: live bracket advancement
  useEffect(() => {
    const ch = supabase
      .channel(`public-tournament-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_fixtures", filter: `tournament_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["tournament-fixtures", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_registrations", filter: `tournament_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["tournament-regs", id] });
          qc.invalidateQueries({ queryKey: ["tournament-capacity", id] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);


  if (isLoading) return <PublicShell><div className="container-page py-10"><div className="h-64 animate-pulse bg-muted rounded-2xl" /></div></PublicShell>;
  if (!t) return <PublicShell><div className="container-page py-16 text-center text-muted-foreground">Tournament not found.</div></PublicShell>;

  const myReg = (regs ?? []).find((r) => r.user_id === user?.id);
  const approvedCount = capacity?.approved_count ?? 0;
  const maxTeams = capacity?.max_teams ?? t.max_teams ?? null;
  const isFull = capacity?.is_full ?? (maxTeams ? approvedCount >= maxTeams : false);
  const spotsLeft = maxTeams != null ? Math.max(maxTeams - approvedCount, 0) : null;
  const isHost = !!user && user.id === t.owner_id;
  const isClosed = t.status !== "open";
  const canRegister = !!user && !isClosed && !myReg && !isFull;

  // Eligibility checklist — explains exactly why join is/isn't available
  const eligibility = [
    { ok: !!user, label: "Signed in", hint: "Sign in to register for this tournament." },
    { ok: !isClosed, label: `Registration ${isClosed ? `is ${t.status}` : "is open"}`, hint: `Host has set status to "${t.status}".` },
    { ok: !myReg, label: myReg ? "You're already registered" : "Not yet registered", hint: myReg ? `Current status: ${myReg.status}.` : "Pick a team or solo, then tap Join." },
    { ok: !isFull, label: isFull ? "Tournament is full" : maxTeams ? `${spotsLeft} of ${maxTeams} spots left` : "Unlimited spots", hint: isFull ? "Wait for the host to expand the bracket or look for another tournament." : undefined },
  ];

  async function register() {
    if (!user) return;
    setRegistering(true);
    try {
      const chosenTeam = teamId && teamId !== "__solo__" ? teamId : null;
      const { error } = await supabase.from("tournament_registrations").insert({
        tournament_id: id,
        user_id: user.id,
        team_id: chosenTeam,
        status: "approved", // instant join — no host approval required
      });
      if (error) {
        toast.error(error.message.includes("duplicate") ? "You're already registered for this tournament." : error.message);
        return;
      }
      toast.success(chosenTeam ? "You're in! Team registered." : "You're in! See you on match day.");
      // Force immediate refetch so the capacity badge updates without waiting for the 15s poll
      await Promise.all([
        qc.refetchQueries({ queryKey: ["tournament-regs", id] }),
        qc.refetchQueries({ queryKey: ["tournament-capacity", id] }),
      ]);
    } finally {
      setRegistering(false);
    }
  }


  return (
    <PublicShell>
      <div className="border-b border-border bg-surface">
        <div className="container-page grid gap-8 py-10 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <Link to="/tournaments" className="text-xs text-muted-foreground hover:underline">← All tournaments</Link>
            <p className="eyebrow mt-3 capitalize">{t.status} · {t.format ?? "tournament"}</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{t.name}</h1>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatDate(t.start_date)}{t.end_date && ` – ${formatDate(t.end_date)}`}</span>
              {t.turfs && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{t.turfs.name}, {t.turfs.city}</span>}
              <span className="flex items-center gap-1.5"><Users2 className="h-4 w-4" />{approvedCount}{maxTeams ? ` / ${maxTeams}` : ""} teams</span>
              {spotsLeft != null && (
                <span className={`flex items-center gap-1.5 font-medium ${isFull ? "text-destructive" : spotsLeft <= 2 ? "text-amber-600" : "text-success"}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${isFull ? "bg-destructive" : "bg-success animate-pulse"}`} />
                  {isFull ? "Full" : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
                </span>
              )}
            </div>

            {t.description && <p className="mt-5 max-w-2xl text-sm leading-relaxed text-foreground/80">{t.description}</p>}
          </div>
          <aside className="surface-card h-fit p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Entry fee</p>
            <p className="mt-1 font-display text-3xl font-bold">{formatPrice(t.entry_fee)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Pay the host at the venue on match day.</p>

            {/* Eligibility checklist — always visible so players know exactly where they stand */}
            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Can I join?</p>
              <ul className="mt-2 space-y-1.5 text-xs">
                {eligibility.map((e, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`mt-0.5 inline-block h-3.5 w-3.5 rounded-full border ${e.ok ? "border-success bg-success/20" : "border-destructive bg-destructive/20"}`}>
                      <span className={`block h-full w-full rounded-full ${e.ok ? "bg-success" : "bg-destructive"} scale-50`} />
                    </span>
                    <span>
                      <span className={e.ok ? "text-foreground" : "text-destructive font-medium"}>{e.label}</span>
                      {e.hint && !e.ok && <span className="block text-muted-foreground">{e.hint}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {isHost && (
                <p className="mt-2 text-[11px] text-muted-foreground">You're the host — you can still register yourself as a player.</p>
              )}
            </div>

            {!user ? (
              <Button asChild className="mt-4 w-full" size="lg">
                <Link to="/auth" search={{ mode: "signin" }}>Sign in to join</Link>
              </Button>
            ) : myReg ? (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-sm font-semibold text-emerald-700">You're registered 🎉</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status: <span className="capitalize">{myReg.status}</span>. We'll notify you when the bracket is published.
                </p>
              </div>
            ) : !canRegister ? (
              <div className="mt-4 rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
                {isFull
                  ? "This tournament is full. Check back if a slot opens up."
                  : isClosed
                  ? `Registration is ${t.status}. The host has paused or closed sign-ups.`
                  : "Joining is not available right now."}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Playing as</p>
                  <Select value={teamId || "__solo__"} onValueChange={setTeamId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__solo__">Solo / pick-up</SelectItem>
                      {(myTeams ?? []).map((tm) => (
                        <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Link to="/teams" className="mt-1 inline-block text-xs text-accent hover:underline">
                    + Create a team
                  </Link>
                </div>
                <Button onClick={register} disabled={registering} className="w-full" size="lg">
                  {registering ? "Joining…" : "Join tournament"}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Instant confirmation · no host approval needed
                </p>
              </div>
            )}
          </aside>

        </div>
      </div>


      <div className="container-page grid gap-8 py-10 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-lg font-semibold mb-4">Approved teams ({approvedCount})</h2>
          {(regs ?? []).filter((r) => r.status === "approved").length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {approvedCount > 0
                ? `${approvedCount} team${approvedCount === 1 ? "" : "s"} registered. Sign in as the host to see the roster.`
                : "No teams approved yet. Be the first to join!"}
            </p>
          ) : (
            <ul className="divide-y divide-border surface-card">
              {(regs ?? []).filter((r) => r.status === "approved").map((r: any, i: number) => (
                <li key={r.id} className="flex items-center gap-3 p-4">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                  <span className="font-medium">{r.teams?.name ?? "Solo player"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>


        <section>
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2"><Trophy className="h-4 w-4" /> Bracket</h2>
          {(fixtures ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Bracket not published yet.</p>
          ) : (
            <Bracket fixtures={fixtures ?? []} />
          )}
        </section>
      </div>
    </PublicShell>
  );
}

function Bracket({ fixtures }: { fixtures: any[] }) {
  const rounds = new Map<number, any[]>();
  for (const f of fixtures) {
    const arr = rounds.get(f.round) ?? [];
    arr.push(f); rounds.set(f.round, arr);
  }
  return (
    <div className="flex gap-4 overflow-x-auto">
      {Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]).map(([round, fs]) => (
        <div key={round} className="min-w-[200px] space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Round {round}</p>
          {fs.map((f) => (
            <div key={f.id} className="surface-card p-3 text-sm">
              <FixtureRow name={f.team_a?.name ?? "TBD"} score={f.score_a} winner={f.winner_team_id === f.team_a?.id} />
              <FixtureRow name={f.team_b?.name ?? "TBD"} score={f.score_b} winner={f.winner_team_id === f.team_b?.id} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FixtureRow({ name, score, winner }: { name: string; score: number | null; winner: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${winner ? "font-semibold text-success" : ""}`}>
      <span className="truncate">{name}</span>
      <span className="tabular-nums text-muted-foreground">{score ?? "—"}</span>
    </div>
  );
}
