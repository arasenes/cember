import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../supabase", () => ({ supabase: {} }));
import { anketGorunumu, oyUygula, type Anket } from "./anket";
import AnketKart from "./AnketKart";
import AnketOlustur, { taslakGecerli } from "./AnketOlustur";

const anket = (o: Partial<Anket> = {}): Anket => ({
  id: "a1", mesaj_id: "m1", soru: "Ne oynayalım?", bitis: null, coklu: false,
  secenekler: [{ id: "s1", metin: "Valorant", sira: 1 }, { id: "s2", metin: "CS", sira: 2 }],
  oylar: [], ...o,
});

describe("anket hesapları", () => {
  it("yüzdeleri oy kullanan kişi sayısına göre hesaplar", () => {
    const a = anket({ oylar: [{ uye_id: "u1", secenek_id: "s1" }, { uye_id: "u2", secenek_id: "s1" }, { uye_id: "u3", secenek_id: "s2" }, { uye_id: "u4", secenek_id: "s2" }] });
    const g = anketGorunumu(a, "u1");
    expect(g.toplamOy).toBe(4);
    expect(g.secenekler.map((s) => s.yuzde)).toEqual([50, 50]);
    expect(g.secenekler[0].benim).toBe(true);
    expect(g.secenekler[1].benim).toBe(false);
  });

  it("oysuz ankette yüzdeler 0, süresi geçmiş anket bitmiş sayılır", () => {
    expect(anketGorunumu(anket(), "u1").secenekler.every((s) => s.yuzde === 0)).toBe(true);
    expect(anketGorunumu(anket({ bitis: new Date(Date.now() - 1000).toISOString() }), "u1").bitti).toBe(true);
    expect(anketGorunumu(anket({ bitis: new Date(Date.now() + 60000).toISOString() }), "u1").bitti).toBe(false);
  });

  it("tek seçimli ankette yeni oy öncekini değiştirir, çoklu ankette eklenir, geri çekilebilir", () => {
    let a = oyUygula(anket(), "u1", "s1", true);
    a = oyUygula(a, "u1", "s2", true);
    expect(a.oylar).toEqual([{ uye_id: "u1", secenek_id: "s2" }]);
    let c = oyUygula(anket({ coklu: true }), "u1", "s1", true);
    c = oyUygula(c, "u1", "s2", true);
    expect(c.oylar).toHaveLength(2);
    c = oyUygula(c, "u1", "s1", false);
    expect(c.oylar).toEqual([{ uye_id: "u1", secenek_id: "s2" }]);
  });
});

describe("AnketKart", () => {
  it("seçeneğe tıklayınca oy verir; kendi oyuna tıklayınca geri çeker", async () => {
    const onOyla = vi.fn(async () => null);
    const { rerender } = render(<AnketKart anket={anket()} benUyeId="u1" onOyla={onOyla} onHata={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Valorant/ }));
    await waitFor(() => expect(onOyla).toHaveBeenCalledWith("s1", true));
    rerender(<AnketKart anket={anket({ oylar: [{ uye_id: "u1", secenek_id: "s1" }] })} benUyeId="u1" onOyla={onOyla} onHata={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Valorant/ }));
    await waitFor(() => expect(onOyla).toHaveBeenLastCalledWith("s1", false));
  });

  it("sona ermiş ankette seçenekler kapalıdır ve hata bildirilir", async () => {
    render(<AnketKart anket={anket({ bitis: new Date(Date.now() - 1000).toISOString() })} benUyeId="u1" onOyla={vi.fn()} onHata={vi.fn()} />);
    expect((screen.getByRole("button", { name: /Valorant/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Sona erdi/)).toBeTruthy();
  });

  it("sunucu hata dönerse onHata çağrılır", async () => {
    const onHata = vi.fn();
    render(<AnketKart anket={anket()} benUyeId="u1" onOyla={async () => "Oy verilemedi."} onHata={onHata} />);
    fireEvent.click(screen.getByRole("button", { name: /CS/ }));
    await waitFor(() => expect(onHata).toHaveBeenCalledWith("Oy verilemedi."));
  });
});

describe("AnketOlustur", () => {
  it("taslak doğrulaması", () => {
    expect(taslakGecerli({ soru: "", secenekler: ["a", "b"], sureDk: null, coklu: false })).toMatch(/Soru/);
    expect(taslakGecerli({ soru: "x", secenekler: ["a", ""], sureDk: null, coklu: false })).toMatch(/2 seçenek/);
    expect(taslakGecerli({ soru: "x", secenekler: ["a", "A"], sureDk: null, coklu: false })).toMatch(/Aynı/);
    expect(taslakGecerli({ soru: "x", secenekler: ["a", "b"], sureDk: null, coklu: false })).toBeNull();
  });

  it("formu doldurup gönderir, en fazla 6 seçenek eklenir", async () => {
    const onOlustur = vi.fn(async () => null);
    render(<AnketOlustur onOlustur={onOlustur} onKapat={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Soru"), { target: { value: "Pizza mı?" } });
    fireEvent.change(screen.getByLabelText("Seçenek 1"), { target: { value: "Evet" } });
    fireEvent.change(screen.getByLabelText("Seçenek 2"), { target: { value: "Hayır" } });
    for (let i = 0; i < 6; i++) { const b = screen.queryByRole("button", { name: /Seçenek ekle/ }); if (b) fireEvent.click(b); }
    expect(screen.getAllByLabelText(/^Seçenek \d$/)).toHaveLength(6);
    expect(screen.queryByRole("button", { name: /Seçenek ekle/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Anketi gönder" }));
    await waitFor(() => expect(onOlustur).toHaveBeenCalledWith({ soru: "Pizza mı?", secenekler: ["Evet", "Hayır"], sureDk: 1440, coklu: false }));
  });

  it("eksik formda hata gösterir ve göndermez", async () => {
    const onOlustur = vi.fn();
    render(<AnketOlustur onOlustur={onOlustur} onKapat={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Anketi gönder" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Soruyu yaz/);
    expect(onOlustur).not.toHaveBeenCalled();
  });
});
