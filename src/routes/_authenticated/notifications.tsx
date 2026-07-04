import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Bowlie" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!user,
  });

  const markAll = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  return (
    <DashShell
      area="player"
      title="Notifications"
      subtitle="Booking updates, squad requests, and platform announcements."
      actions={data && data.length > 0 ? <Button variant="outline" onClick={() => markAll.mutate()}>Mark all read</Button> : undefined}
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-4 w-4" />}
          title="You're all caught up"
          description="Booking confirmations, squad-fill activity, and platform announcements will show here."
        />
      ) : (
        <div className="space-y-2">
          {data.map((n: any) => (
            <div key={n.id} className={`rounded-xl border border-border p-4 ${n.read_at ? "bg-card" : "bg-accent/[0.06]"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{n.type}</p>
                  <p className="mt-1 font-medium">{n.title}</p>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashShell>
  );
}
