import { describe, it, expect } from "vitest";
import { videoLinkiCoz, youtubeIdCikar } from "./BirlikteIzle";

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
