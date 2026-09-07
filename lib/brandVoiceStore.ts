import { brandVoice, parseBrandVoice, type BrandVoice } from "@/lib/brandVoice";
import { createClient } from "@/lib/supabase/server";

export async function getBrandVoice(ownerId: string): Promise<BrandVoice> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("brand_voices")
    .select("voice").eq("owner_id", ownerId).maybeSingle();
  if (error) throw new Error("Could not load brand voice.");
  return data ? parseBrandVoice(data.voice) : brandVoice;
}

export async function saveBrandVoice(ownerId: string, voice: BrandVoice) {
  const supabase = await createClient();
  const { error } = await supabase.from("brand_voices").upsert({
    owner_id: ownerId, voice, updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id" });
  if (error) throw new Error("Could not save brand voice. Please try again.");
}
