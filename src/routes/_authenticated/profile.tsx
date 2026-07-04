import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Bowlie" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, roles, primaryRole } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({ full_name: "", phone: "", city: "", bio: "" });
  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        city: profile.city ?? "",
        bio: profile.bio ?? "",
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <DashShell area="player" title="Profile" subtitle="How other players and turf owners see you.">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="surface-card space-y-4 p-6"
        >
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="mt-1.5 bg-muted/50" />
          </div>
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1.5" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="mt-1.5" />
          </div>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
        </form>

        <aside className="surface-card p-6 text-sm">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Account</p>
          <p className="mt-2"><span className="text-muted-foreground">Primary role:</span> <span className="capitalize">{primaryRole ?? "none"}</span></p>
          <p className="mt-1"><span className="text-muted-foreground">All roles:</span> {roles.join(", ") || "—"}</p>
          <div className="my-4 h-px bg-border" />
          <p className="text-xs text-muted-foreground">User ID</p>
          <p className="mt-1 break-all font-mono text-xs">{user?.id}</p>
        </aside>
      </div>
    </DashShell>
  );
}
