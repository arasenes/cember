import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useYaziyorTakip, YAZIYOR_SURE_MS, yaziyorMetni } from "./yaziyor";

describe("yaziyorMetni", () => {
  it("kişi sayısına göre metin üretir", () => {
    expect(yaziyorMetni([])).toBe("");
    expect(yaziyorMetni(["Can"])).toBe("Can yazıyor…");
    expect(yaziyorMetni(["Can", "Enes"])).toBe("Can ve Enes yazıyor…");
    expect(yaziyorMetni(["Can", "Enes", "Ayşe"])).toBe("Birkaç kişi yazıyor…");
  });
});

describe("useYaziyorTakip", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("yalnızca aktif kanaldakileri gösterir ve 5 sn sonra söner", () => {
    const { result } = renderHook(() => useYaziyorTakip("k1"));
    act(() => { result.current.kaydet("u1", "Can", "k1"); result.current.kaydet("u2", "Enes", "k2"); });
    expect(result.current.metin).toBe("Can yazıyor…");
    act(() => { vi.advanceTimersByTime(YAZIYOR_SURE_MS + 1100); });
    expect(result.current.metin).toBe("");
  });

  it("yeni sinyal süreyi uzatır, mesaj gelince sil() hemen kaldırır", () => {
    const { result } = renderHook(() => useYaziyorTakip("k1"));
    act(() => { result.current.kaydet("u1", "Can", "k1"); });
    act(() => { vi.advanceTimersByTime(4000); });
    act(() => { result.current.kaydet("u1", "Can", "k1"); });
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current.metin).toBe("Can yazıyor…");
    act(() => { result.current.sil("u1"); });
    expect(result.current.metin).toBe("");
  });

  it("kanal değişince diğer kanalın yazanlarını gösterir", () => {
    const { result, rerender } = renderHook(({ k }) => useYaziyorTakip(k), { initialProps: { k: "k1" as string | null } });
    act(() => { result.current.kaydet("u2", "Enes", "k2"); });
    expect(result.current.metin).toBe("");
    rerender({ k: "k2" });
    expect(result.current.metin).toBe("Enes yazıyor…");
    rerender({ k: null });
    expect(result.current.metin).toBe("");
  });
});
