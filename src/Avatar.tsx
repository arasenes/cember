import { useEffect, useState, type ReactNode } from "react";
import { imzaliUrlAl, onbellekTemizle, onbellektenAl } from "./imzali";
import { bas } from "./util";
import type { Uye } from "./types";

function parlaklik(hex: string): number {
  const k = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(1 + i, 3 + i), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
}

/** Zeminle en yüksek kontrastı veren yazı rengi (beyaz ya da lacivert). */
export function yaziRengi(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#14213D";
  const z = parlaklik(hex), lacivert = parlaklik("#14213D");
  const beyazKontrast = 1.05 / (z + 0.05);
  const laciKontrast = (Math.max(z, lacivert) + 0.05) / (Math.min(z, lacivert) + 0.05);
  return beyazKontrast > laciKontrast ? "#FFFFFF" : "#14213D";
}

const BOT_HAYVAN: Record<string, string> = {
  pamuk: "🐰", zeytin: "🦉", boncuk: "🐱", fıstık: "🐿️", karamel: "🦊", mısır: "🐥", tarçın: "🐻", limon: "🐸",
};

/** Botlar için kendi renginde, yerelde çizilen avatar: adı tanınan botlara hayvan, diğerlerine robot yüzü (dış servis gerektirmez). */
export function botAvatarAdresi(renk: string, ad = ""): string {
  const r = /^#[0-9a-f]{6}$/i.test(renk) ? renk : "#6B7280";
  const hayvan = BOT_HAYVAN[ad.trim().toLocaleLowerCase("tr")];
  if (hayvan) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${r}"/>`
      + `<circle cx="32" cy="32" r="25" fill="#fff" fill-opacity=".28"/>`
      + `<text x="32" y="33" font-size="34" text-anchor="middle" dominant-baseline="central">${hayvan}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${r}"/>`
    + `<line x1="32" y1="10" x2="32" y2="17" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="9" r="3" fill="#fff"/>`
    + `<rect x="13" y="17" width="38" height="31" rx="9" fill="#fff"/>`
    + `<circle cx="24" cy="31" r="5" fill="${r}"/><circle cx="40" cy="31" r="5" fill="${r}"/>`
    + `<circle cx="25.5" cy="29.5" r="1.7" fill="#fff"/><circle cx="41.5" cy="29.5" r="1.7" fill="#fff"/>`
    + `<rect x="22" y="40" width="20" height="3.5" rx="1.75" fill="${r}"/>`
    + `<rect x="8" y="27" width="4" height="9" rx="2" fill="#fff"/><rect x="52" y="27" width="4" height="9" rx="2" fill="#fff"/></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

type Props = {
  uye?: Pick<Uye, "takma_ad" | "renk" | "avatar_yol"> & { bot?: boolean };
  /** Kaydedilmeden önce gösterilecek yerel önizleme (blob adresi). */
  onizleme?: string | null;
  className?: string;
  children?: ReactNode;
};

// Dekoratif: adı her zaman yanında yazılı olduğu için ekran okuyuculardan gizlenir.
export default function Avatar({ uye, onizleme, className = "", children }: Props) {
  const yol = uye?.avatar_yol ?? null;
  const [url, setUrl] = useState<string | null>(() => onbellektenAl("avatarlar", yol));
  const [bozuk, setBozuk] = useState(false);

  useEffect(() => {
    let iptal = false;
    setBozuk(false);
    if (!yol) { setUrl(null); return; }
    const hazir = onbellektenAl("avatarlar", yol);
    if (hazir) { setUrl(hazir); return; }
    setUrl(null);
    imzaliUrlAl("avatarlar", yol).then((u) => { if (!iptal) setUrl(u); });
    return () => { iptal = true; };
  }, [yol]);

  const renk = uye?.renk ?? "#999999";
  const adres = onizleme ?? (bozuk ? null : url) ?? (uye?.bot ? botAvatarAdresi(renk, uye.takma_ad) : null);
  return (
    <div className={("dot " + className).trim()} style={{ background: renk, color: yaziRengi(renk) }} aria-hidden="true">
      {adres ? (
        <img className="dot-img" src={adres} alt="" draggable={false}
          onError={() => { if (yol && !onizleme) { onbellekTemizle("avatarlar", yol); setBozuk(true); } }} />
      ) : bas(uye?.takma_ad ?? "?")}
      {children}
    </div>
  );
}
