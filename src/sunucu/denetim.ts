// Denetim kaydı satırlarını okunur cümlelere çevirir ve süzgeç kategorilerine ayırır.
export type DenetimSatiri = {
  id: number; oda_id: string; eyleyen: string | null; eylem: string; hedef: string | null; ayrinti: Record<string, unknown>; zaman: string;
};
export type DenetimSuzgeci = "tumu" | "mesajlar" | "uyeler" | "roller" | "kanallar" | "sunucu";

export const SUZGEC_ADLARI: Record<DenetimSuzgeci, string> = { tumu: "Tümü", mesajlar: "Mesajlar", uyeler: "Üyeler", roller: "Roller", kanallar: "Kanallar", sunucu: "Sunucu" };

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
    case "mesaj_sil": return { eyleyen: e, once: "", vurgu: h, sonra: `kişisinin bir mesajını sildi${a.kanal ? ` (#${String(a.kanal)})` : ""}` };
    case "sustur": return { eyleyen: e, vurgu: h, sonra: `kişisini susturdu${a.bitis ? ` (${new Date(String(a.bitis)).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}'e kadar)` : ""}` };
    case "sustur_kaldir": return { eyleyen: e, vurgu: h, sonra: "kişisinin susturmasını kaldırdı" };
    case "rol_degis": return { eyleyen: e, vurgu: h, sonra: a.yeni === "moderator" ? "kişisini moderatör yaptı" : "kişisini moderatörlükten aldı" };
    case "rol_ver": return { eyleyen: e, vurgu: String(a.rol ?? ""), sonra: `rolünü ${h} kişisine verdi` };
    case "rol_al": return { eyleyen: e, vurgu: String(a.rol ?? ""), sonra: `rolünü ${h} kişisinden aldı` };
    case "rol_olustur": return { eyleyen: e, once: "yeni rol oluşturdu:", vurgu: h, sonra: "" };
    case "rol_guncelle": return { eyleyen: e, vurgu: h, sonra: "rolünü güncelledi" };
    case "rol_sil": return { eyleyen: e, vurgu: h, sonra: "rolünü sildi" };
    case "kanal_ekle": return { eyleyen: e, once: "yeni kanal ekledi:", vurgu: `#${h}`, sonra: "" };
    case "kanal_sil": return { eyleyen: e, once: "bir kanalı sildi:", vurgu: `#${h}`, sonra: "" };
    case "yavas_mod": return { eyleyen: e, once: sn > 0 ? `yavaş modu ${sn} sn yaptı` : "yavaş modu kapattı", vurgu: "", sonra: `(#${h})` };
    case "davet_olustur": return { eyleyen: e, sonra: "davet bağlantısı oluşturdu" };
    case "sunucu_ayar": return { eyleyen: e, sonra: "sunucu ayarlarını değiştirdi" };
    case "at": return { eyleyen: e, vurgu: h, sonra: "kişisini sunucudan attı" };
    case "yasakla": return { eyleyen: e, vurgu: h, sonra: "kişisini yasakladı" };
    case "yasak_kaldir": return { eyleyen: e, sonra: "bir yasağı kaldırdı" };
    case "ses_at": return { eyleyen: e, vurgu: h, sonra: "kişisini sesli odadan çıkardı" };
    case "ses_tasi": return { eyleyen: e, vurgu: h, sonra: "kişisini başka sesli odaya taşıdı" };
    case "ses_sustur": return { eyleyen: e, vurgu: h, sonra: "kişisini sesli odada susturdu" };
    case "ses_sustur_kaldir": return { eyleyen: e, vurgu: h, sonra: "kişisinin sesli oda susturmasını kaldırdı" };
    default: return { eyleyen: e, sonra: k.eylem };
  }
}

/** "Bugün 20:12", "Dün 23:05", "3 Ekim 22:08" */
export function denetimZamani(iso: string, simdi = new Date()): string {
  const d = new Date(iso);
  const gun = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const saat = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const fark = Math.round((gun(simdi) - gun(d)) / 86400000);
  if (fark === 0) return `Bugün ${saat}`;
  if (fark === 1) return `Dün ${saat}`;
  return `${d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} ${saat}`;
}
