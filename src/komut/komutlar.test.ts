import { describe, expect, it } from "vitest";
import { komutlariSuz, sadelestir, type Komut } from "./komutlar";
import { cevir } from "../i18n";

const k = (id: string, ad: string): Komut => ({ id, ad, tur: "Kanal", ikon: "hash", calistir: () => {} });
const liste = [k("1", "genel"), k("2", "Şarkı önerileri"), k("3", "duyurular"), k("4", "oyun-genel")];

describe("komut paleti süzme", () => {
  it("Türkçe harfleri sadeleştirir", () => {
    expect(sadelestir("ŞARKI Ğ İ ı")).toBe("sarki g i i");
  });
  it("baştan eşleşme önce gelir, kelime başı sonra", () => {
    expect(komutlariSuz(liste, "gen").map((x) => x.id)).toEqual(["1", "4"]);
    expect(komutlariSuz(liste, "sarki")[0].id).toBe("2");
    expect(komutlariSuz(liste, "onerileri")[0].id).toBe("2");
  });
  it("boş sorgu hepsini (sınırlı) döner, eşleşmeyen boş döner", () => {
    expect(komutlariSuz(liste, "", 2)).toHaveLength(2);
    expect(komutlariSuz(liste, "zzz")).toEqual([]);
  });
});

describe("i18n", () => {
  it("eksik İngilizce anahtar Türkçeye düşer; İngilizce çevrilir", () => {
    expect(cevir("palet.bos", "tr")).toBe("Eşleşen sonuç yok");
    expect(cevir("palet.bos", "en")).toBe("No matching results");
  });
});
