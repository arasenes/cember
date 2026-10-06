import { describe, expect, it } from "vitest";
import { etiketParcala, etiketVar, kadinSesi, seslerAcik, seslerKaydet } from "./uyari";

const v = (name: string, lang = "tr-TR") => ({ name, lang }) as SpeechSynthesisVoice;

describe("uyarılar", () => {
  it("etiketi tanır (büyük/küçük harf, boşluklu ad, kelime sınırı)", () => {
    expect(etiketVar("selam @Aras nasılsın", "aras")).toBe(true);
    expect(etiketVar("@aras", "Aras")).toBe(true);
    expect(etiketVar("@Ali Veli gel", "Ali Veli")).toBe(true);
    expect(etiketVar("@arasx", "aras")).toBe(false);
    expect(etiketVar("mail@aras.com", "aras")).toBe(false);
    expect(etiketVar("aras", "aras")).toBe(false);
  });
  it("metni etiket parçalarına böler", () => {
    expect(etiketParcala("hey @aras bak", "aras")).toEqual([{ m: "hey ", etiket: false }, { m: "@aras", etiket: true }, { m: " bak", etiket: false }]);
    expect(etiketParcala("düz yazı", "aras")).toEqual([{ m: "düz yazı", etiket: false }]);
  });
  it("kadın Türkçe sesi seçer, erkeği eler", () => {
    expect(kadinSesi([v("Microsoft Tolga"), v("Microsoft Emel"), v("English", "en-US")])?.name).toBe("Microsoft Emel");
    expect(kadinSesi([v("Microsoft Tolga"), v("Yelda")])?.name).toBe("Yelda");
    expect(kadinSesi([v("English", "en-US")])).toBeNull();
  });
  it("ses tercihi saklanır, varsayılan açık", () => {
    localStorage.clear();
    expect(seslerAcik()).toBe(true);
    seslerKaydet(false);
    expect(seslerAcik()).toBe(false);
  });
});
