import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { requestOwnerRole } from "@/lib/owner.functions";

const schema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(2000).optional(),
  address: z.string().min(4).max(200),
  city: z.string().min(2).max(80),
  state: z.string().max(80).optional(),
  lat: z.coerce.number().min(-90).max(90).optional().or(z.literal("").transform(() => undefined)),
  lng: z.coerce.number().min(-180).max(180).optional().or(z.literal("").transform(() => undefined)),
  base_price: z.coerce.number().min(0).max(100000),
});

export const Route = createFileRoute("/owner-onboarding")({
  head: () => ({ meta: [{ title: "List your turf — Bowlie" }] }),
  component: OwnerOnboarding,
});

function OwnerOnboarding() {
  const { user, roles, refresh } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <PublicShell>
        <div className="container-page py-16">
          <div className="mx-auto max-w-md surface-card p-7 text-center">
            <Building2 className="mx-auto h-8 w-8 text-accent" />
            <h1 className="mt-3 font-display text-2xl font-semibold">List your turf</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an owner account to start onboarding your venue.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild>
                <Link to="/auth" search={{ mode: "signup", role: "owner" }}>
                  Create owner account
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/auth" search={{ mode: "signin" }}>Sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  async function ensureOwnerRole() {
    if (!user) return;
    if (roles.includes("owner")) return;
    await requestOwnerRole();
    await refresh();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const parsed = schema.parse({
        name: fd.get("name"),
        description: fd.get("description") || undefined,
        address: fd.get("address"),
        city: fd.get("city"),
        state: fd.get("state") || undefined,
        lat: fd.get("lat") || undefined,
        lng: fd.get("lng") || undefined,
        base_price: fd.get("base_price"),
      });

      await ensureOwnerRole();

      const slug = `${slugify(parsed.name)}-${Math.random().toString(36).slice(2, 7)}`;
      const { error } = await supabase.from("turfs").insert({
        owner_id: user!.id,
        name: parsed.name,
        slug,
        description: parsed.description,
        address: parsed.address,
        city: parsed.city,
        state: parsed.state,
        lat: parsed.lat ?? null,
        lng: parsed.lng ?? null,
        base_price: parsed.base_price,
        status: "pending",
      });
      if (error) throw error;

      toast.success("Turf submitted for review");
      router.navigate({ to: "/owner/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <div className="container-page grid gap-12 py-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="eyebrow">Owner onboarding</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Tell us about your turf
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Submit the basics now — you'll add photos, slot templates, pitches, and add-ons from
            your dashboard after approval.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            <Step n="1" title="Submit business details" current />
            <Step n="2" title="Admin approval (usually 24h)" />
            <Step n="3" title="Add photos, slots, and pricing" />
            <Step n="4" title="Go live" />
          </ul>
        </div>

        <form onSubmit={onSubmit} className="surface-card space-y-5 p-7">
          <div>
            <Label htmlFor="name">Turf name</Label>
            <Input id="name" name="name" required placeholder="Greenfield Arena" className="mt-1.5" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" required placeholder="Bengaluru" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="state">State (optional)</Label>
              <Input id="state" name="state" placeholder="Karnataka" className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="address">Full address</Label>
            <Input id="address" name="address" required placeholder="123 Sport St, Indiranagar" className="mt-1.5" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="lat">Latitude (optional)</Label>
              <Input id="lat" name="lat" type="number" step="any" placeholder="12.9716" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="lng">Longitude (optional)</Label>
              <Input id="lng" name="lng" type="number" step="any" placeholder="77.5946" className="mt-1.5" />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Right-click your venue on <a className="underline" href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a> to copy the coordinates. This attaches a map to every booking ticket.
          </p>
          <div>
            <Label htmlFor="base_price">Base price per hour (INR)</Label>
            <Input id="base_price" name="base_price" type="number" required min={0} step={50} placeholder="1200" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={4} placeholder="Surface, dimensions, what makes your turf great…" className="mt-1.5" />
          </div>
          <Button type="submit" size="lg" disabled={busy} className="w-full">
            {busy ? "Submitting…" : "Submit for review"}
          </Button>
        </form>
      </div>
    </PublicShell>
  );
}

function Step({ n, title, current = false }: { n: string; title: string; current?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${
          current ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
        }`}
      >
        {current ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </span>
      <span className={current ? "font-medium" : "text-muted-foreground"}>{title}</span>
    </li>
  );
}
