export type Cikartma = {
  id: string;
  ad: string;
  kategori: "kedi" | "meme" | "oyun" | "tepki" | "ozel";
  url: string;
};

const HAZIR_CIKARTMALAR: Cikartma[] = [
  // Kediler & Sevimliler
  { id: "kedi-bongo", ad: "Bongo Kedi", kategori: "kedi", url: "https://media.tenor.com/D_i-B14J6LAAAAAM/bongo-cat.gif" },
  { id: "kedi-pop", ad: "Pop Kedi", kategori: "kedi", url: "https://media.tenor.com/qg9bK6Gj2x0AAAAM/pop-cat-cat.gif" },
  { id: "kedi-vibe", ad: "Vibe Cat", kategori: "kedi", url: "https://media.tenor.com/Z4qF25Lq9x0AAAAM/cat-vibing.gif" },
  { id: "kedi-mutlu", ad: "Mutlu Kedi", kategori: "kedi", url: "https://media.tenor.com/UfBw7sH3fV0AAAAM/happy-cat.gif" },
  { id: "kedi-saril", ad: "Kedi Sarılma", kategori: "kedi", url: "https://media.tenor.com/K_c3Nfx2aWAAAAAM/mochi-peach.gif" },

  // Memeler & Eğlence
  { id: "meme-pepe-dance", ad: "Pepe Dans", kategori: "meme", url: "https://media.tenor.com/rQdG2q21NPAAAAAM/pepe-dance.gif" },
  { id: "meme-pepe-hype", ad: "Pepe Hype", kategori: "meme", url: "https://media.tenor.com/K2y9E_7kRsoAAAAM/pepe-hype.gif" },
  { id: "meme-doge", ad: "Doge Dans", kategori: "meme", url: "https://media.tenor.com/4qj1Q_E0gT4AAAAM/doge-dance.gif" },
  { id: "meme-gigachad", ad: "Chad Gülüş", kategori: "meme", url: "https://media.tenor.com/e2oE7g8TzX0AAAAM/gigachad-chad.gif" },
  { id: "meme-sponge", ad: "SüngerBob Dans", kategori: "meme", url: "https://media.tenor.com/x8v1oNUOmg4AAAAM/spongebob-dance.gif" },

  // Oyun & Piksel
  { id: "oyun-gg", ad: "GG WP", kategori: "oyun", url: "https://media.tenor.com/9nF8fWz9XbAAAAAM/gg-good-game.gif" },
  { id: "oyun-kalp", ad: "Piksel Kalp", kategori: "oyun", url: "https://media.tenor.com/4b_15m24GfgAAAAM/pixel-heart.gif" },
  { id: "oyun-zafer", ad: "Zafer Kupası", kategori: "oyun", url: "https://media.tenor.com/r0jX5N1Q20YAAAAM/trophy-win.gif" },
  { id: "oyun-level", ad: "Level Up", kategori: "oyun", url: "https://media.tenor.com/PZ7s28yK7aEAAAAM/level-up.gif" },
  { id: "oyun-mario", ad: "Mario Dans", kategori: "oyun", url: "https://media.tenor.com/eZ3WkY7LwUIAAAAM/mario-dance.gif" },

  // Tepkiler & İfadeler
  { id: "tepki-ates", ad: "Alev Alev", kategori: "tepki", url: "https://media.tenor.com/uGzZ4Zq1U2EAAAAM/fire-flame.gif" },
  { id: "tepki-parti", ad: "Parti Konfeti", kategori: "tepki", url: "https://media.tenor.com/Fw5b9pP44ZcAAAAM/party-popper.gif" },
  { id: "tepki-alkis", ad: "Alkış", kategori: "tepki", url: "https://media.tenor.com/1G2wK3g8MlcAAAAM/applause-clapping.gif" },
  { id: "tepki-beyin", ad: "Şok / Beyin Yandı", kategori: "tepki", url: "https://media.tenor.com/z0m7E8H5hY4AAAAM/mind-blown.gif" },
  { id: "tepki-agla", ad: "Gözyaşı", kategori: "tepki", url: "https://media.tenor.com/eM2Zk6P3xGkAAAAM/crying-sad.gif" },
];

const OZEL_ANAHTAR = "cember_ozel_cikartmalar";

export function cikartmalariGetir(): Cikartma[] {
  const ozel = ozelCikartmalariGetir();
  return [...HAZIR_CIKARTMALAR, ...ozel];
}

export function ozelCikartmalariGetir(): Cikartma[] {
  try {
    const raw = localStorage.getItem(OZEL_ANAHTAR);
    if (!raw) return [];
    return JSON.parse(raw) as Cikartma[];
  } catch {
    return [];
  }
}

export function ozelCikartmaEkle(url: string, ad: string): Cikartma {
  const yeni: Cikartma = {
    id: "ozel-" + Date.now(),
    ad: ad.trim() || "Özel Çıkartma",
    kategori: "ozel",
    url: url.trim(),
  };
  const liste = ozelCikartmalariGetir();
  liste.unshift(yeni);
  try {
    localStorage.setItem(OZEL_ANAHTAR, JSON.stringify(liste.slice(0, 30)));
  } catch {
    /* yoksay */
  }
  return yeni;
}

export function ozelCikartmaSil(id: string): void {
  const liste = ozelCikartmalariGetir().filter((c) => c.id !== id);
  try {
    localStorage.setItem(OZEL_ANAHTAR, JSON.stringify(liste));
  } catch {
    /* yoksay */
  }
}

const CIKARTMA_REGEX = /^\[cikartma:(https?:\/\/[^\s|]+)\|([^\]]+)\]$/;

export function cikartmaCoz(metin: string): { url: string; ad: string } | null {
  const t = metin.trim();
  const m = CIKARTMA_REGEX.exec(t);
  if (!m) return null;
  return { url: m[1], ad: m[2] };
}

export function cikartmaMetni(url: string, ad: string): string {
  return `[cikartma:${url}|${ad}]`;
}
