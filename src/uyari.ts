// Etiket (@ad) yardımcıları ve sekme arkadayken sistem bildirimi. Sesler: src/sesler.ts (Web Audio, insan sesi yok).
import { sesAyarOku } from "./sesler";

/** Sekme arkadayken sistem bildirimi (izin verilmişse). */
export function bildirim(baslik: string, govde: string) {
  try {
    if (!sesAyarOku().acik || !document.hidden || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification(baslik, { body: govde.slice(0, 120), tag: "cember-etiket" });
  } catch { /* yoksay */ }
}
export function bildirimIzniIste() {
  try { if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission(); } catch { /* yoksay */ }
}

const kac = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Metinde "@ad" biçiminde bu kişi etiketlenmiş mi? */
export function etiketVar(metin: string, ad: string): boolean {
  if (!ad) return false;
  return new RegExp(`(^|\\s)@${kac(ad)}(?![\\p{L}\\p{N}_])`, "iu").test(metin);
}
/** Mesaj metnini düz parçalara böler; bu kişiye yapılan etiketler işaretlenir. */
export function etiketParcala(metin: string, ad: string): { m: string; etiket: boolean }[] {
  if (!ad) return [{ m: metin, etiket: false }];
  const re = new RegExp(`(^|\\s)(@${kac(ad)})(?![\\p{L}\\p{N}_])`, "giu");
  const out: { m: string; etiket: boolean }[] = [];
  let son = 0;
  for (const x of metin.matchAll(re)) {
    const bas = (x.index ?? 0) + x[1].length;
    if (bas > son) out.push({ m: metin.slice(son, bas), etiket: false });
    out.push({ m: x[2], etiket: true });
    son = bas + x[2].length;
  }
  if (son < metin.length) out.push({ m: metin.slice(son), etiket: false });
  return out.length ? out : [{ m: metin, etiket: false }];
}
