import { describe, expect, it } from "vitest";
import { ipOzelMi, onizlemeCikar } from "../../supabase/functions/onizleme/saf";

describe("onizleme: özel adres engeli (SSRF)", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.5", "172.31.255.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1",
    "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::1",
  ])("%s özel sayılır", (ip) => expect(ipOzelMi(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "172.15.0.1", "93.184.216.34", "2606:4700:4700::1111"])("%s herkese açık sayılır", (ip) => expect(ipOzelMi(ip)).toBe(false));
});

describe("onizlemeCikar", () => {
  const sayfa = "https://ornek.com/yazi/1";

  it("Open Graph alanlarını okur, göreli resmi mutlak yapar", () => {
    const html = `<html><head><title>Eski</title>
      <meta property="og:title" content="Başlık &amp; Ek">
      <meta content="Kısa açıklama" property="og:description">
      <meta property="og:image" content="/kapak.png"><meta property="og:site_name" content="Örnek"></head></html>`;
    expect(onizlemeCikar(html, sayfa)).toEqual({ url: sayfa, baslik: "Başlık & Ek", aciklama: "Kısa açıklama", resim: "https://ornek.com/kapak.png", site: "Örnek" });
  });

  it("og yoksa <title>'a düşer, site adı olarak alan adını verir", () => {
    const o = onizlemeCikar("<title> Sadece Başlık </title>", sayfa)!;
    expect(o.baslik).toBe("Sadece Başlık");
    expect(o.site).toBe("ornek.com");
  });

  it("javascript:/data: resimleri kabul etmez", () => {
    const o = onizlemeCikar(`<meta property="og:title" content="x"><meta property="og:image" content="javascript:alert(1)">`, sayfa)!;
    expect(o.resim).toBeNull();
  });

  it("hiçbir bilgi yoksa null döner", () => {
    expect(onizlemeCikar("<html><body>merhaba</body></html>", sayfa)).toBeNull();
  });

  it("uzun metinleri keser", () => {
    const o = onizlemeCikar(`<meta property="og:title" content="${"a".repeat(500)}">`, sayfa)!;
    expect(o.baslik!.length).toBe(120);
  });
});
