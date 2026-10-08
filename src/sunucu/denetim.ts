import { dilKodu, t } from "../i18n";
// Denetim kaydı satırlarını okunur cümlelere çevirir ve süzgeç kategorilerine ayırır.
export type DenetimSatiri = {
  id: number; oda_id: string; eyleyen: string | null; eylem: string; hedef: string | null; ayrinti: Record<string, unknown>; zaman: string;
};
export type DenetimSuzgeci = "tumu" | "mesajlar" | "uyeler" | "roller" | "kanallar" | "sunucu";

export const SUZGEC_ADLARI: Record<DenetimSuzgeci, string> = { tumu: t("Tümü"), mesajlar: t("Mesajlar"), uyeler: t("Üyeler"), roller: t("Roller"), kanallar: t("Kanallar"), sunucu: t("Sunucu") };

const KATEGORI: Record<string, DenetimSuzgeci> = {
  mesaj_sil: "mesajlar",
  sustur: "uyeler", sustur_kaldir: "uyeler", rol_degis: "uyeler", at: "uyeler", yasakla: "uyeler", yasak_kaldir: "uyeler", ses_at: "uyeler", ses_tasi: "uyeler", ses_sustur: "uyeler", ses_sustur_kaldir: "uyeler",
  rol_ver: "roller", rol_al: "roller", rol_olustur: "roller", rol_guncelle: "roller", rol_sil: "roller",
  kanal_ekle: "kanallar", kanal_sil: "kanallar", yavas_mod: "kanallar",
  davet_olustur: "sunucu", sunucu_ayar: "sunucu",
};
export const denetimKategorisi = (eylem: string): DenetimSuzgeci => KATEGORI[eylem] ?? "sunucu";
export const suzgecUyar = (s: DenetimSuzgeci, eylem: string) => s === "tumu" || denetimKategorisi(eylem) === s;

export type DenetimCumlesi = { eyleyen: string; once?: string; vurgu?: string; sonra: string };

/** "{eyleyen} [önce] [vurgu] sonra" biçiminde parçalar: arayüz eyleyeni ve vurguyu kalın gösterir. */
export function denetimCumlesi(k: DenetimSatiri, eyleyenAdi: string): DenetimCumlesi {
  const e = eyleyenAdi;
  const h = k.hedef ?? "";
  const a = k.ayrinti ?? {};
  const sn = Number(a.sn ?? 0);
  switch (k.eylem) {
    case "mesaj_sil": return { eyleyen: e, once: "", vurgu: h, sonra: t("kişisinin bir mesajını sildi") + (a.kanal ? ` (#${String(a.kanal)})` : "") };
    case "sustur": return { eyleyen: e, vurgu: h, sonra: t("kişisini susturdu") + (a.bitis ? ` (${t("{zaman}'e kadar", { zaman: new Date(String(a.bitis)).toLocaleString(dilKodu(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })})` : "") };
    case "sustur_kaldir": return { eyleyen: e, vurgu: h, sonra: t("kişisinin susturmasını kaldırdı") };
    case "rol_degis": return { eyleyen: e, vurgu: h, sonra: a.yeni === "moderator" ? t("kişisini moderatör yaptı") : t("kişisini moderatörlükten aldı") };
    case "rol_ver": return { eyleyen: e, vurgu: String(a.rol ?? ""), sonra: t("rolünü {h} kişisine verdi", { h }) };
    case "rol_al": return { eyleyen: e, vurgu: String(a.rol ?? ""), sonra: t("rolünü {h} kişisinden aldı", { h }) };
    case "rol_olustur": return { eyleyen: e, once: t("yeni rol oluşturdu:"), vurgu: h, sonra: "" };
    case "rol_guncelle": return { eyleyen: e, vurgu: h, sonra: t("rolünü güncelledi") };
    case "rol_sil": return { eyleyen: e, vurgu: h, sonra: t("rolünü sildi") };
    case "kanal_ekle": return { eyleyen: e, once: t("yeni kanal ekledi:"), vurgu: `#${h}`, sonra: "" };
    case "kanal_sil": return { eyleyen: e, once: t("bir kanalı sildi:"), vurgu: `#${h}`, sonra: "" };
    case "yavas_mod": return { eyleyen: e, once: sn > 0 ? t("yavaş modu {sn} sn yaptı", { sn }) : t("yavaş modu kapattı"), vurgu: "", sonra: `(#${h})` };
    case "davet_olustur": return { eyleyen: e, sonra: t("davet bağlantısı oluşturdu") };
    case "sunucu_ayar": return { eyleyen: e, sonra: t("sunucu ayarlarını değiştirdi") };
    case "at": return { eyleyen: e, vurgu: h, sonra: t("kişisini sunucudan attı") };
    case "yasakla": return { eyleyen: e, vurgu: h, sonra: t("kişisini yasakladı") };
    case "yasak_kaldir": return { eyleyen: e, sonra: t("bir yasağı kaldırdı") };
    case "ses_at": return { eyleyen: e, vurgu: h, sonra: t("kişisini sesli odadan çıkardı") };
    case "ses_tasi": return { eyleyen: e, vurgu: h, sonra: t("kişisini başka sesli odaya taşıdı") };
    case "ses_sustur": return { eyleyen: e, vurgu: h, sonra: t("kişisini sesli odada susturdu") };
    case "ses_sustur_kaldir": return { eyleyen: e, vurgu: h, sonra: t("kişisinin sesli oda susturmasını kaldırdı") };
    default: return { eyleyen: e, sonra: k.eylem };
  }
}

/** "Bugün 20:12", "Dün 23:05", "3 Ekim 22:08" */
export function denetimZamani(iso: string, simdi = new Date()): string {
  const d = new Date(iso);
  const gun = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const saat = d.toLocaleTimeString(dilKodu(), { hour: "2-digit", minute: "2-digit" });
  const fark = Math.round((gun(simdi) - gun(d)) / 86400000);
  if (fark === 0) return `${t("Bugün")} ${saat}`;
  if (fark === 1) return `${t("Dün")} ${saat}`;
  return `${d.toLocaleDateString(dilKodu(), { day: "numeric", month: "long" })} ${saat}`;
}
