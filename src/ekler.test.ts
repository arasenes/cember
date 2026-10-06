import { describe, expect, it } from "vitest";
import { boyutMetni, EkHatasi, ekYolu, gosterimBoyutu, olcekle, turKontrol, uzantiOf } from "./ekler";

describe("ekler", () => {
  it("büyük resmi oranı koruyarak en uzun kenara göre küçültür, küçüğe dokunmaz", () => {
    expect(olcekle(3200, 1600, 1600)).toEqual({ g: 1600, y: 800 });
    expect(olcekle(1000, 4000, 1600)).toEqual({ g: 400, y: 1600 });
    expect(olcekle(800, 600, 1600)).toEqual({ g: 800, y: 600 });
  });

  it("mesajdaki gösterim boyutu 360x320 kutusuna sığar ve en az 1 piksel kalır", () => {
    expect(gosterimBoyutu(1600, 800)).toEqual({ g: 360, y: 180 });
    expect(gosterimBoyutu(400, 1600)).toEqual({ g: 80, y: 320 });
    expect(gosterimBoyutu(100, 100)).toEqual({ g: 100, y: 100 });
    expect(gosterimBoyutu(10000, 1)).toEqual({ g: 360, y: 1 });
  });

  it("depolama yolu <oda>/<kanal>/<uuid>.<uzantı> biçimindedir ve veritabanı kalıbına uyar", () => {
    const u = "123e4567-e89b-12d3-a456-426614174000";
    const yol = ekYolu(u, u, u, "image/jpeg");
    expect(yol).toBe(`${u}/${u}/${u}.jpg`);
    const kalip = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|gif)$/;
    for (const t of ["image/webp", "image/jpeg", "image/png", "image/gif"]) expect(ekYolu(u, u, u, t)).toMatch(kalip);
    expect(uzantiOf("image/webp")).toBe("webp");
  });

  it("izin verilmeyen türleri (svg, pdf, html) ve çok büyük ya da boş dosyaları reddeder", () => {
    for (const tur of ["image/svg+xml", "application/pdf", "text/html", ""]) {
      expect(() => turKontrol({ type: tur, size: 1000 })).toThrow(EkHatasi);
    }
    expect(() => turKontrol({ type: "image/png", size: 26 * 1024 * 1024 })).toThrow(/25 MB/);
    expect(() => turKontrol({ type: "image/png", size: 0 })).toThrow(EkHatasi);
    expect(() => turKontrol({ type: "image/png", size: 2000 })).not.toThrow();
  });

  it("boyutu okunur yazar", () => {
    expect(boyutMetni(500)).toBe("1 KB");
    expect(boyutMetni(150 * 1024)).toBe("150 KB");
    expect(boyutMetni(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});
