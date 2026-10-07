import { useCallback, useEffect, useState } from "react";
import { supabase, SUPABASE_URL } from "../supabase";
import type { Kanal } from "../types";
import { BildirimSatiri, panoyaKopyala, rpcCagir, SayfaBasligi, useBildirim } from "./ortak";

type Webhook = { id: string; kanal_id: string; ad: string; olusturma: string };
type Props = { odaId: string; kanallar: Kanal[] };

/** curl örneği: şifre yalnızca oluşturulurken bir kez gösterilir. */
export function webhookOrnegi(id: string, sifre: string): string {
  return `curl -X POST ${SUPABASE_URL}/functions/v1/webhook \\\n  -H "Content-Type: application/json" \\\n  -d '{"id":"${id}","sifre":"${sifre}","icerik":"Merhaba!"}'`;
}

/** Webhook ve botlar: dış servislerin kanala mesaj göndermesi için adres + şifre üretir. */
export default function WebhookBotlar({ odaId, kanallar }: Props) {
  const yazili = kanallar.filter((k) => k.tur === "yazili");
  const [liste, setListe] = useState<Webhook[]>([]);
  const [ad, setAd] = useState("");
  const [kanal, setKanal] = useState(yazili[0]?.id ?? "");
  const [yeni, setYeni] = useState<{ id: string; sifre: string; ad: string } | null>(null);
  const { bildirim, mesgul, calistir } = useBildirim();

  const yukle = useCallback(async () => {
    const { data } = await supabase.from("webhooklar").select("id, kanal_id, ad, olusturma").eq("oda_id", odaId).order("olusturma", { ascending: false });
    if (data) setListe(data as Webhook[]);
  }, [odaId]);
  useEffect(() => { void yukle(); }, [yukle]);
  useEffect(() => { if (!kanal && yazili[0]) setKanal(yazili[0].id); }, [kanal, yazili]);

  async function olustur(e: React.FormEvent) {
    e.preventDefault();
    const ok = await calistir("Webhook oluşturuldu. Şifreyi şimdi kaydet; bir daha gösterilmez.", async () => {
      const { data, error } = await supabase.rpc("webhook_olustur", { p_kanal: kanal, p_ad: ad.trim() });
      if (error) return error.message;
      const s = (Array.isArray(data) ? data[0] : data) as { id: string; sifre: string } | null;
      if (s) setYeni({ id: s.id, sifre: s.sifre, ad: ad.trim() });
      setAd("");
      return null;
    });
    if (ok) await yukle();
  }
  const sil = (w: Webhook) => {
    if (!confirm(`"${w.ad}" webhook'u silinsin mi? Bu adrese gelen istekler artık çalışmaz.`)) return;
    void calistir("Webhook silindi.", async () => {
      const r = await rpcCagir("webhook_sil", { p_id: w.id });
      if (!r.hata) { await yukle(); if (yeni?.id === w.id) setYeni(null); }
      return r.hata;
    });
  };

  return (
    <div className="ayar-form">
      <SayfaBasligi baslik="Webhook ve botlar" aciklama="Webhook, dış bir servisin (GitHub, takvim, kendi betiğin) seçili kanala mesaj göndermesini sağlar. Mesajlar webhook adıyla, “bot” olarak görünür." />
      <form className="kanal-form" onSubmit={olustur}>
        <input type="text" value={ad} onChange={(e) => setAd(e.target.value)} maxLength={24} placeholder="Webhook adı" aria-label="Webhook adı" disabled={mesgul} />
        <select value={kanal} onChange={(e) => setKanal(e.target.value)} aria-label="Mesajın gideceği kanal" disabled={mesgul}>
          {yazili.map((k) => <option key={k.id} value={k.id}>#{k.ad}</option>)}
        </select>
        <button className="cta" type="submit" disabled={mesgul || ad.trim().length < 2 || !kanal}>Webhook oluştur</button>
      </form>
      <BildirimSatiri b={bildirim} />
      {yeni && (
        <div className="kart webhook-yeni" role="region" aria-label="Yeni webhook bilgileri">
          <b>{yeni.ad}</b>
          <p className="hint">Bu şifre bir daha gösterilmez; veritabanında yalnızca özeti saklanır. Örnek istek:</p>
          <pre className="md-blok"><code>{webhookOrnegi(yeni.id, yeni.sifre)}</code></pre>
          <button type="button" className="pk-btn" onClick={() => void panoyaKopyala(webhookOrnegi(yeni.id, yeni.sifre))}>Örneği kopyala</button>
        </div>
      )}
      <ul className="yon-liste">
        {liste.map((w) => (
          <li key={w.id} className="yon-uye">
            <div className="mem-ad"><b>{w.ad}</b><small>#{kanallar.find((k) => k.id === w.kanal_id)?.ad ?? "silinmiş kanal"} · {new Date(w.olusturma).toLocaleDateString("tr-TR")}</small></div>
            <button className="pk-btn tehlike" disabled={mesgul} onClick={() => sil(w)} aria-label={`${w.ad} webhook'unu sil`}>Sil</button>
          </li>
        ))}
        {!liste.length && <li className="hint">Henüz webhook yok.</li>}
      </ul>
    </div>
  );
}
