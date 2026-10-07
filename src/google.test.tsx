import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("./supabase", () => ({
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_KEY: "k",
  supabase: { auth: { signInWithOAuth: vi.fn(), linkIdentity: vi.fn(), getUserIdentities: vi.fn(), getSession: vi.fn(), signOut: vi.fn() } },
}));
vi.mock("./ekranOrtak", () => ({ uygulamaIci: () => false }));

import Gate from "./Gate";
import KayitAdi from "./KayitAdi";
import { googleAcikMi, googleKullanicisi } from "./google";

beforeEach(() => { vi.restoreAllMocks(); });

describe("google", () => {
  it("ayar açıksa true, kapalıysa false döner", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true } }) }));
    expect(await googleAcikMi()).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: false } }) }));
    expect(await googleAcikMi()).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ağ")));
    expect(await googleAcikMi()).toBe(false);
  });
  it("googleKullanicisi kimliğe bakar", () => {
    expect(googleKullanicisi({ identities: [{ provider: "google" }] })).toBe(true);
    expect(googleKullanicisi({ identities: [{ provider: "email" }] })).toBe(false);
    expect(googleKullanicisi(null)).toBe(false);
  });
  it("Gate: Google açıkken düğmeyi gösterir, kapalıyken göstermez", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true } }) }));
    const { unmount } = render(<Gate onJoined={() => {}} />);
    expect(await screen.findByText("Google ile devam et")).toBeTruthy();
    unmount();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: false } }) }));
    render(<Gate onJoined={() => {}} />);
    await waitFor(() => expect(screen.queryByText("Google ile devam et")).toBeNull());
    expect(screen.getByLabelText("Davet kodu")).toBeTruthy();
  });
  it("KayitAdi: kısa takma adı reddeder", async () => {
    render(<KayitAdi onBitti={() => {}} />);
    (screen.getByText("Kayıt ol ve gir") as HTMLButtonElement).click();
    expect(await screen.findByText("Takma ad en az 2 harf olmalı.")).toBeTruthy();
  });
});
