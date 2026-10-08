import { describe, expect, it } from "vitest";
import { etiketParcala, etiketVar } from "./uyari";


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
});
