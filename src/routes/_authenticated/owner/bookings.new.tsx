import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/owner/bookings/new")({
  head: () => ({ meta: [{ title: "Record manual booking — Owner" }] }),
  component: ManualBooking,
});

function ManualBooking() {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [turfId, setTurfId] = useState("");
  const [pitchId, setPitchId] = useState<string>("none");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(true);

  const { data: turfs } = useQuery({
    queryKey: ["owner-turfs-min", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("turfs").select("id, name, base_price").eq("owner_id", user.id).order("name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: pitches } = useQuery({
    queryKey: ["pitches", turfId],
    queryFn: async () => {
      if (!turfId) return [];
      const { data } = await supabase.from("pitch_types").select("id, name, base_price").eq("turf_id", turfId);
      return data ?? [];
    },
    enabled: !!turfId,
  });

  const selectedTurf = (turfs ?? []).find((t) => t.id === turfId);
  const computedHours = start && end ? Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3.6e6) : 0;
  const suggested = selectedTurf ? Math.round(selectedTurf.base_price * computedHours) : 0;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    if (!turfId || !start || !end) return toast.error("Pick turf and time window");
    if (new Date(end) <= new Date(start)) return toast.error("End must be after start");
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const total = Number(amount || suggested);
      const { data, error } = await supabase.from("bookings").insert({
        user_id: user.id,
        turf_id: turfId,
        pitch_type_id: pitchId === "none" ? null : pitchId,
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        subtotal_amount: total,
        total_amount: total,
        add_ons_amount: 0,
        status: "confirmed",
        payment_status: paid ? "paid" : "unpaid",
        is_offline: true,
        offline_customer_name: String(fd.get("customer_name") ?? "") || null,
        offline_customer_phone: String(fd.get("customer_phone") ?? "") || null,
        notes: String(fd.get("notes") ?? "") || null,
      }).select("id").maybeSingle();
      if (error) throw error;
      toast.success("Manual booking recorded");
      router.navigate({ to: "/owner/bookings" });
      void data;
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <DashShell area="owner" title="Record manual booking" subtitle="Walk-in, phone, or cash bookings — blocks the slot and shows up in your calendar.">
      <form onSubmit={submit} className="surface-card max-w-2xl space-y-5 p-6">
        <div>
          <Label>Turf</Label>
          <Select value={turfId} onValueChange={(v) => { setTurfId(v); setPitchId("none"); }}>
            <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select turf" /></SelectTrigger>
            <SelectContent>
              {(turfs ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {pitches && pitches.length > 0 && (
          <div>
            <Label>Pitch</Label>
            <Select value={pitchId} onValueChange={setPitchId}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Whole turf</SelectItem>
                {pitches.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="start">Start</Label><Input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required className="mt-1.5" /></div>
          <div><Label htmlFor="end">End</Label><Input id="end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required className="mt-1.5" /></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="customer_name">Customer name</Label><Input id="customer_name" name="customer_name" placeholder="Walk-in / caller" className="mt-1.5" /></div>
          <div><Label htmlFor="customer_phone">Phone</Label><Input id="customer_phone" name="customer_phone" type="tel" placeholder="+91…" className="mt-1.5" /></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="amount">Total (INR)</Label>
            <Input id="amount" type="number" min={0} step={50} value={amount} placeholder={suggested ? String(suggested) : "0"} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" />
            {computedHours > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">{computedHours.toFixed(1)}h × {formatPrice(selectedTurf?.base_price ?? 0)}/hr = {formatPrice(suggested)} suggested</p>
            )}
          </div>
          <div>
            <Label>Payment</Label>
            <Select value={paid ? "paid" : "unpaid"} onValueChange={(v) => setPaid(v === "paid")}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Collected (cash/UPI/card)</SelectItem>
                <SelectItem value="unpaid">Pay at venue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={3} placeholder="Any add-ons, kit, internal notes…" className="mt-1.5" /></div>

        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Record booking"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.navigate({ to: "/owner/bookings" })}>Cancel</Button>
        </div>
      </form>
    </DashShell>
  );
}
