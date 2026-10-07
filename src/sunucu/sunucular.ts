import { supabase } from "../supabase";
import type { Uye } from "../types";

/** Bir kişinin üye olduğu sunucu: sunucu bilgisi + o sunucudaki üye kaydı. */
export type Sunucu = { oda_id: string; ad: string; ikon_metin: string | null; ikon_renk: string; olusturma: string; ben: Uye };

type OdaSatiri = { id: string; ad: string; ikon_metin: string | null; ikon_renk: string; silindi: boolean; olusturma: string };

/** Giriş yapmış kişinin tüm sunucuları (silinenler hariç), varsayılan (en eski) sunucu başta. */
export async function sunuculariGetir(userId: string): Promise<Sunucu[]> {
  const { data } = await supabase.from("uyeler").select("*, odalar(id, ad, ikon_metin, ikon_renk, silindi, olusturma)").eq("user_id", userId).eq("silindi", false);
  const liste: Sunucu[] = [];
  for (const satir of (data ?? []) as (Uye & { odalar: OdaSatiri | OdaSatiri[] | null })[]) {
    const { odalar, ...uye } = satir;
    const o = Array.isArray(odalar) ? odalar[0] : odalar;
    if (!o || o.silindi) continue;
    liste.push({ oda_id: o.id, ad: o.ad, ikon_metin: o.ikon_metin, ikon_renk: o.ikon_renk, olusturma: o.olusturma, ben: uye as Uye });
  }
  return liste.sort((a, b) => a.olusturma.localeCompare(b.olusturma));
}

const SECILI = "cember-sunucu";
export function seciliSunucuOku(): string | null {
  try { return localStorage.getItem(SECILI); } catch { return null; }
}
export function seciliSunucuYaz(odaId: string) {
  try { localStorage.setItem(SECILI, odaId); } catch { /* yoksay */ }
}
/** Kayıtlı seçim listede varsa o, yoksa ilk (varsayılan) sunucu. */
export function sunucuSec(liste: Sunucu[], istenen: string | null): Sunucu | null {
  return liste.find((s) => s.oda_id === istenen) ?? liste[0] ?? null;
}

/** Sunucu simgesindeki yazı: ayarlıysa o, yoksa adın baş harfi. */
export function sunucuBasHarf(s: { ad: string; ikon_metin: string | null }): string {
  return (s.ikon_metin?.trim() || s.ad.trim()[0] || "?").toLocaleUpperCase("tr");
}

// ===== Davet bağlantıları =====
const DAVET_ANAHTAR = "cember-davet";
const KOD = /^[A-Za-z0-9]{6,16}$/;

/** Yapıştırılan metinden (bağlantı ya da yalın kod) davet kodunu çıkarır. */
export function davetKodunuCikar(metin: string): string | null {
  const t = metin.trim();
  if (KOD.test(t)) return t.toUpperCase();
  try {
    const u = new URL(t);
    const q = u.searchParams.get("davet");
    if (q && KOD.test(q)) return q.toUpperCase();
    const m = /\/davet\/([A-Za-z0-9]{6,16})\/?$/.exec(u.pathname);
    if (m) return m[1].toUpperCase();
  } catch { /* URL değil */ }
  return null;
}
/** Adres çubuğundaki davet kodunu (?davet=KOD ya da /davet/KOD) alıp saklar ve adresi temizler. */
export function adrestenDavetAl(): string | null {
  try {
    const u = new URL(window.location.href);
    const kod = davetKodunuCikar(u.href);
    if (kod) {
      sessionStorage.setItem(DAVET_ANAHTAR, kod);
      u.searchParams.delete("davet");
      window.history.replaceState(null, "", "/" + (u.search || "") + u.hash);
    }
  } catch { /* yoksay */ }
  return bekleyenDavet();
}
export function bekleyenDavet(): string | null {
  try { return sessionStorage.getItem(DAVET_ANAHTAR); } catch { return null; }
}
export function davetiUnut() {
  try { sessionStorage.removeItem(DAVET_ANAHTAR); } catch { /* yoksay */ }
}
export function davetBaglantisi(kod: string): string {
  return `${window.location.origin}/?davet=${kod}`;
}
