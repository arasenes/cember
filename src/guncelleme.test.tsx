import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const durum = vi.hoisted(() => ({ app: true, kurulu: 3 }));
vi.mock("./ekranOrtak", () => ({
  uygulamaIci: () => durum.app,
  yerelEkran: () => ({ surum: async () => ({ kod: durum.kurulu, ad: "x" }) }),
}));

import { surumNo, yeniSurumVarMi } from "./guncelleme";
import GuncellemeBandi from "./GuncellemeBandi";

function surumCevabi(ad: string) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ name: ad }) })));
}

describe("güncelleme uyarısı", () => {
  beforeEach(() => { durum.app = true; durum.kurulu = 3; localStorage.clear(); });

  it("sürüm adından numara çıkarır", () => {
    expect(surumNo("Çember Android (test sürümü 12)")).toBe(12);
    expect(surumNo("sürüm yok")).toBeNull();
  });
  it("yeni sürüm varsa numarayı döner", async () => {
    surumCevabi("Çember Android (test sürümü 6)");
    expect(await yeniSurumVarMi()).toBe(6);
  });
  it("sürüm aynıysa ya da uygulama dışındaysak uyarmaz", async () => {
    surumCevabi("Çember Android (test sürümü 3)");
    expect(await yeniSurumVarMi()).toBeNull();
    durum.app = false;
    surumCevabi("Çember Android (test sürümü 9)");
    expect(await yeniSurumVarMi()).toBeNull();
  });
  it("şerit yeni sürümde görünür, 'Sonra' dedikten sonra aynı sürüm için gizlenir", async () => {
    surumCevabi("Çember Android (test sürümü 6)");
    const { unmount } = render(<GuncellemeBandi />);
    await waitFor(() => screen.getByText(/Yeni sürüm var/));
    screen.getByText("Sonra").click();
    await waitFor(() => expect(screen.queryByText(/Yeni sürüm var/)).toBeNull());
    unmount();
    render(<GuncellemeBandi />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/Yeni sürüm var/)).toBeNull();
  });
});
