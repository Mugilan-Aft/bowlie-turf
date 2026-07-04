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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/site/EmptyState";
import { formatDateTime, formatPrice } from "@/lib/format";

type Tab = "refund_due" | "refunded" | "all";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({ meta: [{ title: "Refunds — Admin" }] }),
  component: AdminPayments,
});

function AdminPayments() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("refund_due");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: bookings } = useQuery({
    queryKey: ["admin-refunds", tab, search],
    enabled: roles.includes("admin"),
    queryFn: async () => {
      let q = supabase.from("bookings")
        .select("id, turf_id, user_id, start_at, end_at, total_amount, status, payment_status, cancellation_reason, cancelled_at, notes")
        .order("cancelled_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (tab === "refund_due") q = q.eq("status", "cancelled").eq("payment_status", "paid");
      if (tab === "refunded") q = q.eq("payment_status", "refunded");
      if (search) q = q.ilike("cancellation_reason", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const active = (bookings ?? []).find((b) => b.id === openId);

  const { data: payments } = useQuery({
    queryKey: ["admin-booking-payments", openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data } = await supabase.from("payments")
        .select("id, amount, provider, provider_ref, status, owner_payout_status, created_at")
        .eq("booking_id", openId!).order("created_at");
      return data ?? [];
    },
  });

  async function processRefund(id: string) {
    if (!confirm("Mark this booking as refunded? Updates booking status and payment record.")) return;
    const now = new Date().toISOString();
    const { error: bErr } = await supabase.from("bookings").update({
      payment_status: "refunded", status: "refunded",
    }).eq("id", id);
    if (bErr) return toast.error(bErr.message);
    const { error: pErr } = await supabase.from("payments").update({ status: "refunded" }).eq("booking_id", id);
    if (pErr) toast.warning("Booking marked, payment row update failed: " + pErr.message);
    toast.success("Refund processed");
    void now;
    qc.invalidateQueries({ queryKey: ["admin-refunds"] });
    qc.invalidateQueries({ queryKey: ["admin-counts"] });
    setOpenId(null);
  }

  if (!roles.includes("admin")) {
    return <DashShell area="admin" title="Refunds"><EmptyState icon={<ShieldCheck className="h-4 w-4" />} title="Admin access required" description="" /></DashShell>;
  }

  return (
    <DashShell area="admin" title="Refund oversight" subtitle="Process refunds on cancelled bookings and inspect payment trails.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="refund_due">Refund due</TabsTrigger>
            <TabsTrigger value="refunded">Refunded</TabsTrigger>
            <TabsTrigger value="all">All cancellations</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input placeholder="Search reason…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[260px]" />
      </div>

      <div className="surface-card overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Cancelled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(bookings ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-12">Nothing here.</TableCell></TableRow>
            ) : (bookings ?? []).map((b) => (
              <TableRow key={b.id} className="cursor-pointer" onClick={() => setOpenId(b.id)}>
                <TableCell className="font-mono text-xs">{b.id.slice(0, 8)}…</TableCell>
                <TableCell>{formatPrice(b.total_amount)}</TableCell>
                <TableCell><Badge variant="outline">{b.payment_status}</Badge></TableCell>
                <TableCell>{b.cancelled_at ? formatDateTime(b.cancelled_at) : "—"}</TableCell>
                <TableCell className="text-right">
                  {b.status === "cancelled" && b.payment_status === "paid" ? (
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); setOpenId(b.id); }}>Process</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setOpenId(b.id); }}>View</Button>
                  )}
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
                <SheetTitle>Booking #{active.id.slice(0, 8)}</SheetTitle>
                <SheetDescription>{formatDateTime(active.start_at)} → {formatDateTime(active.end_at)}</SheetDescription>
              </SheetHeader>
              <div className="mt-5 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</p><p className="mt-1 font-display text-lg font-bold">{formatPrice(active.total_amount)}</p></div>
                  <div className="rounded-lg border border-border p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p><p className="mt-1 capitalize">{active.status}</p></div>
                </div>
                {active.cancellation_reason && (
                  <div><p className="text-xs uppercase text-muted-foreground">Cancellation reason</p><p className="mt-1">{active.cancellation_reason}</p></div>
                )}
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-2">Payment trail</p>
                  {!payments || payments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No payment records.</p>
                  ) : payments.map((p) => (
                    <div key={p.id} className="rounded-lg border border-border p-3 mb-2 text-xs">
                      <div className="flex justify-between"><span className="font-medium">{formatPrice(p.amount)}</span><Badge variant="outline">{p.status}</Badge></div>
                      <p className="text-muted-foreground mt-1">{p.provider} · {p.provider_ref ?? "no ref"} · {formatDateTime(p.created_at)}</p>
                    </div>
                  ))}
                </div>
                {active.status === "cancelled" && active.payment_status === "paid" && (
                  <Button className="w-full" onClick={() => processRefund(active.id)}>Mark refunded</Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashShell>
  );
}
