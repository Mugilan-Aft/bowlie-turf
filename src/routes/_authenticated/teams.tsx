import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/site/EmptyState";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({ meta: [{ title: "My teams — Bowlie" }] }),
  component: TeamsPage,
});

function TeamsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: teams } = useQuery({
    queryKey: ["my-teams", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("teams").select("*").eq("captain_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  async function createTeam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("teams").insert({
      captain_id: user.id,
      name: String(fd.get("name") ?? ""),
      logo_url: String(fd.get("logo_url") ?? "") || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Team created");
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["my-teams", user.id] });
  }

  async function removeTeam(id: string) {
    if (!confirm("Delete this team?")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["my-teams", user?.id] });
  }

  return (
    <DashShell area="player" title="My teams" subtitle="Captain a team to register for tournaments and squad-fill posts.">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {!teams || teams.length === 0 ? (
            <EmptyState icon={<Users2 className="h-4 w-4" />} title="No teams yet" description="Create a team to register together for tournaments." />
          ) : teams.map((t: any) => (
            <div key={t.id} className="surface-card flex items-center gap-3 p-4">
              <div className="h-10 w-10 overflow-hidden rounded-md bg-muted">
                {t.logo_url && <img src={t.logo_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">You're captain</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeTeam(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <form onSubmit={createTeam} className="surface-card h-fit space-y-3 p-5">
          <p className="font-display font-semibold">Create team</p>
          <div><Label htmlFor="t-name">Team name</Label><Input id="t-name" name="name" required placeholder="Sunday Strikers" className="mt-1.5" /></div>
          <div><Label htmlFor="t-logo">Logo URL (optional)</Label><Input id="t-logo" name="logo_url" type="url" placeholder="https://…" className="mt-1.5" /></div>
          <Button type="submit" className="w-full">Create</Button>
        </form>
      </div>
    </DashShell>
  );
}
