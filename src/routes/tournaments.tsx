import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/site/PublicShell";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice } from "@/lib/format";
import { CalendarDays, Trophy } from "lucide-react";

export const Route = createFileRoute("/tournaments")({
  head: () => ({
    meta: [
      { title: "Tournaments — Bowlie" },
      { name: "description", content: "Browse and apply to upcoming tournaments hosted on Bowlie." },
    ],
  }),
  component: TournamentsPage,
});

function TournamentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["tournaments-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id, name, description, start_date, end_date, entry_fee, max_teams, status, banner_url, turfs(name, city)")
        .in("status", ["open", "live", "closed"])
        .order("start_date", { ascending: true })
        .limit(30);
      return data ?? [];
    },
  });

  return (
    <PublicShell>
      <div className="border-b border-border bg-surface">
        <div className="container-page py-10">
          <p className="eyebrow">Tournaments</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Compete in the next big match
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Discover open tournaments, see fixtures, and register your team.
          </p>
        </div>
      </div>

      <div className="container-page py-10">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-4 w-4" />}
            title="No tournaments yet"
            description="Owners can host tournaments from their dashboard. They'll show up here as soon as they're open."
            action={
              <Button asChild variant="outline">
                <Link to="/owner-onboarding">Host a tournament</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((t: any) => (
              <Link to="/tournaments/$id" params={{ id: t.id }} key={t.id} className="surface-card overflow-hidden hover:border-accent transition-colors">
                <div className="aspect-[16/9] bg-muted">
                  {t.banner_url && <img src={t.banner_url} alt={t.name} className="h-full w-full object-cover" />}
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                    {t.status}
                  </p>
                  <h3 className="mt-2 font-display text-lg font-semibold">{t.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.turfs?.name} · {t.turfs?.city}
                  </p>
                  <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(t.start_date)}
                    {t.end_date && ` – ${formatDate(t.end_date)}`}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm font-semibold">{formatPrice(t.entry_fee)} entry</p>
                    {t.max_teams && (
                      <p className="text-xs text-muted-foreground">Max {t.max_teams} teams</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
