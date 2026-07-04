import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Printer,
  ShieldCheck,
  Share2,
  ArrowRight,
  Landmark,
  Wallet,
  Loader2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { BookingTicket } from "@/components/bookings/Ticket";
import { formatDateTime, formatPrice, formatDate } from "@/lib/format";
import { confirmBookingPayment } from "@/lib/bookings.functions";

const UPI_PROVIDERS = [
  { id: "gpay",       label: "Google Pay",   emoji: "🟢" },
  { id: "phonepe",   label: "PhonePe",       emoji: "💜" },
  { id: "paytm",     label: "Paytm",         emoji: "🔵" },
  { id: "bhim",      label: "BHIM UPI",      emoji: "🇮🇳" },
  { id: "amazonpay", label: "Amazon Pay",    emoji: "🟠" },
  { id: "card",      label: "Card / Netbanking", emoji: "💳" },
] as const;

export const Route = createFileRoute("/_authenticated/bookings_/$id/confirmation")({
  head: () => ({ meta: [{ title: "Booking confirmed — Bowlie" }] }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const confirmFn = useServerFn(confirmBookingPayment);
  const [method, setMethod] = useState<"netbanking" | "cash" | null>(null);
  const [upi, setUpi] = useState<string | null>(null);
  const [upiInput, setUpiInput] = useState("");

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking-confirmation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `*,
          turfs(name, city, address, slug, lat, lng, cover_image_url, cancellation_hours, cancellation_fee_pct, reschedule_hours),
          booking_add_ons(id, quantity, unit_price, add_on_services(name, unit))`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", data.user_id)
          .maybeSingle();
        return { ...data, profiles: profile };
      }
      return data;
    },
  });

  const confirm = useMutation({
    mutationFn: (m: "netbanking" | "cash") => confirmFn({ data: { id, method: m } }),
    onSuccess: (_r, m) => {
      toast.success(
        m === "netbanking"
          ? "Payment successful — booking confirmed"
          : "Booking confirmed — pay in cash at the venue",
      );
      qc.invalidateQueries({ queryKey: ["booking-confirmation", id] });
      qc.invalidateQueries({ queryKey: ["booking", id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  if (isLoading) {
    return (
      <DashShell area="player" title="Booking confirmation">
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
      </DashShell>
    );
  }
  if (!booking) {
    return (
      <DashShell area="player" title="Booking confirmation">
        <p className="text-sm text-muted-foreground">Booking not found.</p>
      </DashShell>
    );
  }

  const isPending = booking.status === "pending";
  const refCode = booking.id.slice(0, 8).toUpperCase();

  async function shareBooking() {
    const text = `Booking at ${booking?.turfs?.name} on ${formatDateTime(
      booking!.start_at,
    )} — ref ${refCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Bowlie booking", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Booking details copied");
      }
    } catch {}
  }

  // Pending → show payment picker BEFORE ticket
  if (isPending) {
    const startD = new Date(booking.start_at);
    const endD = new Date(booking.end_at);
    const durationHrs = (endD.getTime() - startD.getTime()) / 36e5;
    const slotSubtotal = Number(booking.subtotal_amount ?? 0) || Number(booking.total_amount) - Number(booking.add_ons_amount ?? 0);
    const addOnsTotal = Number(booking.add_ons_amount ?? 0);
    const total = Number(booking.total_amount);
    const addOns = (booking.booking_add_ons ?? []) as any[];

    return (
      <DashShell area="player" title="Choose your payment method">
        <div className="mx-auto max-w-2xl">
          <div className="surface-card p-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-warning">
              Slot locked — 10 min hold
            </p>
            <h1 className="mt-3 font-display text-2xl font-semibold">Confirm your booking</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ref <span className="font-mono">{refCode}</span></p>

            {/* ── Booking summary ─────────────────────────────────────── */}
            <div className="mt-5 rounded-2xl border border-border bg-surface/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Booking details</p>
              <div className="space-y-2.5 text-sm">
                <ConfSummaryRow label="Ground" value={booking.turfs?.name ?? "—"} />
                <ConfSummaryRow
                  label="Date"
                  value={startD.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                />
                <ConfSummaryRow
                  label="Time"
                  value={`${startD.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} → ${endD.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                />
                <ConfSummaryRow label="Duration" value={`${durationHrs}h`} />

                <div className="my-2 border-t border-dashed border-border" />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Slot rental</span>
                  <span className="tabular-nums">{formatPrice(slotSubtotal)}</span>
                </div>
                {addOns.map((l: any) => (
                  <div key={l.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {l.add_on_services?.name} × {l.quantity}
                    </span>
                    <span className="tabular-nums">{formatPrice(Number(l.unit_price) * l.quantity)}</span>
                  </div>
                ))}
                {addOnsTotal > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Add-ons</span>
                    <span className="tabular-nums">{formatPrice(addOnsTotal)}</span>
                  </div>
                )}

                <div className="my-2 border-t border-border" />

                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total</span>
                  <span className="font-display text-2xl font-bold tabular-nums">{formatPrice(total)}</span>
                </div>
              </div>
            </div>

            {/* ── Payment method ──────────────────────────────────────── */}
            <p className="mt-6 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Pick a payment method
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <PayOption
                icon={Landmark}
                title="Online Payment"
                desc="UPI, credit/debit card, or net banking"
                active={method === "netbanking"}
                onClick={() => setMethod("netbanking")}
              />
              <PayOption
                icon={Wallet}
                title="Cash at Venue"
                desc="Pay in cash before your session starts"
                active={method === "cash"}
                onClick={() => { setMethod("cash"); setUpi(null); setUpiInput(""); }}
              />
            </div>

            {method === "netbanking" && (
              <div className="mt-5 space-y-4 animate-fade-in">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Choose a provider
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {UPI_PROVIDERS.map((p) => {
                    const active = upi === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setUpi(p.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition ${
                          active
                            ? "border-accent bg-accent/5 shadow-[var(--shadow-soft)] ring-1 ring-accent"
                            : "border-border bg-card hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[var(--shadow-soft)]"
                        }`}
                      >
                        <span className="text-2xl leading-none">{p.emoji}</span>
                        <span className={`text-[10px] font-semibold leading-tight ${
                          active ? "text-accent" : "text-muted-foreground"
                        }`}>{p.label}</span>
                      </button>
                    );
                  })}
                </div>

                {upi && (
                  <div className="rounded-2xl border border-border bg-surface/60 p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2 block">
                      Enter UPI ID or registered phone number
                    </label>
                    <input
                      type="text"
                      value={upiInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUpiInput(e.target.value)}
                      placeholder="e.g. 9876543210 or name@upi"
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Confirm / pay button ────────────────────────────────── */}
            <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-surface/60 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total</p>
                <p className="font-display text-2xl font-bold">{formatPrice(total)}</p>
                {method === "netbanking" && upi && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    via {UPI_PROVIDERS.find((p) => p.id === upi)?.label}
                  </p>
                )}
                {method === "cash" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Pay at the venue before your session
                  </p>
                )}
              </div>
              <Button
                size="lg"
                disabled={
                  !method ||
                  confirm.isPending ||
                  (method === "netbanking" && (!upi || !upiInput.trim()))
                }
                onClick={() => method && confirm.mutate(method)}
              >
                {confirm.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                  </span>
                ) : method === "netbanking"
                    ? (upi && upiInput.trim() ? "Pay & confirm" : upi ? "Enter UPI ID" : "Pick a provider")
                    : method === "cash"
                      ? "Reserve slot — Pay at ground"
                      : "Pick a method"}
              </Button>
            </div>

            {confirm.isError && (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">Payment failed</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(confirm.error as Error)?.message ?? "Something went wrong. Please try again."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    if (method) confirm.mutate(method);
                  }}
                  disabled={confirm.isPending}
                >
                  Retry payment
                </Button>
              </div>
            )}

            <p className="mt-3 text-[11px] text-muted-foreground">
              Online payments (UPI/card/netbanking) are simulated in this demo — no real charge is made. Cash bookings must be settled at the venue before check-in.
            </p>
          </div>
        </div>
      </DashShell>
    );
  }

  const turf = booking.turfs as any;
  const mapEmbed = turf?.lat && turf?.lng
    ? `https://maps.google.com/maps?q=${turf.lat},${turf.lng}&z=15&output=embed`
    : turf?.address
      ? `https://maps.google.com/maps?q=${encodeURIComponent(`${turf.address}, ${turf.city ?? ""}`)}&z=15&output=embed`
      : null;
  const mapLink = turf?.lat && turf?.lng
    ? `https://www.google.com/maps/search/?api=1&query=${turf.lat},${turf.lng}`
    : turf?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${turf.address}, ${turf.city ?? ""}`)}`
      : null;

  return (
    <DashShell area="player" title="Booking confirmation">
      {/* Success / Payment-pending banner */}
      {booking.payment_status === "unpaid" || (booking as any).payment_method === "cash" ? (
        <div
          className="mx-auto mb-6 flex max-w-3xl items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-50/80 p-4"
          data-no-print
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-xl">
            💰
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold text-amber-800">
              Slot Reserved! Pay in cash at the ground 🏟️
            </p>
            <p className="text-xs text-amber-700/80">
              Please pay {formatPrice(Number(booking.total_amount))} before your session starts.
            </p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800">
              💰 Payment Pending – Pay at Ground
            </span>
          </div>
        </div>
      ) : (
        <div
          className="mx-auto mb-6 flex max-w-3xl items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"
          data-no-print
        >
          <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/20">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold">
              Payment Successful! ✅ You're in — show this ticket at the gate.
            </p>
            <p className="text-xs text-muted-foreground">
              Ref <span className="font-mono">{refCode}</span> · {(booking as any).payment_method ?? "—"} · {booking.payment_status}
            </p>
          </div>
        </div>
      )}

      <BookingTicket booking={booking as any} />

      {mapEmbed && (
        <div className="mx-auto mt-6 max-w-3xl surface-card overflow-hidden" data-no-print>
          <div className="flex items-center justify-between px-5 py-3">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
              Venue location
            </p>
            {mapLink && (
              <a href={mapLink} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent hover:underline">
                Open in Google Maps ↗
              </a>
            )}
          </div>
          <iframe
            title="Venue map"
            src={mapEmbed}
            className="h-64 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {turf?.address && (
            <p className="px-5 py-3 text-xs text-muted-foreground">
              {turf.address}{turf.city ? `, ${turf.city}` : ""}
            </p>
          )}
        </div>
      )}

      <div className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-[1.4fr_1fr]" data-no-print>
        <div className="surface-card p-5">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
            Next steps
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button onClick={() => window.print()} variant="outline">
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button onClick={shareBooking} variant="outline">
              <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
            <Button asChild>
              <Link to="/verify/$id" params={{ id: booking.id }}>
                Open verification <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/bookings/$id" params={{ id: booking.id }}>
                Manage booking
              </Link>
            </Button>
          </div>
        </div>

        <div className="surface-card p-5">
          <p className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.14em]">
            <ShieldCheck className="h-4 w-4" /> Flexibility
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <li>• Free cancel up to {booking.turfs?.cancellation_hours ?? 6}h before kickoff.</li>
            <li>• Late cancel fee: {booking.turfs?.cancellation_fee_pct ?? 0}% of total.</li>
            <li>• Reschedule up to {booking.turfs?.reschedule_hours ?? 6}h before kickoff.</li>
            <li>• Owner-side cancellations are always fully refunded.</li>
          </ul>
        </div>
      </div>
    </DashShell>
  );
}

function PayOption({
  icon: Icon,
  title,
  desc,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
        active
          ? "border-accent bg-accent/5 shadow-[var(--shadow-soft)] ring-1 ring-accent"
          : "border-border bg-card hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[var(--shadow-soft)]"
      }`}
    >
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${active ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
      </span>
      {active && (
        <span className="absolute right-3 top-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Selected
        </span>
      )}
    </button>
  );
}

function ConfSummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
