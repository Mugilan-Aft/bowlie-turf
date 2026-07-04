import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Heart,
  MapPin,
  Search,
  Store,
  TrendingUp,
  Users2,
  XCircle,
  ArrowRight,
  DollarSign,
  Ticket,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice, formatTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Bowlie" }] }),
  component: PlayerDashboard,
});

// ── Types ──────────────────────────────────────────────────────────

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  total_amount: number | string;
  status: string;
  payment_status: string;
  turfs?: { name?: string | null; city?: string | null; slug?: string | null; cover_image_url?: string | null } | null;
};

type PaymentRow = {
  id: string;
  amount: number;
  created_at: string;
  status: string;
  provider: string;
  bookings?: {
    id: string;
    start_at: string;
    turfs?: { name?: string | null } | null;
  } | null;
};

type FavRow = {
  id: string;
  slug: string | null;
  name: string | null;
  city: string | null;
  cover_image_url: string | null;
  base_price: number | null;
  rating: number | null;
  total_reviews: number | null;
};

// ── Dashboard ──────────────────────────────────────────────────────

function PlayerDashboard() {
  const { user, roles } = useAuth();
  const isOwner = roles.includes("owner");

  const now = new Date();

  // ── All bookings (for stats + sections) ─────────────────────────
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["dash-bookings", user?.id],
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

  // ── Stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const list = bookings ?? [];
    const upcoming = list.filter((b) => b.status !== "cancelled" && new Date(b.start_at) >= now);
    const completed = list.filter((b) => b.status === "completed" || (b.status !== "cancelled" && new Date(b.end_at) < now));
    const cancelled = list.filter((b) => b.status === "cancelled");
    const totalSpent = list
      .filter((b) => b.payment_status === "paid")
      .reduce((s, b) => s + Number(b.total_amount), 0);
    return {
      total: list.length,
      upcoming: upcoming.length,
      completed: completed.length,
      cancelled: cancelled.length,
      totalSpent,
    };
  }, [bookings]);

  // ── Upcoming bookings ──────────────────────────────────────────
  const upcoming = useMemo(() => {
    return (bookings ?? [])
      .filter((b) => b.status !== "cancelled" && new Date(b.start_at) >= now)
      .slice(0, 3);
  }, [bookings]);

  // ── Recent bookings ────────────────────────────────────────────
  const recent = useMemo(() => {
    return (bookings ?? []).slice(0, 4);
  }, [bookings]);

  // ── Favorites ──────────────────────────────────────────────────
  const { data: favorites, isLoading: favsLoading } = useQuery({
    queryKey: ["dash-favorites", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("favorites")
        .select("turfs(id, slug, name, city, cover_image_url, base_price, rating, total_reviews)")
        .eq("user_id", user.id);
      return (data ?? []).map((f: any) => f.turfs).filter(Boolean) as FavRow[];
    },
    enabled: !!user,
  });

  // ── Profile ────────────────────────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ["dash-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, city, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // ── Recent payments ────────────────────────────────────────────
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["dash-payments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("payments")
        .select("id, amount, created_at, status, provider, bookings(id, start_at, turfs(name))")
        .in("booking_id", (bookings ?? []).map((b) => b.id))
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as PaymentRow[];
    },
    enabled: !!user && (bookings?.length ?? 0) > 0,
  });

  const statCards = [
    { icon: CalendarClock, label: "Upcoming", value: stats.upcoming, color: "text-amber-600", bg: "bg-amber-500/10" },
    { icon: CheckCircle2, label: "Completed", value: stats.completed, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { icon: XCircle, label: "Cancelled", value: stats.cancelled, color: "text-muted-foreground", bg: "bg-muted" },
    { icon: TrendingUp, label: "Total spent", value: formatPrice(stats.totalSpent), color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <DashShell
      area="player"
      title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : user?.email ? `, ${user.email.split("@")[0]}` : ""}`}
      subtitle="Your bookings, favorites, and stats — all in one place."
      actions={
        <Button asChild>
          <Link to="/browse"><Search className="mr-1.5 h-4 w-4" /> Find a turf</Link>
        </Button>
      }
    >
      {/* ── Stats row ──────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {statCards.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="surface-card flex items-center gap-3 p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${bg} ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
              <p className="font-display text-xl font-bold tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Owner CTA (if not owner) ───────────────────────────── */}
      {!isOwner && (
        <OwnerCTA />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Left column ──────────────────────────────────────── */}
        <div className="space-y-6">

          {/* ── Upcoming bookings ────────────────────────────── */}
          <Section
            title="Upcoming bookings"
            action={<Link to="/bookings" className="text-xs text-accent hover:underline">See all</Link>}
          >
            {bookingsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <EmptyCard
                message="No upcoming bookings."
                action={<Link to="/browse" className="text-xs text-accent hover:underline">Find a turf →</Link>}
              />
            ) : (
              <div className="space-y-2">
                {upcoming.map((b) => (
                  <BookingRowCard key={b.id} booking={b} />
                ))}
              </div>
            )}
          </Section>

          {/* ── Recent bookings ────────────────────────────────── */}
          <Section
            title="Recent activity"
            action={<Link to="/bookings" className="text-xs text-accent hover:underline">View history</Link>}
          >
            {bookingsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <EmptyCard message="No bookings yet." />
            ) : (
              <div className="space-y-2">
                {recent.map((b) => (
                  <BookingRowCard key={b.id} booking={b} compact />
                ))}
              </div>
            )}
          </Section>

          {/* ── Recent payments ────────────────────────────────── */}
          <Section title="Recent payments">
            {paymentsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : !payments || payments.length === 0 ? (
              <EmptyCard message="No payments recorded yet." />
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <PaymentRowCard key={p.id} payment={p} />
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ── Right sidebar ────────────────────────────────────── */}
        <div className="space-y-6">

          {/* ── Quick actions ──────────────────────────────────── */}
          <div className="surface-card p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Quick actions</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <QuickAction icon={Search} label="Find a turf" to="/browse" />
              <QuickAction icon={Ticket} label="My bookings" to="/bookings" />
              <QuickAction icon={Users2} label="Squad fill" to="/squad-fill" />
              <QuickAction icon={Heart} label="Favorites" to="/favorites" />
              {isOwner && <QuickAction icon={Store} label="Owner panel" to="/owner/dashboard" />}
            </div>
          </div>

          {/* ── Favorite grounds ──────────────────────────────── */}
          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Favorite grounds</p>
              <Link to="/favorites" className="text-[11px] text-accent hover:underline">See all</Link>
            </div>
            {favsLoading ? (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : !favorites || favorites.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                No favorites yet. <Link to="/browse" className="text-accent hover:underline">Browse turfs</Link>
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {favorites.slice(0, 4).map((f) => (
                  <Link
                    key={f.id}
                    to="/turfs/$slug"
                    params={{ slug: f.slug ?? "" }}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {f.cover_image_url ? (
                        <img src={f.cover_image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="text-[11px] text-muted-foreground">{f.city}</p>
                    </div>
                    {f.rating != null && f.rating > 0 && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {f.rating.toFixed(1)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── Profile summary ────────────────────────────────── */}
          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Profile</p>
              <Link to="/profile" className="text-[11px] text-accent hover:underline">Edit</Link>
            </div>
            <div className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ?? user?.email?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{profile?.full_name || user?.email?.split("@")[0] || "User"}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              {profile?.phone && (
                <p className="text-xs text-muted-foreground">📱 {profile.phone}</p>
              )}
              {profile?.city && (
                <p className="text-xs text-muted-foreground">📍 {profile.city}</p>
              )}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {roles.map((r) => (
                  <span key={r} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary capitalize">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyCard({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

function BookingRowCard({ booking, compact }: { booking: BookingRow; compact?: boolean }) {
  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);
  const durationHrs = (end.getTime() - start.getTime()) / 36e5;

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-700",
    confirmed: "bg-emerald-500/10 text-emerald-700",
    completed: "bg-blue-500/10 text-blue-700",
    cancelled: "bg-muted text-muted-foreground",
  };

  return (
    <Link
      to="/bookings/$id/confirmation"
      params={{ id: booking.id }}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/30"
    >
      {!compact && (
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
          {booking.turfs?.cover_image_url ? (
            <img src={booking.turfs.cover_image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MapPin className="h-4 w-4 text-muted-foreground/40" />
            </div>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{booking.turfs?.name ?? "Unknown turf"}</p>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${statusColors[booking.status] ?? "bg-muted text-muted-foreground"}`}>
            {booking.status}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatDate(start)}</span>
          <span>{formatTime(start)} → {formatTime(end)} · {durationHrs}h</span>
        </div>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(Number(booking.total_amount))}</p>
    </Link>
  );
}

function PaymentRowCard({ payment }: { payment: PaymentRow }) {
  const isPaid = payment.status === "paid";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isPaid ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
        <CreditCard className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{payment.bookings?.turfs?.name ?? "Booking"}</p>
        <p className="text-xs text-muted-foreground">{formatDate(new Date(payment.created_at))}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums">{formatPrice(payment.amount)}</p>
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${isPaid ? "text-emerald-600" : "text-amber-600"}`}>
          {payment.status}
        </p>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, to }: { icon: React.ComponentType<{ className?: string }>; label: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-sm font-medium transition-colors hover:bg-muted/40"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </Link>
  );
}

function OwnerCTA() {
  return null;
}
