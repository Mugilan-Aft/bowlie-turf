import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/site/EmptyState";
import { formatDate, formatPrice } from "@/lib/format";

type TurfStatus = "pending" | "approved" | "rejected" | "suspended";

type ChecklistItem = { key: string; label: string; ok: boolean };

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { key: "photos", label: "Photos are clear and representative", ok: false },
  { key: "address", label: "Address and map location verified", ok: false },
  { key: "pricing", label: "Pricing and slot rules are clear", ok: false },
  { key: "amenities", label: "Listed amenities match reality", ok: false },
  { key: "owner_identity", label: "Owner identity confirmed", ok: false },
  { key: "safety", label: "Safety and compliance acceptable", ok: false },
];

export const Route = createFileRoute("/_authenticated/admin/turfs")({
  head: () => ({ meta: [{ title: "Turf approvals — Admin" }] }),
  component: AdminTurfs,
});

function AdminTurfs() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TurfStatus>("pending");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Resolve owner ids whose profile name matches the search term so the
  // single search input matches venue name OR owner name.
  const { data: matchedOwnerIds } = useQuery({
    queryKey: ["admin-turfs-owner-search", search],
    enabled: roles.includes("admin") && search.trim().length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("full_name", `%${search.trim()}%`)
        .limit(50);
      return (data ?? []).map((p) => p.id);
    },
  });

  const { data: turfs } = useQuery({
    queryKey: ["admin-turfs", tab, search, matchedOwnerIds],
    enabled: roles.includes("admin"),
    queryFn: async () => {
      let q = supabase.from("turfs")
        .select("id, name, slug, city, state, address, base_price, status, owner_id, created_at, description, cover_image_url, rejection_reason, verification_checklist, reviewed_at")
        .eq("status", tab)
        .order("created_at", { ascending: tab === "pending" });
      const term = search.trim();
      if (term) {
        const owners = matchedOwnerIds ?? [];
        if (owners.length > 0) {
          q = q.or(`name.ilike.%${term}%,owner_id.in.(${owners.join(",")})`);
        } else {
          q = q.ilike("name", `%${term}%`);
        }
      }
      const { data } = await q.limit(200);
      return data ?? [];
    },
  });

  const active = (turfs ?? []).find((t) => t.id === openId);

  const { data: owner } = useQuery({
    queryKey: ["admin-turf-owner", active?.owner_id],
    enabled: !!active?.owner_id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, phone, city, is_banned").eq("id", active!.owner_id).maybeSingle();
      return data;
    },
  });

  if (!roles.includes("admin")) {
    return <DashShell area="admin" title="Turf approvals"><EmptyState icon={<ShieldCheck className="h-4 w-4" />} title="Admin access required" description="" /></DashShell>;
  }

  return (
    <DashShell area="admin" title="Turf approvals" subtitle="Review owner submissions and moderate listings.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TurfStatus)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="suspended">Suspended</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search venue or owner name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[280px]"
        />
      </div>

      <div className="surface-card overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Turf</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Base price</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(turfs ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-12">Nothing in this queue.</TableCell></TableRow>
            ) : (turfs ?? []).map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setOpenId(t.id)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-14 shrink-0 overflow-hidden rounded bg-muted">
                      {t.cover_image_url && <img src={t.cover_image_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <p className="font-medium">{t.name}</p>
                  </div>
                </TableCell>
                <TableCell>{t.city}</TableCell>
                <TableCell>{formatPrice(t.base_price)}/hr</TableCell>
                <TableCell>{formatDate(t.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}>Review</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {active && (
            <ReviewPanel
              turf={active}
              owner={owner}
              reviewerId={user?.id ?? null}
              onDone={() => {
                qc.invalidateQueries({ queryKey: ["admin-turfs"] });
                qc.invalidateQueries({ queryKey: ["admin-counts"] });
                setOpenId(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </DashShell>
  );
}

function ReviewPanel({
  turf,
  owner,
  reviewerId,
  onDone,
}: {
  turf: any;
  owner: { full_name: string | null; phone: string | null; city: string | null; is_banned: boolean | null } | null | undefined;
  reviewerId: string | null;
  onDone: () => void;
}) {
  const initialChecklist: ChecklistItem[] = useMemo(() => {
    const raw = turf.verification_checklist;
    if (Array.isArray(raw) && raw.length > 0) return raw as ChecklistItem[];
    return DEFAULT_CHECKLIST;
  }, [turf.id]);

  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist);
  const [reason, setReason] = useState<string>(turf.rejection_reason ?? "");
  const [busy, setBusy] = useState(false);

  const allOk = checklist.every((c) => c.ok);
  const failed = checklist.filter((c) => !c.ok);

  function toggle(idx: number, ok: boolean) {
    setChecklist((cs) => cs.map((c, i) => (i === idx ? { ...c, ok } : c)));
  }

  async function save(status: TurfStatus) {
    if (status === "rejected" && !reason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("turfs")
      .update({
        status,
        verification_checklist: checklist,
        rejection_reason: status === "rejected" ? reason.trim() : null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId,
      })
      .eq("id", turf.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Turf ${status}`);
    onDone();
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{turf.name}</SheetTitle>
        <SheetDescription>
          {turf.city}{turf.state ? `, ${turf.state}` : ""} · <Badge variant="outline">{turf.status}</Badge>
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-5 text-sm">
        {turf.cover_image_url && <img src={turf.cover_image_url} alt="" className="aspect-video w-full rounded-lg object-cover" />}
        <DetailRow label="Address" value={turf.address ?? "—"} />
        <DetailRow label="Base price" value={`${formatPrice(turf.base_price)}/hr`} />
        <DetailRow label="Submitted" value={formatDate(turf.created_at)} />
        {turf.reviewed_at && <DetailRow label="Last reviewed" value={formatDate(turf.reviewed_at)} />}
        {turf.description && <div><Label className="text-muted-foreground">Description</Label><p className="mt-1 whitespace-pre-wrap">{turf.description}</p></div>}

        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Owner</p>
          {owner ? (
            <div className="mt-1.5">
              <p className="font-medium">{owner.full_name ?? "Unknown"}</p>
              <p className="text-xs text-muted-foreground">{owner.phone ?? "no phone"} · {owner.city ?? "no city"}</p>
              {owner.is_banned && <Badge variant="destructive" className="mt-1">Banned</Badge>}
            </div>
          ) : <p className="text-xs text-muted-foreground">Loading…</p>}
        </div>

        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Verification checklist</p>
          <ul className="mt-2 space-y-2">
            {checklist.map((c, i) => (
              <li key={c.key} className="flex items-start gap-2.5">
                <Checkbox id={`chk-${c.key}`} checked={c.ok} onCheckedChange={(v) => toggle(i, !!v)} className="mt-0.5" />
                <Label htmlFor={`chk-${c.key}`} className="text-sm font-normal leading-snug">{c.label}</Label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {allOk ? "All items passed." : `${failed.length} item${failed.length === 1 ? "" : "s"} unresolved.`}
          </p>
        </div>

        <div>
          <Label htmlFor="reason" className="text-muted-foreground">Rejection reason {failed.length > 0 && <span className="text-destructive">(required to reject)</span>}</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain what the owner needs to fix before resubmitting."
            className="mt-1.5 min-h-[90px]"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {turf.status !== "approved" && (
          <Button onClick={() => save("approved")} disabled={busy || !allOk} title={!allOk ? "Tick every checklist item to approve" : undefined}>
            Approve
          </Button>
        )}
        {turf.status !== "rejected" && <Button variant="outline" onClick={() => save("rejected")} disabled={busy}>Reject</Button>}
        {turf.status !== "suspended" && <Button variant="outline" onClick={() => save("suspended")} disabled={busy}>Suspend</Button>}
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
