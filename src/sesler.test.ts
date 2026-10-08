import { beforeEach, describe, expect, it, vi } from "vitest";

let osc = 0;
class SahteParam { value = 0; setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
class SahteBaglam {
  state = "running"; currentTime = 0; destination = {};
  createGain() { return { gain: new SahteParam(), connect() {} }; }
  createOscillator() { osc++; return { type: "", frequency: new SahteParam(), connect() {}, start() {}, stop() {} }; }
  resume() { return Promise.resolve(); }
}

async function yukle() {
  vi.resetModules();
  (window as unknown as { AudioContext: unknown }).AudioContext = SahteBaglam;
  return import("./sesler");
}

describe("sesler", () => {
  beforeEach(() => { osc = 0; localStorage.clear(); });

  it("varsayılan ayarla çalar (Tok, açık, %60)", async () => {
    const s = await yukle();
    expect(s.sesAyarOku()).toEqual({ acik: true, seviye: 60, takim: "tok" });
    s.sesCal("mesaj");
    expect(osc).toBeGreaterThan(0);
  });

  it("kapalıyken ya da seviye 0 iken çalmaz", async () => {
    const s = await yukle();
    s.sesAyarKaydet({ acik: false });
    s.sesCal("bahsetme");
    expect(osc).toBe(0);
    s.sesAyarKaydet({ acik: true, seviye: 0 });
    s.sesCal("bahsetme");
    expect(osc).toBe(0);
  });

  it("aynı ses 150 ms içinde ikinci kez çalmaz", async () => {
    const s = await yukle();
    s.sesCal("mesaj");
    const ilk = osc;
    s.sesCal("mesaj");
    expect(osc).toBe(ilk);
  });

  it("ayarı saklar, sınırlar ve dinleyiciye haber verir", async () => {
    const s = await yukle();
    const f = vi.fn();
    s.sesAyarDinle(f);
    s.sesAyarKaydet({ seviye: 500, takim: "tok" });
    expect(s.sesAyarOku()).toMatchObject({ seviye: 100, takim: "tok" });
    expect(f).toHaveBeenCalled();
    const s2 = await yukle();
    expect(s2.sesAyarOku().takim).toBe("tok");
  });

  it("geçersiz takım adını yok sayar; önizleme kapalıyken de çalar", async () => {
    const s = await yukle();
    s.sesAyarKaydet({ acik: false });
    s.sesAyarKaydet({ takim: "yok" as never });
    expect(s.sesAyarOku().takim).toBe("tok");
    s.sesOnizle("katil", "blip");
    expect(osc).toBeGreaterThan(0);
  });

  it("Müzikal takımda her olayın kendi melodisi var", async () => {
    const s = await yukle();
    for (const o of Object.keys(s.OLAYLAR)) expect(s.TAKIMLAR.muzikal.notalar?.[o as keyof typeof s.OLAYLAR]?.length).toBeGreaterThan(0);
  });

  it("11 olayın hepsi tanımlı ve insan sesi/dosya içermez (yalnız osilatör)", async () => {
    const s = await yukle();
    expect(Object.keys(s.OLAYLAR)).toHaveLength(11);
    for (const o of Object.keys(s.OLAYLAR) as (keyof typeof s.OLAYLAR)[]) s.sesOnizle(o);
    expect(osc).toBeGreaterThan(20);
  });

  it("sağırlaştırılmışken yalnızca mikAc, mikKapat, sagir ve hata çalar", async () => {
    const s = await yukle();
    s.sesSagirAyarla(true);
    for (const o of ["mesaj", "bahsetme", "dm", "gonder", "katil", "ayril", "ekran"] as const) { s.sesCal(o); expect(osc, o).toBe(0); }
    for (const o of ["mikAc", "mikKapat", "sagir", "hata"] as const) { const once = osc; s.sesCal(o); expect(osc, o).toBeGreaterThan(once); }
    s.sesSagirAyarla(false);
    const once = osc; s.sesCal("mesaj"); expect(osc).toBeGreaterThan(once);
  });
});
