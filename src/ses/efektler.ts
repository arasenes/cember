// Sesli oda efekt paneli (Soundboard): Web Audio ile sıfır dosya boyutlu, anında çalan eğlenceli ses efektleri.
import { sesAyarOku } from "../sesler";

export type EfektKodu = "alkis" | "davul" | "korna" | "zafer" | "gong" | "uzgun";

export const SES_EFEKTLERI: readonly { kod: EfektKodu; etiket: string; simge: string }[] = [
  { kod: "alkis", etiket: "Alkış", simge: "👏" },
  { kod: "davul", etiket: "Espri", simge: "🥁" },
  { kod: "korna", etiket: "Korna", simge: "📯" },
  { kod: "zafer", etiket: "Zafer", simge: "🎺" },
  { kod: "gong", etiket: "Gong", simge: "🔔" },
  { kod: "uzgun", etiket: "Trombon", simge: "🎻" },
];

export function gecerliEfektMi(kod: unknown): kod is EfektKodu {
  return typeof kod === "string" && SES_EFEKTLERI.some((e) => e.kod === kod);
}

let ctx: AudioContext | null = null;
function contextAl(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx || ctx.state === "closed") ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

function gurultuTamponu(c: AudioContext, sureSn: number): AudioBuffer {
  const n = Math.max(1, Math.floor(c.sampleRate * sureSn));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const veri = buf.getChannelData(0);
  for (let i = 0; i < n; i++) veri[i] = Math.random() * 2 - 1;
  return buf;
}

/** Seçilen ses efektini Web Audio ile sentezleyip çalar. */
export function efektCal(kod: EfektKodu, sagir = false): void {
  if (sagir) return;
  const ayar = sesAyarOku();
  const seviye = ayar.acik ? Math.max(0.25, ayar.seviye / 100) : 0.5;
  const c = contextAl();
  if (!c) return;
  const t0 = c.currentTime;

  if (kod === "alkis") {
    // Arka arkaya kısa filtrelenmiş alkış vuruşları
    for (let i = 0; i < 14; i++) {
      const gecikme = i * 0.055 + (Math.random() * 0.02);
      const src = c.createBufferSource();
      src.buffer = gurultuTamponu(c, 0.07);
      const flt = c.createBiquadFilter();
      flt.type = "bandpass";
      flt.frequency.value = 1100 + (i % 4) * 220;
      flt.Q.value = 2.2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, t0 + gecikme);
      g.gain.exponentialRampToValueAtTime(0.28 * seviye, t0 + gecikme + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + gecikme + 0.065);
      src.connect(flt).connect(g).connect(c.destination);
      src.start(t0 + gecikme);
    }
    return;
  }

  if (kod === "davul") {
    // Ba-dum-tss: Bas davul (0s) -> Trampet (0.18s) -> Zil (0.38s)
    const kick = c.createOscillator();
    const kg = c.createGain();
    kick.frequency.setValueAtTime(140, t0);
    kick.frequency.exponentialRampToValueAtTime(42, t0 + 0.14);
    kg.gain.setValueAtTime(0.45 * seviye, t0);
    kg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    kick.connect(kg).connect(c.destination);
    kick.start(t0); kick.stop(t0 + 0.16);

    const snare = c.createOscillator();
    const sg = c.createGain();
    snare.type = "triangle";
    snare.frequency.setValueAtTime(210, t0 + 0.18);
    snare.frequency.exponentialRampToValueAtTime(95, t0 + 0.31);
    sg.gain.setValueAtTime(0.38 * seviye, t0 + 0.18);
    sg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
    snare.connect(sg).connect(c.destination);
    snare.start(t0 + 0.18); snare.stop(t0 + 0.33);

    const zil = c.createBufferSource();
    zil.buffer = gurultuTamponu(c, 0.45);
    const zf = c.createBiquadFilter();
    zf.type = "highpass"; zf.frequency.value = 5500;
    const zg = c.createGain();
    zg.gain.setValueAtTime(0.26 * seviye, t0 + 0.38);
    zg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.82);
    zil.connect(zf).connect(zg).connect(c.destination);
    zil.start(t0 + 0.38);
    return;
  }

  if (kod === "korna") {
    // Havalı korna: çoklu testere dişi osilatör
    for (const f of [392, 493.88, 587.33]) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f * 0.96, t0);
      o.frequency.linearRampToValueAtTime(f, t0 + 0.05);
      g.gain.setValueAtTime(0.14 * seviye, t0);
      g.gain.setValueAtTime(0.14 * seviye, t0 + 0.42);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.58);
      o.connect(g).connect(c.destination);
      o.start(t0); o.stop(t0 + 0.6);
    }
    return;
  }

  if (kod === "zafer") {
    // Zafer fanfarı: C5 - E5 - G5 - C6
    const notalar = [
      { f: 523.25, b: 0, s: 0.11 },
      { f: 659.25, b: 0.12, s: 0.11 },
      { f: 783.99, b: 0.24, s: 0.11 },
      { f: 1046.5, b: 0.36, s: 0.38 },
    ];
    for (const n of notalar) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(n.f, t0 + n.b);
      g.gain.setValueAtTime(0.28 * seviye, t0 + n.b);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + n.b + n.s);
      o.connect(g).connect(c.destination);
      o.start(t0 + n.b); o.stop(t0 + n.b + n.s + 0.02);
    }
    return;
  }

  if (kod === "gong") {
    // Zengin harmonikli çan / gong
    for (const [f, oran] of [[220, 1], [330, 0.6], [554.37, 0.35], [880, 0.2]] as const) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.25 * oran * seviye, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
      o.connect(g).connect(c.destination);
      o.start(t0); o.stop(t0 + 1.15);
    }
    return;
  }

  if (kod === "uzgun") {
    // Üzgün trombon: Wah-wah-wah-waaah
    const adimlar = [
      { f1: 311.13, f2: 293.66, b: 0, s: 0.22 },
      { f1: 293.66, f2: 277.18, b: 0.25, s: 0.22 },
      { f1: 277.18, f2: 261.63, b: 0.5, s: 0.22 },
      { f1: 261.63, f2: 220.0, b: 0.75, s: 0.5 },
    ];
    for (const a of adimlar) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(a.f1, t0 + a.b);
      o.frequency.linearRampToValueAtTime(a.f2, t0 + a.b + a.s);
      g.gain.setValueAtTime(0.18 * seviye, t0 + a.b);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + a.b + a.s);
      o.connect(g).connect(c.destination);
      o.start(t0 + a.b); o.stop(t0 + a.b + a.s + 0.02);
    }
  }
}
