import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashShell } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, formatPrice } from "@/lib/format";
import { TurfImageUploader } from "@/components/owner/TurfImageUploader";

export const Route = createFileRoute("/_authenticated/owner/turfs/$id")({
  head: () => ({ meta: [{ title: "Manage turf — Owner" }] }),
  component: ManageTurf,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ManageTurf() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: turf, isLoading } = useQuery({
    queryKey: ["turf-manage", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("turfs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <DashShell area="owner"><div className="h-40 animate-pulse bg-muted rounded" /></DashShell>;
  if (!turf) return <DashShell area="owner" title="Not found"><p className="text-sm text-muted-foreground">Turf not found.</p></DashShell>;
  if (user && turf.owner_id !== user.id) return <DashShell area="owner" title="Unauthorized"><p className="text-sm text-muted-foreground">You do not own this turf.</p></DashShell>;

  async function deleteTurf() {
    if (!confirm("Delete this turf? Bookings will be retained but the listing will disappear.")) return;
    const { error } = await supabase.from("turfs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Turf deleted");
    qc.invalidateQueries({ queryKey: ["owner-turfs"] });
    router.navigate({ to: "/owner/dashboard" });
  }

  return (
    <DashShell
      area="owner"
      title={turf.name}
      subtitle={`${turf.city} • ${turf.status}`}
      actions={
        <>
          {turf.status === "approved" && (
            <Button asChild variant="outline">
              <Link to="/turfs/$slug" params={{ slug: turf.slug }}>View public page</Link>
            </Button>
          )}
          <Button variant="outline" onClick={deleteTurf}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
        </>
      }
    >
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="pitches">Pitches</TabsTrigger>
          <TabsTrigger value="slots">Slot templates</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="blackouts">Blackouts</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-6"><DetailsTab turf={turf} /></TabsContent>
        <TabsContent value="pitches" className="mt-6"><PitchesTab turfId={id} basePrice={turf.base_price} /></TabsContent>
        <TabsContent value="slots" className="mt-6"><SlotsTab turfId={id} basePrice={turf.base_price} /></TabsContent>
        <TabsContent value="addons" className="mt-6"><AddOnsTab turfId={id} /></TabsContent>
        <TabsContent value="blackouts" className="mt-6"><BlackoutsTab turfId={id} /></TabsContent>
        <TabsContent value="images" className="mt-6"><ImagesTab turfId={id} /></TabsContent>
      </Tabs>
    </DashShell>
  );
}

function DetailsTab({ turf }: { turf: any }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string>(turf.cover_image_url ?? "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const latRaw = String(fd.get("lat") ?? "").trim();
      const lngRaw = String(fd.get("lng") ?? "").trim();
      const { error } = await supabase.from("turfs").update({
        name: String(fd.get("name") ?? ""),
        description: String(fd.get("description") ?? "") || null,
        address: String(fd.get("address") ?? ""),
        city: String(fd.get("city") ?? ""),
        state: String(fd.get("state") ?? "") || null,
        lat: latRaw ? Number(latRaw) : null,
        lng: lngRaw ? Number(lngRaw) : null,
        base_price: Number(fd.get("base_price") ?? 0),
        cover_image_url: coverUrl || null,
        cancellation_hours: Number(fd.get("cancellation_hours") ?? 6),
        cancellation_fee_pct: Number(fd.get("cancellation_fee_pct") ?? 0),
        reschedule_hours: Number(fd.get("reschedule_hours") ?? 6),
      }).eq("id", turf.id);
      if (error) throw error;
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["turf-manage", turf.id] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit} className="surface-card max-w-2xl space-y-4 p-6">
      <div><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={turf.name} required className="mt-1.5" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="city">City</Label><Input id="city" name="city" defaultValue={turf.city} required className="mt-1.5" /></div>
        <div><Label htmlFor="state">State</Label><Input id="state" name="state" defaultValue={turf.state ?? ""} className="mt-1.5" /></div>
      </div>
      <div><Label htmlFor="address">Address</Label><Input id="address" name="address" defaultValue={turf.address} required className="mt-1.5" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="lat">Latitude</Label>
          <Input id="lat" name="lat" type="number" step="any" defaultValue={turf.lat ?? ""} placeholder="e.g. 12.9716" className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="lng">Longitude</Label>
          <Input id="lng" name="lng" type="number" step="any" defaultValue={turf.lng ?? ""} placeholder="e.g. 77.5946" className="mt-1.5" />
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-muted-foreground">
        Tip: right-click your venue in <a className="underline" href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a> and copy the lat, lng values. This map is attached to every booking ticket.
      </p>
      {turf.lat && turf.lng ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <iframe
            title="Venue map preview"
            src={`https://maps.google.com/maps?q=${turf.lat},${turf.lng}&z=15&output=embed`}
            className="h-48 w-full border-0"
            loading="lazy"
          />
        </div>
      ) : null}
      <div><Label htmlFor="base_price">Base price / hr (INR)</Label><Input id="base_price" name="base_price" type="number" min={0} step={50} defaultValue={turf.base_price} required className="mt-1.5" /></div>
      <div>
        <Label>Cover image</Label>
        <div className="mt-1.5 flex items-start gap-4">
          <div className="aspect-[16/9] w-48 overflow-hidden rounded-lg border border-border bg-muted">
            {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-muted-foreground">No cover</div>}
          </div>
          <div className="space-y-2">
            <TurfImageUploader turfId={turf.id} label="Upload cover" onUploaded={(u) => setCoverUrl(u)} />
            {coverUrl && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setCoverUrl("")}>Remove cover</Button>
            )}
          </div>
        </div>
      </div>
      <div><Label htmlFor="description">Description</Label><Textarea id="description" name="description" rows={5} defaultValue={turf.description ?? ""} className="mt-1.5" /></div>

      <div className="border-t border-border pt-4">
        <p className="font-display text-sm font-semibold">Cancellation & reschedule policy</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div><Label htmlFor="cancellation_hours">Free cancel (hrs before)</Label><Input id="cancellation_hours" name="cancellation_hours" type="number" min={0} max={168} defaultValue={turf.cancellation_hours ?? 6} className="mt-1.5" /></div>
          <div><Label htmlFor="cancellation_fee_pct">Late cancel fee (%)</Label><Input id="cancellation_fee_pct" name="cancellation_fee_pct" type="number" min={0} max={100} defaultValue={turf.cancellation_fee_pct ?? 0} className="mt-1.5" /></div>
          <div><Label htmlFor="reschedule_hours">Reschedule cutoff (hrs)</Label><Input id="reschedule_hours" name="reschedule_hours" type="number" min={0} max={168} defaultValue={turf.reschedule_hours ?? 6} className="mt-1.5" /></div>
        </div>
      </div>

      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}

function PitchesTab({ turfId, basePrice }: { turfId: string; basePrice: number }) {
  const qc = useQueryClient();
  const { data: pitches } = useQuery({
    queryKey: ["pitches", turfId],
    queryFn: async () => {
      const { data } = await supabase.from("pitch_types").select("*").eq("turf_id", turfId).order("created_at");
      return data ?? [];
    },
  });

  async function addPitch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("pitch_types").insert({
      turf_id: turfId,
      name: String(fd.get("name") ?? ""),
      surface_type: String(fd.get("surface_type") ?? "") || null,
      capacity: Number(fd.get("capacity") ?? 0) || null,
      base_price: Number(fd.get("base_price") ?? basePrice),
    });
    if (error) return toast.error(error.message);
    toast.success("Pitch added");
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["pitches", turfId] });
  }

  async function removePitch(id: string) {
    if (!confirm("Remove this pitch?")) return;
    const { error } = await supabase.from("pitch_types").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pitches", turfId] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        {(pitches ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No pitches yet. Add the first one →</p>
        ) : (pitches ?? []).map((p: any) => (
          <div key={p.id} className="surface-card flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {[p.surface_type, p.capacity ? `${p.capacity}-a-side` : null].filter(Boolean).join(" • ")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{formatPrice(p.base_price)}/hr</span>
              <Button size="sm" variant="ghost" onClick={() => removePitch(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={addPitch} className="surface-card space-y-3 p-5">
        <p className="font-display font-semibold">Add pitch</p>
        <div><Label htmlFor="p-name">Name</Label><Input id="p-name" name="name" required placeholder="Main 7-a-side" className="mt-1.5" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="p-surf">Surface</Label><Input id="p-surf" name="surface_type" placeholder="Artificial grass" className="mt-1.5" /></div>
          <div><Label htmlFor="p-cap">Capacity</Label><Input id="p-cap" name="capacity" type="number" min={1} placeholder="7" className="mt-1.5" /></div>
        </div>
        <div><Label htmlFor="p-price">Base price / hr</Label><Input id="p-price" name="base_price" type="number" min={0} step={50} defaultValue={basePrice} required className="mt-1.5" /></div>
        <Button type="submit" className="w-full">Add pitch</Button>
      </form>
    </div>
  );
}

function SlotsTab({ turfId, basePrice }: { turfId: string; basePrice: number }) {
  const qc = useQueryClient();
  const { data: slots } = useQuery({
    queryKey: ["slots", turfId],
    queryFn: async () => {
      const { data } = await supabase.from("availability_slots").select("*").eq("turf_id", turfId).order("day_of_week").order("start_time");
      return data ?? [];
    },
  });

  async function addSlot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("availability_slots").insert({
      turf_id: turfId,
      day_of_week: Number(fd.get("day_of_week")),
      start_time: String(fd.get("start_time")),
      end_time: String(fd.get("end_time")),
      price: Number(fd.get("price") ?? basePrice),
      is_peak: fd.get("is_peak") === "on",
    });
    if (error) return toast.error(error.message);
    toast.success("Slot added");
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["slots", turfId] });
  }

  async function removeSlot(id: string) {
    const { error } = await supabase.from("availability_slots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["slots", turfId] });
  }

  const byDay = new Map<number, any[]>();
  for (const s of slots ?? []) {
    const arr = byDay.get(s.day_of_week) ?? [];
    arr.push(s); byDay.set(s.day_of_week, arr);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        {DAYS.map((d, i) => (
          <div key={i} className="surface-card p-4">
            <p className="font-display font-semibold text-sm mb-2">{d}</p>
            {(byDay.get(i) ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No slots configured</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(byDay.get(i) ?? []).map((s: any) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                    <span className="font-medium">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span>
                    <span className="text-muted-foreground">{formatPrice(s.price)}</span>
                    {s.is_peak && <span className="rounded-full bg-warning/15 text-warning-foreground px-1.5 py-0.5 text-[9px] uppercase">peak</span>}
                    <button onClick={() => removeSlot(s.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={addSlot} className="surface-card space-y-3 p-5 h-fit">
        <p className="font-display font-semibold">Add slot template</p>
        <div>
          <Label htmlFor="s-day">Day</Label>
          <Select name="day_of_week" defaultValue="1">
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="s-start">Start</Label><Input id="s-start" name="start_time" type="time" required className="mt-1.5" /></div>
          <div><Label htmlFor="s-end">End</Label><Input id="s-end" name="end_time" type="time" required className="mt-1.5" /></div>
        </div>
        <div><Label htmlFor="s-price">Price</Label><Input id="s-price" name="price" type="number" min={0} step={50} defaultValue={basePrice} required className="mt-1.5" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_peak" /> Peak slot</label>
        <Button type="submit" className="w-full">Add slot</Button>
      </form>
    </div>
  );
}

function BlackoutsTab({ turfId }: { turfId: string }) {
  const qc = useQueryClient();
  const { data: blackouts } = useQuery({
    queryKey: ["blackouts", turfId],
    queryFn: async () => {
      const { data } = await supabase.from("blackout_periods").select("*").eq("turf_id", turfId).order("start_at", { ascending: false });
      return data ?? [];
    },
  });

  async function addBlackout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const start = new Date(String(fd.get("start_at"))).toISOString();
    const end = new Date(String(fd.get("end_at"))).toISOString();
    if (new Date(end) <= new Date(start)) return toast.error("End must be after start");
    const { error } = await supabase.from("blackout_periods").insert({
      turf_id: turfId, start_at: start, end_at: end,
      reason: String(fd.get("reason") ?? "") || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Blackout added");
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["blackouts", turfId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("blackout_periods").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["blackouts", turfId] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        {(blackouts ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No blackout periods.</p>
        ) : (blackouts ?? []).map((b: any) => (
          <div key={b.id} className="surface-card flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">{formatDateTime(b.start_at)} → {formatDateTime(b.end_at)}</p>
              {b.reason && <p className="text-xs text-muted-foreground">{b.reason}</p>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <form onSubmit={addBlackout} className="surface-card space-y-3 p-5 h-fit">
        <p className="font-display font-semibold">Add blackout</p>
        <div><Label htmlFor="bo-start">Start</Label><Input id="bo-start" name="start_at" type="datetime-local" required className="mt-1.5" /></div>
        <div><Label htmlFor="bo-end">End</Label><Input id="bo-end" name="end_at" type="datetime-local" required className="mt-1.5" /></div>
        <div><Label htmlFor="bo-reason">Reason</Label><Input id="bo-reason" name="reason" placeholder="Maintenance, tournament…" className="mt-1.5" /></div>
        <Button type="submit" className="w-full">Add blackout</Button>
      </form>
    </div>
  );
}

function ImagesTab({ turfId }: { turfId: string }) {
  const qc = useQueryClient();
  const { data: images } = useQuery({
    queryKey: ["images", turfId],
    queryFn: async () => {
      const { data } = await supabase.from("turf_images").select("*").eq("turf_id", turfId).order("position");
      return data ?? [];
    },
  });

  async function onUploaded(url: string) {
    const { error } = await supabase.from("turf_images").insert({
      turf_id: turfId,
      url,
      position: images?.length ?? 0,
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["images", turfId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("turf_images").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["images", turfId] });
  }

  return (
    <div className="space-y-5">
      <div className="surface-card flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display font-semibold">Photo gallery</p>
          <p className="text-xs text-muted-foreground">Upload arena photos — JPG/PNG, up to 8 MB each.</p>
        </div>
        <TurfImageUploader turfId={turfId} label="Upload photo" onUploaded={onUploaded} />
      </div>
      {(images ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No images yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(images ?? []).map((img: any) => (
            <div key={img.id} className="relative overflow-hidden rounded-xl border border-border bg-card">
              <img src={img.url} alt="" className="aspect-[4/3] w-full object-cover" />
              <Button size="sm" variant="destructive" className="absolute top-2 right-2" onClick={() => remove(img.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddOnsTab({ turfId }: { turfId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);

  const { data: addOns } = useQuery({
    queryKey: ["addons", turfId],
    queryFn: async () => {
      const { data } = await supabase
        .from("add_on_services")
        .select("*")
        .eq("turf_id", turfId)
        .order("created_at");
      return data ?? [];
    },
  });

  async function createOne(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("add_on_services").insert({
      turf_id: turfId,
      name: String(fd.get("name") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim() || null,
      price: Number(fd.get("price") ?? 0),
      unit: String(fd.get("unit") ?? "per_booking"),
      is_active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Add-on created");
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["addons", turfId] });
  }

  async function update(id: string, patch: any) {
    const { error } = await supabase.from("add_on_services").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["addons", turfId] });
  }

  async function remove(id: string) {
    if (!confirm("Remove this add-on? Existing bookings keep their copy.")) return;
    const { error } = await supabase.from("add_on_services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Add-on removed");
    qc.invalidateQueries({ queryKey: ["addons", turfId] });
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await update(id, {
      name: String(fd.get("name") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim() || null,
      price: Number(fd.get("price") ?? 0),
      unit: String(fd.get("unit") ?? "per_booking"),
    });
    setEditing(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        {(addOns ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No add-ons yet. Create one to offer extras like a bowling machine or floodlights →
          </p>
        ) : (addOns ?? []).map((a: any) => editing === a.id ? (
          <form key={a.id} onSubmit={(e) => saveEdit(e, a.id)} className="surface-card space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor={`e-name-${a.id}`}>Name</Label><Input id={`e-name-${a.id}`} name="name" defaultValue={a.name} required className="mt-1.5" /></div>
              <div><Label htmlFor={`e-price-${a.id}`}>Price (INR)</Label><Input id={`e-price-${a.id}`} name="price" type="number" min={0} step={10} defaultValue={a.price} required className="mt-1.5" /></div>
            </div>
            <div>
              <Label htmlFor={`e-unit-${a.id}`}>Charged</Label>
              <Select name="unit" defaultValue={a.unit}>
                <SelectTrigger id={`e-unit-${a.id}`} className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_booking">Per booking</SelectItem>
                  <SelectItem value="per_hour">Per hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`e-desc-${a.id}`}>Description</Label><Textarea id={`e-desc-${a.id}`} name="description" rows={2} defaultValue={a.description ?? ""} className="mt-1.5" /></div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">Save</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div key={a.id} className="surface-card flex items-start justify-between gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{a.name}</p>
                {!a.is_active && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">paused</span>}
              </div>
              {a.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatPrice(a.price)} {a.unit === "per_hour" ? "/ hour" : "/ booking"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => update(a.id, { is_active: !a.is_active })}>
                {a.is_active ? "Pause" : "Resume"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(a.id)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={createOne} className="surface-card h-fit space-y-3 p-5">
        <p className="font-display font-semibold">Add new</p>
        <div><Label htmlFor="ao-name">Name</Label><Input id="ao-name" name="name" required placeholder="Bowling machine" className="mt-1.5" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="ao-price">Price (INR)</Label><Input id="ao-price" name="price" type="number" min={0} step={10} required placeholder="500" className="mt-1.5" /></div>
          <div>
            <Label htmlFor="ao-unit">Charged</Label>
            <Select name="unit" defaultValue="per_hour">
              <SelectTrigger id="ao-unit" className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_hour">Per hour</SelectItem>
                <SelectItem value="per_booking">Per booking</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label htmlFor="ao-desc">Description (optional)</Label><Textarea id="ao-desc" name="description" rows={2} placeholder="Operator included, 60 balls/hour" className="mt-1.5" /></div>
        <Button type="submit" className="w-full">Create add-on</Button>
      </form>
    </div>
  );
}
