import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn(async () => ({ error: null }));
vi.mock("./supabase", () => ({ supabase: { rpc: (...a: unknown[]) => (rpc as (...x: unknown[]) => unknown)(...a) } }));
vi.mock("./ekranOrtak", () => ({ uygulamaIci: () => false }));

import { pushAc, pushAcikMi, pushDestekli, pushKapat, pushSadeceEtiket, pushTercih, pushYenile } from "./push";

describe("bildirim (push)", () => {
  beforeEach(() => { localStorage.clear(); rpc.mockClear(); });

  it("destek yoksa (jsdom) açılamaz ve nedenini söyler", async () => {
    expect(pushDestekli()).toBe(false);
    const s = await pushAc();
    expect(s.ok).toBe(false);
    expect(s.mesaj).toMatch(/desteklemiyor/);
    expect(pushAcikMi()).toBe(false);
  });

  it("kapalıyken tercih yalnızca yerelde saklanır, sunucuya gitmez", async () => {
    await pushTercih(true);
    expect(pushSadeceEtiket()).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("kapat: yerel bayrak kapanır ama tercih kalır", async () => {
    localStorage.setItem("cember.push", JSON.stringify({ acik: true, sadeceEtiket: true, uc: "x" }));
    await pushKapat();
    expect(pushAcikMi()).toBe(false);
    expect(pushSadeceEtiket()).toBe(true);
  });

  it("yenile: bildirim hiç açılmadıysa hiçbir şey yapmaz", async () => {
    await pushYenile();
    expect(rpc).not.toHaveBeenCalled();
  });
});
