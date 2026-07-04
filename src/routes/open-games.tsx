import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Users2, Zap } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PublicShell } from "@/components/site/PublicShell";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SquadCard } from "@/components/squad/SquadCard";

const searchSchema = z.object({
  type: z.enum(["all", "emergency", "pre_match"]).optional(),
  skill: z.enum(["any", "beginner", "intermediate", "advanced", "pro"]).optional(),
  city: z.string().optional(),
});

export const Route = createFileRoute("/open-games")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Open games — find players near you · Bowlie" },
      { name: "description", content: "Browse open squad-fill posts: pre-match and emergency fills. Join games near you with one tap." },
      { property: "og:title", content: "Open games · Bowlie" },
      { property: "og:description", content: "Pre-match and emergency squad fills near you." },
    ],
  }),
  component: OpenGamesPage,
});

function OpenGamesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const nav = Route.useNavigate();
  const [city, setCity] = useState(search.city ?? "");

  const { data, isLoading } = useQuery({
    queryKey: ["open-games", search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_open_squad_posts");
      if (error) throw error;
      let rows = (data ?? []).map((r: any) => ({
        ...r,
        bookings: { start_at: r.start_at, end_at: r.end_at, turfs: { name: r.turf_name, city: r.turf_city, slug: r.turf_slug, cover_image_url: r.turf_cover_image_url } },
        sports: r.sport_name ? { name: r.sport_name } : null,
        profiles: { full_name: r.host_name ?? "Host" },
      })) as any[];
      if (search.type && search.type !== "all") rows = rows.filter((r) => r.fill_type === search.type);
      if (search.skill) rows = rows.filter((r) => r.skill_level === search.skill);
      if (search.city && search.city.trim()) {
        const c = search.city.trim().toLowerCase();
        rows = rows.filter((r) => r.turf_city?.toLowerCase().includes(c));
      }
      return rows;
    },
  });


  const myReqs = useQuery({
    queryKey: ["my-squad-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("squad_fill_requests")
        .select("post_id, status")
        .eq("user_id", user!.id);
      const map: Record<string, string> = {};
      for (const r of data ?? []) map[(r as any).post_id] = (r as any).status;
      return map;
    },
  });

  // Surface the signed-in user's upcoming bookings so they can host a post in one tap.
  const myUpcoming = useQuery({
    queryKey: ["my-upcoming-for-host", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, start_at, turfs(name, city), squad_fill_posts(id, status)")
        .eq("user_id", user!.id)
        .in("status", ["pending", "confirmed"])
        .gte("start_at", new Date().toISOString())
        .order("start_at")
        .limit(6);
      return (data ?? []).filter(
        (b: any) => !(b.squad_fill_posts ?? []).some((p: any) => p.status === "open" || p.status === "full"),
      );
    },
  });


  const join = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error("Sign in to join");
      const { error } = await supabase.from("squad_fill_requests").insert({ post_id: postId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: (_d, postId) => {
      toast.success("Request sent");
      qc.invalidateQueries({ queryKey: ["open-games"] });
      qc.invalidateQueries({ queryKey: ["my-squad-requests"] });
      qc.invalidateQueries({ queryKey: ["squad-post", postId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Realtime: refresh on any post/request change
  useEffect(() => {
    const ch = supabase
      .channel("open-games-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_fill_posts" }, () => {
        qc.invalidateQueries({ queryKey: ["open-games"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_fill_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["open-games"] });
        qc.invalidateQueries({ queryKey: ["my-squad-requests"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const counts = useMemo(() => {
    const emergency = (data ?? []).filter((p: any) => p.fill_type === "emergency").length;
    return { total: data?.length ?? 0, emergency };
  }, [data]);

  return (
    <PublicShell>
      <section className="container-page py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Squad fill</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Open games near you</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {counts.total} live posts · {counts.emergency} emergency
            </p>
          </div>
          <Button asChild>
            {user ? (
              <Link to="/squad-fill/new">+ New squad post</Link>
            ) : (
              <Link to="/auth" search={{ mode: "signin", next: "/squad-fill/new" } as any}>
                Sign in to post
              </Link>
            )}
          </Button>
        </header>

        {user && (myUpcoming.data?.length ?? 0) > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Host a post</p>
                <p className="mt-0.5 text-sm">Open spots on one of your upcoming bookings — players join instantly.</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {myUpcoming.data!.map((b: any) => (
                <Link
                  key={b.id}
                  to="/squad-fill/new"
                  search={{ booking: b.id }}
                  className="group min-w-[220px] shrink-0 rounded-lg border border-border bg-background p-3 transition hover:border-foreground/40"
                >
                  <p className="truncate text-sm font-medium">{b.turfs?.name ?? "Booking"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(b.start_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  <p className="mt-2 text-xs font-medium text-foreground group-hover:underline">+ Host squad post →</p>
                </Link>
              ))}
            </div>
          </div>
        )}


        <div className="mt-6 flex flex-wrap items-center gap-2">
          <FilterChip
            active={!search.type || search.type === "all"}
            onClick={() => nav({ search: (s: any) => ({ ...s, type: "all" }) })}
          >All</FilterChip>
          <FilterChip
            active={search.type === "emergency"}
            onClick={() => nav({ search: (s: any) => ({ ...s, type: "emergency" }) })}
            icon={<Zap className="h-3 w-3" />}
          >Emergency</FilterChip>
          <FilterChip
            active={search.type === "pre_match"}
            onClick={() => nav({ search: (s: any) => ({ ...s, type: "pre_match" }) })}
            icon={<Users2 className="h-3 w-3" />}
          >Pre-match</FilterChip>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={search.skill ?? ""}
              onChange={(e) => nav({ search: (s: any) => ({ ...s, skill: (e.target.value || undefined) as any }) })}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Any skill</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="pro">Pro</option>
            </select>
            <form
              onSubmit={(e) => { e.preventDefault(); nav({ search: (s: any) => ({ ...s, city: city || undefined }) }); }}
              className="flex items-center gap-2"
            >
              <Input placeholder="City…" value={city} onChange={(e) => setCity(e.target.value)} className="h-9 w-36" />
              <Button type="submit" size="sm" variant="outline">Apply</Button>
            </form>
          </div>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <EmptyState
              icon={<Users2 className="h-4 w-4" />}
              title="No open games match your filters"
              description="Try clearing filters, or open your own squad post from any upcoming booking."
              action={user ? <Button asChild><Link to="/squad-fill/new">New squad post</Link></Button> : (
                <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Sign in to host</Link></Button>
              )}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((p: any) => {
                const mine = p.host_id === user?.id;
                const myStatus = myReqs.data?.[p.id];
                return (
                  <SquadCard
                    key={p.id}
                    post={p}
                    myRequestStatus={myStatus}
                    ctaSlot={
                      mine ? (
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <Link to="/squad/$id" params={{ id: p.id }}>Manage post</Link>
                        </Button>
                      ) : !user ? (
                        <Button asChild size="sm" className="w-full">
                          <Link to="/auth" search={{ mode: "signin" }}>Sign in to join</Link>
                        </Button>
                      ) : myStatus ? (
                        <Button asChild size="sm" variant="outline" className="w-full">
                          <Link to="/squad/$id" params={{ id: p.id }}>View status</Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => join.mutate(p.id)}
                          disabled={join.isPending}
                        >
                          {p.approval_mode === "instant_join" ? "Join now" : "Request to join"}
                        </Button>
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}

function FilterChip({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${
        active ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/30"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
