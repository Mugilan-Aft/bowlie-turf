import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/site/EmptyState";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  head: () => ({ meta: [{ title: "Announcements — Admin" }] }),
  component: AdminAnnouncements,
});

function AdminAnnouncements() {
  const { roles, user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: list } = useQuery({
    queryKey: ["admin-announcements"],
    enabled: roles.includes("admin"),
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const { error } = await supabase.from("announcements").insert({
        title: String(fd.get("title") ?? ""),
        body: String(fd.get("body") ?? ""),
        audience: String(fd.get("audience") ?? "all"),
        is_active: true,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Announcement published");
      (e.target as HTMLFormElement).reset();
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }

  async function toggle(id: string, is_active: boolean) {
    const { error } = await supabase.from("announcements").update({ is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  if (!roles.includes("admin")) {
    return <DashShell area="admin" title="Announcements"><EmptyState icon={<ShieldCheck className="h-4 w-4" />} title="Admin access required" description="" /></DashShell>;
  }

  return (
    <DashShell area="admin" title="Platform announcements" subtitle="Broadcast updates, maintenance windows, and policy changes.">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {!list || list.length === 0 ? (
            <EmptyState icon={<ShieldCheck className="h-4 w-4" />} title="No announcements yet" description="Create one on the right to broadcast to users." />
          ) : list.map((a) => (
            <div key={a.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(a.created_at)} · audience: <Badge variant="outline">{a.audience}</Badge></p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={a.is_active} onCheckedChange={(v) => toggle(a.id, v)} />
                  <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap">{a.body}</p>
            </div>
          ))}
        </div>

        <form onSubmit={create} className="surface-card space-y-3 p-5 h-fit">
          <p className="font-display font-semibold">New announcement</p>
          <div><Label htmlFor="title">Title</Label><Input id="title" name="title" required className="mt-1.5" /></div>
          <div><Label htmlFor="body">Message</Label><Textarea id="body" name="body" rows={5} required className="mt-1.5" /></div>
          <div>
            <Label>Audience</Label>
            <Select name="audience" defaultValue="all">
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="players">Players</SelectItem>
                <SelectItem value="owners">Owners</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Publishing…" : "Publish"}</Button>
        </form>
      </div>
    </DashShell>
  );
}
