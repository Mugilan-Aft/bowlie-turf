import { Link } from "@tanstack/react-router";
import { MapPin, Star, ArrowUpRight } from "lucide-react";
import { formatPrice } from "@/lib/format";

export interface TurfCardData {
  id: string;
  slug: string;
  name: string;
  city: string;
  cover_image_url: string | null;
  base_price: number;
  rating: number;
  total_reviews: number;
  sports?: string[];
}

export function TurfCard({ turf, featured = false }: { turf: TurfCardData; featured?: boolean }) {
  return (
    <Link
      to="/turfs/$slug"
      params={{ slug: turf.slug }}
      className="group relative block overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-[var(--shadow-lift)]"
    >
      <div
        className={`relative overflow-hidden bg-muted ${featured ? "aspect-[16/10]" : "aspect-[4/3]"}`}
      >
        {turf.cover_image_url ? (
          <img
            src={turf.cover_image_url}
            alt={turf.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-muted to-secondary text-muted-foreground">
            No image
          </div>
        )}

        {/* gradient wash */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-90" />

        {/* top row: sport chip + rating */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {turf.sports && turf.sports.length > 0 && (
            <span className="rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground backdrop-blur">
              {turf.sports[0]}
            </span>
          )}
          {turf.rating > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold shadow-soft backdrop-blur">
              <Star className="h-3 w-3 fill-warning text-warning" />
              {turf.rating.toFixed(1)}
              <span className="font-normal text-muted-foreground">·{turf.total_reviews}</span>
            </span>
          )}
        </div>

        {/* bottom overlay: name + city + price */}
        <div className="absolute inset-x-0 bottom-0 p-4 text-primary-foreground">
          <h3 className="font-display text-lg font-bold leading-tight drop-shadow-sm">
            {turf.name}
          </h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-primary-foreground/85">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{turf.city}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Starting at
          </p>
          <p className="font-display text-lg font-bold leading-tight">
            {formatPrice(turf.base_price)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/hr</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-all group-hover:gap-1.5 group-hover:bg-foreground">
          Book now
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>

      {turf.sports && turf.sports.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-4">
          {turf.sports.slice(1, 4).map((s) => (
            <span
              key={s}
              className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
