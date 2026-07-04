import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/site/PublicShell";
import { EmptyState } from "@/components/site/EmptyState";
import { Tv } from "lucide-react";

export const Route = createFileRoute("/live-scores")({
  head: () => ({ meta: [{ title: "Live scores — Bowlie" }] }),
  component: LiveScoresPage,
});

function LiveScoresPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["live-matches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_matches")
        .select("id, team_a, team_b, score_a, score_b, status, started_at, sports(name), turfs(name, city)")
        .in("status", ["live", "scheduled", "completed"])
        .order("started_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  return (
    <PublicShell>
      <div className="border-b border-border bg-surface">
        <div className="container-page py-10">
          <p className="eyebrow">Live</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Live scores & fixtures
          </h1>
        </div>
      </div>
      <div className="container-page py-10">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Tv className="h-4 w-4" />}
            title="No matches yet"
            description="When owners or tournament hosts publish matches, live scores will appear here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.map((m: any) => (
              <div key={m.id} className="surface-card p-5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]">
                  <span className={m.status === "live" ? "text-destructive" : "text-muted-foreground"}>
                    ● {m.status}
                  </span>
                  <span className="text-muted-foreground">{m.sports?.name ?? ""}</span>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <p className="text-right font-medium">{m.team_a}</p>
                  <p className="font-display text-2xl font-bold">
                    {m.score_a} <span className="text-muted-foreground">–</span> {m.score_b}
                  </p>
                  <p className="font-medium">{m.team_b}</p>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {m.turfs?.name} · {m.turfs?.city}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
