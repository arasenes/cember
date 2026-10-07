/** Yalnızca GIF servislerinden gelen tek bir bağlantıdan oluşan mesaj GIF olarak gösterilir. */
const GIF_URL = /^https:\/\/(?:media\d*\.giphy\.com|i\.giphy\.com|media\.tenor\.com|c\.tenor\.com)\/\S+$/i;

export function gifUrlMi(metin: string): boolean {
  return GIF_URL.test(metin.trim());
}
