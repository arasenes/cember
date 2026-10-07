import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { davetBaglantisi } from "../sunucu/sunucular";
import { BildirimSatiri, panoyaKopyala, rpcCagir, SayfaBasligi, useBildirim } from "./ortak";

export type Davet = { kod: string; oda_id: string; bitis: string | null; kullanim_limiti: number | null; kullanim: number; olusturma: string };

export const davetGecerliMi = (d: Davet, simdi = Date.now()) =>
  (!d.bitis || new Date(d.bitis).getTime() > simdi) && (d.kullanim_limiti === null || d.kullanim < d.kullanim_limiti);

export function davetEtiketleri(d: Davet, simdi = Date.now()): string[] {
  const e: string[] = [];
  if (!d.bitis) e.push("Süresiz");
  else {
    const kalan = new Date(d.bitis).getTime() - simdi;
    if (kalan <= 0) e.push("Süresi doldu");
    else if (kalan >= 86400000) e.push(`${Math.round(kalan / 86400000)} gün sonra biter`);
    else e.push(`${Math.max(1, Math.round(kalan / 3600000))} saat sonra biter`);
  }
  e.push(d.kullanim_limiti ? `En çok ${d.kullanim_limiti} kullanım` : "Sınırsız kullanım");
  e.push(`${d.kullanim} kullanıldı`);
  return e;
}

/** Davet listesi + oluşturma; yalnızca "davet" izni olanlar görür. */
export function useDavetler(odaId: string) {
  const [davetler, setDavetler] = useState<Davet[]>([]);
  const yukle = useCallback(async () => {
    const { data } = await supabase.from("davetler").select("*").eq("oda_id", odaId).order("olusturma", { ascending: false });
    if (data) setDavetler(data as Davet[]);
  }, [odaId]);
  useEffect(() => { void yukle(); }, [yukle]);
  return { davetler, yukle };
}

type Props = { odaId: string };

export default function Davetler({ odaId }: Props) {
  const { davetler, yukle } = useDavetler(odaId);
  const [gun, setGun] = useState<number | null>(7);
  const [limit, setLimit] = useState("");
  const { bildirim, mesgul, calistir } = useBildirim();

  async function olustur(e: React.FormEvent) {
    e.preventDefault();
    const sinir = limit.trim() ? Number(limit) : null;
    if (sinir !== null && (!Number.isInteger(sinir) || sinir < 1)) return;
    let kod = "";
    const ok = await calistir("Davet oluşturuldu.", async () => {
      const r = await rpcCagir("davet_olustur", { p_oda: odaId, p_gun: gun, p_limit: sinir });
      if (!r.hata) kod = String(r.veri);
      return r.hata;
    });
    if (ok) { setLimit(""); await yukle(); if (kod) void panoyaKopyala(davetBaglantisi(kod)); }
  }
  const sil = (d: Davet) => calistir("Davet silindi.", async () => {
    const r = await rpcCagir("davet_sil", { p_kod: d.kod });
    if (!r.hata) await yukle();
    return r.hata;
  });

  return (
    <div className="ayar-form">
      <SayfaBasligi baslik="Davetler" aciklama="Davet bağlantısıyla Google hesabı olan kişiler sunucuna katılır. Misafir hesaplar davetle katılamaz." />
      <form className="davet-olustur" onSubmit={olustur}>
        <div className="field">
          <label htmlFor="davet-gun">Süre</label>
          <select id="davet-gun" value={gun ?? ""} onChange={(e) => setGun(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="1">1 gün</option><option value="7">7 gün</option><option value="30">30 gün</option><option value="">Süresiz</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="davet-limit">Kullanım sınırı</label>
          <input id="davet-limit" type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Sınırsız" />
        </div>
        <button type="submit" className="cta" disabled={mesgul}>Davet oluştur</button>
      </form>
      <BildirimSatiri b={bildirim} />
      <ul className="davet-liste">
        {davetler.map((d) => {
          const baglanti = davetBaglantisi(d.kod);
          const gecerli = davetGecerliMi(d);
          return (
            <li key={d.kod} className={"davet-satir" + (gecerli ? "" : " bitti")}>
              <div className="davet-kutu" title={baglanti}>{baglanti}</div>
              <button type="button" className="cta" disabled={!gecerli} onClick={() => void panoyaKopyala(baglanti).then((ok) => calistir(ok ? "Bağlantı kopyalandı." : "Kopyalanamadı; bağlantıyı elle seç.", async () => (ok ? null : "Kopyalanamadı")))}>Kopyala</button>
              <button type="button" className="ib tehlike" disabled={mesgul} onClick={() => void sil(d)} aria-label={`${d.kod} davetini sil`}>Sil</button>
              <div className="davet-etiketler">{davetEtiketleri(d).map((t) => <span key={t}>{t}</span>)}</div>
            </li>
          );
        })}
        {!davetler.length && <li className="hint">Henüz davet yok.</li>}
      </ul>
    </div>
  );
}
