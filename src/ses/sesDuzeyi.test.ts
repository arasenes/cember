import { beforeEach, describe, expect, it, vi } from "vitest";
import { DUZEY_MAX, SesYoneticisi, duzeyleriOku, sinirla } from "./sesDuzeyi";

class SahteGain { gain = { value: 1 }; baglantilar: unknown[] = []; connect(h: unknown) { this.baglantilar.push(h); } disconnect() { this.baglantilar = []; } }
class SahteKaynak { baglantilar: unknown[] = []; connect(h: unknown) { this.baglantilar.push(h); } disconnect() { this.baglantilar = []; } }
function sahteBaglam() {
  const gainler: SahteGain[] = [];
  const ctx = {
    destination: { ad: "hedef" },
    createGain: () => { const g = new SahteGain(); gainler.push(g); return g; },
    createMediaStreamSource: () => new SahteKaynak(),
    resume: vi.fn(async () => {}),
  };
  return { ctx: ctx as unknown as AudioContext, gainler };
}
const akis = (sesli = true) => ({ getAudioTracks: () => (sesli ? [{}] : []) }) as unknown as MediaStream;
const eleman = () => ({ muted: false, volume: 1 }) as unknown as HTMLAudioElement;

describe("SesYoneticisi", () => {
  beforeEach(() => localStorage.clear());

  it("düzey sınırlanır ve kaydedilir; varsayılan %100", () => {
    expect(sinirla(500)).toBe(DUZEY_MAX);
    expect(sinirla(-4)).toBe(0);
    const { ctx } = sahteBaglam();
    const y = new SesYoneticisi(() => ctx);
    expect(y.duzey("u1")).toBe(100);
    y.duzeyAyarla("u1", 150);
    expect(y.duzey("u1")).toBe(150);
    expect(duzeyleriOku()).toEqual({ u1: 150 });
  });

  it("kaydedilen ses kazanç hattından geçer, eleman sessize alınır; düzey değişince kazanç güncellenir", () => {
    const { ctx, gainler } = sahteBaglam();
    const y = new SesYoneticisi(() => ctx);
    y.duzeyAyarla("u1", 60);
    const el = eleman();
    y.kaydet("u1", akis(), el);
    expect(el.muted).toBe(true);
    const kazanc = gainler[1]; // gainler[0] ana kazanç
    expect(kazanc.gain.value).toBeCloseTo(0.6);
    y.duzeyAyarla("u1", 200);
    expect(kazanc.gain.value).toBe(2);
    expect(y.anahtarlar()).toEqual(["u1"]);
    y.kaldir("u1");
    expect(y.anahtarlar()).toEqual([]);
  });

  it("sağırlaştır ana kazancı sıfırlar ve geri açar", () => {
    const { ctx, gainler } = sahteBaglam();
    const y = new SesYoneticisi(() => ctx);
    y.kaydet("u1", akis(), eleman());
    y.sagirlastir(true);
    expect(gainler[0].gain.value).toBe(0);
    expect(y.sagir).toBe(true);
    y.sagirlastir(false);
    expect(gainler[0].gain.value).toBe(1);
  });

  it("ses kanalı yoksa ya da WebAudio yoksa elemanın kendi ses düzeyine düşer (en çok %100)", () => {
    const y = new SesYoneticisi(() => null);
    const el = eleman();
    y.duzeyAyarla("u2", 150);
    y.kaydet("u2", akis(), el);
    expect(el.volume).toBe(1);
    y.duzeyAyarla("u2", 40);
    expect(el.volume).toBeCloseTo(0.4);
    y.sagirlastir(true);
    expect(el.muted).toBe(true);
    const bos = eleman();
    y.kaydet("u3", akis(false), bos);
    expect(bos.volume).toBe(1);
  });

  it("aynı anahtar tekrar kaydedilince eski hat kopar, dinleyiciler haberdar edilir", () => {
    const { ctx } = sahteBaglam();
    const y = new SesYoneticisi(() => ctx);
    const f = vi.fn();
    const iptal = y.abone(f);
    y.kaydet("u1", akis(), eleman());
    y.kaydet("u1", akis(), eleman());
    expect(y.anahtarlar()).toEqual(["u1"]);
    expect(f).toHaveBeenCalled();
    iptal();
    f.mockClear();
    y.duzeyAyarla("u1", 70);
    expect(f).not.toHaveBeenCalled();
  });

  it("bozuk kayıtlı veri yok sayılır", () => {
    localStorage.setItem("cember-ses-duzeyleri", '{"a":"x","b":300,"c":50}');
    expect(duzeyleriOku()).toEqual({ b: 200, c: 50 });
    localStorage.setItem("cember-ses-duzeyleri", "{bozuk");
    expect(duzeyleriOku()).toEqual({});
  });
});
