// Palet seçici. Seçim kullanıcıya özeldir: önce localStorage, girişliyse profiles.tema (Supabase) ile cihazlar arası.
export type TemaId = "mint-gece" | "mor-gece" | "derin-mavi" | "sicak-mercan" | "acik-tema" | "gul-gecesi" | "komur-turuncu" | "neon-limon" | "orman-altin" | "acik-mercan";

export interface Tema { id: TemaId; ad: string; not: string; acik: boolean; renkler: [string, string, string, string]; } // önizleme: [şerit, ana, vurgu, ikinci]

export const TEMALAR: Tema[] = [
  { id: "mint-gece", ad: "Mint Gece", not: "şimdiki", acik: false, renkler: ["#0f1116", "#1c2029", "#4fd1a5", "#f5b94a"] },
  { id: "mor-gece", ad: "Mor Gece", not: "canlı, oyuncu", acik: false, renkler: ["#100e17", "#1d1a28", "#a78bfa", "#f9a8d4"] },
  { id: "derin-mavi", ad: "Derin Mavi", not: "sakin, ciddi", acik: false, renkler: ["#0a1019", "#142030", "#4cc2ff", "#ffb454"] },
  { id: "sicak-mercan", ad: "Sıcak Mercan", not: "samimi, sıcak", acik: false, renkler: ["#130f0e", "#211918", "#ff7a59", "#ffd166"] },
  { id: "acik-tema", ad: "Açık Tema", not: "gündüz modu", acik: true, renkler: ["#e3e7ed", "#fafbfc", "#0e7c66", "#b45309"] },
  { id: "gul-gecesi", ad: "Gül Gecesi", not: "pembe, eğlenceli", acik: false, renkler: ["#120b10", "#211620", "#ff5fa2", "#7be0ff"] },
  { id: "komur-turuncu", ad: "Kömür ve Turuncu", not: "nötr, net", acik: false, renkler: ["#0c0c0c", "#1b1b1b", "#ff9f1c", "#5ee0c1"] },
  { id: "neon-limon", ad: "Neon Limon", not: "enerjik", acik: false, renkler: ["#0b0d08", "#181c11", "#c6f432", "#ff8fab"] },
  { id: "orman-altin", ad: "Orman ve Altın", not: "doğal, şık", acik: false, renkler: ["#0b130f", "#16231b", "#e3b341", "#7ee0a1"] },
  { id: "acik-mercan", ad: "Açık Mercan", not: "gündüz, sıcak", acik: true, renkler: ["#f1e4da", "#fffaf6", "#d9480f", "#0b7285"] },
];

export const VARSAYILAN_TEMA: TemaId = "komur-turuncu";
const ANAHTAR = "cember-tema";

export function temaOku(): TemaId {
  try { const t = localStorage.getItem(ANAHTAR) as TemaId | null; if (t && TEMALAR.some(x => x.id === t)) return t; } catch { /* özel pencere vb. */ }
  return VARSAYILAN_TEMA;
}

export function temaUygula(id: TemaId): void {
  const kok = document.documentElement;
  if (id === VARSAYILAN_TEMA) kok.removeAttribute("data-tema"); else kok.setAttribute("data-tema", id);
  const acik = TEMALAR.find(t => t.id === id)?.acik ?? false;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(kok).getPropertyValue("--zemin-serit").trim());
  kok.style.colorScheme = acik ? "light" : "dark";
}

export function temaKaydet(id: TemaId): void {
  try { localStorage.setItem(ANAHTAR, id); } catch { /* yoksay */ }
  temaUygula(id);
  // Girişliyse: supabase.from("profiles").update({ tema: id }).eq("id", kullaniciId)  (migration: alter table profiles add column tema text)
}

// main.tsx'te render'dan ÖNCE çağır (açılışta renk titremesi olmasın): temaUygula(temaOku());
