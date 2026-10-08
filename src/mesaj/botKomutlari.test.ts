import { describe, expect, it } from "vitest";
import { komutOner } from "./botKomutlari";

describe("bot komut önerisi", () => {
  it("/ yazınca hepsi, harf yazdıkça süzülür", () => {
    expect(komutOner("/").length).toBe(7);
    expect(komutOner("/z").map((k) => k.ad)).toEqual(["/zar"]);
    expect(komutOner("/YA").map((k) => k.ad)).toEqual(["/yardim", "/yazitura"]);
  });
  it("normal metinde ve komuttan sonra (boşluk) öneri yok", () => {
    expect(komutOner("merhaba")).toEqual([]);
    expect(komutOner("/zar 20")).toEqual([]);
    expect(komutOner("selam /zar")).toEqual([]);
  });
});
