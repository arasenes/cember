import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { Kanal } from "../types";
import { BildirimSatiri, rpcCagir, SayfaBasligi, useBildirim } from "./ortak";

type Props = { odaId: string; kanallar: Kanal[]; duzenleyebilir: boolean };

/** Kelime listesini kutudan (satır ya da virgülle ayrılmış) diziye çevirir. */
export function kelimeleriAyir(metin: string): string[] {
  return [...new Set(metin.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean))];
}

/** Otomatik moderasyon: yasaklı kelimeler ve hoş geldin mesajı. (Yavaş mod kanal bazında, Kanallar sayfasındadır.) */
export default function OtomatikModerasyon({ odaId, kanallar, duzenleyebilir }: Props) {
  const [kelimeler, setKelimeler] = useState("");
  const [hosgeldin, setHosgeldin] = useState("");
  const [kanal, setKanal] = useState("");
  const [yuklendi, setYuklendi] = useState(false);
  const { bildirim, mesgul, calistir } = useBildirim();

  useEffect(() => {
    let iptal = false;
    supabase.from("odalar").select("yasakli_kelimeler, hosgeldin_mesaji, hosgeldin_kanal").eq("id", odaId).maybeSingle().then(({ data }) => {
      if (iptal || !data) return;
      const d = data as { yasakli_kelimeler: string[] | null; hosgeldin_mesaji: string | null; hosgeldin_kanal: string | null };
      setKelimeler((d.yasakli_kelimeler ?? []).join("\n"));
      setHosgeldin(d.hosgeldin_mesaji ?? "");
      setKanal(d.hosgeldin_kanal ?? "");
      setYuklendi(true);
    });
    return () => { iptal = true; };
  }, [odaId]);

  const liste = kelimeleriAyir(kelimeler);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    await calistir("Kaydedildi.", async () => (await rpcCagir("moderasyon_ayarla", { p_oda: odaId, p_kelimeler: liste, p_hosgeldin: hosgeldin.trim(), p_hosgeldin_kanal: kanal || null })).hata);
  }

  return (
    <form className="ayar-form" onSubmit={kaydet}>
      <SayfaBasligi baslik="Otomatik moderasyon" aciklama="Yasaklı kelimeler ve yeni üyeleri karşılayan mesaj. Mesaj yönetme izni olanlar filtreye takılmaz." />
      <div className="field">
        <label htmlFor="yasakli-kelimeler">Yasaklı kelimeler ({liste.length}/100)</label>
        <textarea id="yasakli-kelimeler" rows={6} value={kelimeler} disabled={!duzenleyebilir || !yuklendi} onChange={(e) => setKelimeler(e.target.value)} placeholder={"Her satıra bir kelime ya da virgülle ayır"} />
        <p className="hint">Yalnızca tam kelime eşleşir (“kötü” kelimesi “kötülük” içinde engellenmez); büyük/küçük harf ve Türkçe İ/ı farkı yok sayılır.</p>
      </div>
      <div className="field">
        <label htmlFor="hosgeldin-mesaji">Hoş geldin mesajı</label>
        <textarea id="hosgeldin-mesaji" rows={3} value={hosgeldin} maxLength={300} disabled={!duzenleyebilir || !yuklendi} onChange={(e) => setHosgeldin(e.target.value)} placeholder="Hoş geldin {ad}! Kuralları okumayı unutma." />
        <p className="hint">{"{ad}"} yeni üyenin adıyla değişir. Boş bırakırsan mesaj gönderilmez. Mesaj sunucu sahibi adına yazılır.</p>
      </div>
      <div className="field">
        <label htmlFor="hosgeldin-kanal">Hoş geldin kanalı</label>
        <select id="hosgeldin-kanal" value={kanal} disabled={!duzenleyebilir || !yuklendi} onChange={(e) => setKanal(e.target.value)}>
          <option value="">İlk yazılı kanal</option>
          {kanallar.filter((k) => k.tur === "yazili").map((k) => <option key={k.id} value={k.id}>#{k.ad}</option>)}
        </select>
      </div>
      <BildirimSatiri b={bildirim} />
      {duzenleyebilir ? <button type="submit" className="cta" disabled={mesgul || !yuklendi}>{mesgul ? "Kaydediliyor…" : "Kaydet"}</button>
        : <p className="hint">Bu ayarları yalnızca sunucu sahibi değiştirebilir.</p>}
    </form>
  );
}
