import { dilKodu, t } from "./i18n";
export const EMOJILER = ["😀","😂","😍","🥳","😎","🤔","😢","😡","👍","👎","👏","🙏","🔥","❤️","🎉","💯","👀","🤝","🎮","🎧","☕","🍕","🌙","⭐"];
export const HIZLI_TEPKILER = ["👍","❤️","😂","🎉","🔥"];

export function saat(iso: string): string {
  return new Date(iso).toLocaleTimeString(dilKodu(), { hour: "2-digit", minute: "2-digit" });
}
export function gunEtiketi(iso: string): string {
  const d = new Date(iso), bugun = new Date();
  const fark = Math.round((new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate()).getTime() -
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (fark === 0) return t("Bugün");
  if (fark === 1) return t("Dün");
  return d.toLocaleDateString(dilKodu(), { day: "numeric", month: "long" });
}
export function bas(ad: string): string {
  return (ad.trim()[0] ?? "?").toLocaleUpperCase(dilKodu());
}
export function rolEtiketi(rol: "sahip" | "moderator" | "uye"): string {
  return rol === "sahip" ? t("Oda sahibi") : rol === "moderator" ? t("Moderatör") : t("Üye");
}
export const DURUM_BILGI = {
  cevrimici: { ad: t("Çevrimiçi"), renk: "var(--live)" },
  mesgul: { ad: t("Meşgul"), renk: "var(--acc)" },
  rahatsiz: { ad: t("Rahatsız etmeyin"), renk: "var(--danger)" },
} as const;
