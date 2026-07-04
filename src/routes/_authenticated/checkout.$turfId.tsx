import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, MapPin, ShoppingBag, Sparkles, Sun, Sunset, Moon, ShieldCheck, Lock, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/checkout/$turfId")({
  head: () => ({ meta: [{ title: "Checkout — Bowlie" }] }),
  component: CheckoutPage,
});

type AddOnQty = Record<string, number>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

const SLOT_START_HOUR = 6;
const SLOT_END_HOUR = 24; // exclusive — last selectable start = 23:00
const HOURS = Array.from({ length: SLOT_END_HOUR - SLOT_START_HOUR }, (_, i) => SLOT_START_HOUR + i);

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function fmtHour(h: number) {
  const hh = h % 24;
  const period = hh >= 12 ? "PM" : "AM";
  const disp = hh % 12 === 0 ? 12 : hh % 12;
  return `${disp}:00 ${period}`;
}
function fmtRangeShort(start: number, hours: number) {
  return `${fmtHour(start)} → ${fmtHour(start + hours)}`;
}
function periodOf(h: number) {
  if (h < 12) return { label: "Morning", Icon: Sun };
  if (h < 17) return { label: "Afternoon", Icon: Sun };
  if (h < 20) return { label: "Evening", Icon: Sunset };
  return { label: "Night", Icon: Moon };
}
function toLocalISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function buildDays(count = 14) {
  const out: { iso: string; date: Date; dow: string; day: number; month: string }[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push({
      iso: toLocalISODate(d),
      date: d,
      dow: d.toLocaleDateString(undefined, { weekday: "short" }),
      day: d.getDate(),
      month: d.toLocaleDateString(undefined, { month: "short" }),
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────

function CheckoutPage() {
  const { turfId } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();

  const days = useMemo(() => buildDays(14), []);
  const [date, setDate] = useState(days[0].iso);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [hours, setHours] = useState(1);
  const [pitchId, setPitchId] = useState<string>("");
  // (Auto-select for single-pitch turfs happens in an effect once turf data loads.)
  const [addOnQty, setAddOnQty] = useState<AddOnQty>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: turf } = useQuery({
    queryKey: ["turf-checkout", turfId],
    queryFn: async () => {
      const { data } = await supabase
        .from("turfs")
        .select(
          "id, name, city, address, base_price, slug, cover_image_url, cancellation_hours, cancellation_fee_pct, reschedule_hours, rating, total_reviews, pitch_types(id, name, surface_type, capacity, base_price), add_on_services(id, name, description, price, unit, is_active)",
        )
        .eq("id", turfId)
        .maybeSingle();
      return data;
    },
  });

  const { data: takenBookings } = useQuery({
    queryKey: ["turf-day-bookings", turfId, date, pitchId],
    queryFn: async () => {
      // RPC returns only time ranges + pitch + status (no PII), so other users'
      // booked slots are visible to anyone viewing checkout.
      const { data, error } = await supabase.rpc("get_booked_slots", {
        _turf_id: turfId,
        _day: date,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        start_at: string;
        end_at: string;
        status: string;
        pitch_type_id: string | null;
      }>;
    },
    refetchInterval: 30_000,
  });

  const pitches = (turf?.pitch_types ?? []) as any[];
  const addOns = ((turf?.add_on_services ?? []) as any[]).filter((a) => a.is_active);
  const multiPitch = pitches.length > 1;
  const pitchRequired = pitches.length > 0 && !pitchId;

  // Auto-select sole pitch
  useEffect(() => {
    if (pitches.length === 1 && !pitchId) setPitchId(pitches[0].id);
  }, [pitches, pitchId]);

  const pricePerHour = useMemo(() => {
    if (pitchId) {
      const p = pitches.find((p: any) => p.id === pitchId);
      if (p) return Number(p.base_price);
    }
    if (pitches.length === 1) return Number(pitches[0].base_price);
    return Number(turf?.base_price ?? 0);
  }, [turf, pitchId, pitches]);

  // Status map for every hour cell
  const cellState = useMemo(() => {
    const states: Record<number, "available" | "taken" | "past"> = {};
    // Allow booking up to 10 minutes before the slot starts.
    const now = new Date();
    const isToday = date === toLocalISODate(now);
    for (const h of HOURS) {
      const cellStart = new Date(`${date}T${pad(h)}:00:00`);
      // 10-minute buffer: slot is past if current time >= (slot start − 10 min)
      const cutoff = new Date(cellStart.getTime() - 10 * 60 * 1000);
      if (isToday && now >= cutoff) {
        states[h] = "past";
        continue;
      }
      states[h] = "available";
    }
    for (const b of takenBookings ?? []) {
      if (pitchId && b.pitch_type_id && b.pitch_type_id !== pitchId) continue;
      const s = new Date(b.start_at);
      const e = new Date(b.end_at);
      for (const h of HOURS) {
        const cellStart = new Date(`${date}T${pad(h)}:00:00`);
        const cellEnd = new Date(cellStart.getTime() + 60 * 60 * 1000);
        if (cellStart < e && cellEnd > s) states[h] = "taken";
      }
    }
    return states;
  }, [date, takenBookings, pitchId]);

  // Reset selection when date/pitch changes
  useEffect(() => {
    setStartHour(null);
    setHours(1);
  }, [date, pitchId]);

  // Max consecutive duration from selected start
  const maxDuration = useMemo(() => {
    if (startHour == null) return 1;
    let count = 0;
    for (let h = startHour; h < SLOT_END_HOUR; h++) {
      if (cellState[h] !== "available") break;
      count++;
      if (count >= 6) break;
    }
    return Math.max(1, count);
  }, [startHour, cellState]);

  useEffect(() => {
    if (hours > maxDuration) setHours(maxDuration);
  }, [hours, maxDuration]);

  const subtotal = pricePerHour * hours;

  const addOnLines = useMemo(
    () =>
      addOns
        .map((a) => {
          const qty = addOnQty[a.id] ?? 0;
          if (qty <= 0) return null;
          const unitMultiplier = a.unit === "per_hour" ? hours : 1;
          const lineTotal = Number(a.price) * qty * unitMultiplier;
          return { ...a, qty, unitMultiplier, lineTotal };
        })
        .filter(Boolean) as Array<any>,
    [addOns, addOnQty, hours],
  );
  const addOnsTotal = addOnLines.reduce((s, l) => s + l.lineTotal, 0);
  const total = subtotal + addOnsTotal;

  async function onConfirm() {
    if (!user) return;
    if (pitches.length > 0 && !pitchId) return toast.error("Please select a pitch to continue");
    if (startHour == null) return toast.error("Please select a start time");
    setBusy(true);
    try {
      const startAt = new Date(`${date}T${pad(startHour)}:00:00`);
      const endAt = new Date(startAt.getTime() + hours * 60 * 60 * 1000);
      const now = new Date();

      // Validate: date must not be in the past
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const selectedDateObj = new Date(`${date}T00:00:00`);
      if (selectedDateObj < todayStart) {
        toast.error("Cannot book a date in the past");
        setBusy(false);
        return;
      }

      // Validate: slot must not be in the past (10-minute buffer)
      const cutoff = new Date(startAt.getTime() - 10 * 60 * 1000);
      if (now >= cutoff) {
        toast.error("This slot starts in less than 10 minutes and can no longer be booked");
        setBusy(false);
        return;
      }

      // Validate: slot must still be available (not taken by another user)
      if (cellState[startHour] !== "available") {
        toast.error("This slot is no longer available — please pick another time");
        setBusy(false);
        return;
      }
      // Also check that all hours in the selected range are available
      for (let h = startHour; h < startHour + hours; h++) {
        if (cellState[h] !== "available") {
          toast.error("One or more hours in your selection are no longer available");
          setBusy(false);
          return;
        }
      }

      const effectivePitchId = pitchId || (pitches.length === 1 ? pitches[0].id : null);
      const lockExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          user_id: user.id,
          turf_id: turfId,
          pitch_type_id: effectivePitchId,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          subtotal_amount: subtotal,
          add_ons_amount: addOnsTotal,
          total_amount: total,
          status: "pending",
          payment_status: "unpaid",
          lock_expires_at: lockExpires,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505" || /no longer available/i.test(error.message)) {
          toast.error("That slot was just taken by someone else — please pick another time.");
        } else {
          throw error;
        }
        return;
      }

      if (addOnLines.length > 0) {
        const rows = addOnLines.map((l) => ({
          booking_id: booking.id,
          add_on_id: l.id,
          quantity: l.qty,
          unit_price: Number(l.price),
        }));
        const { error: addErr } = await supabase.from("booking_add_ons").insert(rows);
        if (addErr) throw addErr;
      }

      toast.success("Slot locked — confirm your booking next");
      router.navigate({ to: "/bookings/$id/confirmation", params: { id: booking.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function setQty(id: string, qty: number) {
    setAddOnQty((p) => ({ ...p, [id]: Math.max(0, qty) }));
  }

  // Group hours by period for visual sectioning
  const grouped = useMemo(() => {
    const groups: Record<string, number[]> = { Morning: [], Afternoon: [], Evening: [], Night: [] };
    for (const h of HOURS) {
      const { label } = periodOf(h);
      groups[label].push(h);
    }
    return groups;
  }, []);

  const selectedRange = startHour != null ? new Set(Array.from({ length: hours }, (_, i) => startHour + i)) : new Set<number>();

  return (
    <DashShell area="player" title="Book your slot" subtitle="Pick a date, pick your time — the way you'd book a movie.">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-primary text-primary-foreground shadow-[var(--shadow-lift)]">
        {turf?.cover_image_url && (
          <img src={turf.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="absolute inset-0 bg-gradient-to-tr from-primary via-primary/95 to-transparent" />
        <div className="relative grid gap-4 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] backdrop-blur">
              <Sparkles className="h-3 w-3" /> Premium booking
            </p>
            <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-primary-foreground sm:text-3xl md:text-4xl">
              {turf?.name ?? "Loading venue…"}
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-primary-foreground/75">
              <MapPin className="h-3.5 w-3.5" /> {turf?.address ?? ""}{turf?.city ? `, ${turf.city}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-2.5 py-1 backdrop-blur">⭐ {turf?.rating?.toFixed?.(1) ?? "New"} · {turf?.total_reviews ?? 0} reviews</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 backdrop-blur">From {formatPrice(turf?.base_price ?? 0)}/hr</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur"><ShieldCheck className="h-3 w-3" /> Instant confirmation</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* STEP 1 — DATE STRIP */}
          <section className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <StepBadge n={1} />
                <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">Choose a date</h2>
              </div>
              <p className="text-xs text-muted-foreground">Next 14 days</p>
            </div>
            <div className="scrollbar-thin flex gap-2 overflow-x-auto px-5 py-4">
              {days.map((d) => {
                const active = d.iso === date;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => setDate(d.iso)}
                    className={`group flex w-[68px] shrink-0 flex-col items-center rounded-2xl border px-3 py-3 transition-all ${
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-lift)]"
                        : "border-border bg-card hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[var(--shadow-soft)]"
                    }`}
                  >
                    <span className={`text-[10px] uppercase tracking-[0.14em] ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {d.dow}
                    </span>
                    <span className="mt-1 font-display text-xl font-bold tabular-nums">{d.day}</span>
                    <span className={`text-[10px] uppercase tracking-[0.14em] ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {d.month}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* PITCH PICKER */}
          {pitches.length > 0 && (
            <section className="surface-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <StepBadge n={2} />
                  <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
                    {multiPitch ? "Pick a pitch" : "Pitch"}
                  </h2>
                </div>
                {pitchRequired && <span className="text-xs text-destructive">required</span>}
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                {pitches.map((p: any) => {
                  const active = pitchId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPitchId(p.id)}
                      className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-accent bg-accent/5 shadow-[var(--shadow-soft)] ring-1 ring-accent"
                          : "border-border bg-card hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[var(--shadow-soft)]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-display font-semibold">{p.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {[p.surface_type, p.capacity ? `${p.capacity}-a-side` : null].filter(Boolean).join(" • ") || "—"}
                          </p>
                        </div>
                        {active && <Check className="h-4 w-4 text-accent" />}
                      </div>
                      <p className="mt-3 text-sm font-semibold tabular-nums">{formatPrice(p.base_price)}<span className="text-xs font-normal text-muted-foreground">/hr</span></p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* STEP — SLOT GRID (movie-seat style) */}
          <section className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <StepBadge n={pitches.length > 0 ? 3 : 2} />
                <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">Pick your time</h2>
              </div>
              <Legend />
            </div>

            <div className="space-y-5 p-5">
              {(Object.keys(grouped) as Array<keyof typeof grouped>).map((label) => {
                const hrs = grouped[label as string];
                if (hrs.length === 0) return null;
                const { Icon } = periodOf(hrs[0]);
                return (
                  <div key={label}>
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {hrs.map((h) => {
                        const state = cellState[h];
                        const selected = selectedRange.has(h);
                        const isStart = startHour === h;
                        const disabled = state !== "available";
                        return (
                          <button
                            key={h}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              if (disabled) return;
                              setStartHour(h);
                              setHours(1);
                            }}
                            title={
                              state === "taken"
                                ? "Already booked"
                                : state === "past"
                                ? "Time has passed"
                                : fmtHour(h)
                            }
                            className={[
                              "relative h-12 rounded-lg border text-sm font-semibold tabular-nums transition-all",
                              disabled
                                ? state === "taken"
                                  ? "cursor-not-allowed border-dashed border-border bg-muted/40 text-muted-foreground line-through"
                                  : "cursor-not-allowed border-border bg-muted/30 text-muted-foreground/60"
                                : selected
                                ? "border-accent bg-accent text-accent-foreground shadow-[var(--shadow-soft)]"
                                : "border-border bg-card hover:-translate-y-0.5 hover:border-accent hover:text-accent hover:shadow-[var(--shadow-soft)]",
                            ].join(" ")}
                          >
                            {fmtHour(h).replace(":00 ", " ")}
                            {isStart && (
                              <span className="absolute -top-1.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-accent-foreground/60" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Duration picker */}
              <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Duration</p>
                    <p className="mt-0.5 text-sm">
                      {startHour == null ? (
                        <span className="text-muted-foreground">Select a start time first</span>
                      ) : (
                        <span className="font-medium">{fmtRangeShort(startHour, hours)}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((n) => {
                      const allowed = startHour != null && n <= maxDuration;
                      const active = n === hours;
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={!allowed}
                          onClick={() => setHours(n)}
                          className={[
                            "h-9 w-12 rounded-lg border text-sm font-semibold tabular-nums transition",
                            !allowed
                              ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground/50"
                              : active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:border-foreground/40",
                          ].join(" ")}
                        >
                          {n}h
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ADD-ONS */}
          {addOns.length > 0 && (
            <section className="surface-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <StepBadge n={pitches.length > 0 ? 4 : 3} />
                <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" /> Add-ons
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">Optional</p>
              </div>
              <div className="space-y-2 p-5">
                {addOns.map((a: any) => {
                  const qty = addOnQty[a.id] ?? 0;
                  const active = qty > 0;
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center justify-between gap-4 rounded-xl border p-3.5 transition ${
                        active ? "border-accent bg-accent/5" : "border-border bg-card"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a.name}</p>
                        {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatPrice(a.price)} {a.unit === "per_hour" ? "/ hour" : "/ booking"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button type="button" size="sm" variant="outline" onClick={() => setQty(a.id, qty - 1)} disabled={qty === 0} className="h-8 w-8 p-0">−</Button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => setQty(a.id, qty + 1)} className="h-8 w-8 p-0">+</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* NOTES */}
          <section className="surface-card p-5">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.14em]">Notes for the venue</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-3"
              placeholder="Anything the turf should know? (optional)"
            />
          </section>
        </div>

        {/* SUMMARY */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-lift)]">
            <div className="bg-primary px-5 py-4 text-primary-foreground">
              <p className="text-[11px] uppercase tracking-[0.18em] text-primary-foreground/70">Booking summary</p>
              <p className="mt-1 font-display text-lg font-semibold leading-tight">
                {turf?.name ?? "—"}
              </p>
            </div>

            <div className="space-y-4 p-5 text-sm">
              {/* Booking details */}
              <div className="space-y-3">
                <SummaryRow
                  label="Ground"
                  value={
                    <span className="font-medium">
                      {turf?.name ?? "—"}
                      {pitchId && pitches.find((p: any) => p.id === pitchId)?.name
                        ? <span className="text-muted-foreground"> · {pitches.find((p: any) => p.id === pitchId)?.name}</span>
                        : null}
                    </span>
                  }
                />
                <SummaryRow
                  label="Date"
                  value={
                    <span className="font-medium">
                      {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  }
                />
                <SummaryRow
                  label="Time"
                  value={
                    startHour == null
                      ? <span className="text-muted-foreground">Not selected</span>
                      : <span className="font-medium">{fmtRangeShort(startHour, hours)}</span>
                  }
                />
                <SummaryRow
                  label="Duration"
                  value={
                    startHour == null
                      ? <span className="text-muted-foreground">—</span>
                      : <span className="font-medium">{hours}h</span>
                  }
                />
              </div>

              <div className="my-1 border-t border-dashed border-border" />

              {/* Price breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Slot rental</span>
                  <span className="tabular-nums">{formatPrice(pricePerHour)} × {hours}h = {formatPrice(subtotal)}</span>
                </div>
                {addOnLines.map((l) => (
                  <div key={l.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {l.name} × {l.qty}{l.unitMultiplier !== 1 ? ` × ${l.unitMultiplier}h` : ""}
                    </span>
                    <span className="tabular-nums">{formatPrice(l.lineTotal)}</span>
                  </div>
                ))}
                {addOnsTotal > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Add-ons total</span>
                    <span className="tabular-nums">{formatPrice(addOnsTotal)}</span>
                  </div>
                )}
              </div>

              <div className="my-1 border-t border-border" />

              {/* Total */}
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total</span>
                <span className="font-display text-3xl font-bold tabular-nums">{formatPrice(total)}</span>
              </div>

              <Button
                size="lg"
                className="mt-2 w-full"
                onClick={onConfirm}
                disabled={busy || pitchRequired || startHour == null}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Locking slot…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Lock slot & continue
                  </span>
                )}
              </Button>

              <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
                <p className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Slot held for 10 minutes during checkout</p>
                <p className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Free cancellation up to {turf?.cancellation_hours ?? 24}h before start</p>
              </div>

              {turf && (
                <Link
                  to="/turfs/$slug"
                  params={{ slug: turf.slug }}
                  className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Back to venue
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </DashShell>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
      {n}
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    ["Available", "border-border bg-card"],
    ["Selected", "border-accent bg-accent"],
    ["Booked", "border-dashed border-border bg-muted/40"],
  ];
  return (
    <div className="hidden items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:flex">
      {items.map(([label, cls]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-4 rounded border ${cls}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
