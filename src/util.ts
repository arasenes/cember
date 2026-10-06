export const EMOJILER = ["😀","😂","😍","🥳","😎","🤔","😢","😡","👍","👎","👏","🙏","🔥","❤️","🎉","💯","👀","🤝","🎮","🎧","☕","🍕","🌙","⭐"];
export const HIZLI_TEPKILER = ["👍","❤️","😂","🎉","🔥"];

export function saat(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
export function gunEtiketi(iso: string): string {
  const d = new Date(iso), bugun = new Date();
  const fark = Math.round((new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate()).getTime() -
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (fark === 0) return "Bugün";
  if (fark === 1) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}
export function bas(ad: string): string {
  return (ad.trim()[0] ?? "?").toLocaleUpperCase("tr-TR");
}
export function rolEtiketi(rol: "sahip" | "moderator" | "uye"): string {
  return rol === "sahip" ? "Oda sahibi" : rol === "moderator" ? "Moderatör" : "Üye";
}
