import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/turfs/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Bowlie` },
      { name: "description", content: "Turf details, pricing, amenities and live availability." },
    ],
  }),
  component: TurfDetail,
});

async function fetchTurf(slug: string) {
  const { data, error } = await supabase
    .from("turfs")
    .select(`
      id, slug, name, description, address, city, state, country,
      lat, lng, cover_image_url, base_price, rating, total_reviews,
      status, rules, is_featured, cancellation_hours, cancellation_fee_pct, reschedule_hours,
      turf_images (id, url, position),
      pitch_types (id, name, surface_type, capacity, base_price),
      add_on_services (id, name, description, price, unit),
      turf_amenities (amenity_id, amenities (name, slug)),
      turf_sports (sport_id, sports (name, slug))
    `)
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchReviews(turfId: string) {
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, user_id, profiles!reviews_user_id_fkey (full_name, avatar_url)")
    .eq("turf_id", turfId)
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

function TurfDetail() {
  const { slug } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: turf, isLoading } = useQuery({ queryKey: ["turf", slug], queryFn: () => fetchTurf(slug) });
  const { data: reviews } = useQuery({
    queryKey: ["reviews", turf?.id],
    queryFn: () => fetchReviews(turf!.id),
    enabled: !!turf?.id,
  });
  const { data: fav } = useQuery({
    queryKey: ["fav", turf?.id, user?.id],
    queryFn: async () => {
      if (!user || !turf) return false;
      const { data } = await supabase
        .from("favorites")
        .select("turf_id")
        .eq("user_id", user.id)
        .eq("turf_id", turf.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!turf?.id,
  });

  const toggleFav = useMutation({
    mutationFn: async () => {
      if (!user || !turf) throw new Error("Sign in required");
      if (fav) {
        await supabase.from("favorites").delete().eq("user_id", user.id).eq("turf_id", turf.id);
      } else {
        await supabase.from("favorites").insert({ user_id: user.id, turf_id: turf.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fav", turf?.id, user?.id] });
      toast.success(fav ? "Removed from favorites" : "Added to favorites");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) {
    return (
      <PublicShell>
        <div className="container-page py-10">
          <div className="aspect-[16/9] animate-pulse rounded-3xl bg-muted" />
        </div>
      </PublicShell>
    );
  }
  if (!turf) throw notFound();

  const images = (turf.turf_images ?? []).sort((a, b) => a.position - b.position);
  const cover = turf.cover_image_url ?? images[0]?.url;
  const amenities = (turf.turf_amenities ?? []).map((a: any) => a.amenities?.name).filter(Boolean);
  const sports = (turf.turf_sports ?? []).map((a: any) => a.sports?.name).filter(Boolean);

  return (
    <PublicShell>
      <div className="container-page py-8">
        <Link to="/browse" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to browse
        </Link>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {turf.name}
            </h1>
            <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {turf.address}, {turf.city}
              {turf.rating > 0 && (
                <span className="ml-3 inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-current text-warning" /> {turf.rating.toFixed(1)} ·{" "}
                  {turf.total_reviews} reviews
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            aria-label={fav ? "Remove from favourites" : "Save to favourites"}
            aria-pressed={fav}
            onClick={() => {
              if (!user) {
                router.navigate({ to: "/auth", search: { mode: "signin" } });
                return;
              }
              toggleFav.mutate();
            }}
          >
            <Heart className={`mr-1.5 h-4 w-4 ${fav ? "fill-destructive text-destructive" : ""}`} />
            {fav ? "Saved" : "Save"}
          </Button>
        </header>

        <div className="mt-6 grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted sm:col-span-2 sm:row-span-2 sm:aspect-auto">
            {cover && <img src={cover} alt={turf.name} className="h-full w-full object-cover" />}
          </div>
          {images.slice(0, 4).map((img) => (
            <div key={img.id} className="hidden aspect-[4/3] overflow-hidden rounded-2xl bg-muted sm:block">
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-10">
            {sports.length > 0 && (
              <Section title="Sports">
                <div className="flex flex-wrap gap-2">
                  {sports.map((s) => (
                    <span key={s} className="rounded-full bg-surface px-3 py-1 text-sm">
                      {s}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {turf.description && (
              <Section title="About this turf">
                <p className="text-sm leading-relaxed text-muted-foreground">{turf.description}</p>
              </Section>
            )}

            {amenities.length > 0 && (
              <Section title="Amenities">
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  {amenities.map((a) => (
                    <div key={a} className="flex items-center gap-2 rounded-md bg-surface px-3 py-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {a}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {turf.pitch_types && turf.pitch_types.length > 0 && (
              <Section title="Pitches">
                <div className="space-y-2">
                  {turf.pitch_types.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[p.surface_type, p.capacity && `${p.capacity} players`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{formatPrice(p.base_price)}/hr</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {turf.add_on_services && turf.add_on_services.length > 0 && (
              <Section title="Add-ons">
                <div className="space-y-2">
                  {turf.add_on_services.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
                      <div>
                        <p className="font-medium">{a.name}</p>
                        {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                      </div>
                      <p className="text-sm font-semibold">
                        {formatPrice(a.price)} <span className="text-xs text-muted-foreground">/ {a.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {turf.rules && (
              <Section title="House rules">
                <p className="whitespace-pre-line text-sm text-muted-foreground">{turf.rules}</p>
              </Section>
            )}

            <Section title="Reviews">
              {!reviews || reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No reviews yet. Verified players can review after a completed booking.
                </p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((r: any) => (
                    <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-3.5 w-3.5 fill-current text-warning" />
                        <span className="font-medium">{r.rating}/5</span>
                        <span className="text-muted-foreground">
                          · {r.profiles?.full_name ?? "Anonymous"}
                        </span>
                      </div>
                      {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Booking card */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="surface-card p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">From</p>
              <p className="font-display text-3xl font-bold">
                {formatPrice(turf.base_price)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/ hour</span>
              </p>
              <Button asChild size="lg" className="mt-5 w-full">
                <Link to="/checkout/$turfId" params={{ turfId: turf.id }}>
                  Check availability
                </Link>
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Slot is held for 10 minutes while you complete checkout.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
