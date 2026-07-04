import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/site/EmptyState";
import { TurfImageUploader } from "@/components/owner/TurfImageUploader";
import { formatDate, formatPrice } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/owner/tournaments")({
  head: () => ({ meta: [{ title: "Tournaments — Owner" }] }),
  component: OwnerTournaments,
});

function OwnerTournaments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string>("");
  const [bannerTurfId, setBannerTurfId] = useState<string>("");


  const { data: turfs } = useQuery({
    queryKey: ["owner-turfs-min", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("turfs").select("id, name").eq("owner_id", user.id).order("name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: tournaments } = useQuery({
    queryKey: ["owner-tournaments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("tournaments").select("*, turfs(name)").eq("owner_id", user.id).order("start_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    try {
      const fd = new FormData(e.currentTarget);
      const { error } = await supabase.from("tournaments").insert({
        owner_id: user.id,
        turf_id: String(fd.get("turf_id")),
        name: String(fd.get("name") ?? ""),
        description: String(fd.get("description") ?? "") || null,
        format: String(fd.get("format") ?? "single_elimination"),
        start_date: String(fd.get("start_date")),
        end_date: String(fd.get("end_date") ?? "") || null,
        entry_fee: Number(fd.get("entry_fee") ?? 0),
        max_teams: Number(fd.get("max_teams") ?? 0) || null,
        banner_url: bannerUrl || null,
        status: "open",
      });
      if (error) throw error;
      toast.success("Tournament published — registrations are open");
      (e.target as HTMLFormElement).reset();
      setBannerUrl("");
      qc.invalidateQueries({ queryKey: ["owner-tournaments", user.id] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setCreating(false); }
  }


  if (!turfs || turfs.length === 0) {
    return (
      <DashShell area="owner" title="Tournaments">
        <EmptyState
          icon={<Trophy className="h-4 w-4" />}
          title="Add a turf first"
          description="Tournaments must be hosted at one of your turfs. Create a turf to get started — no approval required."
          action={<Button asChild><Link to="/owner/dashboard">Go to turfs</Link></Button>}
        />
      </DashShell>
    );
  }

  return (
    <DashShell area="owner" title="Tournaments" subtitle="Publish tournaments at any of your turfs — no admin approval needed.">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {!tournaments || tournaments.length === 0 ? (
            <EmptyState icon={<Trophy className="h-4 w-4" />} title="No tournaments yet" description="Create your first tournament on the right." />
          ) : tournaments.map((t: any) => (
            <Link to="/owner/tournaments/$id" params={{ id: t.id }} key={t.id} className="surface-card flex items-center justify-between p-4 hover:border-accent transition-colors">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.turfs?.name} · {formatDate(t.start_date)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatPrice(t.entry_fee)}</p>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground capitalize">{t.status}</span>
              </div>
            </Link>
          ))}
        </div>
        <form onSubmit={create} className="surface-card h-fit space-y-3 p-5">
          <p className="font-display font-semibold">Host tournament</p>
          <div>
            <Label htmlFor="t-turf">Turf</Label>
            <Select
              name="turf_id"
              defaultValue={turfs[0].id}
              onValueChange={(v) => { setBannerTurfId(v); setBannerUrl(""); }}
            >
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {turfs.map((tf) => <SelectItem key={tf.id} value={tf.id}>{tf.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div><Label htmlFor="t-name">Name</Label><Input id="t-name" name="name" required placeholder="Summer Cup 2026" className="mt-1.5" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="t-start">Start</Label><Input id="t-start" name="start_date" type="date" required className="mt-1.5" /></div>
            <div><Label htmlFor="t-end">End</Label><Input id="t-end" name="end_date" type="date" className="mt-1.5" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="t-fee">Entry fee</Label><Input id="t-fee" name="entry_fee" type="number" min={0} defaultValue={500} required className="mt-1.5" /></div>
            <div><Label htmlFor="t-max">Max teams</Label><Input id="t-max" name="max_teams" type="number" min={2} defaultValue={8} className="mt-1.5" /></div>
          </div>
          <div>
            <Label htmlFor="t-format">Format</Label>
            <Select name="format" defaultValue="single_elimination">
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single_elimination">Single elimination</SelectItem>
                <SelectItem value="round_robin">Round robin</SelectItem>
                <SelectItem value="league">League</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Banner</Label>
            <div className="mt-1.5 flex items-start gap-3">
              <div className="aspect-[16/9] w-36 overflow-hidden rounded-lg border border-border bg-muted">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-[10px] text-muted-foreground">No banner</div>
                )}
              </div>
              <div className="space-y-2">
                <TurfImageUploader
                  turfId={bannerTurfId || turfs[0].id}
                  label="Upload banner"
                  onUploaded={(u) => setBannerUrl(u)}
                />
                {bannerUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setBannerUrl("")}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div><Label htmlFor="t-desc">Description</Label><Textarea id="t-desc" name="description" rows={3} className="mt-1.5" /></div>
          <Button type="submit" disabled={creating} className="w-full">{creating ? "Publishing…" : "Publish tournament"}</Button>
        </form>
      </div>
    </DashShell>
  );
}
