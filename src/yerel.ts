// Bu cihaza özgü küçük tercihler (okundu işaretleri, katlanan bölümler, kanal sırası, sessiz kanallar, yazı boyutu).
function oku<T>(anahtar: string, varsayilan: T): T {
  try { const v = localStorage.getItem(anahtar); return v ? (JSON.parse(v) as T) : varsayilan; } catch { return varsayilan; }
}
function yaz(anahtar: string, deger: unknown): void {
  try { localStorage.setItem(anahtar, JSON.stringify(deger)); } catch { /* yoksay */ }
}

const OKUNDU = "cember-okundu";
export function okunduOku(): Record<string, string> { const v = oku<Record<string, string>>(OKUNDU, {}); return v && typeof v === "object" ? v : {}; }
export function okunduYaz(h: Record<string, string>): void { yaz(OKUNDU, h); }

export function katlanmisOku(): string[] { const v = oku<string[]>("cember-katlanmis", []); return Array.isArray(v) ? v : []; }
export function katlanmisYaz(l: string[]): void { yaz("cember-katlanmis", l); }

export function sessizOku(): string[] { const v = oku<string[]>("cember-sessiz", []); return Array.isArray(v) ? v : []; }
export function sessizYaz(l: string[]): void { yaz("cember-sessiz", l); }

export function siraOku(): Record<string, string[]> { const v = oku<Record<string, string[]>>("cember-sira", {}); return v && typeof v === "object" ? v : {}; }
export function siraYaz(h: Record<string, string[]>): void { yaz("cember-sira", h); }

/** Kayıtlı sıraya göre diz; kayıtta olmayanlar özgün sırasıyla sona gider. */
export function sirala<T extends { id: string }>(liste: T[], sira: string[] | undefined): T[] {
  if (!sira?.length) return liste;
  const yer = new Map(sira.map((id, i) => [id, i]));
  return [...liste].sort((a, b) => (yer.get(a.id) ?? 1e6 + liste.indexOf(a)) - (yer.get(b.id) ?? 1e6 + liste.indexOf(b)));
}

export type YaziBoyutu = "kucuk" | "orta" | "buyuk";
export function yaziBoyutuOku(): YaziBoyutu { const v = oku<string>("cember-yazi", "orta"); return v === "kucuk" || v === "buyuk" ? v : "orta"; }
export function yaziBoyutuUygula(b: YaziBoyutu): void { document.documentElement.setAttribute("data-yazi", b); }
export function yaziBoyutuKaydet(b: YaziBoyutu): void { yaz("cember-yazi", b); yaziBoyutuUygula(b); }
