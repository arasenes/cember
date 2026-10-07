import type { Onizleme } from "../types";

function guvenliUrl(u: string | null): string | null {
  if (!u) return null;
  try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.toString() : null; } catch { return null; }
}

/** Mesajdaki bağlantının Open Graph kartı. */
export default function OnizlemeKarti({ o }: { o: Onizleme }) {
  const href = guvenliUrl(o.url);
  if (!href) return null;
  const resim = guvenliUrl(o.resim);
  return (
    <a className="onizleme" href={href} target="_blank" rel="noopener noreferrer nofollow">
      {resim && <img src={resim} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <span className="onizleme-yazi">
        {o.site && <span className="onizleme-site">{o.site}</span>}
        {o.baslik && <b className="onizleme-baslik">{o.baslik}</b>}
        {o.aciklama && <span className="onizleme-aciklama">{o.aciklama}</span>}
      </span>
    </a>
  );
}
