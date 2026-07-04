import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, CalendarX2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

const searchSchema = z.object({ booking: z.string().optional() });

// Server-side rules are also enforced by triggers; this mirrors them client-side
// so we can give friendly inline errors before round-tripping.
const formSchema = z.object({
  bookingId: z.string().uuid({ message: "Pick a booking to attach this post to." }),
  spots: z.number().int().min(1, "At least 1 spot").max(20, "Max 20 spots"),
  skill: z.enum(["beginner", "intermediate", "advanced", "pro", "any"]),
  joinFee: z.number().min(0, "Fee can't be negative").max(50000, "Fee looks too high"),
  mode: z.enum(["host_approval", "instant_join"]),
  fillType: z.enum(["pre_match", "emergency"]),
  notes: z.string().max(500, "Keep notes under 500 chars").optional(),
});

export const Route = createFileRoute("/_authenticated/squad-fill/new")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "New squad post — Bowlie" }] }),
  component: SquadFillNew,
});

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  turfs: { name: string | null; city: string | null } | null;
  has_post?: boolean;
};

function SquadFillNew() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { booking: preBookingId } = Route.useSearch();

  const [bookingId, setBookingId] = useState(preBookingId ?? "");
  const [spots, setSpots] = useState(2);
  const [skill, setSkill] = useState<"beginner" | "intermediate" | "advanced" | "pro" | "any">("any");
  const [joinFee, setJoinFee] = useState(0);
  const [mode, setMode] = useState<"host_approval" | "instant_join">("host_approval");
  const [fillType, setFillType] = useState<"pre_match" | "emergency">("pre_match");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pull ALL recent bookings (eligible + ineligible) so we can show users why a
  // booking can't be used (cancelled/past/already posted).
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["my-recent-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("bookings")
        .select("id, start_at, end_at, status, turfs(name, city)")
        .eq("user_id", user.id)
        .gte("start_at", since)
        .order("start_at", { ascending: true });
      if (error) throw error;

      const ids = (data ?? []).map((b) => b.id);
      let postedSet = new Set<string>();
      if (ids.length > 0) {
        const { data: posted } = await supabase
          .from("squad_fill_posts")
          .select("booking_id")
          .in("booking_id", ids)
          .in("status", ["open", "full"]);
        postedSet = new Set((posted ?? []).map((p: any) => p.booking_id));
      }
      return (data ?? []).map((b) => ({ ...b, has_post: postedSet.has(b.id) })) as BookingRow[];
    },
  });

  const upcoming = useMemo(
    () => (bookings ?? []).filter((b) => new Date(b.start_at).getTime() > Date.now()),
    [bookings],
  );
  const eligible = useMemo(
    () =>
      upcoming.filter(
        (b) => (b.status === "pending" || b.status === "confirmed") && !b.has_post,
      ),
    [upcoming],
  );
  const ineligible = useMemo(
    () =>
      (bookings ?? []).filter(
        (b) =>
          new Date(b.start_at).getTime() <= Date.now() ||
          b.status === "cancelled" ||
          b.status === "refunded" ||
          b.has_post,
      ),
    [bookings],
  );

  // If user landed with ?booking=... but it isn't eligible, surface a clear reason
  useEffect(() => {
    if (!preBookingId || !bookings) return;
    const match = bookings.find((b) => b.id === preBookingId);
    if (!match) {
      setErrors((e) => ({ ...e, bookingId: "That booking isn't on your account anymore." }));
      setBookingId("");
      return;
    }
    const reason = ineligibleReason(match);
    if (reason) {
      setErrors((e) => ({ ...e, bookingId: reason }));
      setBookingId("");
    }
  }, [preBookingId, bookings]);

  function ineligibleReason(b: BookingRow): string | null {
    if (b.status === "cancelled") return "This booking was cancelled — pick a confirmed one.";
    if (b.status === "refunded") return "This booking was refunded and can't be used.";
    if (b.status === "completed") return "This booking has already happened.";
    if (new Date(b.start_at).getTime() <= Date.now()) return "This booking has already started.";
    if (b.has_post) return "There's already an open squad post for this booking.";
    return null;
  }

  function pickBooking(id: string) {
    setErrors((e) => ({ ...e, bookingId: "" }));
    setBookingId(id);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const parsed = formSchema.safeParse({
      bookingId,
      spots,
      skill,
      joinFee,
      mode,
      fillType,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join(".")] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error(parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.");
      return;
    }
    setErrors({});

    setBusy(true);
    try {
      // Re-verify booking is still eligible right before insert
      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .select("id, start_at, status, user_id")
        .eq("id", bookingId)
        .maybeSingle();
      if (bErr) throw bErr;
      if (!booking) throw new Error("Booking not found. Pick a different one.");
      if (booking.user_id !== user.id) throw new Error("You can only post for your own bookings.");
      const reason = ineligibleReason({
        id: booking.id,
        start_at: booking.start_at,
        end_at: "",
        status: booking.status as string,
        turfs: null,
      });
      if (reason) throw new Error(reason);

      const emergencyExpiresAt =
        fillType === "emergency"
          ? new Date(new Date(booking.start_at).getTime() + 10 * 60 * 1000).toISOString()
          : null;

      const { error } = await supabase.from("squad_fill_posts").insert({
        booking_id: bookingId,
        host_id: user.id,
        spots_needed: spots,
        skill_level: skill,
        join_fee: joinFee,
        approval_mode: mode,
        fill_type: fillType,
        emergency_expires_at: emergencyExpiresAt,
        notes: notes.trim() || null,
        status: "open",
      });
      if (error) {
        // Map known DB errors to friendlier text
        if (error.message.toLowerCase().includes("duplicate")) {
          throw new Error("A squad post already exists for this booking.");
        }
        throw error;
      }

      toast.success("Squad post created — it's live now.");

      // Force fresh data everywhere a post could appear so users see it immediately
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-hosted-posts"] }),
        qc.invalidateQueries({ queryKey: ["my-join-requests"] }),
        qc.invalidateQueries({ queryKey: ["open-games"] }),
        qc.invalidateQueries({ queryKey: ["my-recent-bookings"] }),
        qc.invalidateQueries({ queryKey: ["my-upcoming-for-host"] }),
        qc.invalidateQueries({ queryKey: ["squad-posts"] }),
      ]);


      router.navigate({ to: "/squad-fill" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const hasEligible = eligible.length > 0;
  const showIneligible = ineligible.length > 0;

  return (
    <DashShell area="player" title="New squad post" subtitle="Link to a booking and open spots for players to fill.">
      <div className="mx-auto max-w-2xl">
        {isLoading ? (
          <div className="surface-card p-6"><div className="h-24 animate-pulse rounded bg-muted" /></div>
        ) : (
          <form onSubmit={onSubmit} className="surface-card space-y-6 p-6">
            {/* Booking picker — selectable cards for fast selection */}
            <div>
              <Label>Pick a booking</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Squad posts attach to one of your upcoming confirmed/pending bookings so joiners know where and when to show up.
              </p>

              {hasEligible ? (
                <div className="mt-3 grid gap-2">
                  {eligible.map((b) => {
                    const active = b.id === bookingId;
                    return (
                      <button
                        type="button"
                        key={b.id}
                        onClick={() => pickBooking(b.id)}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                          active ? "border-foreground bg-foreground/5 ring-1 ring-foreground" : "border-border hover:border-foreground/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{b.turfs?.name ?? "Booking"}{b.turfs?.city ? ` · ${b.turfs.city}` : ""}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(b.start_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">{b.status}</span>
                          {active && <CheckCircle2 className="h-4 w-4 text-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">No upcoming eligible bookings yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Book a slot first, then return here to open a squad post for that booking.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => router.navigate({ to: "/browse" })}>Browse turfs</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => router.navigate({ to: "/bookings" })}>My bookings</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => router.navigate({ to: "/open-games" })}>See open games</Button>
                  </div>
                </div>
              )}

              {errors.bookingId && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" /> {errors.bookingId}
                </p>
              )}
              {showIneligible && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    {ineligible.length} booking{ineligible.length === 1 ? "" : "s"} can't be used — why?
                  </summary>
                  <ul className="mt-2 space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
                    {ineligible.slice(0, 5).map((b) => (
                      <li key={b.id} className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          <span className="font-medium">{b.turfs?.name ?? "Booking"}</span> · {formatDateTime(b.start_at)} —{" "}
                          <span className="text-muted-foreground">{ineligibleReason(b)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {hasEligible && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Don't see the one you want?{" "}
                  <Link to="/browse" className="underline hover:text-foreground">Book a new slot</Link>.
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="spots">Spots needed</Label>
                <Input id="spots" type="number" min={1} max={20} value={spots} onChange={(e) => setSpots(Number(e.target.value))} className="mt-1.5" />
                {errors.spots && <p className="mt-1 text-xs text-destructive">{errors.spots}</p>}
              </div>
              <div>
                <Label htmlFor="skill">Skill level</Label>
                <select id="skill" value={skill} onChange={(e) => setSkill(e.target.value as any)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="any">Any</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <div>
                <Label htmlFor="fee">Join fee (INR)</Label>
                <Input id="fee" type="number" min={0} value={joinFee} onChange={(e) => setJoinFee(Number(e.target.value))} className="mt-1.5" />
                {errors.joinFee && <p className="mt-1 text-xs text-destructive">{errors.joinFee}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Approval</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["host_approval", "instant_join"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`rounded-md border px-3 py-2 text-sm capitalize ${mode === m ? "border-foreground bg-foreground text-background" : "border-border"}`}
                    >
                      {m.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Fill type</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["pre_match", "emergency"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFillType(t)}
                      className={`rounded-md border px-3 py-2 text-sm capitalize ${fillType === t ? "border-foreground bg-foreground text-background" : "border-border"}`}
                    >
                      {t.replace("_", " ")}
                    </button>
                  ))}
                </div>
                {fillType === "emergency" && (
                  <p className="mt-1.5 text-xs text-destructive">
                    Emergency posts auto-expire 10 minutes after the booking starts.
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" placeholder="Anything joiners should know" />
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{errors.notes ?? ""}</span>
                <span>{notes.length}/500</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={busy || !bookingId}>
                {busy ? "Posting…" : "Open squad post"}
              </Button>
              <Button type="button" variant="ghost" size="lg" onClick={() => router.navigate({ to: "/squad-fill" })}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </DashShell>
  );
}
