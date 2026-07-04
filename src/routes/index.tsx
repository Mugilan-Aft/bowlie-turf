import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarCheck2, MapPin, Search, ShieldCheck, Trophy, Users2, Zap } from "lucide-react";
import { formatDate, formatPrice } from "@/lib/format";

import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/site/PublicShell";
import { TurfCard, type TurfCardData } from "@/components/site/TurfCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/site/EmptyState";
import heroImage from "@/assets/hero-turf.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bowlie — Book turfs, fill your squad, run tournaments" },
      {
        name: "description",
        content:
          "Discover nearby turfs, lock your slot in seconds, and fill missing squad spots with verified players. Built for serious sport.",
      },
      { property: "og:title", content: "Bowlie — The premium turf marketplace" },
      {
        property: "og:description",
        content:
          "Discover nearby turfs, lock your slot, and fill missing squad spots with players around you.",
      },
    ],
  }),
  component: Landing,
});

async function fetchFeaturedTurfs(): Promise<TurfCardData[]> {
  const { data, error } = await supabase
    .from("turfs")
    .select("id, slug, name, city, cover_image_url, base_price, rating, total_reviews")
    .eq("status", "approved")
    .order("is_featured", { ascending: false })
    .order("rating", { ascending: false })
    .limit(7);
  if (error) throw error;
  return data ?? [];
}

async function fetchUpcomingCompetitions() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, description, start_date, end_date, entry_fee, status, banner_url, turfs(name, city)")
    .in("status", ["open", "live"])
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(4);
  if (error) throw error;
  return data ?? [];
}


function Landing() {
  const { data: turfs, isLoading } = useQuery({
    queryKey: ["landing-turfs"],
    queryFn: fetchFeaturedTurfs,
  });
  const { data: competitions } = useQuery({
    queryKey: ["landing-competitions"],
    queryFn: fetchUpcomingCompetitions,
  });

  const [featured, ...rest] = turfs ?? [];


  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">The turf marketplace</p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Lock the turf.
              <br />
              Find the players.
              <br />
              <span className="text-accent">Play the match.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-muted-foreground sm:text-lg">
              Bowlie is a serious booking platform for football, cricket, and racquet sports —
              with a squad-fill flow that solves the real problem: not having enough players.
            </p>

            <form
              className="mt-8 grid gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft sm:grid-cols-[1.4fr_1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const q = String(fd.get("q") ?? "");
                const city = String(fd.get("city") ?? "");
                const params = new URLSearchParams();
                if (q) params.set("q", q);
                if (city) params.set("city", city);
                window.location.href = `/browse${params.toString() ? "?" + params : ""}`;
              }}
            >
              <label className="flex items-center gap-2 rounded-xl px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="Search turfs, sport..."
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl px-3 sm:border-l sm:border-border">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Input
                  name="city"
                  placeholder="City"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </label>
              <Button type="submit" size="lg" className="h-11">
                Search
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Stat label="Real-time slots" />
              <Stat label="Verified reviews" />
              <Stat label="Squad fill in &lt; 10 min" />
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border shadow-[var(--shadow-lift)]">
              <img
                src={heroImage}
                alt="Turf at dusk under floodlights"
                width={1920}
                height={1280}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/85 via-primary/40 to-transparent p-6 text-primary-foreground">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
                  Featured this week
                </p>
                <p className="mt-1 font-display text-xl font-semibold">
                  Floodlit nights, fast bookings, full squads
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured (magazine block + grid) */}
      <section className="border-b border-border bg-paper">
        <div className="container-page py-16">
          <SectionHeader
            eyebrow="Featured turfs"
            title="Premium grounds, vetted operators"
            cta={{ label: "Browse all turfs", to: "/browse" }}
          />

          {isLoading ? (
            <FeaturedSkeleton />
          ) : !turfs || turfs.length === 0 ? (
            <EmptyState
              icon={<Building className="h-4 w-4" />}
              title="No approved turfs yet"
              description="As soon as turf owners onboard and an admin approves their listings, they'll appear here. Are you an owner?"
              action={
                <Button asChild>
                  <Link to="/owner-onboarding">List your turf</Link>
                </Button>
              }
            />
          ) : (
            <div className="mt-8 grid gap-6 sm:mt-10 lg:mt-12 lg:grid-cols-[1.4fr_1fr]">


              {featured && (
                <div className="lg:row-span-2">
                  <TurfCard turf={featured} featured />
                </div>
              )}
              <div className="grid gap-6 sm:grid-cols-2">
                {rest.slice(0, 6).map((t) => (
                  <TurfCard key={t.id} turf={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Squad fill */}
      <section className="border-b border-border bg-primary text-primary-foreground">
        <div className="container-page grid gap-10 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/70">
              The Bowlie difference
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-primary-foreground sm:text-4xl">
              <span className="text-primary-foreground">Booked the turf but short on players?</span>
              <br />
              <span className="text-[oklch(0.85_0.1_75)]">Squad fill solves that.</span>
            </h2>

            <p className="mt-5 max-w-lg text-primary-foreground/75">
              Open a squad request linked to your booking. Set spots, skill level, and join fee.
              Choose host-approval or instant-join. If kickoff is minutes away and you're still
              short — switch on Emergency mode and we'll push it to nearby players for 10 minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="secondary" size="lg">
                <Link to="/squad-fill">See open squads</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/dashboard">Create a squad post</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard
              icon={<Users2 className="h-4 w-4" />}
              title="Pre-match fill"
              body="Open spots ahead of time, approve requests, lock your squad before kickoff."
            />
            <FeatureCard
              icon={<Zap className="h-4 w-4" />}
              title="Emergency mode"
              body="Posted in the last 10 minutes. Auto-expires when the match starts."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Verified players"
              body="Skill tags and review history so you know who's joining."
            />
            <FeatureCard
              icon={<CalendarCheck2 className="h-4 w-4" />}
              title="Linked to bookings"
              body="Tied to a real confirmed booking — no flake-and-cancel posts."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border">
        <div className="container-page py-20">
          <SectionHeader eyebrow="How it works" title="From discovery to first whistle" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Discover nearby turfs",
                body: "Filter by sport, distance, price, and amenities. See real photos, real reviews, real availability.",
              },
              {
                step: "02",
                title: "Lock your slot",
                body: "Slot is held while you check out. Add bowling machine, equipment, or other extras.",
              },
              {
                step: "03",
                title: "Fill your squad",
                body: "Short on players? Open a squad post. Host-approval or instant-join, your call.",
              },
            ].map((s) => (
              <div key={s.step} className="surface-card p-6">
                <p className="font-display text-sm font-semibold text-accent">{s.step}</p>
                <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitions happening around */}
      <section className="border-b border-border">
        <div className="container-page py-20">
          <SectionHeader
            eyebrow="Competitions happening around"
            title="Bring your team. Lift a trophy."
            cta={{ label: "Browse all", to: "/tournaments" }}

          />
          {!competitions || competitions.length === 0 ? (
            <EmptyState
              icon={<Trophy className="h-4 w-4" />}
              title="No tournaments yet"
              description="Check back soon — owners host weekend cups regularly."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {competitions.map((t: any) => (
                <Link
                  key={t.id}
                  to="/tournaments/$id"
                  params={{ id: t.id }}
                  className="group surface-card overflow-hidden transition-shadow hover:shadow-lg"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    {t.banner_url ? (
                      <img
                        src={t.banner_url}
                        alt={t.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full place-items-center bg-primary/10 text-primary">
                        <Trophy className="h-8 w-8" />
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      {t.status === "live" ? "Live now" : "Open"}
                    </span>
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="font-display text-base font-semibold leading-tight">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.turfs?.name} · {t.turfs?.city}
                    </p>
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="text-muted-foreground">{formatDate(t.start_date)}</span>
                      <span className="font-semibold">{formatPrice(Number(t.entry_fee))}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>



      {/* Reviews */}
      <section className="border-b border-border bg-paper">
        <div className="container-page py-20">
          <SectionHeader
            eyebrow="What players say"
            title="Loved by squads across the city"
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Arjun M.",
                role: "Football captain",
                rating: 5,
                quote:
                  "Squad fill saved our Sunday league. Booked the turf, opened 3 spots, full XI in 8 minutes.",
              },
              {
                name: "Priya R.",
                role: "Cricket club organiser",
                rating: 5,
                quote:
                  "The owner dashboard is unreal. Slot templates + offline bookings means zero double-booking drama.",
              },
              {
                name: "Vikram S.",
                role: "Weekend baller",
                rating: 4,
                quote:
                  "Receipts with QR check-in at the gate. Feels like a real ticketed event, not a WhatsApp group.",
              },
            ].map((r) => (
              <figure key={r.name} className="surface-card flex h-full flex-col p-6">
                <div className="flex items-center gap-1 text-warning">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} viewBox="0 0 24 24" className={`h-4 w-4 ${i < r.rating ? "fill-current" : "fill-none stroke-current opacity-30"}`} strokeWidth="1.5">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground">
                  "{r.quote}"
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
                    {r.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* For owners CTA */}
      <section>
        <div className="container-page py-20">
          <div className="grid items-center gap-10 rounded-3xl border border-border bg-surface p-10 lg:grid-cols-[1.2fr_1fr] lg:p-14">
            <div>
              <p className="eyebrow">For turf owners</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Run your turf like a serious business.
              </h2>
              <p className="mt-4 max-w-lg text-muted-foreground">
                Recurring slot templates, peak/off-peak pricing, blackout windows, manual offline
                bookings, tournament hosting, live score entry, revenue analytics. One operations
                surface.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/owner-onboarding">
                    List your turf
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/browse">See how players discover</Link>
                </Button>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-6">
              <Metric value="< 2 min" label="To create a slot" />
              <Metric value="100%" label="Of bookings tracked" />
              <Metric value="0 fees" label="During preview" />
              <Metric value="24/7" label="Slot lock holds" />
            </dl>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function SectionHeader({
  eyebrow,
  title,
  cta,
}: {
  eyebrow: string;
  title: string;
  cta?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      </div>
      {cta && (
        <Link
          to={cta.to}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          {cta.label} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/[0.06] p-5">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-primary-foreground/15 text-primary-foreground">
        {icon}
      </div>
      <h4 className="mt-3 font-display text-base font-semibold text-primary-foreground">{title}</h4>
      <p className="mt-1 text-sm text-primary-foreground/75">{body}</p>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
    </div>
  );
}

function Stat({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      <span dangerouslySetInnerHTML={{ __html: label }} />
    </span>
  );
}

function Building(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h2M13 9h2M9 13h2M13 13h2M9 17h2M13 17h2"/></svg>;
}

function FeaturedSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="aspect-[16/10] animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
