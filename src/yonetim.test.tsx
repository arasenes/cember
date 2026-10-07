import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Kanal, Uye } from "./types";

vi.mock("./supabase", () => {
  const o: Record<string, unknown> = {};
  for (const ad of ["select", "eq", "order"]) o[ad] = () => o;
  o.then = (r: (v: unknown) => unknown) => r({ data: [{ id: "y1", takma_ad: "Kötü", sebep: null, olusturma: "2026-01-01T00:00:00Z" }], error: null });
  return {
    SUPABASE_URL: "http://x", SUPABASE_KEY: "k",
    supabase: { from: () => o, rpc: async () => ({ data: "ABC-DEF", error: null }), auth: { getSession: async () => ({ data: { session: null } }) } },
  };
});

import YonetimPaneli, { islemYapabilir, susturulmus } from "./YonetimPaneli";

const u = (id: string, rol: Uye["rol"], ad = id): Uye => ({ id, oda_id: "o1", user_id: id, takma_ad: ad, renk: "#E8A33D", rol, son_gorulme: "", avatar_yol: null, hakkinda: null });
const kanallar: Kanal[] = [
  { id: "s1", oda_id: "o1", ad: "Sohbet", tur: "sesli", sira: 1 },
  { id: "s2", oda_id: "o1", ad: "Oyun", tur: "sesli", sira: 2 },
] as Kanal[];

describe("yetki kuralları", () => {
  it("sahip herkese (sahip hariç), moderatör yalnızca üyeye işlem yapar", () => {
    expect(islemYapabilir(u("a", "sahip"), u("b", "uye"))).toBe(true);
    expect(islemYapabilir(u("a", "sahip"), u("b", "moderator"))).toBe(true);
    expect(islemYapabilir(u("a", "moderator"), u("b", "uye"))).toBe(true);
    expect(islemYapabilir(u("a", "moderator"), u("b", "moderator"))).toBe(false);
    expect(islemYapabilir(u("a", "moderator"), u("b", "sahip"))).toBe(false);
    expect(islemYapabilir(u("a", "sahip"), u("a", "sahip"))).toBe(false);
  });
  it("susturma süresi", () => {
    expect(susturulmus({ susturma_bitis: null })).toBe(false);
    expect(susturulmus({ susturma_bitis: new Date(Date.now() + 60000).toISOString() })).toBe(true);
    expect(susturulmus({ susturma_bitis: new Date(Date.now() - 60000).toISOString() })).toBe(false);
  });
});

describe("YonetimPaneli", () => {
  const uyeler = [u("a", "sahip", "Ben"), u("b", "uye", "Ayşe"), u("c", "moderator", "Can")];
  const konum = new Map([["b", { kanal: "s1" }]]);

  it("sahip: yasakla, moderatör yap, ban listesi görünür", async () => {
    render(<YonetimPaneli ben={uyeler[0]} uyeler={uyeler} kanallar={kanallar} sesKonum={konum} cevrimici={new Set(["b"])} izin={511} />);
    expect(screen.getAllByRole("button", { name: "Yasakla" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Moderatör yap" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Moderatörlüğü al" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sesten at" })).toBeTruthy();
    expect(screen.getByLabelText("Ayşe kişisini başka sesli odaya taşı")).toBeTruthy();
    expect(await screen.findByText("Kötü")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kodu yenile" })).toBeNull();
  });

  it("moderatör: yasaklama ve rol verme yok; moderatöre işlem yok", () => {
    render(<YonetimPaneli ben={uyeler[2]} uyeler={uyeler} kanallar={kanallar} sesKonum={konum} cevrimici={new Set()} izin={447} />);
    expect(screen.queryByRole("button", { name: "Yasakla" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Moderatör/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Kodu yenile" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "At" })).toHaveLength(1);
  });
});
