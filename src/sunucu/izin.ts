import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { t } from "../i18n";

// İzin bitleri: sunucudaki 024_roller_izinler.sql ile aynı olmalı.
export const IZIN = { MESAJ_YAZ: 1, DOSYA: 2, SES_KONUS: 4, EKRAN_KAMERA: 8, MESAJ_YONET: 16, SUSTUR: 32, YASAKLA: 64, KANAL_YONET: 128, DAVET: 256 } as const;
export type IzinAdi = keyof typeof IZIN;
export const IZIN_TUMU = 511;
export const VARSAYILAN_HERKES = 15;
export const VARSAYILAN_MODERATOR = 447;

/** İzin editöründe gösterilen satırlar (tasarımdaki sıra ve açıklamalar). */
export const IZIN_SATIRLARI: { bit: number; ad: string; aciklama: string }[] = [
  { bit: IZIN.MESAJ_YAZ, ad: t("Mesaj yaz"), aciklama: t("Yazılı kanallarda mesaj gönderebilir") },
  { bit: IZIN.DOSYA, ad: t("Dosya ve resim ekle"), aciklama: t("Mesajlara dosya eklenebilir") },
  { bit: IZIN.SES_KONUS, ad: t("Sesli odada konuş"), aciklama: t("Mikrofon ve bas-konuş") },
  { bit: IZIN.EKRAN_KAMERA, ad: t("Ekran ve kamera paylaş"), aciklama: t("LiveKit yayını") },
  { bit: IZIN.MESAJ_YONET, ad: t("Mesajları yönet"), aciklama: t("Başkasının mesajını sil ve sabitle") },
  { bit: IZIN.SUSTUR, ad: t("Üyeleri sustur"), aciklama: t("Zaman aşımı ver, sesli odada sustur, odadan at") },
  { bit: IZIN.YASAKLA, ad: t("Üyeleri yasakla"), aciklama: t("Ad ve IP ile yasaklama") },
  { bit: IZIN.KANAL_YONET, ad: t("Kanalları yönet"), aciklama: t("Kanal ve kategori ekle, sil, sırala") },
  { bit: IZIN.DAVET, ad: t("Davet oluştur"), aciklama: t("Davet bağlantısı üretebilir") },
];

export const izinVar = (maske: number, bit: number): boolean => (maske & bit) !== 0;
/** Yönetim araçlarından (üye, kanal, davet) herhangi birine erişimi var mı? */
export const yonetimErisimi = (maske: number): boolean => (maske & (IZIN.MESAJ_YONET | IZIN.SUSTUR | IZIN.YASAKLA | IZIN.KANAL_YONET | IZIN.DAVET)) !== 0;
export const izinAc = (maske: number, bit: number, acik: boolean): number => (acik ? maske | bit : maske & ~bit) & IZIN_TUMU;

/** Veritabanı gelmeden önceki varsayım: yalnızca temel rolden. */
export function rolIzni(rol: "sahip" | "moderator" | "uye"): number {
  return rol === "sahip" ? IZIN_TUMU : rol === "moderator" ? VARSAYILAN_MODERATOR : VARSAYILAN_HERKES;
}

/** Benim bu sunucudaki etkin izin maskem; roller değişince canlı yenilenir. */
export function useIzinler(odaId: string, rol: "sahip" | "moderator" | "uye") {
  const [maske, setMaske] = useState(() => rolIzni(rol));
  const yenile = useCallback(async () => {
    const { data, error } = await supabase.rpc("izinlerim", { p_oda: odaId });
    if (!error && typeof data === "number") setMaske(data);
  }, [odaId]);
  useEffect(() => { setMaske(rolIzni(rol)); void yenile(); }, [odaId, rol, yenile]);
  useEffect(() => {
    const k = supabase.channel(`izin-${odaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "roller" }, () => void yenile())
      .on("postgres_changes", { event: "*", schema: "public", table: "uye_rolleri" }, () => void yenile())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "odalar" }, () => void yenile())
      .subscribe();
    return () => { void supabase.removeChannel(k); };
  }, [odaId, yenile]);
  return { maske, var: (bit: number) => izinVar(maske, bit), yonetim: yonetimErisimi(maske), yenile };
}
