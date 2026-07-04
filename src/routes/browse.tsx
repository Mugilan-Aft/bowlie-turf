import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { z } from "zod";
import { Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/site/PublicShell";
import { TurfCard, type TurfCardData } from "@/components/site/TurfCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/site/EmptyState";

const searchSchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  sport: z.string().optional(),
});

export const Route = createFileRoute("/browse")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Browse turfs — Bowlie" },
      { name: "description", content: "Discover and book turfs near you. Filter by sport, city, and price." },
    ],
  }),
  component: BrowsePage,
});

async function fetchTurfs(filters: { q?: string; city?: string }): Promise<TurfCardData[]> {
  let query = supabase
    .from("turfs")
    .select("id, slug, name, city, cover_image_url, base_price, rating, total_reviews")
    .eq("status", "approved")
    .order("rating", { ascending: false });
  if (filters.city) query = query.ilike("city", `%${filters.city}%`);
  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  const { data, error } = await query.limit(60);
  if (error) throw error;
  return data ?? [];
}

async function fetchSports() {
  const { data } = await supabase.from("sports").select("id, name, slug").order("name");
  return data ?? [];
}

function BrowsePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const [city, setCity] = useState(search.city ?? "");

  const { data: turfs, isLoading } = useQuery({
    queryKey: ["turfs", search.q, search.city],
    queryFn: () => fetchTurfs({ q: search.q, city: search.city }),
  });
  const { data: sports } = useQuery({ queryKey: ["sports"], queryFn: fetchSports });

  const activeSport = search.sport;
  const filtered = useMemo(() => turfs ?? [], [turfs]);

  return (
    <PublicShell>
      <div className="border-b border-border bg-surface">
        <div className="container-page py-10">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Find your turf
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {turfs?.length ?? 0} approved turfs · filter by city and sport
          </p>

          <form
            className="mt-6 grid gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft sm:grid-cols-[1.4fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({
                search: { ...search, q: q || undefined, city: city || undefined },
              });
            }}
          >
            <label className="flex items-center gap-2 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search turfs..."
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </label>
            <label className="flex items-center gap-2 px-3 sm:border-l sm:border-border">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </label>
            <Button type="submit">Apply</Button>
          </form>

          {sports && sports.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => navigate({ search: { ...search, sport: undefined } })}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  !activeSport
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                All sports
              </button>
              {sports.map((sp) => (
                <button
                  key={sp.id}
                  onClick={() => navigate({ search: { ...search, sport: sp.slug } })}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    activeSport === sp.slug
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sp.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container-page py-10">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No turfs match this search"
            description="Try a different city or sport — or come back soon as we onboard more venues."
            action={
              <Button asChild variant="outline">
                <Link to="/owner-onboarding">Own a turf? List it</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <TurfCard key={t.id} turf={t} />
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
