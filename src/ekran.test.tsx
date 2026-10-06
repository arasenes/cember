import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SesCubugu from "./SesCubugu";
import EkranPaneli from "./EkranPaneli";
import type { SesArayuzu } from "./sesMotoru";
import { ekranHatasi, ekranIstegi, KALITE } from "./ekranOrtak";

function ses(ek: Partial<SesArayuzu> = {}): SesArayuzu {
  return {
    durum: "bagli", kanalId: "k", sessiz: false, konusanlar: new Set(), kullanilan: null, motor: "livekit", hata: "", bilgi: "",
    kabiRefleri: [], izlenen: null, paylasiyorum: false, ekranDestegi: true,
    baglan: vi.fn(), ayril: vi.fn(), sessizDegistir: vi.fn(), hataTemizle: vi.fn(),
    ekranPaylas: vi.fn(async () => ({ ok: true })), ekranDurdur: vi.fn(async () => {}),
    ...ek,
  } as unknown as SesArayuzu;
}

describe("SesCubugu ekran paylaşımı", () => {
  it("seçilen kaliteyle paylaşımı başlatır", () => {
    const s = ses();
    render(<SesCubugu ses={s} kanalAdi="Sohbet" className="x" />);
    fireEvent.change(screen.getByLabelText("Ekran paylaşım kalitesi"), { target: { value: "1080" } });
    fireEvent.click(screen.getByText(/Ekranı paylaş/));
    expect(s.ekranPaylas).toHaveBeenCalledWith("1080");
  });

  it("varsayılan kalite tasarruflu 720p'dir", () => {
    const s = ses();
    render(<SesCubugu ses={s} kanalAdi="Sohbet" className="x" />);
    fireEvent.click(screen.getByText(/Ekranı paylaş/));
    expect(s.ekranPaylas).toHaveBeenCalledWith("720");
  });

  it("paylaşırken 'Paylaşımı durdur' gösterir ve durdurur", () => {
    const s = ses({ paylasiyorum: true });
    render(<SesCubugu ses={s} kanalAdi="Sohbet" className="x" />);
    expect(screen.queryByText(/Ekranı paylaş/)).toBeNull();
    fireEvent.click(screen.getByText(/Paylaşımı durdur/));
    expect(s.ekranDurdur).toHaveBeenCalled();
  });

  it("başkası paylaşırken paylaş düğmesi kapalıdır ve kimin paylaştığını söyler", () => {
    render(<SesCubugu ses={ses()} kanalAdi="Sohbet" className="x" baskasiPaylasiyor="Mehmet" />);
    expect((screen.getByText(/Ekranı paylaş/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Mehmet ekran paylaşıyor; bitince/)).toBeTruthy();
  });

  it("ekran paylaşamayan cihazda (telefon) paylaş düğmesi hiç görünmez", () => {
    render(<SesCubugu ses={ses({ ekranDestegi: false })} kanalAdi="Sohbet" className="x" />);
    expect(screen.queryByText(/Ekranı paylaş/)).toBeNull();
    expect(screen.getByText("🎙️ Sessize al")).toBeTruthy();
  });

  it("odada değilken hiçbir şey göstermez", () => {
    const { container } = render(<SesCubugu ses={ses({ durum: "kapali" })} kanalAdi="Sohbet" className="x" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("EkranPaneli", () => {
  it("yayını video öğesine bağlar ve paylaşanın adını gösterir", () => {
    const akis = {} as MediaStream;
    render(<EkranPaneli izlenen={{ uyeId: "u2", akis }} yapanAd="Mehmet" />);
    expect(screen.getByText("Mehmet")).toBeTruthy();
    const v = screen.getByLabelText("Mehmet ekran yayını") as HTMLVideoElement;
    expect(v.srcObject).toBe(akis);
    expect(v.controls).toBe(true);
  });
});

describe("ekranOrtak", () => {
  it("kullanıcı seçim penceresini kapatırsa hata mesajı üretmez", () => {
    expect(ekranHatasi({ name: "NotAllowedError" })).toEqual({ ok: false });
    expect(ekranHatasi({ name: "AbortError" })).toEqual({ ok: false });
    expect(ekranHatasi({ name: "TypeError" }).mesaj).toMatch(/paylaşılamadı/);
  });
  it("istek 30 kare/sn ister, ses ve kalite ayarını taşır", () => {
    const i = ekranIstegi("1080") as { video: { width: { ideal: number }; frameRate: { max: number } }; audio: unknown };
    expect(i.video.width.ideal).toBe(1920);
    expect(i.video.frameRate.max).toBe(30);
    expect(i.audio).toBeTruthy();
    expect(KALITE["720"].bitHizi).toBeLessThan(KALITE["1080"].bitHizi);
  });
});
