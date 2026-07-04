import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Users2, Zap, Clock, ShieldCheck } from "lucide-react";
import { formatDateTime, formatPrice } from "@/lib/format";

type Post = any;

export function SquadCard({
  post,
  rightSlot,
  ctaSlot,
  myRequestStatus,
}: {
  post: Post;
  rightSlot?: React.ReactNode;
  ctaSlot?: React.ReactNode;
  myRequestStatus?: string;
}) {
  const remaining = Math.max(0, post.spots_needed - post.spots_filled);
  const isEmergency = post.fill_type === "emergency";
  const start = post.bookings?.start_at;
  const postStatus = post.status as string;
  const turf = post.bookings?.turfs;
  const hostName = post.profiles?.full_name ?? "Host";

  return (
    <article className="surface-card flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
            isEmergency ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"
          }`}
        >
          {isEmergency ? <Zap className="h-3 w-3" /> : <Users2 className="h-3 w-3" />}
          {isEmergency ? "Emergency" : "Pre-match"}
        </span>
        <PostStatusPill value={postStatus} />
      </div>

      <Link
        to="/squad/$id"
        params={{ id: post.id }}
        className="mt-3 font-display text-lg font-semibold leading-tight hover:underline"
      >
        {turf?.name ?? "Open game"}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {turf?.city && (
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {turf.city}</span>
        )}
        {post.sports?.name && <span>· {post.sports.name}</span>}
      </div>

      {start && (
        <p className="mt-3 inline-flex items-center gap-1 text-sm">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {formatDateTime(start)}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Spots left" value={`${remaining}/${post.spots_needed}`} accent={remaining === 0} />
        <Stat label="Skill" value={String(post.skill_level)} />
        <Stat label="Join" value={post.approval_mode === "instant_join" ? "Instant" : "Approval"} />
      </div>

      <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
        Hosted by <span className="font-medium text-foreground">{hostName}</span>
        {post.approval_mode === "host_approval" && (
          <span className="ml-1 inline-flex items-center gap-0.5"><ShieldCheck className="h-3 w-3" /></span>
        )}
      </p>

      {post.notes && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{post.notes}</p>}

      {isEmergency && post.emergency_expires_at && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-destructive">
          <Clock className="h-3 w-3" /> Closes {formatDateTime(post.emergency_expires_at)}
        </p>
      )}

      {myRequestStatus && (
        <p className="mt-3 text-xs">
          Your request: <RequestStatusPill value={myRequestStatus} />
        </p>
      )}

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">{post.join_fee > 0 ? `${formatPrice(post.join_fee)} join` : "Free to join"}</span>
          <div className="ml-auto flex items-center gap-2">{rightSlot}</div>
        </div>
        {ctaSlot && <div className="mt-3">{ctaSlot}</div>}
      </div>
    </article>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xs font-semibold capitalize ${accent ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

const POST_TONES: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-600",
  full: "bg-warning/15 text-warning-foreground",
  closed: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};
export function PostStatusPill({ value }: { value: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${POST_TONES[value] ?? "bg-muted text-muted-foreground"}`}>
      {value}
    </span>
  );
}

const REQ_TONES: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground",
  approved: "bg-accent/15 text-accent",
  joined: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};
export function RequestStatusPill({ value }: { value: string }) {
  const label = value === "pending" ? "requested" : value;
  return (
    <span className={`ml-1 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${REQ_TONES[value] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}
