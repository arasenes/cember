// Ses ayarını hesapla saklar (cihazlar arası aynı ses): kullanici_ayarlari.ses_ayar (migration 038).
import { supabase } from "./supabase";
import { TAKIMLAR, type SesAyar, type SesTakimi } from "./sesler";

/** Bulutta saklanan ayarı doğrular; geçersiz alanlar atılır. */
export function sesAyariniDogrula(ham: unknown): Partial<SesAyar> | null {
  if (!ham || typeof ham !== "object") return null;
  const h = ham as Record<string, unknown>;
  const s: Partial<SesAyar> = {};
  if (typeof h.acik === "boolean") s.acik = h.acik;
  if (typeof h.seviye === "number" && Number.isFinite(h.seviye)) s.seviye = Math.min(100, Math.max(0, Math.round(h.seviye)));
  if (typeof h.takim === "string" && h.takim in TAKIMLAR) s.takim = h.takim as SesTakimi;
  return Object.keys(s).length ? s : null;
}

export async function sesAyarBuluttanOku(kullaniciId: string): Promise<Partial<SesAyar> | null> {
  try {
    const { data } = await supabase.from("kullanici_ayarlari").select("ses_ayar").eq("user_id", kullaniciId).maybeSingle();
    return sesAyariniDogrula(data?.ses_ayar);
  } catch { return null; }
}

let zamanlayici: ReturnType<typeof setTimeout> | null = null;
/** Kaydırıcı sürüklenirken her değişiklikte yazmamak için 600 ms bekler. */
export function sesAyarBulutaYaz(kullaniciId: string, ayar: SesAyar): void {
  if (zamanlayici) clearTimeout(zamanlayici);
  zamanlayici = setTimeout(() => {
    void Promise.resolve(supabase.from("kullanici_ayarlari").upsert({ user_id: kullaniciId, ses_ayar: ayar }, { onConflict: "user_id" })).catch(() => { /* ağ yoksa yerel tercih yeter */ });
  }, 600);
}
