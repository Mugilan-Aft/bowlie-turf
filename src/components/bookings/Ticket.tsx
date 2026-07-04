import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  CalendarDays,
  Clock,
  MapPin,
  Ticket as TicketIcon,
  ShieldCheck,
  Download,
  Loader2,
  Share2,
  Navigation,
  Home,
  User,
  Phone,
  CreditCard,
  Hash,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";

export type TicketBooking = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  total_amount: number | string;
  subtotal_amount?: number | string;
  add_ons_amount?: number | string;
  checked_in_at?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  turfs?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    cover_image_url?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  pitch_types?: { name?: string | null } | null;
  booking_add_ons?: Array<{
    id: string;
    quantity: number;
    unit_price: number | string;
    add_on_services?: { name?: string | null } | null;
  }>;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; Icon: React.ComponentType<{ className?: string }> }> = {
  confirmed: { label: "Confirmed", color: "bg-emerald-500/15 text-emerald-700", dot: "bg-emerald-500", Icon: CheckCircle2 },
  pending:   { label: "Pending",   color: "bg-amber-500/15 text-amber-700",   dot: "bg-amber-500",   Icon: AlertCircle },
  completed: { label: "Completed", color: "bg-blue-500/15 text-blue-700",     dot: "bg-blue-500",    Icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground",   dot: "bg-muted-foreground", Icon: XCircle },
};

const PAYMENT_CONFIG: Record<string, { label: string; color: string }> = {
  paid:   { label: "Paid",   color: "bg-emerald-500/15 text-emerald-700" },
  unpaid: { label: "Unpaid", color: "bg-amber-500/15 text-amber-700" },
};

export function BookingTicket({
  booking,
  qrUrl,
  banner,
}: {
  booking: TicketBooking;
  qrUrl?: string;
  banner?: React.ReactNode;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const ticketRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const url = qrUrl ?? `${window.location.origin}/verify/${booking.id}`;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 320,
      color: { dark: "#0f1b3d", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [booking.id, qrUrl]);

  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);
  const durationHrs = (end.getTime() - start.getTime()) / 36e5;
  const addOns = booking.booking_add_ons ?? [];
  const refCode = booking.id.slice(0, 8).toUpperCase();
  const isVerified = !!booking.checked_in_at;

  const statusCfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const paymentCfg = PAYMENT_CONFIG[booking.payment_status] ?? PAYMENT_CONFIG.unpaid;

  const hasLocation = (booking.turfs?.lat && booking.turfs?.lng) || booking.turfs?.address;
  const mapsEmbedUrl = booking.turfs?.lat && booking.turfs?.lng
    ? `https://maps.google.com/maps?q=${booking.turfs.lat},${booking.turfs.lng}&z=15&output=embed`
    : booking.turfs?.address
      ? `https://maps.google.com/maps?q=${encodeURIComponent(`${booking.turfs.address}, ${booking.turfs.city ?? ""}`)}&z=15&output=embed`
      : null;
  const mapsDirUrl = booking.turfs?.lat && booking.turfs?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${booking.turfs.lat},${booking.turfs.lng}`
    : booking.turfs?.address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${booking.turfs.address}, ${booking.turfs.city ?? ""}`)}`
      : null;

  async function handleDownload() {
    if (!ticketRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(ticketRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `bowlie-ticket-${refCode}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Ticket downloaded");
    } catch (err) {
      toast.error("Couldn't generate image. Try Print instead.");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  async function handleShare() {
    const text = [
      `Booking at ${booking.turfs?.name ?? "—"}`,
      `Date: ${start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}`,
      `Time: ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} → ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      `Ref: ${refCode}`,
    ].join("\n");
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Bowlie booking", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Booking details copied to clipboard");
      }
    } catch {
      // user cancelled share
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <style>{`
        @media print {
          body { background: #fff !important; }
          [data-no-print] { display: none !important; }
        }
        .ticket-notch {
          --notch: 18px;
          mask-image:
            radial-gradient(circle var(--notch) at 0 50%, transparent 98%, #000 100%),
            radial-gradient(circle var(--notch) at 100% 50%, transparent 98%, #000 100%);
          mask-composite: intersect;
          -webkit-mask-image:
            radial-gradient(circle var(--notch) at 0 50%, transparent 98%, #000 100%),
            radial-gradient(circle var(--notch) at 100% 50%, transparent 98%, #000 100%);
          -webkit-mask-composite: source-in;
        }
      `}</style>

      {banner}

      <div
        ref={ticketRef}
        className="ticket-notch overflow-hidden rounded-[28px] bg-card shadow-[var(--shadow-lift)] ring-1 ring-border"
      >
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr]">
          {/* ── Left: Booking details ──────────────────────────────── */}
          <div className="relative overflow-hidden bg-primary text-primary-foreground">
            {booking.turfs?.cover_image_url && (
              <img
                src={booking.turfs.cover_image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-25"
                data-no-print
              />
            )}
            <div
              className="absolute inset-0 bg-gradient-to-tr from-primary via-primary/95 to-primary/70"
              data-no-print
            />

            <div className="relative p-7">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/70">
                  <TicketIcon className="h-3.5 w-3.5" /> Bowlie pass
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    isVerified
                      ? "bg-emerald-400/25 text-emerald-100"
                      : statusCfg.color
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                  {isVerified ? "Checked in" : statusCfg.label}
                </span>
              </div>

              {/* Venue name */}
              <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight">
                {booking.turfs?.name ?? "—"}
              </h2>
              {(booking.turfs?.address || booking.turfs?.city) && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-primary-foreground/75">
                  <MapPin className="h-3.5 w-3.5" /> {booking.turfs?.address}
                  {booking.turfs?.address && booking.turfs?.city ? ", " : ""}
                  {booking.turfs?.city}
                </p>
              )}

              {/* Booking info grid */}
              <div className="mt-7 grid grid-cols-2 gap-5">
                <Stub icon={Hash} label="Booking ID">
                  <span className="font-mono">{refCode}</span>
                </Stub>
                {booking.customer_name && (
                  <Stub icon={User} label="Customer">
                    {booking.customer_name}
                  </Stub>
                )}
                {booking.customer_phone && (
                  <Stub icon={Phone} label="Phone">
                    {booking.customer_phone}
                  </Stub>
                )}
                {booking.pitch_types?.name && (
                  <Stub label="Pitch">{booking.pitch_types.name}</Stub>
                )}
                <Stub icon={CalendarDays} label="Date">
                  {start.toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </Stub>
                <Stub icon={Clock} label="Time">
                  {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  <span className="ml-1 text-primary-foreground/60">→ {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </Stub>
                <Stub icon={Clock} label="Duration">
                  {durationHrs}h
                </Stub>
                <Stub label="Amount">
                  <span className="font-display text-lg font-bold">
                    {formatPrice(Number(booking.total_amount))}
                  </span>
                </Stub>
              </div>

              {/* Itemised breakdown */}
              <div className="mt-7 rounded-xl bg-white/10 p-4 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.18em] text-primary-foreground/60">
                  Itemised
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li className="flex justify-between">
                    <span>Slot rental × {durationHrs}h</span>
                    <span className="tabular-nums">
                      {formatPrice(
                        Number(booking.subtotal_amount ?? 0) ||
                          Number(booking.total_amount) - Number(booking.add_ons_amount ?? 0),
                      )}
                    </span>
                  </li>
                  {addOns.map((l) => (
                    <li key={l.id} className="flex justify-between text-primary-foreground/80">
                      <span>
                        {l.add_on_services?.name} × {l.quantity}
                      </span>
                      <span className="tabular-nums">
                        {formatPrice(Number(l.unit_price) * l.quantity)}
                      </span>
                    </li>
                  ))}
                  <li className="mt-2 flex justify-between border-t border-white/15 pt-2 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatPrice(Number(booking.total_amount))}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* ── Right: QR + payment info ───────────────────────────── */}
          <div className="relative bg-card">
            <div
              className="absolute inset-y-4 left-0 hidden w-px border-l-2 border-dashed border-border md:block"
              aria-hidden
            />
            <div className="flex h-full flex-col items-center justify-center gap-4 p-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {isVerified ? "Verified at gate" : "Scan at gate"}
              </p>
              <div className="relative rounded-2xl bg-white p-3 shadow-sm ring-1 ring-border">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Booking QR code" className="h-44 w-44" />
                ) : (
                  <div className="h-44 w-44 animate-pulse bg-muted" />
                )}
                {isVerified && (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="rotate-[-12deg] rounded-md border-4 border-emerald-600/80 bg-white/85 px-3 py-1 font-display text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
                      <ShieldCheck className="-mt-0.5 mr-1 inline h-4 w-4" /> Verified
                    </div>
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Reference
                </p>
                <p className="mt-1 font-mono text-base font-bold">{refCode}</p>
              </div>
              <div className="w-full border-t border-dashed border-border pt-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Payment
                </p>
                <p className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${paymentCfg.color}`}>
                  {booking.payment_status === "paid" ? "Paid" : "Unpaid"}
                </p>
                {booking.payment_method && (
                  <p className="mt-1 text-[11px] capitalize text-muted-foreground">
                    via {booking.payment_method}
                  </p>
                )}
              </div>
              {isVerified && (
                <div className="w-full border-t border-dashed border-border pt-3 text-center">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Checked in
                  </p>
                  <p className="mt-1 text-xs">
                    {new Date(booking.checked_in_at!).toLocaleString([], {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Google Maps location ─────────────────────────────────── */}
        {hasLocation && (
          <div className="border-t border-dashed border-border bg-card">
            <div className="flex flex-col gap-3 p-5 md:flex-row md:items-stretch">
              <div className="flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Getting there
                </p>
                <p className="mt-1 font-display text-sm font-semibold">
                  {booking.turfs?.name}
                </p>
                {(booking.turfs?.address || booking.turfs?.city) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {booking.turfs?.address}
                    {booking.turfs?.address && booking.turfs?.city ? ", " : ""}
                    {booking.turfs?.city}
                  </p>
                )}
                {mapsDirUrl && (
                  <a
                    href={mapsDirUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/15"
                    data-no-print
                  >
                    <Navigation className="h-3 w-3" /> Get directions
                  </a>
                )}
              </div>
              {mapsEmbedUrl && (
                <div className="h-32 w-full overflow-hidden rounded-xl border border-border md:w-64">
                  <iframe
                    title="Venue map"
                    src={mapsEmbedUrl}
                    className="h-full w-full border-0"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Action buttons ─────────────────────────────────────────── */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2" data-no-print>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || !qrDataUrl}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? "Preparing…" : "Download ticket"}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/50 disabled:opacity-60"
        >
          {sharing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          Share ticket
        </button>
        {mapsDirUrl && (
          <a
            href={mapsDirUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/50"
          >
            <Navigation className="h-4 w-4" /> View location
          </a>
        )}
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/50"
        >
          <Home className="h-4 w-4" /> Back to home
        </Link>
      </div>
    </div>
  );
}

function Stub({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-primary-foreground/60">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </p>
      <p className="mt-1 text-sm font-medium text-primary-foreground">{children}</p>
    </div>
  );
}
