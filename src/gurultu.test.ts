import { describe, expect, it, vi } from "vitest";
import { gurultuTercihi, gurultuTercihiKaydet, gurultuUygula } from "./gurultu";

describe("gürültü engelleme", () => {
  it("varsayılan açık; tercih saklanır", () => {
    localStorage.clear();
    expect(gurultuTercihi()).toBe(true);
    gurultuTercihiKaydet(false);
    expect(gurultuTercihi()).toBe(false);
    gurultuTercihiKaydet(true);
    expect(gurultuTercihi()).toBe(true);
  });
  it("çalışan mikrofon kanalına kısıtları uygular, desteklenmiyorsa hata vermez", async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    await gurultuUygula({ applyConstraints } as unknown as MediaStreamTrack, false);
    expect(applyConstraints).toHaveBeenCalledWith({ noiseSuppression: false, autoGainControl: false, echoCancellation: true });
    await expect(gurultuUygula({ applyConstraints: () => Promise.reject(new Error("x")) } as unknown as MediaStreamTrack, true)).resolves.toBeUndefined();
    await expect(gurultuUygula(undefined, true)).resolves.toBeUndefined();
  });
});
