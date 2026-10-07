import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("./supabase", () => ({ supabase: { storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: null }) }) } } }));
import MessageView from "./MessageView";
import KatilimciSeridi from "./KatilimciSeridi";
import AyarlarDialog from "./AyarlarDialog";
import type { Mesaj, Uye } from "./types";

const uye: Uye = { id: "u1", oda_id: "o", user_id: "x", takma_ad: "Ayşe", renk: "#E8A33D", rol: "uye", son_gorulme: "" };
const m: Mesaj = { id: "m1", kanal_id: "k", uye_id: "u1", metin: "selam", olusturma: new Date().toISOString(), duzenleme: null, silindi: false, ek_yol: null, ek_tur: null, ek_boyut: null, ek_genislik: null, ek_yukseklik: null, sabit: false, sabit_zaman: null, ust_mesaj_id: null };

describe("yeni tasarım", () => {
  it("devam eden mesajda avatar gizlenir, ad ekran okuyucuya kalır", () => {
    const { container } = render(<MessageView devam mesaj={m} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} onProfil={vi.fn()} />);
    expect(container.querySelector(".dot")).toBeNull();
    expect(container.querySelector(".gutter-saat")).toBeTruthy();
    expect(container.querySelector(".mh.sr")).toBeTruthy();
  });
  it("araç çubuğundan tepki seçici açılır, konu butonu çalışır", () => {
    const onKonu = vi.fn();
    render(<MessageView mesaj={m} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} onKonu={onKonu} />);
    fireEvent.click(screen.getByRole("button", { name: "Konu aç ve yanıtla" }));
    expect(onKonu).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tepki ekle" }));
    expect(screen.getByRole("button", { name: "👍 ekle" })).toBeTruthy();
  });
  it("katılımcı şeridi konuşanı ve paylaşanı işaretler, Katıl çalışır", () => {
    const onKatil = vi.fn();
    const { container } = render(<KatilimciSeridi katilimcilar={[uye]} konusanlar={new Set(["u1"])} sorunlu={new Set()} paylasanlar={new Set(["u1"])}
      benimId="x" buradayim={false} baglaniyor={false} onKatil={onKatil} onProfil={vi.fn()} />);
    expect(container.querySelector(".karo.konusuyor.paylasiyor")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ayşe.*konuşuyor.*ekran paylaşıyor/ })).toBeTruthy();
    fireEvent.click(screen.getByText("Katıl"));
    expect(onKatil).toHaveBeenCalled();
  });
  it("ayarlar: tema, yazı boyutu ve ses seçimi geri bildirir", () => {
    const onTema = vi.fn(), onYazi = vi.fn(), onSesler = vi.fn();
    render(<AyarlarDialog tema="otomatik" onTema={onTema} yazi="orta" onYazi={onYazi} sesler={true} onSesler={onSesler} onKapat={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /Gündüz/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Büyük" }));
    fireEvent.click(screen.getByRole("switch"));
    expect(onTema).toHaveBeenCalledWith("gunduz");
    expect(onYazi).toHaveBeenCalledWith("buyuk");
    expect(onSesler).toHaveBeenCalledWith(false);
  });
});
