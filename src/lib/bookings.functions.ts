import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";


type Role = "admin" | "owner" | "player";

async function loadContext(adminClient: any, userId: string, bookingId: string) {
  const { data: booking, error: bErr } = await adminClient
    .from("bookings")
    .select(
      "id, user_id, turf_id, pitch_type_id, start_at, end_at, status, payment_status, total_amount, subtotal_amount, add_ons_amount, turfs(owner_id, cancellation_hours, cancellation_fee_pct, reschedule_hours)",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (bErr) throw new Error(bErr.message);
  if (!booking) throw new Error("Booking not found");

  const { data: roleRows } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (roleRows ?? []).map((r: any) => r.role as Role);
  const isAdmin = roles.includes("admin");
  const isVenueOwner = booking.turfs?.owner_id === userId;
  const isPlayer = booking.user_id === userId;
  if (!isAdmin && !isVenueOwner && !isPlayer) {
    throw new Error("You don't have permission to act on this booking");
  }
  const actor: Role = isAdmin ? "admin" : isVenueOwner ? "owner" : "player";
  return { booking, actor, isAdmin, isVenueOwner, isPlayer };
}

/**
 * Cancel a booking. Role-aware:
 *  - player: own booking only, fee applies inside cutoff window.
 *  - owner: any booking on their turf, always full refund (venue-side cancel).
 *  - admin: any booking, always full refund.
 */
export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { booking, actor, isAdmin, isVenueOwner, isPlayer } = await loadContext(
      supabaseAdmin,
      context.userId,
      data.id,
    );

    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new Error(`Booking is already ${booking.status} — nothing to cancel`);
    }

    const hoursToStart = (new Date(booking.start_at).getTime() - Date.now()) / 36e5;
    const cutoff = booking.turfs?.cancellation_hours ?? 6;
    const feePct = Number(booking.turfs?.cancellation_fee_pct ?? 0);
    const insideCutoff = hoursToStart < cutoff;

    // Players inside the cutoff pay the fee. Owner/admin cancellations are full refund.
    const fee = isPlayer && insideCutoff
      ? Math.round((Number(booking.total_amount) * feePct) / 100)
      : 0;
    const isPaid = booking.payment_status === "paid";
    const refund = isPaid ? Math.max(0, Number(booking.total_amount) - fee) : 0;

    const reason =
      data.reason?.trim() ||
      (isAdmin ? "Cancelled by admin" : isVenueOwner ? "Cancelled by venue" : null);

    const nextPaymentStatus = isPaid && refund > 0 ? "refunded" : booking.payment_status;

    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        payment_status: nextPaymentStatus,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    return { ok: true, actor, fee, refund, refunded: isPaid && refund > 0 };
  });

/**
 * Reschedule a booking. Same role gates as cancel.
 * Duration is preserved — to change duration, cancel and rebook.
 * Players must reschedule before the venue's cutoff window.
 * Owners/admins can move bookings at any time, including past the cutoff.
 */
export const rescheduleBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; startAt: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { booking, isPlayer } = await loadContext(
      supabaseAdmin,
      context.userId,
      data.id,
    );

    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new Error(`Booking is ${booking.status} — cannot reschedule`);
    }

    const oldStart = new Date(booking.start_at);
    const oldEnd = new Date(booking.end_at);
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    const newStart = new Date(data.startAt);
    if (Number.isNaN(newStart.getTime())) throw new Error("Invalid start time");
    if (newStart < new Date()) throw new Error("Start time is in the past");
    const newEnd = new Date(newStart.getTime() + durationMs);

    if (isPlayer) {
      const hoursToStart = (oldStart.getTime() - Date.now()) / 36e5;
      const cutoff = booking.turfs?.reschedule_hours ?? 6;
      if (hoursToStart < cutoff) {
        throw new Error(
          `Reschedule must be done at least ${cutoff}h before the original start time`,
        );
      }
    }

    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        start_at: newStart.toISOString(),
        end_at: newEnd.toISOString(),
        lock_expires_at: null,
      })
      .eq("id", data.id);
    if (error) {
      if (error.code === "23505" || /no longer available/i.test(error.message)) {
        throw new Error("That slot is already taken — pick another time");
      }
      throw new Error(error.message);
    }

    return { ok: true, startAt: newStart.toISOString(), endAt: newEnd.toISOString() };
  });

/**
 * Verify (check-in) a booking at the gate.
 * Allowed actors: the player who owns the booking, the turf owner, or admin.
 * Idempotent — calling twice returns the same checked_in_at.
 */
export const checkInBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("check_in_booking", {
      _booking_id: data.id,
    });
    if (error) throw new Error(error.message);
    return row as { id: string; checked_in_at: string; checked_in_by: string; status: string };
  });

/**
 * Confirm a pending booking by choosing a payment method.
 *  - netbanking → marks payment_status='paid' (simulated online payment)
 *  - cash → marks payment_status='unpaid' (pay at venue)
 * Sets status='confirmed' and releases the slot lock.
 */
export const confirmBookingPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; method: "netbanking" | "cash" }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("confirm_booking_payment", {
      _booking_id: data.id,
      _method: data.method,
    });
    if (error) throw new Error(error.message);
    return row as any;
  });

/**
 * Mark a booking as completed once its end time has passed.
 * Used to unlock the review flow for players.
 */
export const markBookingCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("mark_booking_completed", {
      _booking_id: data.id,
    });
    if (error) throw new Error(error.message);
    return row as any;
  });

const reviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

/**
 * Submit a review for a completed booking.
 * Only the booking's player may submit. One review per booking (DB unique index).
 * Rating is clamped 1-5, comment max 1000 chars.
 * After insert, recomputes the turf's rating + total_reviews.
 */
export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bookingId: string; rating: number; comment?: string }) =>
    reviewSchema.parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, user_id, turf_id, status, end_at")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!booking) throw new Error("Booking not found");
    if (booking.user_id !== userId) throw new Error("Only the booking owner can review");
    // Auto-complete if the booking has ended
    if (booking.status !== "completed") {
      if (new Date(booking.end_at) > new Date()) {
        throw new Error("Reviews open once your booking has finished");
      }
      if (!["confirmed", "pending"].includes(booking.status)) {
        throw new Error(`Cannot review a ${booking.status} booking`);
      }
      await supabase.rpc("mark_booking_completed", { _booking_id: booking.id });
    }

    const { error: insErr } = await supabase.from("reviews").insert({
      booking_id: booking.id,
      user_id: userId,
      turf_id: booking.turf_id,
      rating: data.rating,
      comment: data.comment?.trim() || null,
    });
    if (insErr) {
      if (insErr.code === "23505") throw new Error("You already reviewed this booking");
      throw new Error(insErr.message);
    }

    // Recompute aggregates with the admin client so it works even if the player
    // can't read every review row.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agg } = await supabaseAdmin
      .from("reviews")
      .select("rating", { count: "exact" })
      .eq("turf_id", booking.turf_id);
    if (agg && agg.length > 0) {
      const avg = agg.reduce((s, r: any) => s + Number(r.rating), 0) / agg.length;
      await supabaseAdmin
        .from("turfs")
        .update({ rating: Number(avg.toFixed(2)), total_reviews: agg.length })
        .eq("id", booking.turf_id);
    }
    return { ok: true };
  });

