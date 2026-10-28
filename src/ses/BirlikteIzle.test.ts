import { describe, it, expect } from "vitest";
import { videoLinkiCoz, youtubeIdCikar, platformCikar, gomuluAdres } from "./BirlikteIzle";

describe("videoLinkiCoz", () => {
  it("https video adreslerini kabul eder", () => {
    expect(videoLinkiCoz("https://ornek.com/film.mp4")).toBe("https://ornek.com/film.mp4");
    expect(videoLinkiCoz("  https://cdn.ornek.com/a/b.webm?x=1  ")).toBe("https://cdn.ornek.com/a/b.webm?x=1");
  });
  it("http ve tehlikeli şemaları reddeder", () => {
    expect(videoLinkiCoz("http://ornek.com/film.mp4")).toBeNull();
    expect(videoLinkiCoz("javascript:alert(1)")).toBeNull();
    expect(videoLinkiCoz("data:video/mp4;base64,AAAA")).toBeNull();
    expect(videoLinkiCoz("file:///C:/film.mp4")).toBeNull();
    expect(videoLinkiCoz("blob:https://ornek.com/abc")).toBeNull();
  });
  it("kullanıcı bilgisi içeren, boş ya da çok uzun adresleri reddeder", () => {
    expect(videoLinkiCoz("https://kullanici:sifre@ornek.com/a.mp4")).toBeNull();
    expect(videoLinkiCoz("")).toBeNull();
    expect(videoLinkiCoz("not a url")).toBeNull();
    expect(videoLinkiCoz("https://ornek.com/" + "a".repeat(2000))).toBeNull();
  });
  it("YouTube ayrıştırması etkilenmez", () => {
    expect(youtubeIdCikar("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
});

describe("platformCikar", () => {
  it("Vimeo bağlantılarını çözer", () => {
    expect(platformCikar("https://vimeo.com/76979871")).toEqual({ tur: "vimeo", videoId: "76979871" });
    expect(platformCikar("https://player.vimeo.com/video/76979871")).toEqual({ tur: "vimeo", videoId: "76979871" });
    expect(platformCikar("https://vimeo.com/76979871/abcdef1234")).toEqual({ tur: "vimeo", videoId: "76979871/abcdef1234" });
  });
  it("Dailymotion bağlantılarını çözer", () => {
    expect(platformCikar("https://www.dailymotion.com/video/x8abc12")).toEqual({ tur: "dailymotion", videoId: "x8abc12" });
    expect(platformCikar("https://dai.ly/x8abc12")).toEqual({ tur: "dailymotion", videoId: "x8abc12" });
  });
  it("başka siteleri ve http'yi reddeder", () => {
    expect(platformCikar("https://evil.com/vimeo.com/123")).toBeNull();
    expect(platformCikar("http://vimeo.com/76979871")).toBeNull();
    expect(platformCikar("javascript:alert(1)")).toBeNull();
  });
});

describe("gomuluAdres", () => {
  it("geçerli kimliklerden adres üretir", () => {
    expect(gomuluAdres("vimeo", "76979871", 5)).toContain("player.vimeo.com/video/76979871");
    expect(gomuluAdres("dailymotion", "x8abc12", 0)).toContain("dailymotion.com/embed/video/x8abc12");
  });
  it("karşıdan gelen geçersiz kimliği reddeder", () => {
    expect(gomuluAdres("vimeo", "1\"onload=x", 0)).toBeNull();
    expect(gomuluAdres("dailymotion", "../../x", 0)).toBeNull();
    expect(gomuluAdres("youtube", "kisa", 0)).toBeNull();
  });
});
