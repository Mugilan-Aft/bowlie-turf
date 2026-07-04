import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { SquadCard } from "@/components/squad/SquadCard";

export const Route = createFileRoute("/_authenticated/squad-fill")({
  head: () => ({ meta: [{ title: "My squad activity — Bowlie" }] }),
  component: MySquadsPage,
});

function MySquadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const hosted = useQuery({
    queryKey: ["my-hosted-posts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("squad_fill_posts")
        .select(`
          *,
          bookings(start_at, end_at, turfs(name, city, slug, cover_image_url)),
          sports(name)
        `)
        .eq("host_id", user!.id)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as any[];
      return rows.map((r) => ({ ...r, profiles: { full_name: "You" } }));
    },
  });

  const joined = useQuery({
    queryKey: ["my-join-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("squad_fill_requests")
        .select(`
          id, status, created_at,
          squad_fill_posts (
            *,
            bookings(start_at, end_at, turfs(name, city, slug, cover_image_url)),
            sports(name)
          )
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as any[];
      const hostIds = Array.from(new Set(rows.map((r) => r.squad_fill_posts?.host_id).filter(Boolean)));
      const pmap: Record<string, string> = {};
      if (hostIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", hostIds);
        for (const p of profs ?? []) pmap[(p as any).id] = (p as any).full_name;
      }
      return rows.map((r) => r.squad_fill_posts ? {
        ...r,
        squad_fill_posts: { ...r.squad_fill_posts, profiles: { full_name: pmap[r.squad_fill_posts.host_id] ?? "Host" } },
      } : r);
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("my-squads-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_fill_posts" }, () => {
        qc.invalidateQueries({ queryKey: ["my-hosted-posts"] });
        qc.invalidateQueries({ queryKey: ["my-join-requests"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_fill_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["my-hosted-posts"] });
        qc.invalidateQueries({ queryKey: ["my-join-requests"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <DashShell
      area="player"
      title="Squad fill"
      subtitle="Your hosted posts and games you've asked to join."
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/open-games">Browse open games</Link></Button>
          <Button asChild><Link to="/squad-fill/new">+ New post</Link></Button>
        </div>
      }
    >
      <section>
        <h2 className="font-display text-lg font-semibold">Hosted by you</h2>
        <div className="mt-4">
          {hosted.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2"><div className="h-44 animate-pulse rounded-xl bg-muted" /></div>
          ) : !hosted.data || hosted.data.length === 0 ? (
            <EmptyState
              icon={<Users2 className="h-4 w-4" />}
              title="No squad posts yet"
              description="Open a post from one of your upcoming bookings to start filling spots."
              action={<Button asChild><Link to="/squad-fill/new">New squad post</Link></Button>}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hosted.data.map((p: any) => (
                <SquadCard
                  key={p.id}
                  post={p}
                  ctaSlot={
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link to="/squad/$id" params={{ id: p.id }}>Manage requests</Link>
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold">Games you've joined</h2>
        <div className="mt-4">
          {joined.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2"><div className="h-44 animate-pulse rounded-xl bg-muted" /></div>
          ) : !joined.data || joined.data.length === 0 ? (
            <EmptyState
              icon={<Users2 className="h-4 w-4" />}
              title="No active join requests"
              description="Find open games and request to join."
              action={<Button asChild variant="outline"><Link to="/open-games">Browse open games</Link></Button>}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {joined.data.map((r: any) => r.squad_fill_posts && (
                <SquadCard
                  key={r.id}
                  post={r.squad_fill_posts}
                  myRequestStatus={r.status}
                  ctaSlot={
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link to="/squad/$id" params={{ id: r.squad_fill_posts.id }}>View post</Link>
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </DashShell>
  );
}
