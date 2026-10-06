// Uyarı sesleri: mesaj, etiket, odaya giriş/çıkış. Kısa çınlamalar + Türkçe kadın sesiyle okuma. Varsayılan: açık.
const ANAHTAR = "cember-sesler";

export function seslerAcik(): boolean {
  try { return localStorage.getItem(ANAHTAR) !== "kapali"; } catch { return true; }
}
export function seslerKaydet(acik: boolean) {
  try { localStorage.setItem(ANAHTAR, acik ? "acik" : "kapali"); } catch { /* yoksay */ }
}

export type Uyari = "mesaj" | "etiket" | "baglandi" | "ayrildi";
// [frekans, başlama gecikmesi (sn)]
const NOTALAR: Record<Uyari, [number, number][]> = {
  mesaj: [[784, 0]],
  etiket: [[880, 0], [1175, 0.13], [1568, 0.26]],
  baglandi: [[523, 0], [784, 0.12]],
  ayrildi: [[784, 0], [523, 0.12]],
};

let ctx: AudioContext | null = null;
function baglam(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { return null; }
  return ctx;
}

/** Tarayıcılar sesi ilk dokunuşa kadar kilitli tutar; ilk tıklamada açar. */
export function sesleriHazirla(): () => void {
  const ac = () => { void baglam()?.resume().catch(() => {}); };
  window.addEventListener("pointerdown", ac);
  window.addEventListener("keydown", ac);
  return () => { window.removeEventListener("pointerdown", ac); window.removeEventListener("keydown", ac); };
}

function nota(c: AudioContext, frekans: number, bas: number, sure: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = frekans;
  g.gain.setValueAtTime(0.0001, bas);
  g.gain.exponentialRampToValueAtTime(0.14, bas + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, bas + sure);
  o.connect(g).connect(c.destination);
  o.start(bas);
  o.stop(bas + sure + 0.03);
}

export function cal(tur: Uyari) {
  if (!seslerAcik()) return;
  const c = baglam();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
  const t = c.currentTime + 0.02;
  for (const [f, gecikme] of NOTALAR[tur]) nota(c, f, t + gecikme, 0.2);
}

/** Türkçe kadın sesi: bilinen kadın seslerini önceler, erkek seslerini eler. */
export function kadinSesi(sesler: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const tr = sesler.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("tr"));
  if (!tr.length) return null;
  const erkek = /tolga|ahmet|cem\b|\bmale\b|erkek/i;
  const kadin = /emel|yelda|filiz|seda|female|kad[ıi]n|google/i;
  return tr.find((v) => kadin.test(v.name) && !erkek.test(v.name)) ?? tr.find((v) => !erkek.test(v.name)) ?? tr[0];
}

let bekleyen = 0;
export function konus(metin: string) {
  if (!seslerAcik() || typeof window === "undefined" || !window.speechSynthesis) return;
  if (bekleyen >= 3) return; // art arda çok olay olursa kuyruğu şişirme
  try {
    const u = new SpeechSynthesisUtterance(metin);
    u.lang = "tr-TR";
    const v = kadinSesi(window.speechSynthesis.getVoices());
    if (v) u.voice = v;
    u.pitch = 1.15;
    u.rate = 1;
    u.volume = 0.9;
    bekleyen++;
    u.onend = u.onerror = () => { bekleyen = Math.max(0, bekleyen - 1); };
    window.speechSynthesis.speak(u);
  } catch { /* yoksay */ }
}

/** Çınlama + (varsa) okunacak metin. */
export function duyur(tur: Uyari, okunacak?: string) {
  if (!seslerAcik()) return;
  cal(tur);
  if (okunacak) setTimeout(() => konus(okunacak), 280);
}

/** Sekme arkadayken sistem bildirimi (izin verilmişse). */
export function bildirim(baslik: string, govde: string) {
  try {
    if (!seslerAcik() || !document.hidden || typeof Notification === "undefined" || Notification.permission !== "granted") return;
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
