export type Uye = {
  id: string; oda_id: string; user_id: string; takma_ad: string;
  renk: string; rol: "sahip" | "uye"; son_gorulme: string;
};
export type Kanal = { id: string; oda_id: string; ad: string; tur: "yazili" | "sesli"; sira: number };
export type Mesaj = {
  id: string; kanal_id: string; uye_id: string; metin: string;
  olusturma: string; duzenleme: string | null; silindi: boolean;
  ek_yol: string | null; ek_tur: string | null; ek_boyut: number | null; ek_genislik: number | null; ek_yukseklik: number | null;
};
export type Tepki = { id: string; mesaj_id: string; uye_id: string; emoji: string };
