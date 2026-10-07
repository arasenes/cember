export type Komut = { id: string; ad: string; tur: string; ikon: "hash" | "ses" | "sohbet" | "ara" | "ayar" | "kalkan" | "kullanici" | "grup"; calistir: () => void };

/** Türkçe harfleri sadeleştirip küçültür: "Şarkı" ile "sarki" eşleşsin. */
export function sadelestir(m: string): string {
  return m.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Sorguya göre süzer ve sıralar: baştan eşleşme > kelime başı > içinde geçen. Boş sorgu ilk `sinir` komutu döner. */
export function komutlariSuz(liste: Komut[], sorgu: string, sinir = 12): Komut[] {
  const q = sadelestir(sorgu);
  if (!q) return liste.slice(0, sinir);
  const puanli: { k: Komut; p: number }[] = [];
  for (const k of liste) {
    const ad = sadelestir(k.ad);
    let p = -1;
    if (ad.startsWith(q)) p = 0;
    else if (ad.split(/[\s#\-_.]+/).some((w) => w.startsWith(q))) p = 1;
    else if (ad.includes(q)) p = 2;
    if (p >= 0) puanli.push({ k, p });
  }
  return puanli.sort((a, b) => a.p - b.p || a.k.ad.localeCompare(b.k.ad, "tr")).slice(0, sinir).map((x) => x.k);
}
