export type Durum = "cevrimici" | "mesgul" | "rahatsiz";
export type Uye = {
  id: string; oda_id: string; user_id: string | null; takma_ad: string; misafir?: boolean; silindi?: boolean;
  renk: string; rol: "sahip" | "moderator" | "uye"; son_gorulme: string; susturma_bitis?: string | null;
  avatar_yol?: string | null; hakkinda?: string | null; durum?: Durum; durum_metin?: string | null; bot?: boolean;
};
export type Kanal = { id: string; oda_id: string; ad: string; tur: "yazili" | "sesli"; sira: number; sifreli: boolean; aciklama: string | null; kategori_id?: string | null; yavas_mod?: number };
export type Kategori = { id: string; oda_id: string; ad: string; sira: number };
export type Mesaj = {
  id: string; kanal_id: string; uye_id: string; metin: string;
  olusturma: string; duzenleme: string | null; silindi: boolean;
  ek_yol: string | null; ek_tur: string | null; ek_boyut: number | null; ek_genislik: number | null; ek_yukseklik: number | null;
  sabit: boolean; sabit_zaman: string | null; ust_mesaj_id: string | null;
  yanit_id?: string | null; iletilen_ad?: string | null; onizleme?: Onizleme | null;
};
export type Onizleme = { url: string; baslik: string | null; aciklama: string | null; resim: string | null; site: string | null };
export type Tepki = { id: string; mesaj_id: string; uye_id: string; emoji: string };
