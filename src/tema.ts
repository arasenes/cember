// Tema seçimi: gece (varsayılan, tasarımdaki koyu tema) | gündüz (Kâğıt) | otomatik (cihazı izler). Tercih bu cihazda saklanır.
export type Tema = "otomatik" | "gunduz" | "gece";
const ANAHTAR = "cember-tema";
const SIRA: Tema[] = ["otomatik", "gunduz", "gece"];

export function temaTercihi(): Tema {
  try { const v = localStorage.getItem(ANAHTAR); return v === "gunduz" || v === "otomatik" ? v : "gece"; } catch { return "gece"; }
}
export function temaUygula(t: Tema): void {
  const el = document.documentElement;
  if (t === "gunduz") el.setAttribute("data-theme", "light");
  else if (t === "gece") el.setAttribute("data-theme", "dark");
  else el.removeAttribute("data-theme");
}
export function temaKaydet(t: Tema): void {
  try { localStorage.setItem(ANAHTAR, t); } catch { /* yoksay */ }
  temaUygula(t);
}
export function sonrakiTema(t: Tema): Tema { return SIRA[(SIRA.indexOf(t) + 1) % SIRA.length]; }
export const TEMA_BILGI: Record<Tema, { simge: string; ad: string }> = {
  otomatik: { simge: "🌓", ad: "Otomatik (cihaza göre)" },
  gunduz: { simge: "☀️", ad: "Gündüz" },
  gece: { simge: "🌙", ad: "Gece" },
};
