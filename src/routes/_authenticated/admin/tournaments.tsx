import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Star, StarOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/site/EmptyState";
import { formatDate, formatPrice } from "@/lib/format";

type Tab = "all" | "featured" | "open" | "draft";

export const Route = createFileRoute("/_authenticated/admin/tournaments")({
  head: () => ({ meta: [{ title: "Tournaments — Admin" }] }),
  component: AdminTournaments,
});

function AdminTournaments() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const { data: list } = useQuery({
    queryKey: ["admin-tournaments", tab, search],
    enabled: roles.includes("admin"),
    queryFn: async () => {
      let q = supabase.from("tournaments")
        .select("id, name, status, start_date, end_date, entry_fee, max_teams, is_featured, turf_id, turfs(name, city)")
        .order("start_date", { ascending: false })
        .limit(200);
      if (tab === "featured") q = q.eq("is_featured", true);
      if (tab === "open") q = q.eq("status", "open");
      if (tab === "draft") q = q.eq("status", "draft");
      if (search) q = q.ilike("name", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  async function toggleFeatured(id: string, next: boolean) {
    const { error } = await supabase.from("tournaments").update({ is_featured: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next ? "Featured" : "Unfeatured");
    qc.invalidateQueries({ queryKey: ["admin-tournaments"] });
  }

  if (!roles.includes("admin")) {
    return <DashShell area="admin" title="Tournaments"><EmptyState icon={<ShieldCheck className="h-4 w-4" />} title="Admin access required" description="" /></DashShell>;
  }

  return (
    <DashShell area="admin" title="Featured tournaments" subtitle="Curate the tournaments that appear in discovery and home spotlights.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="featured">Featured</TabsTrigger>
            <TabsTrigger value="open">Open registration</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input placeholder="Search name…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[260px]" />
      </div>

      <div className="surface-card overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tournament</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(list ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">No tournaments.</TableCell></TableRow>
            ) : (list ?? []).map((t: any) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {t.is_featured && <Star className="h-3.5 w-3.5 text-warning-foreground fill-current" />}
                    <Link to="/tournaments/$id" params={{ id: t.id }} className="font-medium hover:underline">{t.name}</Link>
                  </div>
                </TableCell>
                <TableCell>{t.turfs?.name ?? "—"}<span className="text-xs text-muted-foreground"> · {t.turfs?.city ?? ""}</span></TableCell>
                <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                <TableCell>{formatDate(t.start_date)}</TableCell>
                <TableCell>{formatPrice(t.entry_fee)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant={t.is_featured ? "outline" : "default"} onClick={() => toggleFeatured(t.id, !t.is_featured)}>
                    {t.is_featured ? <><StarOff className="h-3.5 w-3.5 mr-1" />Unfeature</> : <><Star className="h-3.5 w-3.5 mr-1" />Feature</>}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashShell>
  );
}
