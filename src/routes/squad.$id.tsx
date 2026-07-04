import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar, MapPin, Users2, Zap, Clock, ShieldCheck, CheckCircle2, XCircle, UserCheck, Hourglass, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { formatDateTime, formatPrice } from "@/lib/format";
import { PostStatusPill, RequestStatusPill } from "@/components/squad/SquadCard";

export const Route = createFileRoute("/squad/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Squad post · Bowlie` },
      { property: "og:title", content: `Open game · Bowlie` },
      { property: "og:description", content: `Squad post ${params.id} — join the game` },
    ],
  }),
  component: SquadPostPage,
});

function SquadPostPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();

  const { data: post, isLoading } = useQuery({
    queryKey: ["squad-post", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_squad_post", { _id: id });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        ...row,
        bookings: {
          id: row.booking_id,
          start_at: row.start_at,
          end_at: row.end_at,
          turfs: {
            name: row.turf_name,
            city: row.turf_city,
            slug: row.turf_slug,
            address: row.turf_address,
            cover_image_url: row.turf_cover_image_url,
          },
        },
        sports: row.sport_name ? { name: row.sport_name } : null,
        host_profile: { full_name: row.host_name ?? "Host" },
      } as any;
    },
  });


  const isHost = !!user && !!post && post.host_id === user.id;

  const { data: requests } = useQuery({
    queryKey: ["squad-post-requests", id, isHost, user?.id],
    enabled: !!user,
    queryFn: async () => {
      // RLS allows: host sees all, others see only own.
      const { data } = await supabase
        .from("squad_fill_requests")
        .select(`id, status, message, created_at, user_id`)
        .eq("post_id", id)
        .order("created_at");
      const rows = data ?? [];
      if (rows.length === 0) return rows as Array<any>;
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const pmap: Record<string, string> = {};
      for (const p of profs ?? []) pmap[(p as any).id] = (p as any).full_name;
      return rows.map((r) => ({ ...r, profiles: { full_name: pmap[r.user_id] ?? "Player" } }));
    },
  });

  const { data: events } = useQuery({
    queryKey: ["squad-post-events", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("squad_request_events")
        .select("id, request_id, from_status, to_status, changed_by, note, created_at")
        .eq("post_id", id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`squad-post-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_fill_posts", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["squad-post", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_fill_requests", filter: `post_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["squad-post-requests", id] });
        qc.invalidateQueries({ queryKey: ["squad-post", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_request_events", filter: `post_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["squad-post-events", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const join = useMutation({
    mutationFn: async (message: string) => {
      if (!user) throw new Error("Sign in to join");
      const { error } = await supabase.from("squad_fill_requests").insert({
        post_id: id, user_id: user.id, message: message || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent");
      qc.invalidateQueries({ queryKey: ["squad-post-requests", id] });
      qc.invalidateQueries({ queryKey: ["squad-post", id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancelMine = useMutation({
    mutationFn: async (reqId: string) => {
      const { error } = await supabase.from("squad_fill_requests").update({ status: "cancelled" }).eq("id", reqId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request cancelled"); qc.invalidateQueries({ queryKey: ["squad-post-requests", id] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const decide = useMutation({
    mutationFn: async ({ reqId, status }: { reqId: string; status: "approved" | "rejected" | "joined" }) => {
      const { error } = await supabase.from("squad_fill_requests").update({ status }).eq("id", reqId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["squad-post-requests", id] });
      qc.invalidateQueries({ queryKey: ["squad-post", id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const closePost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("squad_fill_posts").update({ status: "closed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Post closed"); qc.invalidateQueries({ queryKey: ["squad-post", id] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const reopen = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("squad_fill_posts").update({ status: "open" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Post reopened"); qc.invalidateQueries({ queryKey: ["squad-post", id] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) {
    return (
      <PublicShell>
        <div className="container-page py-10"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>
      </PublicShell>
    );
  }
  if (!post) {
    return (
      <PublicShell>
        <div className="container-page py-16 text-center">
          <p className="text-sm text-muted-foreground">Squad post not found.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/open-games">Browse open games</Link></Button>
        </div>
      </PublicShell>
    );
  }

  const turf = post.bookings?.turfs;
  const start = post.bookings?.start_at;
  const remaining = Math.max(0, post.spots_needed - post.spots_filled);
  const isEmergency = post.fill_type === "emergency";
  const myRequest = (requests ?? []).find((r: any) => r.user_id === user?.id);
  const canJoin = post.status === "open" && remaining > 0 && !isHost && !myRequest && (!start || new Date(start) > new Date());

  return (
    <PublicShell>
      <div className="container-page py-8">
        <button onClick={() => router.history.back()} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="surface-card overflow-hidden">
            <div className="aspect-[16/9] bg-muted">
              {turf?.cover_image_url && <img src={turf.cover_image_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                    isEmergency ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"
                  }`}>
                    {isEmergency ? <Zap className="h-3 w-3" /> : <Users2 className="h-3 w-3" />}
                    {isEmergency ? "Emergency fill" : "Pre-match fill"}
                  </span>
                  <h1 className="mt-2 font-display text-2xl font-semibold">{turf?.name ?? "Open game"}</h1>
                  {turf && (
                    <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {turf.address}, {turf.city}
                    </p>
                  )}
                </div>
                <PostStatusPill value={post.status} />
              </div>

              <dl className="mt-6 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                {start && <Row label="When"><Calendar className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />{formatDateTime(start)}</Row>}
                {post.sports?.name && <Row label="Sport">{post.sports.name}</Row>}
                <Row label="Spots">{post.spots_filled}/{post.spots_needed} filled · <span className={remaining === 0 ? "text-destructive" : ""}>{remaining} left</span></Row>
                <Row label="Skill"><span className="capitalize">{post.skill_level}</span></Row>
                <Row label="Join mode">
                  {post.approval_mode === "instant_join" ? "Instant join" : (
                    <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Host approval</span>
                  )}
                </Row>
                <Row label="Join fee">{post.join_fee > 0 ? formatPrice(post.join_fee) : "Free"}</Row>
                <Row label="Host">{post.host_profile?.full_name ?? "Host"}</Row>
                {isEmergency && post.emergency_expires_at && (
                  <Row label="Closes"><Clock className="mr-1 inline h-3.5 w-3.5 text-destructive" />{formatDateTime(post.emergency_expires_at)}</Row>
                )}
              </dl>

              {post.notes && (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Notes from host</p>
                  <p className="mt-1 text-sm">{post.notes}</p>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-3">
            <div className="surface-card p-5">
              {isHost ? (
                <>
                  <p className="font-display font-semibold">Host controls</p>
                  <p className="mt-1 text-xs text-muted-foreground">Review requests below. The post tracks fill state automatically.</p>
                  <div className="mt-4 grid gap-2">
                    {post.status === "open" || post.status === "full" ? (
                      <Button variant="outline" onClick={() => closePost.mutate()} disabled={closePost.isPending}>Close post</Button>
                    ) : post.status === "closed" ? (
                      <Button variant="outline" onClick={() => reopen.mutate()} disabled={reopen.isPending}>Reopen post</Button>
                    ) : null}
                    <Button asChild variant="ghost">
                      <Link to="/bookings/$id" params={{ id: post.booking_id }}>View linked booking</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-display font-semibold">Join this game</p>
                  {!user ? (
                    <Button asChild className="mt-3 w-full">
                      <Link to="/auth" search={{ mode: "signin" }}>Sign in to join</Link>
                    </Button>
                  ) : myRequest ? (
                    <div className="mt-3 space-y-3 text-sm">
                      <p>Your status: <RequestStatusPill value={myRequest.status} /></p>
                      {(myRequest.status === "pending" || myRequest.status === "approved") && (
                        <Button variant="outline" size="sm" onClick={() => cancelMine.mutate(myRequest.id)} disabled={cancelMine.isPending} className="w-full">
                          Cancel request
                        </Button>
                      )}
                    </div>
                  ) : canJoin ? (
                    <JoinDialog
                      mode={post.approval_mode}
                      disabled={join.isPending}
                      onSubmit={(m) => join.mutate(m)}
                    />
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {post.status !== "open" ? `Post is ${post.status}.` : remaining === 0 ? "All spots filled." : "Joining is not available."}
                    </p>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

        {/* Requests panel */}
        {user && (isHost || myRequest) && (
          <section className="mt-8 surface-card p-5">
            <p className="font-display font-semibold">{isHost ? "Join requests" : "Your request"}</p>
            <div className="mt-4 divide-y divide-border">
              {(requests ?? []).length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No requests yet.</p>
              ) : (requests ?? []).map((r: any) => {
                const reqEvents = (events ?? []).filter((e: any) => e.request_id === r.id);
                const isMine = r.user_id === user?.id;
                return (
                  <div key={r.id} className="py-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {isMine ? "You" : (r.profiles?.full_name ?? "Player")} <RequestStatusPill value={r.status} />
                        </p>
                        <p className="text-xs text-muted-foreground">Requested {formatDateTime(r.created_at)}</p>
                        {r.message && <p className="mt-1 text-sm text-muted-foreground">"{r.message}"</p>}
                      </div>
                      {isHost && !isMine && (
                        <div className="flex flex-wrap gap-2">
                          {r.status === "pending" && (
                            <>
                              <Button size="sm" onClick={() => decide.mutate({ reqId: r.id, status: "joined" })} disabled={decide.isPending}>Approve & add</Button>
                              <Button size="sm" variant="outline" onClick={() => decide.mutate({ reqId: r.id, status: "approved" })} disabled={decide.isPending}>Approve</Button>
                              <Button size="sm" variant="outline" onClick={() => decide.mutate({ reqId: r.id, status: "rejected" })} disabled={decide.isPending}>Reject</Button>
                            </>
                          )}
                          {r.status === "approved" && (
                            <>
                              <Button size="sm" onClick={() => decide.mutate({ reqId: r.id, status: "joined" })} disabled={decide.isPending}>Mark joined</Button>
                              <Button size="sm" variant="outline" onClick={() => decide.mutate({ reqId: r.id, status: "rejected" })} disabled={decide.isPending}>Reject</Button>
                            </>
                          )}
                          {r.status === "joined" && (
                            <Button size="sm" variant="outline" onClick={() => decide.mutate({ reqId: r.id, status: "rejected" })} disabled={decide.isPending}>Remove</Button>
                          )}
                          {(r.status === "rejected" || r.status === "cancelled") && remaining > 0 && (
                            <Button size="sm" variant="outline" onClick={() => decide.mutate({ reqId: r.id, status: "approved" })} disabled={decide.isPending}>Restore</Button>
                          )}
                        </div>
                      )}
                      {isMine && (r.status === "pending" || r.status === "approved") && (
                        <Button size="sm" variant="outline" onClick={() => cancelMine.mutate(r.id)} disabled={cancelMine.isPending}>Cancel</Button>
                      )}
                    </div>
                    <StatusTimeline events={reqEvents} createdAt={r.created_at} currentStatus={r.status} />
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </PublicShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function JoinDialog({ mode, disabled, onSubmit }: { mode: string; disabled: boolean; onSubmit: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="mt-3 w-full" disabled={disabled}>
          {mode === "instant_join" ? "Join now" : "Request to join"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "instant_join" ? "Join this game" : "Send join request"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {mode === "instant_join"
              ? "You'll be added to the squad immediately."
              : "The host will review your request before adding you."}
          </p>
          <div>
            <Label htmlFor="msg">Message to host (optional)</Label>
            <Textarea id="msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1.5" placeholder="Position, skill, anything useful" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onSubmit(message); setOpen(false); }}>
            {mode === "instant_join" ? "Confirm join" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusTimeline({ events, createdAt, currentStatus }: { events: any[]; createdAt: string; currentStatus: string }) {
  const items = events.length > 0
    ? events
    : [{ id: "seed", from_status: null, to_status: "pending", created_at: createdAt, note: "Request created" }];
  return (
    <ol className="mt-3 space-y-2 border-l border-border pl-4">
      {items.map((e, i) => {
        const meta = statusMeta(e.to_status);
        const isLast = i === items.length - 1;
        return (
          <li key={e.id} className="relative">
            <span className={`absolute -left-[21px] top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-background ${meta.dot}`}>
              <meta.Icon className="h-2.5 w-2.5 text-white" />
            </span>
            <p className="text-xs">
              <span className="font-medium">{meta.label}</span>
              {e.from_status && <span className="text-muted-foreground"> · from {e.from_status}</span>}
              {isLast && e.to_status !== currentStatus && (
                <span className="ml-1 text-muted-foreground">(latest: {currentStatus})</span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">{formatDateTime(e.created_at)}{e.note ? ` · ${e.note}` : ""}</p>
          </li>
        );
      })}
    </ol>
  );
}

function statusMeta(status: string): { label: string; dot: string; Icon: typeof Hourglass } {
  switch (status) {
    case "pending":   return { label: "Pending",   dot: "bg-amber-500",   Icon: Hourglass };
    case "approved":  return { label: "Approved",  dot: "bg-sky-500",     Icon: CheckCircle2 };
    case "joined":    return { label: "Joined",    dot: "bg-emerald-500", Icon: UserCheck };
    case "rejected":  return { label: "Rejected",  dot: "bg-destructive", Icon: XCircle };
    case "cancelled": return { label: "Cancelled", dot: "bg-muted-foreground", Icon: Ban };
    default:          return { label: status,      dot: "bg-muted-foreground", Icon: Hourglass };
  }
}
