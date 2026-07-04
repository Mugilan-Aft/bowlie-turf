import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Props = {
  turfId: string;
  label?: string;
  onUploaded: (signedUrl: string, path: string) => void | Promise<void>;
  className?: string;
};

const SIGNED_TTL = 60 * 60 * 24 * 365; // 1y

export async function uploadTurfImage(turfId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${turfId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("turf-images")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) throw upErr;
  const { data, error: signErr } = await supabase.storage
    .from("turf-images")
    .createSignedUrl(path, SIGNED_TTL);
  if (signErr || !data) throw signErr ?? new Error("Failed to sign URL");
  return { url: data.signedUrl, path };
}

export function TurfImageUploader({ turfId, label = "Upload image", onUploaded, className = "" }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Max image size is 8 MB");
      return;
    }
    setBusy(true);
    try {
      const { url, path } = await uploadTurfImage(turfId, file);
      await onUploaded(url, path);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
      <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {busy ? "Uploading…" : label}
      </Button>
    </div>
  );
}
