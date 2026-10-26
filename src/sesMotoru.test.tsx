import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BaglanSonuc } from "./voice";

let p2pBaglanMock = vi.fn<(hedef: string) => Promise<BaglanSonuc>>();
let p2pAyrilMock = vi.fn(async () => {});
let p2pSessizAyarlaMock = vi.fn(async (_yeni: boolean) => {});

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
    sessizAyarla: (v: boolean) => p2pSessizAyarlaMock(v),
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

import { useSesMotoru } from "./sesMotoru";

describe("useSesMotoru doğrudan ses motoru", () => {
  beforeEach(() => {
    p2pBaglanMock = vi.fn(async () => ({ ok: true }));
    p2pAyrilMock = vi.fn(async () => {});
    p2pSessizAyarlaMock = vi.fn(async () => {});
  });

  it("LiveKit kotası olmadan doğrudan kendi P2P ses motorumuza bağlanır", async () => {
    const { result } = renderHook(() => useSesMotoru("u1", vi.fn()));

    await act(async () => {
      await result.current.baglan("kanal-1");
    });

    expect(p2pBaglanMock).toHaveBeenCalledWith("kanal-1");
    expect(result.current.hata).toBe("");
    expect(result.current.bilgi).toBe("");
  });

  it("mikrofon yoksa yalnızca dinleyici olarak bağlanır ve bilgi gösterir", async () => {
    p2pBaglanMock = vi.fn(async () => ({ ok: true, mikYok: true }));
    const { result } = renderHook(() => useSesMotoru("u1", vi.fn()));

    await act(async () => {
      await result.current.baglan("kanal-1");
    });

    expect(p2pBaglanMock).toHaveBeenCalledWith("kanal-1");
    expect(result.current.bilgi).toContain("dinleyici");
  });

  it("bağlantı hatasında anlaşılır hata mesajı gösterir", async () => {
    p2pBaglanMock = vi.fn(async () => ({ ok: false, neden: "ag", mesaj: "Sese bağlanılamadı." }));
    const { result } = renderHook(() => useSesMotoru("u1", vi.fn()));

    await act(async () => {
      await result.current.baglan("kanal-1");
    });

    expect(result.current.hata).toBe("Sese bağlanılamadı.");
  });

  it("sağırlaştır açıldığında mikrofonu kapatır, kapatıldığında önceki duruma döner", async () => {
    const { result } = renderHook(() => useSesMotoru("u1", vi.fn()));

    await act(async () => {
      await result.current.sagirDegistir();
    });
    expect(result.current.sagir).toBe(true);
    expect(p2pSessizAyarlaMock).toHaveBeenLastCalledWith(true);

    await act(async () => {
      await result.current.sagirDegistir();
    });
    expect(result.current.sagir).toBe(false);
    expect(p2pSessizAyarlaMock).toHaveBeenLastCalledWith(false);
  });
});
