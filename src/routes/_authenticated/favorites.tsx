import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { TurfCard } from "@/components/site/TurfCard";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "Favorites — Bowlie" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("favorites")
        .select("turfs(id, slug, name, city, cover_image_url, base_price, rating, total_reviews)")
        .eq("user_id", user.id);
      return (data ?? []).map((f: any) => f.turfs).filter(Boolean);
    },
    enabled: !!user,
  });

  return (
    <DashShell area="player" title="Favorites" subtitle="Quick access to turfs you love.">
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-4 w-4" />}
          title="No favorites yet"
          description="Tap the heart on any turf to save it for later."
          action={<Button asChild><Link to="/browse">Browse turfs</Link></Button>}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t: any) => <TurfCard key={t.id} turf={t} />)}
        </div>
      )}
    </DashShell>
  );
}
