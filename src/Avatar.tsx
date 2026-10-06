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

type Props = {
  uye?: Pick<Uye, "takma_ad" | "renk" | "avatar_yol">;
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

  const adres = onizleme ?? (bozuk ? null : url);
  const renk = uye?.renk ?? "#999999";
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
