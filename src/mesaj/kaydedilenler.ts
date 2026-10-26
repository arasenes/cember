import { useCallback, useEffect, useState } from "react";

export type KaydedilenMesaj = {
  id: string;
  kanalId: string;
  kanalAdi: string;
  dmMi?: boolean;
  yazarAd: string;
  metin: string;
  olusturma: string;
  kaydedilme: string;
};

const MAX_KAYIT = 200;

function anahtar(uyeId: string): string {
  return `cember_kaydedilenler_${uyeId || "varsayilan"}`;
}

export function kaydedilenleriOku(uyeId: string): KaydedilenMesaj[] {
  try {
    const ham = localStorage.getItem(anahtar(uyeId));
    if (!ham) return [];
    const dizi = JSON.parse(ham);
    if (!Array.isArray(dizi)) return [];
    return dizi.filter((x) => x && typeof x.id === "string" && typeof x.metin === "string");
  } catch {
    return [];
  }
}

export function kaydedilenleriYaz(uyeId: string, liste: KaydedilenMesaj[]): void {
  try {
    localStorage.setItem(anahtar(uyeId), JSON.stringify(liste.slice(0, MAX_KAYIT)));
    window.dispatchEvent(new CustomEvent("cember-kaydedilenler-degisti", { detail: uyeId }));
  } catch {
    /* depolama doluysa yoksay */
  }
}

export function mesajKaydetDegistir(uyeId: string, oge: Omit<KaydedilenMesaj, "kaydedilme">): boolean {
  const mevcut = kaydedilenleriOku(uyeId);
  const varMi = mevcut.some((x) => x.id === oge.id);
  if (varMi) {
    kaydedilenleriYaz(uyeId, mevcut.filter((x) => x.id !== oge.id));
    return false;
  }
  const yeni: KaydedilenMesaj = { ...oge, kaydedilme: new Date().toISOString() };
  kaydedilenleriYaz(uyeId, [yeni, ...mevcut]);
  return true;
}

export function useKaydedilenler(uyeId: string) {
  const [liste, setListe] = useState<KaydedilenMesaj[]>(() => kaydedilenleriOku(uyeId));

  useEffect(() => {
    setListe(kaydedilenleriOku(uyeId));
    const dinle = () => setListe(kaydedilenleriOku(uyeId));
    window.addEventListener("cember-kaydedilenler-degisti", dinle);
    return () => window.removeEventListener("cember-kaydedilenler-degisti", dinle);
  }, [uyeId]);

  const degistir = useCallback((oge: Omit<KaydedilenMesaj, "kaydedilme">): boolean => {
    const eklendi = mesajKaydetDegistir(uyeId, oge);
    setListe(kaydedilenleriOku(uyeId));
    return eklendi;
  }, [uyeId]);

  const kaldir = useCallback((mesajId: string) => {
    const guncel = kaydedilenleriOku(uyeId).filter((x) => x.id !== mesajId);
    kaydedilenleriYaz(uyeId, guncel);
    setListe(guncel);
  }, [uyeId]);

  const kayitliIds = new Set(liste.map((x) => x.id));

  return { liste, kayitliIds, degistir, kaldir };
}
