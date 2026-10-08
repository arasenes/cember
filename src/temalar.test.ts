import { beforeEach, describe, expect, it } from "vitest";
import { TEMALAR, VARSAYILAN_TEMA, temaKaydet, temaOku, temaUygula } from "./temalar";

describe("palet seçici", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-tema"); });
  it("10 palet; açık olanlar açık işaretli; varsayılan Kömür ve Turuncu", () => {
    expect(TEMALAR).toHaveLength(10);
    expect(TEMALAR.filter((t) => t.acik).map((t) => t.id)).toEqual(["acik-tema", "acik-mercan"]);
    expect(VARSAYILAN_TEMA).toBe("komur-turuncu");
    expect(temaOku()).toBe("komur-turuncu");
  });
  it("varsayılan dışında data-tema koyar, varsayılanda kaldırır; açık palet color-scheme light", () => {
    temaUygula("mor-gece");
    expect(document.documentElement.getAttribute("data-tema")).toBe("mor-gece");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    temaUygula("acik-tema");
    expect(document.documentElement.style.colorScheme).toBe("light");
    temaUygula("komur-turuncu");
    expect(document.documentElement.hasAttribute("data-tema")).toBe(false);
  });
  it("kaydeder, hatırlar; geçersiz ya da eski değeri yok sayar", () => {
    temaKaydet("derin-mavi");
    expect(temaOku()).toBe("derin-mavi");
    localStorage.setItem("cember-tema", "gece");
    expect(temaOku()).toBe("komur-turuncu");
  });
});
