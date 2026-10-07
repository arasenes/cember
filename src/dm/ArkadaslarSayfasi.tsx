import { useState } from "react";
import Avatar from "../Avatar";
import type { Uye } from "../types";
import type { DmDurumu } from "./useDm";
import { durumMetni } from "./ProfilKarti";
import { t } from "../i18n";

type Sekme = "tum" | "bekleyen" | "engelli";
type Props = {
  dm: DmDurumu;
  benId: string;
  uyeler: Uye[];
  cevrimici: Set<string>;
  onMesaj: (uyeId: string) => void;
  onHata: (metin: string) => void;
  onBilgi: (metin: string) => void;
};

/** Arkadaşlar sayfası: Tümü / Bekleyen / Engellenen sekmeleri ve "Arkadaş ekle". */
export default function ArkadaslarSayfasi({ dm, benId, uyeler, cevrimici, onMesaj, onHata, onBilgi }: Props) {
  const [sekme, setSekme] = useState<Sekme>("tum");
  const [ara, setAra] = useState("");
  const harita = new Map(uyeler.map((u) => [u.id, u]));
  const diger = (r: { a: string; b: string }) => harita.get(r.a === benId ? r.b : r.a);
  const arkadaslar = dm.arkadasliklar.filter((r) => r.durum === "kabul");
  const gelen = dm.arkadasliklar.filter((r) => r.durum === "bekliyor" && r.b === benId);
  const giden = dm.arkadasliklar.filter((r) => r.durum === "bekliyor" && r.a === benId);
  const engelli = dm.arkadasliklar.filter((r) => r.durum === "engelli" && r.a === benId);
  const aday = ara.trim()
    ? uyeler.filter((u) => u.id !== benId && !u.silindi && dm.iliski(u.id) === "yok" && u.takma_ad.toLocaleLowerCase("tr").includes(ara.trim().toLocaleLowerCase("tr"))).slice(0, 8)
    : [];

  async function calistir(is: Promise<string | null>, basari?: string) {
    const h = await is;
    if (h) onHata(h); else if (basari) onBilgi(basari);
  }

  const sekmeler: { id: Sekme; ad: string; sayi?: number }[] = [
    { id: "tum", ad: "Tümü", sayi: arkadaslar.length },
    { id: "bekleyen", ad: "Bekleyen", sayi: gelen.length + giden.length },
    { id: "engelli", ad: "Engellenen", sayi: engelli.length },
  ];

  return (
    <section className="arkadaslar" aria-label={t("Arkadaşlar")}>
      <div className="head"><h2>{t("Arkadaşlar")}</h2></div>
      <div className="ark-icerik">
        <div role="tablist" aria-label={t("Arkadaş listesi")} className="ark-sekmeler">
          {sekmeler.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={sekme === s.id} className={"ark-sekme" + (sekme === s.id ? " acik" : "")} onClick={() => setSekme(s.id)}>
              {s.ad}{s.sayi ? ` (${s.sayi})` : ""}
            </button>
          ))}
        </div>

        <div className="field ark-ekle">
          <label htmlFor="ark-ara">{t("Arkadaş ekle")}</label>
          <input id="ark-ara" type="text" value={ara} onChange={(e) => setAra(e.target.value)} placeholder={t("Kullanıcı adı yaz…")} />
          {aday.length > 0 && (
            <ul className="ark-liste">
              {aday.map((u) => (
                <li key={u.id} className="ark-satir">
                  <Avatar uye={u} /><span className="ark-ad">{u.takma_ad}</span>
                  <button type="button" className="pk-btn" onClick={() => void calistir(dm.arkadasIstek(u.id).then((r) => r.hata), `${u.takma_ad} kişisine istek gönderildi`)}>{t("İstek gönder")}</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {sekme === "tum" && (
          <ul className="ark-liste" aria-label={t("Arkadaşlarım")}>
            {arkadaslar.map((r) => { const u = diger(r); if (!u) return null; return (
              <li key={r.id} className="ark-satir">
                <Avatar uye={u} /><span className="ark-ad">{u.takma_ad}<small>{durumMetni(u, cevrimici.has(u.id))}</small></span>
                <button type="button" className="pk-btn" onClick={() => onMesaj(u.id)}>{t("Mesaj")}</button>
                <button type="button" className="pk-btn" onClick={() => void calistir(dm.arkadasSil(u.id))}>{t("Çıkar")}</button>
              </li>
            ); })}
            {!arkadaslar.length && <li className="hint">{t("Henüz arkadaşın yok. Yukarıdan arayıp istek gönder ya da bir kişinin profilinden ekle.")}</li>}
          </ul>
        )}

        {sekme === "bekleyen" && (
          <>
            <h3 className="pk-baslik">Gelen istekler — {gelen.length}</h3>
            <ul className="ark-liste">
              {gelen.map((r) => { const u = harita.get(r.a); if (!u) return null; return (
                <li key={r.id} className="ark-satir">
                  <Avatar uye={u} /><span className="ark-ad">{u.takma_ad}</span>
                  <button type="button" className="pk-btn" onClick={() => void calistir(dm.arkadasYanit(r.id, true), `${u.takma_ad} ile arkadaş oldunuz`)}>{t("Kabul et")}</button>
                  <button type="button" className="pk-btn" onClick={() => void calistir(dm.arkadasYanit(r.id, false))}>{t("Reddet")}</button>
                </li>
              ); })}
              {!gelen.length && <li className="hint">{t("Bekleyen gelen istek yok.")}</li>}
            </ul>
            <h3 className="pk-baslik">Gönderilen istekler — {giden.length}</h3>
            <ul className="ark-liste">
              {giden.map((r) => { const u = harita.get(r.b); if (!u) return null; return (
                <li key={r.id} className="ark-satir">
                  <Avatar uye={u} /><span className="ark-ad">{u.takma_ad}</span>
                  <button type="button" className="pk-btn" onClick={() => void calistir(dm.arkadasSil(u.id))}>{t("Geri al")}</button>
                </li>
              ); })}
              {!giden.length && <li className="hint">{t("Gönderilmiş istek yok.")}</li>}
            </ul>
          </>
        )}

        {sekme === "engelli" && (
          <ul className="ark-liste" aria-label={t("Engellenenler")}>
            {engelli.map((r) => { const u = harita.get(r.b); if (!u) return null; return (
              <li key={r.id} className="ark-satir">
                <Avatar uye={u} /><span className="ark-ad">{u.takma_ad}</span>
                <button type="button" className="pk-btn" onClick={() => void calistir(dm.engelKaldir(u.id), `${u.takma_ad} engeli kaldırıldı`)}>{t("Engeli kaldır")}</button>
              </li>
            ); })}
            {!engelli.length && <li className="hint">{t("Kimseyi engellemedin.")}</li>}
          </ul>
        )}
      </div>
    </section>
  );
}
