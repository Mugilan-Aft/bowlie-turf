import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ShieldAlert,
  Printer,
  ArrowRight,
  Radio,
  Star,
  MessageSquare,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { BookingTicket } from "@/components/bookings/Ticket";
import { checkInBooking } from "@/lib/bookings.functions";

export const Route = createFileRoute("/_authenticated/verify/$id")({
  head: () => ({ meta: [{ title: "Verify ticket — Bowlie" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user, roles } = useAuth();
  const checkIn = useServerFn(checkInBooking);

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ["verify-booking", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `id, user_id, start_at, end_at, status, payment_status, payment_method, total_amount,
           subtotal_amount, add_ons_amount, checked_in_at,
           turfs(name, address, city, cover_image_url, owner_id, lat, lng),
           booking_add_ons(id, quantity, unit_price, add_on_services(name))`,
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

  const mutate = useMutation({
    mutationFn: () => checkIn({ data: { id } }),
    onSuccess: () => {
      toast.success("Ticket verified");
      qc.invalidateQueries({ queryKey: ["verify-booking", id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Auto-verify on first visit if the viewer is allowed (player / owner / admin)
  // and the slot is within a reasonable window.
  const isAdmin = roles.includes("admin");
  const isPlayer = !!user && booking?.user_id === user.id;
  const isOwner = !!user && (booking as any)?.turfs?.owner_id === user.id;
  const canVerify = !!booking && (isAdmin || isPlayer || isOwner);
  const start = booking ? new Date(booking.start_at).getTime() : 0;
  const within = booking ? Math.abs(Date.now() - start) < 12 * 36e5 : false;

  const didAttempt = useRef(false);
  useEffect(() => {
    if (didAttempt.current) return;
    if (
      booking &&
      !booking.checked_in_at &&
      canVerify &&
      within &&
      ["pending", "confirmed", "completed"].includes(booking.status)
    ) {
      didAttempt.current = true;
      mutate.mutate();
    }
  }, [booking, canVerify, within, mutate]);

  // Live subscription: reflect check-in / status changes the moment the gate scans.
  const [liveConnected, setLiveConnected] = useState(false);
  useEffect(() => {
    const channel = supabase
      .channel(`booking-verify-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["verify-booking", id] });
        },
      )
      .subscribe((status) => setLiveConnected(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  if (isLoading) {
    return (
      <DashShell area="player" title="Verify ticket">
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
      </DashShell>
    );
  }
  if (error || !booking) {
    return (
      <DashShell area="player" title="Verify ticket">
        <div className="surface-card mx-auto max-w-md p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-3 font-display text-lg font-semibold">Ticket not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This ticket is invalid or you don't have permission to view it.
          </p>
        </div>
      </DashShell>
    );
  }

  const isVerified = !!booking.checked_in_at;

  return (
    <DashShell area="player" title="Verify ticket">
      <div
        className={`mx-auto mb-6 flex max-w-3xl items-center gap-3 rounded-2xl border p-4 ${
          isVerified
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-warning/30 bg-warning/10"
        }`}
        data-no-print
      >
        <div
          className={`grid h-10 w-10 place-items-center rounded-full ${
            isVerified ? "bg-emerald-500/25" : "bg-warning/20"
          }`}
        >
          <CheckCircle2 className={`h-5 w-5 ${isVerified ? "text-emerald-700" : "text-warning"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold">
            {isVerified
              ? "Ticket verified · entry granted"
              : canVerify
                ? mutate.isPending
                  ? "Verifying ticket…"
                  : "Tap verify to check in"
                : "Show this screen at the gate"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isVerified
              ? `Checked in ${new Date(booking.checked_in_at!).toLocaleString()}`
              : "Only the booking holder, venue staff, or an admin can verify."}
          </p>
        </div>
        {!isVerified && canVerify && (
          <Button onClick={() => mutate.mutate()} disabled={mutate.isPending}>
            {mutate.isPending ? "Verifying…" : "Verify now"}
          </Button>
        )}
      </div>

      <BookingTicket booking={booking as any} />

      <div className="mx-auto mt-6 max-w-3xl space-y-4" data-no-print>
        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.14em]">
              <Radio className={`h-4 w-4 ${liveConnected ? "text-emerald-600" : "text-muted-foreground"}`} />
              Live verification status
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                liveConnected
                  ? "bg-emerald-500/15 text-emerald-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  liveConnected ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50"
                }`}
              />
              {liveConnected ? "Live" : "Connecting"}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isVerified
              ? `Checked in ${new Date(booking.checked_in_at!).toLocaleString()} — entry confirmed in real time.`
              : "Waiting for gate scan — this page updates the moment your ticket is verified."}
          </p>

          {isVerified && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="font-display text-sm font-semibold">Next steps</p>
              <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <li className="surface-card flex items-start gap-3 p-3">
                  <Star className="mt-0.5 h-4 w-4 text-amber-500" />
                  <div>
                    <p className="font-medium">Rate your game</p>
                    <p className="text-xs text-muted-foreground">
                      Share feedback after the match to help other players.
                    </p>
                  </div>
                </li>
                <li className="surface-card flex items-start gap-3 p-3">
                  <MessageSquare className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">Need help?</p>
                    <p className="text-xs text-muted-foreground">
                      Contact venue staff or reach support from the booking page.
                    </p>
                  </div>
                </li>
                <li className="surface-card flex items-start gap-3 p-3 sm:col-span-2">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">Book your next slot</p>
                    <p className="text-xs text-muted-foreground">
                      Lock in the same pitch and time for next week in seconds.
                    </p>
                  </div>
                </li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/bookings/$id" params={{ id: booking.id }}>
                    <Star className="mr-2 h-4 w-4" /> Leave a review
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/browse">
                    <CalendarDays className="mr-2 h-4 w-4" /> Book again
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Download bill
          </Button>
          <Button asChild variant="ghost">
            <Link to="/bookings/$id" params={{ id: booking.id }}>
              Booking details <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </DashShell>
  );
}
