import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import {
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  ArrowRight,
  Ticket,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({ meta: [{ title: "Your bookings — Bowlie" }] }),
  component: BookingsPage,
});

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  total_amount: number | string;
  status: string;
  payment_status: string;
  turfs?: { name?: string | null; city?: string | null; slug?: string | null; cover_image_url?: string | null } | null;
};

type Tab = "upcoming" | "completed" | "cancelled";

const TABS: { key: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "upcoming",  label: "Upcoming",  Icon: CalendarClock },
  { key: "completed", label: "Completed", Icon: CheckCircle2 },
  { key: "cancelled", label: "Cancelled", Icon: XCircle },
];

const STATUS_TONE: Record<string, { bg: string; text: string }> = {
  pending:   { bg: "bg-amber-500/10", text: "text-amber-700" },
  confirmed: { bg: "bg-emerald-500/10", text: "text-emerald-700" },
  completed: { bg: "bg-blue-500/10", text: "text-blue-700" },
  cancelled: { bg: "bg-muted", text: "text-muted-foreground" },
};

function BookingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("upcoming");

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("bookings")
        .select("id, start_at, end_at, total_amount, status, payment_status, turfs(name, city, slug, cover_image_url)")
        .eq("user_id", user.id)
        .order("start_at", { ascending: false });
      return (data ?? []) as BookingRow[];
    },
    enabled: !!user,
  });

  const now = new Date();

  const grouped = useMemo(() => {
    const upcoming: BookingRow[] = [];
    const completed: BookingRow[] = [];
    const cancelled: BookingRow[] = [];
    for (const b of data ?? []) {
      if (b.status === "cancelled") {
        cancelled.push(b);
      } else if (b.status === "completed" || new Date(b.end_at) < now) {
        completed.push(b);
      } else {
        upcoming.push(b);
      }
    }
    return { upcoming, completed, cancelled };
  }, [data]);

  const activeList = grouped[tab];
  const counts = { upcoming: grouped.upcoming.length, completed: grouped.completed.length, cancelled: grouped.cancelled.length };

  return (
    <DashShell area="player" title="Bookings" subtitle="Your booking history — upcoming, completed, and cancelled.">
      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {counts[key] > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-primary/10 text-primary" : "bg-muted-foreground/15 text-muted-foreground"}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : activeList.length === 0 ? (
        <EmptyBookings tab={tab} />
      ) : (
        <div className="space-y-3">
          {activeList.map((b) => (
            <BookingCard key={b.id} booking={b} tab={tab} />
          ))}
        </div>
      )}
    </DashShell>
  );
}

// ── Booking card ───────────────────────────────────────────────────

function BookingCard({ booking, tab }: { booking: BookingRow; tab: Tab }) {
  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);
  const durationHrs = (end.getTime() - start.getTime()) / 36e5;
  const isPast = new Date(booking.end_at) < new Date();
  const tone = STATUS_TONE[booking.status] ?? STATUS_TONE.pending;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/30">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <Link
          to="/bookings/$id/confirmation"
          params={{ id: booking.id }}
          className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-muted"
        >
          {booking.turfs?.cover_image_url ? (
            <img src={booking.turfs.cover_image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MapPin className="h-5 w-5 text-muted-foreground/40" />
            </div>
          )}
        </Link>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              to="/bookings/$id/confirmation"
              params={{ id: booking.id }}
              className="min-w-0"
            >
              <p className="truncate font-display font-semibold hover:underline">
                {booking.turfs?.name ?? "Unknown turf"}
              </p>
            </Link>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.bg} ${tone.text}`}>
              {booking.status}
            </span>
          </div>

          {booking.turfs?.city && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {booking.turfs.city}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {formatDate(start)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(start)} → {formatTime(end)}
              <span className="ml-0.5 text-muted-foreground/60">· {durationHrs}h</span>
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-display text-base font-bold tabular-nums">
              {formatPrice(Number(booking.total_amount))}
            </span>

            <div className="ml-auto flex gap-2">
              <Button asChild size="sm" variant="outline" className="h-8 px-3 text-xs">
                <Link to="/bookings/$id/confirmation" params={{ id: booking.id }}>
                  <Ticket className="mr-1 h-3 w-3" /> View ticket
                </Link>
              </Button>
              {(tab === "completed" || tab === "cancelled") && booking.turfs?.slug && (
                <Button asChild size="sm" variant="ghost" className="h-8 px-3 text-xs">
                  <Link to="/turfs/$slug" params={{ slug: booking.turfs.slug }}>
                    <RotateCcw className="mr-1 h-3 w-3" /> Book again
                  </Link>
                </Button>
              )}
              {tab === "upcoming" && !isPast && (
                <Button asChild size="sm" variant="ghost" className="h-8 px-3 text-xs">
                  <Link to="/bookings/$id" params={{ id: booking.id }}>
                    Details <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty states ───────────────────────────────────────────────────

function EmptyBookings({ tab }: { tab: Tab }) {
  if (tab === "upcoming") {
    return (
      <EmptyState
        icon={<CalendarClock className="h-4 w-4" />}
        title="No upcoming bookings"
        description="Find a turf and lock your next slot — it'll show up here."
        action={
          <Button asChild>
            <Link to="/browse">Browse turfs</Link>
          </Button>
        }
      />
    );
  }
  if (tab === "completed") {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-4 w-4" />}
        title="No completed bookings yet"
        description="Once your sessions are over, they'll appear here. Leave a review to help other players!"
        action={
          <Button asChild>
            <Link to="/browse">Browse turfs</Link>
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={<XCircle className="h-4 w-4" />}
      title="No cancelled bookings"
      description="Hopefully this stays empty — enjoy your games!"
      action={
        <Button asChild>
          <Link to="/browse">Browse turfs</Link>
        </Button>
      }
    />
  );
}
