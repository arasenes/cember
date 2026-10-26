import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BirlikteIzle, { hesaplananKonum, youtubeIdCikar } from "./ses/BirlikteIzle";
import { efektCal, gecerliEfektMi, SES_EFEKTLERI } from "./ses/efektler";
import { dmResimCoz, SesliMesajOynatici, sesliMesajCoz } from "./mesaj/SesliMesaj";
import { duzMetin } from "./mesaj/markdown";
import Gate from "./Gate";

describe("1. Birlikte İzle (Watch Party)", () => {
  it("farklı YouTube bağlantı biçimlerinden video kimliğini çıkarır", () => {
    expect(youtubeIdCikar("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdCikar("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdCikar("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdCikar("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdCikar("https://ornek.com/video")).toBeNull();
  });

  it("oynayan ve duraklatılmış videonun senkronize saniyesini doğru hesaplar", () => {
    const t0 = 1_000_000;
    expect(hesaplananKonum({ videoId: "dQw4w9WgXcQ", baslatanId: "u1", baslangicSn: 30, oynuyor: true, guncelleme: t0 }, t0 + 12_500)).toBe(42);
    expect(hesaplananKonum({ videoId: "dQw4w9WgXcQ", baslatanId: "u1", baslangicSn: 30, oynuyor: false, guncelleme: t0 }, t0 + 12_500)).toBe(30);
  });

  it("YouTube bağlantısı girilip başlatıldığında durumu günceller", () => {
    const onDegistir = vi.fn();
    render(<BirlikteIzle durum={null} baslatanAd="" benId="u1" onDegistir={onDegistir} />);
    fireEvent.change(screen.getByLabelText("YouTube bağlantısı"), { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
    fireEvent.click(screen.getByText("Başlat"));
    expect(onDegistir).toHaveBeenCalledWith(expect.objectContaining({
      videoId: "dQw4w9WgXcQ",
      baslatanId: "u1",
      baslangicSn: 0,
      oynuyor: true,
    }));
  });
});

describe("2. Sesli Oda Efekt Paneli (Soundboard)", () => {
  it("6 ses efektini tanımlar ve doğrular", () => {
    expect(SES_EFEKTLERI).toHaveLength(6);
    for (const e of SES_EFEKTLERI) {
      expect(gecerliEfektMi(e.kod)).toBe(true);
    }
    expect(gecerliEfektMi("bilinmeyen")).toBe(false);
    expect(() => efektCal("zafer", true)).not.toThrow();
  });
});

describe("3 & 4. Sesli Mesaj ve DM Resim Çözümleme", () => {
  const ornekYol = "680ea57c-8b3e-4a57-b21c-ea7bcfd14659/11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.webp";

  it("sesli mesaj etiketini çözer ve oynatıcıyı gösterir", () => {
    const m = `[sesli:${ornekYol}|14]`;
    expect(sesliMesajCoz(m)).toEqual({ yol: ornekYol, sureSn: 14 });
    expect(duzMetin(m)).toBe("🎤 Sesli mesaj");
    render(<SesliMesajOynatici yol={ornekYol} sureSn={14} />);
    expect(screen.getByText(/0:14/)).toBeTruthy();
  });

  it("DM resim etiketini ve açıklamasını çözer", () => {
    const m = `[dmresim:${ornekYol}|800x600]\nMerhaba dünya`;
    expect(dmResimCoz(m)).toEqual({ yol: ornekYol, genislik: 800, yukseklik: 600, yazi: "Merhaba dünya" });
    expect(duzMetin(m)).toBe("🖼️ Merhaba dünya");
  });
});

describe("5. Gate Davet Karşılama Kartı", () => {
  it("bekleyen davet kodu varsa giriş ekranında davet kartını gösterir ve kaldırabilir", () => {
    sessionStorage.setItem("cember-davet", "ARKADAS1");
    render(<Gate onJoined={vi.fn()} />);
    expect(screen.getByText("Bir sunucuya davet edildin")).toBeTruthy();
    expect(screen.getByText("(ARKADAS1)")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Daveti kaldır"));
    expect(screen.queryByText("Bir sunucuya davet edildin")).toBeNull();
  });
});
