import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/site/EmptyState";
import { formatDateTime } from "@/lib/format";

type Status = "open" | "in_progress" | "resolved" | "closed";

export const Route = createFileRoute("/_authenticated/admin/tickets")({
  head: () => ({ meta: [{ title: "Support tickets — Admin" }] }),
  component: AdminTickets,
});

function AdminTickets() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status>("open");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: tickets } = useQuery({
    queryKey: ["admin-tickets", tab, search],
    enabled: roles.includes("admin"),
    queryFn: async () => {
      let q = supabase.from("support_tickets")
        .select("id, subject, body, priority, status, user_id, created_at, updated_at")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(200);
      if (search) q = q.ilike("subject", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const active = (tickets ?? []).find((t) => t.id === openId);

  const { data: reporter } = useQuery({
    queryKey: ["admin-ticket-reporter", active?.user_id],
    enabled: !!active?.user_id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, phone").eq("id", active!.user_id).maybeSingle();
      return data;
    },
  });

  async function updateStatus(id: string, status: Status) {
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status.replace("_", " ")}`);
    qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    qc.invalidateQueries({ queryKey: ["admin-counts"] });
  }

  if (!roles.includes("admin")) {
    return <DashShell area="admin" title="Support tickets"><EmptyState icon={<ShieldCheck className="h-4 w-4" />} title="Admin access required" description="" /></DashShell>;
  }

  return (
    <DashShell area="admin" title="Support & disputes" subtitle="Triage support tickets and dispute claims.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="in_progress">In progress</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input placeholder="Search subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[260px]" />
      </div>

      <div className="surface-card overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tickets ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-12">No tickets in this queue.</TableCell></TableRow>
            ) : (tickets ?? []).map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setOpenId(t.id)}>
                <TableCell className="max-w-md truncate font-medium">{t.subject}</TableCell>
                <TableCell><PriorityBadge p={t.priority} /></TableCell>
                <TableCell>{formatDateTime(t.updated_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}>Open</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>{active.subject}</SheetTitle>
                <SheetDescription>
                  From {reporter?.full_name ?? "Unknown"} {reporter?.phone ? `· ${reporter.phone}` : ""} · {formatDateTime(active.created_at)}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-5 space-y-4 text-sm">
                <div className="rounded-lg border border-border bg-muted/30 p-3 whitespace-pre-wrap">{active.body}</div>
                <div className="flex items-center gap-2">
                  <PriorityBadge p={active.priority} /> <Badge variant="outline">{active.status}</Badge>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Change status</label>
                  <Select value={active.status} onValueChange={(v) => updateStatus(active.id, v as Status)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashShell>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    high: "bg-destructive/15 text-destructive",
    medium: "bg-warning/15 text-warning-foreground",
    low: "bg-muted text-muted-foreground",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${map[p] ?? map.low}`}>{p}</span>;
}
