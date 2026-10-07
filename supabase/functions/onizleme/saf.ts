// Saf (ağsız) yardımcılar: birim testleri için ayrı dosyada.
function ipv4Ozel(a: number[]): boolean {
  const [x, y] = a;
  return x === 0 || x === 10 || x === 127 || x >= 224
    || (x === 100 && y >= 64 && y <= 127) || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31)
    || (x === 192 && y === 168) || (x === 192 && y === 0 && a[2] === 0) || (x === 198 && (y === 18 || y === 19));
}
export function ipOzelMi(ip: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) return ipv4Ozel(v4.slice(1).map(Number));
  const s = ip.toLowerCase();
  const eslenik = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (eslenik) return ipOzelMi(eslenik[1]);
  if (s === "::" || s === "::1" || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe8") || s.startsWith("fe9")
    || s.startsWith("fea") || s.startsWith("feb") || s.startsWith("ff") || s.startsWith("64:ff9b") || s.startsWith("::ffff:")) return true;
  return false;
}

export function metaOku(html: string, ...adlar: string[]): string | null {
  for (const ad of adlar) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${ad}["'][^>]*content=["']([^"']*)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${ad}["']`, "i");
    const m = re1.exec(html) ?? re2.exec(html);
    if (m?.[1]) return m[1];
  }
  return null;
}
export const coz = (s: string | null, max: number) =>
  s ? s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim().slice(0, max) || null : null;

export function onizlemeCikar(html: string, sayfaUrl: string) {
  const baslik = coz(metaOku(html, "og:title", "twitter:title") ?? /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? null, 120);
  const aciklama = coz(metaOku(html, "og:description", "twitter:description", "description"), 240);
  const site = coz(metaOku(html, "og:site_name"), 60) ?? new URL(sayfaUrl).hostname;
  let resim: string | null = null;
  const r = metaOku(html, "og:image", "twitter:image");
  if (r) {
    try {
      const ru = new URL(coz(r, 500) ?? "", sayfaUrl);
      if (ru.protocol === "https:" || ru.protocol === "http:") resim = ru.toString();
    } catch { /* geçersiz */ }
  }
  if (!baslik && !aciklama && !resim) return null;
  return { url: sayfaUrl, baslik, aciklama, resim, site };
}

