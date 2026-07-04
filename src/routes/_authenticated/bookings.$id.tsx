import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MapPin, History, CalendarClock, Receipt, ShieldAlert, Star, Ticket as TicketIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { cancelBooking, rescheduleBooking, submitReview } from "@/lib/bookings.functions";

import { formatDateTime, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/bookings/$id")({
  head: () => ({ meta: [{ title: "Booking details — Bowlie" }] }),
  component: BookingDetail,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground",
  confirmed: "bg-accent/15 text-accent",
  completed: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-muted text-muted-foreground",
};

function StatusPill({ value }: { value: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${STATUS_TONE[value] ?? "bg-muted text-muted-foreground"}`}>
      {value}
    </span>
  );
}

function BookingDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const router = useRouter();
  const { user, roles } = useAuth();
  const cancelFn = useServerFn(cancelBooking);
  const rescheduleFn = useServerFn(rescheduleBooking);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          turfs(name, city, slug, address, cover_image_url, owner_id, cancellation_hours, cancellation_fee_pct, reschedule_hours),
          booking_add_ons(id, quantity, unit_price, add_on_services(name, unit))
        `)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["booking-history", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_status_events")
        .select("*")
        .eq("booking_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["booking", id] });
    qc.invalidateQueries({ queryKey: ["booking-history", id] });
    qc.invalidateQueries({ queryKey: ["bookings"] });
  };

  const cancel = useMutation({
    mutationFn: (reason: string) => cancelFn({ data: { id, reason } }),
    onSuccess: (res) => {
      const { fee, refund, refunded, actor } = res;
      const by = actor === "owner" ? "by venue" : actor === "admin" ? "by admin" : "";
      const tail = refunded
        ? `Refund: ${formatPrice(refund)}`
        : fee > 0
          ? `Fee charged: ${formatPrice(fee)}`
          : "No fee";
      toast.success(`Booking cancelled ${by} · ${tail}`);
      invalidateAll();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const reschedule = useMutation({
    mutationFn: ({ date, start }: { date: string; start: string; hours: number }) => {
      // date is local ISO (YYYY-MM-DD), start is local time (HH:mm)
      // Construct via local-time components so IST users don't shift by one day
      const startAt = new Date(`${date}T${start}:00`).toISOString();
      return rescheduleFn({ data: { id, startAt } });
    },
    onSuccess: () => {
      toast.success("Booking rescheduled");
      invalidateAll();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) {
    return (
      <DashShell area="player" title="Booking">
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </DashShell>
    );
  }
  if (!booking) {
    return (
      <DashShell area="player" title="Booking">
        <p className="text-sm text-muted-foreground">Not found.</p>
      </DashShell>
    );
  }

  const startDate = new Date(booking.start_at);
  const hoursToStart = (startDate.getTime() - Date.now()) / 36e5;
  const cancelHours = booking.turfs?.cancellation_hours ?? 6;
  const rescheduleHours = booking.turfs?.reschedule_hours ?? 6;
  const feePct = booking.turfs?.cancellation_fee_pct ?? 0;
  const isOpen = booking.status === "pending" || booking.status === "confirmed";

  // Actor detection — drives permission and refund behavior.
  const isAdmin = roles.includes("admin");
  const isVenueOwner = !!user && booking.turfs?.owner_id === user.id;
  const isPlayer = !!user && booking.user_id === user.id;
  const actor: "admin" | "owner" | "player" | null = isAdmin
    ? "admin"
    : isVenueOwner
      ? "owner"
      : isPlayer
        ? "player"
        : null;

  // Players pay the late-cancel fee. Owner/admin cancellations are always full refund.
  const playerFreeCancel = hoursToStart >= cancelHours;
  const cancelFee = isPlayer && !playerFreeCancel
    ? Math.round((Number(booking.total_amount) * feePct) / 100)
    : 0;
  const refundAmount = booking.payment_status === "paid"
    ? Math.max(0, Number(booking.total_amount) - cancelFee)
    : 0;
  // Owner/admin can reschedule any time; players must respect cutoff.
  const canReschedule = isOpen && (!isPlayer || hoursToStart >= rescheduleHours);
  const canCancel = isOpen && actor !== null;

  const addOns = (booking.booking_add_ons ?? []) as any[];

  return (
    <DashShell area="player" title="Booking details">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <Button asChild size="sm" variant="outline">
          <Link to="/bookings/$id/confirmation" params={{ id: booking.id }}>
            <TicketIcon className="mr-1.5 h-3.5 w-3.5" /> View ticket
          </Link>
        </Button>
      </div>


      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="surface-card overflow-hidden">
            <div className="aspect-[16/9] bg-muted">
              {booking.turfs?.cover_image_url && (
                <img src={booking.turfs.cover_image_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-semibold">{booking.turfs?.name}</h1>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {booking.turfs?.address}, {booking.turfs?.city}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusPill value={booking.status} />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    payment: {booking.payment_status}
                  </span>
                </div>
              </div>

              <dl className="mt-6 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <Row label="Start">{formatDateTime(booking.start_at)}</Row>
                <Row label="End">{formatDateTime(booking.end_at)}</Row>
                {(booking as any).pitch_types?.name && (
                  <Row label="Pitch">
                    {(booking as any).pitch_types.name}
                    {(booking as any).pitch_types.surface_type && (
                      <span className="text-muted-foreground"> · {(booking as any).pitch_types.surface_type}</span>
                    )}
                  </Row>
                )}
                {booking.status === "pending" && booking.lock_expires_at && (
                  <Row label="Slot lock">
                    Held until {formatDateTime(booking.lock_expires_at)}
                  </Row>
                )}
                {booking.cancelled_at && <Row label="Cancelled">{formatDateTime(booking.cancelled_at)}</Row>}
              </dl>

              {booking.cancellation_reason && (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Cancellation reason</p>
                  <p className="mt-1 text-sm">{booking.cancellation_reason}</p>
                </div>
              )}

              {booking.notes && (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Notes</p>
                  <p className="mt-1 text-sm">{booking.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="surface-card p-6">
            <p className="font-display font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Status history</p>
            <ol className="mt-4 space-y-3 text-sm">
              {(history ?? []).map((e: any) => (
                <li key={e.id} className="flex gap-3">
                  <div className="mt-1.5 h-2 w-2 flex-none rounded-full bg-accent" />
                  <div className="flex-1">
                    <p>
                      {e.from_status ? (
                        <>
                          Status: <StatusPill value={e.from_status} /> → <StatusPill value={e.to_status} />
                        </>
                      ) : (
                        <>Created with status <StatusPill value={e.to_status} /></>
                      )}
                      {e.from_payment_status && e.from_payment_status !== e.to_payment_status && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (payment: {e.from_payment_status} → {e.to_payment_status})
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(e.created_at)}{e.note ? ` · ${e.note}` : ""}</p>
                  </div>
                </li>
              ))}
              {(!history || history.length === 0) && (
                <li className="text-sm text-muted-foreground">No history yet.</li>
              )}
            </ol>
          </div>

          <ReviewCard
            bookingId={booking.id}
            canReview={
              isPlayer &&
              ["completed", "confirmed", "pending"].includes(booking.status) &&
              new Date(booking.end_at) < new Date()
            }
            endAt={booking.end_at}
          />
        </div>


        <aside className="space-y-3">
          <div className="surface-card p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Price breakdown</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Slot subtotal</dt>
                <dd>{formatPrice(booking.subtotal_amount || (Number(booking.total_amount) - Number(booking.add_ons_amount || 0)))}</dd>
              </div>
              {addOns.length > 0 && (
                <>
                  <div className="my-2 h-px bg-border" />
                  {addOns.map((l) => (
                    <div key={l.id} className="flex justify-between text-xs">
                      <dt className="text-muted-foreground">
                        {l.add_on_services?.name} × {l.quantity}
                      </dt>
                      <dd>{formatPrice(Number(l.unit_price) * l.quantity)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm">
                    <dt>Add-ons</dt>
                    <dd>{formatPrice(booking.add_ons_amount)}</dd>
                  </div>
                </>
              )}
            </dl>
            <div className="my-3 h-px bg-border" />
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="font-display text-3xl font-bold">{formatPrice(booking.total_amount)}</p>
            </div>

            <div className="mt-5 space-y-2">
              <Button asChild variant="outline" className="w-full">
                <Link to="/bookings/$id/confirmation" params={{ id: booking.id }}>
                  <Receipt className="mr-2 h-4 w-4" /> View receipt
                </Link>
              </Button>
              {canReschedule && (
                <RescheduleDialog
                  start={booking.start_at}
                  durationHours={(new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 36e5}
                  disabled={reschedule.isPending}
                  cutoffHours={rescheduleHours}
                  actor={actor}
                  onSubmit={(v) => reschedule.mutate(v)}
                />
              )}
              {canCancel && (
                <CancelDialog
                  feePct={feePct}
                  isFreeCancel={isPlayer ? playerFreeCancel : true}
                  cancelFee={cancelFee}
                  refundAmount={refundAmount}
                  isPaid={booking.payment_status === "paid"}
                  actor={actor!}
                  disabled={cancel.isPending}
                  onSubmit={(reason) => cancel.mutate(reason)}
                />
              )}
              {isPlayer && (
                <Button asChild variant="ghost" className="w-full">
                  <Link to="/squad-fill/new" search={{ booking: booking.id }}>
                    Need players? Open squad fill
                  </Link>
                </Button>
              )}
              {actor === null && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <ShieldAlert className="mr-1 inline h-3 w-3" />
                  You don't have permission to manage this booking.
                </p>
              )}
            </div>
          </div>

          <div className="surface-card p-5 text-sm">
            <p className="font-medium">Cancellation & reschedule policy</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>• Players: free cancel up to {cancelHours}h before kickoff; late cancel fee {feePct}% of total.</li>
              <li>• Players: reschedule allowed up to {rescheduleHours}h before kickoff (same duration).</li>
              <li>• Venue & admin cancellations are always fully refunded, no cutoff.</li>
              <li>• Pending bookings are slot-locked for 10 minutes during checkout.</li>
            </ul>
          </div>
        </aside>
      </div>
    </DashShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function CancelDialog({
  feePct, isFreeCancel, cancelFee, refundAmount, isPaid, actor, disabled, onSubmit,
}: {
  feePct: number; isFreeCancel: boolean; cancelFee: number; refundAmount: number;
  isPaid: boolean; actor: "admin" | "owner" | "player"; disabled: boolean; onSubmit: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const isStaff = actor !== "player";
  const triggerLabel = actor === "admin"
    ? "Admin override · Cancel"
    : actor === "owner"
      ? "Cancel as venue"
      : "Cancel booking";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={disabled}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {isStaff ? (
            <p className="rounded-md bg-primary/5 px-3 py-2 text-muted-foreground">
              Cancelling on behalf of the {actor === "admin" ? "platform" : "venue"}. The slot lock will release and the player receives a <span className="font-medium text-foreground">full refund</span> of any captured payment.
            </p>
          ) : isFreeCancel ? (
            <p className="text-muted-foreground">
              You're within the free cancellation window. No fees will be charged.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Inside the cancellation window — a fee of <span className="font-medium text-foreground">{feePct}% ({formatPrice(cancelFee)})</span> applies.
            </p>
          )}
          {isPaid && (
            <p className="text-muted-foreground">
              Estimated refund: <span className="font-medium text-foreground">{formatPrice(refundAmount)}</span>
            </p>
          )}
          <div>
            <Label htmlFor="reason">Reason {isStaff ? "(recorded in audit log)" : "(optional)"}</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1.5" placeholder={isStaff ? "Why is this being cancelled?" : "Let the turf know why"} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Keep booking</Button>
          <Button variant="destructive" onClick={() => { onSubmit(reason); setOpen(false); }}>Confirm cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({
  start, durationHours, disabled, cutoffHours, actor, onSubmit,
}: {
  start: string; durationHours: number; disabled: boolean; cutoffHours: number;
  actor: "admin" | "owner" | "player" | null;
  onSubmit: (v: { date: string; start: string; hours: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const d = new Date(start);
  // Use local date methods to avoid the IST one-day-behind bug
  const localYear = d.getFullYear();
  const localMonth = String(d.getMonth() + 1).padStart(2, "0");
  const localDay = String(d.getDate()).padStart(2, "0");
  const isoDay = `${localYear}-${localMonth}-${localDay}`;
  const [date, setDate] = useState(isoDay);
  const [startTime, setStartTime] = useState(d.toTimeString().slice(0, 5));
  const [hours] = useState(Math.max(1, Math.round(durationHours)));
  const isStaff = actor === "admin" || actor === "owner";

  // Compute today's local ISO date for the min attribute
  const now = new Date();
  const todayMin = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={disabled}>
          <CalendarClock className="mr-2 h-4 w-4" /> {isStaff ? "Move slot" : "Reschedule"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule booking</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="rs-date">Date</Label><Input id="rs-date" type="date" value={date} min={todayMin} onChange={(e) => setDate(e.target.value)} className="mt-1.5" /></div>
          <div><Label htmlFor="rs-start">Start</Label><Input id="rs-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1.5" /></div>
        </div>
        <p className="text-xs text-muted-foreground">
          Duration stays at <span className="font-medium text-foreground">{hours}h</span>.{" "}
          {isStaff
            ? "Staff override — cutoff rules are bypassed, but the new slot still has to be free."
            : `Players must reschedule at least ${cutoffHours}h before kickoff.`}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onSubmit({ date, start: startTime, hours }); setOpen(false); }}>Confirm new time</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewCard({ bookingId, canReview, endAt }: { bookingId: string; canReview: boolean; endAt?: string }) {
  const qc = useQueryClient();
  const submit = useServerFn(submitReview);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const { data: existing } = useQuery({
    queryKey: ["booking-review", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("rating, comment, created_at")
        .eq("booking_id", bookingId)
        .maybeSingle();
      return data;
    },
  });

  const m = useMutation({
    mutationFn: () => submit({ data: { bookingId, rating, comment: comment.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Thanks for the review!");
      qc.invalidateQueries({ queryKey: ["booking-review", bookingId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (existing) {
    return (
      <div className="surface-card p-6">
        <p className="font-display font-semibold flex items-center gap-2">
          <Star className="h-4 w-4 fill-current text-amber-500" /> Your review
        </p>
        <div className="mt-3 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-4 w-4 ${n <= existing.rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}`}
            />
          ))}
          <span className="ml-2 text-xs text-muted-foreground">
            {formatDateTime(existing.created_at)}
          </span>
        </div>
        {existing.comment && <p className="mt-3 text-sm">{existing.comment}</p>}
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="surface-card p-6">
        <p className="font-display font-semibold flex items-center gap-2">
          <Star className="h-4 w-4" /> Rate this booking
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {endAt && new Date(endAt) > new Date()
            ? `Reviews open after your booking ends on ${formatDateTime(endAt)}.`
            : "Only the booking holder can review after the slot ends."}
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card p-6">
      <p className="font-display font-semibold flex items-center gap-2">
        <Star className="h-4 w-4" /> Rate this booking
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Help other players. Reviews are public on the venue page.
      </p>
      <div className="mt-4 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="rounded p-0.5 transition-transform hover:scale-110"
            aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              className={`h-7 w-7 ${(hover || rating) >= n ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}`}
            />
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Pitch quality, lighting, staff, value… (optional)"
        className="mt-4"
      />
      <Button onClick={() => m.mutate()} disabled={m.isPending} className="mt-3 w-full">
        {m.isPending ? "Submitting…" : "Submit review"}
      </Button>
    </div>
  );
}


