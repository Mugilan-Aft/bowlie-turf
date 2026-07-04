import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Ban, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/site/EmptyState";
import { formatDate } from "@/lib/format";

type Filter = "all" | "owners" | "banned";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users — Admin" }] }),
  component: AdminUsers,
});

function AdminUsers() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data: ownerIds } = useQuery({
    queryKey: ["admin-owner-ids"],
    enabled: roles.includes("admin") && tab === "owners",
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id").eq("role", "owner");
      return (data ?? []).map((r) => r.user_id);
    },
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users", tab, search, ownerIds?.join(",")],
    enabled: roles.includes("admin"),
    queryFn: async () => {
      let q = supabase.from("profiles")
        .select("id, full_name, phone, city, is_banned, ban_reason, banned_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (tab === "banned") q = q.eq("is_banned", true);
      if (tab === "owners" && ownerIds) q = q.in("id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
      if (search) q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const active = (users ?? []).find((u) => u.id === openId);

  const { data: activity } = useQuery({
    queryKey: ["admin-user-activity", openId],
    enabled: !!openId,
    queryFn: async () => {
      const [bookings, tickets, ownedTurfs] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", openId!),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("user_id", openId!),
        supabase.from("turfs").select("id", { count: "exact", head: true }).eq("owner_id", openId!),
      ]);
      return { bookings: bookings.count ?? 0, tickets: tickets.count ?? 0, ownedTurfs: ownedTurfs.count ?? 0 };
    },
  });

  async function ban(u: typeof active) {
    if (!u) return;
    if (!reason.trim()) return toast.error("Reason required");
    const { error } = await supabase.from("profiles").update({
      is_banned: true, ban_reason: reason.trim(), banned_at: new Date().toISOString(),
    }).eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("User banned");
    setReason("");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-counts"] });
  }
  async function unban(u: typeof active) {
    if (!u) return;
    const { error } = await supabase.from("profiles").update({ is_banned: false, ban_reason: null, banned_at: null }).eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("User unbanned");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-counts"] });
  }

  if (!roles.includes("admin")) {
    return <DashShell area="admin" title="Users"><EmptyState icon={<ShieldCheck className="h-4 w-4" />} title="Admin access required" description="" /></DashShell>;
  }

  return (
    <DashShell area="admin" title="User moderation" subtitle="Investigate accounts and enforce platform rules.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="owners">Owners</TabsTrigger>
            <TabsTrigger value="banned">Banned</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[260px]" />
      </div>

      <div className="surface-card overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">No users.</TableCell></TableRow>
            ) : (users ?? []).map((u) => (
              <TableRow key={u.id} className="cursor-pointer" onClick={() => setOpenId(u.id)}>
                <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                <TableCell>{u.phone ?? "—"}</TableCell>
                <TableCell>{u.city ?? "—"}</TableCell>
                <TableCell>{u.is_banned ? <Badge variant="destructive">Banned</Badge> : <Badge variant="outline">Active</Badge>}</TableCell>
                <TableCell>{formatDate(u.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setOpenId(u.id); }}>Review</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>{active.full_name ?? "Unnamed user"}</SheetTitle>
                <SheetDescription>{active.phone ?? "no phone"} · joined {formatDate(active.created_at)}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Bookings" value={activity?.bookings ?? "—"} />
                  <Stat label="Tickets" value={activity?.tickets ?? "—"} />
                  <Stat label="Turfs owned" value={activity?.ownedTurfs ?? "—"} />
                </div>
                {active.is_banned ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <p className="text-xs font-semibold text-destructive">BANNED · {active.banned_at ? formatDate(active.banned_at) : ""}</p>
                    {active.ban_reason && <p className="mt-1 text-xs">{active.ban_reason}</p>}
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => unban(active)}><ShieldOff className="h-3.5 w-3.5 mr-1" />Unban user</Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border p-3">
                    <Label htmlFor="ban-reason" className="text-xs">Ban reason</Label>
                    <Textarea id="ban-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5" placeholder="Why is this user being banned?" />
                    <Button size="sm" variant="destructive" className="mt-3" onClick={() => ban(active)}><Ban className="h-3.5 w-3.5 mr-1" />Ban user</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
