import { useEffect, useState } from "react";
import Avatar from "../Avatar";
import { supabase } from "../supabase";
import type { Uye } from "../types";
import { denetimCumlesi, denetimZamani, SUZGEC_ADLARI, suzgecUyar, type DenetimSatiri, type DenetimSuzgeci } from "../sunucu/denetim";
import { SayfaBasligi } from "./ortak";
import { dilOku, t } from "../i18n";

/** Son denetim kayıtları; yeni kayıt gelince canlı eklenir. Yalnızca yetkililer görebilir (RLS). */
export function useDenetim(odaId: string, limit = 100) {
  const [satirlar, setSatirlar] = useState<DenetimSatiri[]>([]);
  const [yuklendi, setYuklendi] = useState(false);
  useEffect(() => {
    let iptal = false;
    supabase.from("denetim_kaydi").select("*").eq("oda_id", odaId).order("zaman", { ascending: false }).limit(limit).then(({ data }) => {
      if (iptal) return;
      setSatirlar((data ?? []) as DenetimSatiri[]);
      setYuklendi(true);
    });
    const k = supabase.channel(`denetim-${odaId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "denetim_kaydi", filter: `oda_id=eq.${odaId}` }, (p) => {
        const s = p.new as DenetimSatiri;
        setSatirlar((x) => (x.some((y) => y.id === s.id) ? x : [s, ...x].slice(0, limit)));
      })
      .subscribe();
    return () => { iptal = true; void supabase.removeChannel(k); };
  }, [odaId, limit]);
  return { satirlar, yuklendi };
}

type ListeProps = { satirlar: DenetimSatiri[]; uyeler: Uye[]; sinir?: number };

/** Denetim kaydı satırları: avatar, "<b>{t("eyleyen")}</b> <b>{t("vurgu")}</b> …" cümlesi ve zaman. */
export function DenetimListe({ satirlar, uyeler, sinir }: ListeProps) {
  const harita = new Map(uyeler.map((u) => [u.id, u]));
  const gosterilen = sinir ? satirlar.slice(0, sinir) : satirlar;
  if (!gosterilen.length) return <p className="hint">{t("Kayıt yok.")}</p>;
  return (
    <ul className="denetim-liste">
      {gosterilen.map((k) => {
        const e = k.eyleyen ? harita.get(k.eyleyen) : undefined;
        const c = denetimCumlesi(k, e?.takma_ad ?? t("Bir yönetici"));
        // Türkçe dışında cümle sırası (özne · hedef · eylem) farklı okunur: "Ayşe — Mehmet: susturuldu"
        const trDili = dilOku() === "tr";
        const ayirac = trDili ? "" : " —";
        const ayirac2 = trDili ? " " : ": ";
        return (
          <li key={k.id} className="denetim-satir">
            {e ? <Avatar uye={e} className="denetim-avatar" /> : <span className="denetim-avatar dot" aria-hidden="true">?</span>}
            <div>
              <b>{c.eyleyen}</b>{ayirac} {c.once && <>{c.once} </>}{c.vurgu && <b className="denetim-vurgu">{c.vurgu}</b>}{c.vurgu && c.sonra ? ayirac2 : " "}{c.sonra}
              <time dateTime={k.zaman}>{denetimZamani(k.zaman)}</time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SuzgecCipleri({ deger, onDegis }: { deger: DenetimSuzgeci; onDegis: (s: DenetimSuzgeci) => void }) {
  return (
    <div className="denetim-ciple" role="group" aria-label={t("Kayıt türü")}>
      {(Object.keys(SUZGEC_ADLARI) as DenetimSuzgeci[]).map((s) => (
        <button key={s} type="button" aria-pressed={deger === s} className={"ciple" + (deger === s ? " acik" : "")} onClick={() => onDegis(s)}>{SUZGEC_ADLARI[s]}</button>
      ))}
    </div>
  );
}

type Props = { odaId: string; uyeler: Uye[] };

export default function DenetimKaydi({ odaId, uyeler }: Props) {
  const { satirlar, yuklendi } = useDenetim(odaId);
  const [suzgec, setSuzgec] = useState<DenetimSuzgeci>("tumu");
  const liste = satirlar.filter((k) => suzgecUyar(suzgec, k.eylem));
  return (
    <div className="ayar-form">
      <SayfaBasligi baslik="Denetim kaydı" aciklama="Yöneticilerin yaptığı işlemler otomatik kaydedilir. Yalnızca yetkililer görür." />
      <SuzgecCipleri deger={suzgec} onDegis={setSuzgec} />
      {!yuklendi ? <p className="hint">{t("Yükleniyor…")}</p> : <DenetimListe satirlar={liste} uyeler={uyeler} />}
    </div>
  );
}
