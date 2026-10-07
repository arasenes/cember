import { beforeEach, describe, expect, it } from "vitest";
import { sonrakiTema, temaKaydet, temaTercihi, temaUygula } from "./tema";

describe("tema", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-theme"); });
  it("varsayılan otomatik", () => expect(temaTercihi()).toBe("otomatik"));
  it("gündüz ve gece öznitelik koyar, otomatik kaldırır", () => {
    temaUygula("gunduz"); expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    temaUygula("gece"); expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    temaUygula("otomatik"); expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
  it("kaydeder ve hatırlar", () => { temaKaydet("gece"); expect(temaTercihi()).toBe("gece"); });
  it("sırayla döner", () => { expect(sonrakiTema("otomatik")).toBe("gunduz"); expect(sonrakiTema("gunduz")).toBe("gece"); expect(sonrakiTema("gece")).toBe("otomatik"); });
});
