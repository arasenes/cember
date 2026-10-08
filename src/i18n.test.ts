import { describe, expect, it } from "vitest";
import { cevir, cihazDili, DILLER, t } from "./i18n";
import { SATIRLAR } from "./i18n.sozluk";

describe("çok dilli altyapı", () => {
  it("8 dil; her sözlük satırında 8 sütun ve boş çeviri yok", () => {
    expect(DILLER.map((d) => d.id)).toEqual(["tr", "en", "de", "ar", "ru", "az", "fr", "es"]);
    for (const s of SATIRLAR) {
      expect(s.length, s[0]).toBe(8);
      s.forEach((c, i) => expect(c.length > 0, `${s[0]} [${i}]`).toBe(true));
    }
  });
  it("Türkçe metin aynen döner; değişkenler doldurulur", () => {
    expect(t("Kapat", undefined, "tr")).toBe("Kapat");
    expect(t("{a} yazıyor…", { a: "Ali" }, "tr")).toBe("Ali yazıyor…");
  });
  it("her dilde çevirir; yer tutucular korunur; bilinmeyen metin Türkçe kalır", () => {
    expect(t("Kapat", undefined, "en")).toBe("Close");
    expect(t("Kapat", undefined, "de")).toBe("Schließen");
    expect(t("Kapat", undefined, "ar")).toBe("إغلاق");
    expect(t("Kapat", undefined, "ru")).toBe("Закрыть");
    expect(t("Kapat", undefined, "az")).toBe("Bağla");
    expect(t("Kapat", undefined, "fr")).toBe("Fermer");
    expect(t("Kapat", undefined, "es")).toBe("Cerrar");
    expect(t("{a} yazıyor…", { a: "Ali" }, "de")).toBe("Ali schreibt…");
    expect(t("Tabloda olmayan bir cümle", undefined, "de")).toBe("Tabloda olmayan bir cümle");
  });
  it("birleştirilmiş Türkçe metin desenle eşleşip çevrilir (kanal adı yakalanır)", () => {
    expect(t("\"genel\" kategorisi açıldı.", undefined, "en")).toBe('Category "genel" was created.');
    expect(t("Mesaj 1-4000 karakter olmalı.", undefined, "fr")).toBe("Le message doit contenir de 1 à 4000 caractères.");
    expect(t("Ali artık moderatör.", undefined, "es")).toBe("Ali ahora es moderador.");
  });
  it("eski anahtarlı metinler ve test ortamında varsayılan Türkçe", () => {
    expect(cevir("palet.bos", "en")).toBe("No matching results");
    expect(cevir("palet.bos", "de")).toBe("Keine passenden Ergebnisse");
    expect(cihazDili()).toMatch(/^(tr|en|de|ar|ru|az|fr|es)$/);
  });
});
