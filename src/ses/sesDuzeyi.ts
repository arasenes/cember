import { useEffect, useState } from "react";

// Kişi başı ses düzeyi (0-200%). Uzak sesler WebAudio kazancı üzerinden çalınır; eleman (<audio>) sessize alınır.
// Anahtar: "<üye id>" mikrofon sesi, "<üye id>~ekran" paylaşılan ekranın sesi.
export const DUZEY_MIN = 0;
export const DUZEY_MAX = 200;
const ANAHTAR = "cember-ses-duzeyleri";

export function duzeyleriOku(): Record<string, number> {
  try {
    const j = JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}") as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(j)) if (typeof v === "number" && Number.isFinite(v)) out[k] = sinirla(v);
    return out;
  } catch { return {}; }
}
function duzeyleriYaz(d: Record<string, number>) {
  try { localStorage.setItem(ANAHTAR, JSON.stringify(d)); } catch { /* yoksay */ }
}
export const sinirla = (v: number) => Math.min(DUZEY_MAX, Math.max(DUZEY_MIN, Math.round(v)));

type Kayit = { kaynak: MediaStreamAudioSourceNode | null; kazanc: GainNode | null; el?: HTMLMediaElement };
type BaglamUretici = () => AudioContext | null;

const varsayilanBaglam: BaglamUretici = () => {
  const AC = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!AC) return null;
  try { return new AC(); } catch { return null; }
};

export class SesYoneticisi {
  private ctx: AudioContext | null = null;
  private ana: GainNode | null = null;
  private kayitlar = new Map<string, Kayit>();
  private duzeyler: Record<string, number> = duzeyleriOku();
  private sagirMi = false;
  private dinleyiciler = new Set<() => void>();

  constructor(private baglamUret: BaglamUretici = varsayilanBaglam) {}

  private baglam(): AudioContext | null {
    if (!this.ctx) {
      this.ctx = this.baglamUret();
      if (this.ctx) {
        this.ana = this.ctx.createGain();
        this.ana.gain.value = this.sagirMi ? 0 : 1;
        this.ana.connect(this.ctx.destination);
      }
    }
    return this.ctx;
  }

  duzey(anahtar: string): number { return this.duzeyler[anahtar] ?? 100; }
  get sagir(): boolean { return this.sagirMi; }
  anahtarlar(): string[] { return [...this.kayitlar.keys()]; }

  /** Uzak bir sesi kazanç hattına bağlar. Akış yoksa ya da WebAudio yoksa elemanın kendi ses düzeyine (en çok %100) düşer. */
  kaydet(anahtar: string, akis: MediaStream | null, el?: HTMLMediaElement) {
    this.kaldir(anahtar);
    const ctx = akis && akis.getAudioTracks().length ? this.baglam() : null;
    if (ctx && this.ana && akis) {
      void ctx.resume?.().catch?.(() => {});
      const kaynak = ctx.createMediaStreamSource(akis);
      const kazanc = ctx.createGain();
      kazanc.gain.value = this.duzey(anahtar) / 100;
      kaynak.connect(kazanc);
      kazanc.connect(this.ana);
      if (el) el.muted = true; // ses WebAudio'dan çıkar; eleman yalnızca akışı canlı tutar
      this.kayitlar.set(anahtar, { kaynak, kazanc, el });
    } else {
      if (el) { el.muted = this.sagirMi; el.volume = Math.min(1, this.duzey(anahtar) / 100); }
      this.kayitlar.set(anahtar, { kaynak: null, kazanc: null, el });
    }
    this.bildir();
  }

  kaldir(anahtar: string) {
    const k = this.kayitlar.get(anahtar);
    if (!k) return;
    try { k.kaynak?.disconnect(); k.kazanc?.disconnect(); } catch { /* yoksay */ }
    this.kayitlar.delete(anahtar);
    this.bildir();
  }

  hepsiniKaldir() {
    for (const a of [...this.kayitlar.keys()]) this.kaldir(a);
  }

  duzeyAyarla(anahtar: string, yuzde: number) {
    const d = sinirla(yuzde);
    this.duzeyler = { ...this.duzeyler, [anahtar]: d };
    duzeyleriYaz(this.duzeyler);
    const k = this.kayitlar.get(anahtar);
    if (k?.kazanc) k.kazanc.gain.value = d / 100;
    else if (k?.el) k.el.volume = Math.min(1, d / 100);
    this.bildir();
  }

  /** Sağırlaştır: tüm uzak sesleri keser (kendi mikrofonunu kapatmak çağıranın işi). */
  sagirlastir(acik: boolean) {
    this.sagirMi = acik;
    if (this.ana) this.ana.gain.value = acik ? 0 : 1;
    for (const k of this.kayitlar.values()) if (!k.kazanc && k.el) k.el.muted = acik;
    this.bildir();
  }

  abone(f: () => void): () => void { this.dinleyiciler.add(f); return () => { this.dinleyiciler.delete(f); }; }
  private bildir() { for (const f of this.dinleyiciler) f(); }
}

/** Uygulama genelinde tek yönetici: iki ses motoru da buraya kaydeder. */
export const sesYoneticisi = new SesYoneticisi();

/** Kayıtlı uzak seslerin düzeylerini ve sağırlaştırma durumunu izler (arayüz için). */
export function useSesDuzeyleri() {
  const [, yenile] = useState(0);
  useEffect(() => sesYoneticisi.abone(() => yenile((x) => x + 1)), []);
  return {
    anahtarlar: sesYoneticisi.anahtarlar(),
    duzey: (a: string) => sesYoneticisi.duzey(a),
    ayarla: (a: string, d: number) => sesYoneticisi.duzeyAyarla(a, d),
    sagir: sesYoneticisi.sagir,
  };
}
