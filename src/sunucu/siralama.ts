import type { Kanal, Kategori } from "../types";

// Kanal ve kategori sıralaması: saf mantık (arayüzden bağımsız, test edilebilir).
// Kanallar önce "kategorisiz" grupta, sonra kategorilerin sırasıyla gösterilir; kanal sırası tüm liste boyunca ardışıktır.
export type KanalSira = { id: string; kategori_id: string | null; sira: number };
export type KategoriSira = { id: string; sira: number };
export type Tasima =
  | { tur: "kanal-yukari" | "kanal-asagi"; id: string }
  | { tur: "kanal-kategori"; id: string; kategori_id: string | null } // kategorinin sonuna
  | { tur: "kanal-onune"; id: string; hedef: string }
  | { tur: "kategori-yukari" | "kategori-asagi"; id: string }
  | { tur: "kategori-onune"; id: string; hedef: string };

const sirayla = <T extends { sira: number; id: string }>(l: T[]) => [...l].sort((a, b) => a.sira - b.sira || a.id.localeCompare(b.id));

/** Kanalları kategorilerine göre gruplar: [kategorisiz, ...kategoriler] (sıralı). */
export function gruplariKur(kanallar: Kanal[], kategoriler: Kategori[]): { kategori: Kategori | null; kanallar: Kanal[] }[] {
  const katlar = sirayla(kategoriler);
  const kimlikler = new Set(katlar.map((k) => k.id));
  const kategorisiz = sirayla(kanallar.filter((k) => !k.kategori_id || !kimlikler.has(k.kategori_id)));
  return [{ kategori: null, kanallar: kategorisiz }, ...katlar.map((c) => ({ kategori: c, kanallar: sirayla(kanallar.filter((k) => k.kategori_id === c.id)) }))];
}

function yerDegistir<T>(l: T[], i: number, j: number): T[] {
  if (i < 0 || j < 0 || i >= l.length || j >= l.length) return l;
  const y = [...l];
  [y[i], y[j]] = [y[j], y[i]];
  return y;
}

export function duzenle(kanallar: Kanal[], kategoriler: Kategori[], t: Tasima): { kanallar: KanalSira[]; kategoriler: KategoriSira[] } {
  const gruplar = gruplariKur(kanallar, kategoriler);
  // Çalışma modeli: kategori sırası + her grubun kanal kimlikleri
  let katSirasi = gruplar.slice(1).map((g) => g.kategori!.id);
  const icerik = new Map<string | null, string[]>(gruplar.map((g) => [g.kategori?.id ?? null, g.kanallar.map((k) => k.id)]));
  const grubuBul = (kanalId: string): string | null | undefined => { for (const [k, l] of icerik) if (l.includes(kanalId)) return k; return undefined; };

  if (t.tur === "kanal-yukari" || t.tur === "kanal-asagi") {
    const g = grubuBul(t.id);
    if (g !== undefined) { const l = icerik.get(g)!; const i = l.indexOf(t.id); icerik.set(g, yerDegistir(l, i, t.tur === "kanal-yukari" ? i - 1 : i + 1)); }
  } else if (t.tur === "kanal-kategori") {
    const g = grubuBul(t.id);
    if (g !== undefined && (t.kategori_id === null || katSirasi.includes(t.kategori_id))) {
      icerik.set(g, icerik.get(g)!.filter((x) => x !== t.id));
      icerik.set(t.kategori_id, [...(icerik.get(t.kategori_id) ?? []), t.id]);
    }
  } else if (t.tur === "kanal-onune") {
    const kaynak = grubuBul(t.id);
    const hedefGrup = grubuBul(t.hedef);
    if (kaynak !== undefined && hedefGrup !== undefined && t.id !== t.hedef) {
      icerik.set(kaynak, icerik.get(kaynak)!.filter((x) => x !== t.id));
      const l = [...icerik.get(hedefGrup)!];
      l.splice(l.indexOf(t.hedef), 0, t.id);
      icerik.set(hedefGrup, l);
    }
  } else if (t.tur === "kategori-yukari" || t.tur === "kategori-asagi") {
    const i = katSirasi.indexOf(t.id);
    katSirasi = yerDegistir(katSirasi, i, t.tur === "kategori-yukari" ? i - 1 : i + 1);
  } else if (t.tur === "kategori-onune") {
    if (katSirasi.includes(t.id) && katSirasi.includes(t.hedef) && t.id !== t.hedef) {
      katSirasi = katSirasi.filter((x) => x !== t.id);
      katSirasi.splice(katSirasi.indexOf(t.hedef), 0, t.id);
    }
  }

  const cikti: KanalSira[] = [];
  let sira = 1;
  for (const k of [null, ...katSirasi]) for (const id of icerik.get(k) ?? []) cikti.push({ id, kategori_id: k, sira: sira++ });
  return { kanallar: cikti, kategoriler: katSirasi.map((id, i) => ({ id, sira: i + 1 })) };
}

/** Yavaş mod seçenekleri (saniye). */
export const YAVAS_MOD_SECENEKLERI: { sn: number; etiket: string }[] = [
  { sn: 0, etiket: "Kapalı" }, { sn: 5, etiket: "5 sn" }, { sn: 10, etiket: "10 sn" }, { sn: 30, etiket: "30 sn" },
  { sn: 60, etiket: "1 dk" }, { sn: 300, etiket: "5 dk" }, { sn: 900, etiket: "15 dk" }, { sn: 3600, etiket: "1 saat" }, { sn: 21600, etiket: "6 saat" },
];
export function yavasModMetni(sn: number): string {
  return YAVAS_MOD_SECENEKLERI.find((s) => s.sn === sn)?.etiket ?? `${sn} sn`;
}
