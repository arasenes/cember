import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaglanSonuc } from "./voice";

let lkBaglanMock = vi.fn<(hedef: string) => Promise<BaglanSonuc>>();
let lkAyrilMock = vi.fn(async () => {});
let p2pBaglanMock = vi.fn<(hedef: string) => Promise<BaglanSonuc>>();
let p2pAyrilMock = vi.fn(async () => {});
let sonOnKoptu: ((kanalId: string, neden: string) => void) | undefined;

vi.mock("./voice", () => ({
  useSes: (_uyeId: string, _onKanal: (k: string | null) => void, onKoptu?: (k: string, neden: string) => void) => {
    sonOnKoptu = onKoptu;
    return {
      durum: "kapali",
      kanalId: null,
      sessiz: false,
      konusanlar: new Set(),
      kullanilan: null,
      sesKabi: { current: null },
      baglan: (h: string) => lkBaglanMock(h),
      ayril: () => lkAyrilMock(),
      sessizDegistir: vi.fn(),
      sessizAyarla: vi.fn(),
      gurultuAyarla: vi.fn(),
      izlenen: null,
      paylasiyorum: false,
      kendiEkran: null,
      ekranPaylas: vi.fn(),
      ekranDurdur: vi.fn(),
      kameralar: new Map(),
      kameraAcik: false,
      kameraDegistir: vi.fn(),
    };
  },
}));

vi.mock("./p2p", () => ({
  useSesP2P: () => ({
    durum: "kapali",
    kanalId: null,
    sessiz: false,
    konusanlar: new Set(),
    sorunlu: new Set(),
    turnVar: true,
    sesKabi: { current: null },
    baglan: (h: string) => p2pBaglanMock(h),
    ayril: () => p2pAyrilMock(),
    sessizDegistir: vi.fn(),
    sessizAyarla: vi.fn(),
    gurultuAyarla: vi.fn(),
    izlenen: null,
    paylasiyorum: false,
    kendiEkran: null,
    ekranPaylas: vi.fn(),
    ekranDurdur: vi.fn(),
    kameralar: new Map(),
    kameraAcik: false,
    kameraDegistir: vi.fn(),
  }),
}));

import { useSesMotoru, type Motor } from "./sesMotoru";

describe("useSesMotoru kopma ve yeniden bağlanma", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    lkBaglanMock = vi.fn(async () => ({ ok: true }));
    lkAyrilMock = vi.fn(async () => {});
    p2pBaglanMock = vi.fn(async () => ({ ok: true }));
    p2pAyrilMock = vi.fn(async () => {});
    sonOnKoptu = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("anlık LiveKit kopmasında P2P'ye düşmeden önce LiveKit'e yeniden bağlanır", async () => {
    const motorSor = vi.fn<(k: string) => Motor | null>(() => "livekit");
    const { result } = renderHook(() => useSesMotoru("u1", vi.fn(), motorSor));

    act(() => {
      sonOnKoptu?.("kanal-1", "SIGNAL_CLOSE");
    });
    expect(result.current.bilgi).toContain("yeniden bağlanılıyor");
    expect(p2pBaglanMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });

    expect(lkBaglanMock).toHaveBeenCalledWith("kanal-1");
    expect(p2pBaglanMock).not.toHaveBeenCalled();
    expect(result.current.bilgi).toBe("");
  });

  it("odada başkaları LiveKit'teyken yeniden bağlanma başarısız olursa tek başına P2P'ye geçmez", async () => {
    lkBaglanMock = vi.fn(async () => ({ ok: false, neden: "ag", mesaj: "Ağ hatası" }));
    const motorSor = vi.fn<(k: string) => Motor | null>(() => "livekit");
    const { result } = renderHook(() => useSesMotoru("u1", vi.fn(), motorSor));

    act(() => {
      sonOnKoptu?.("kanal-1", "CONNECTION_TIMEOUT");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(lkBaglanMock).toHaveBeenCalledTimes(2);
    expect(p2pBaglanMock).not.toHaveBeenCalled();
    expect(result.current.hata).toContain("yeniden bağlanılamadı");
  });

  it("odada kimse LiveKit'te kalmadıysa veya kota dolduysa P2P'ye geçer ve mikrofonsuz dinleyici bilgisini korur", async () => {
    lkBaglanMock = vi.fn(async () => ({ ok: false, neden: "limit", mesaj: "Kota doldu" }));
    p2pBaglanMock = vi.fn(async () => ({ ok: true, mikYok: true }));
    const motorSor = vi.fn<(k: string) => Motor | null>(() => "livekit");
    const { result } = renderHook(() => useSesMotoru("u1", vi.fn(), motorSor));

    act(() => {
      sonOnKoptu?.("kanal-1", "UNKNOWN_REASON");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(lkBaglanMock).toHaveBeenCalledTimes(1);
    expect(p2pBaglanMock).toHaveBeenCalledWith("kanal-1");
    expect(result.current.bilgi).toContain("doğrudan moda geçiliyor");
    expect(result.current.bilgi).toContain("dinleyici");
  });

  it("yönetici odadan çıkardığında (PARTICIPANT_REMOVED) yeniden bağlanmaz ve P2P'ye geçmez", async () => {
    const motorSor = vi.fn<(k: string) => Motor | null>(() => null);
    const { result } = renderHook(() => useSesMotoru("u1", vi.fn(), motorSor));

    act(() => {
      sonOnKoptu?.("kanal-1", "PARTICIPANT_REMOVED");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(lkBaglanMock).not.toHaveBeenCalled();
    expect(p2pBaglanMock).not.toHaveBeenCalled();
    expect(result.current.bilgi).toContain("çıkardı");
  });
});
