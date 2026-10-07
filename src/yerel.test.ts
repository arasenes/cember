import { beforeEach, describe, expect, it } from "vitest";
import { katlanmisOku, katlanmisYaz, okunduOku, okunduYaz, sirala, yaziBoyutuKaydet, yaziBoyutuOku } from "./yerel";

describe("yerel tercihler", () => {
  beforeEach(() => localStorage.clear());
  it("okundu ve katlanmış kaydeder", () => {
    okunduYaz({ a: "2026-01-01" }); expect(okunduOku()).toEqual({ a: "2026-01-01" });
    katlanmisYaz(["x"]); expect(katlanmisOku()).toEqual(["x"]);
  });
  it("bozuk kayıtta varsayılana döner", () => { localStorage.setItem("cember-katlanmis", "{bozuk"); expect(katlanmisOku()).toEqual([]); });
  it("sırayı uygular, bilinmeyenleri sona atar", () => {
    const l = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(sirala(l, ["c", "a"]).map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(sirala(l, undefined)).toBe(l);
  });
  it("yazı boyutunu uygular", () => {
    expect(yaziBoyutuOku()).toBe("orta");
    yaziBoyutuKaydet("buyuk"); expect(yaziBoyutuOku()).toBe("buyuk");
    expect(document.documentElement.getAttribute("data-yazi")).toBe("buyuk");
  });
});
