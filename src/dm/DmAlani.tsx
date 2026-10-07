import { useMemo, useState } from "react";
import Avatar from "../Avatar";
import Ikon from "../mesaj/Ikon";
import type { Uye } from "../types";
import { DURUM_BILGI, gunEtiketi, saat } from "../util";
import ArkadaslarSayfasi from "./ArkadaslarSayfasi";
import DmSohbet from "./DmSohbet";
import ProfilKarti from "./ProfilKarti";
import YeniGrupDialog from "./YeniGrupDialog";
import { dmBasligi, karsiUye } from "./tipler";
import type { DmDurumu } from "./useDm";
import { t } from "../i18n";

export type DmSayfa = "arkadaslar" | "sohbet";

type Props = {
  dm: DmDurumu;
  me: Uye;
  uyeler: Uye[];
  cevrimici: Set<string>;
  bosta: Set<string>;
  aktifDm: string | null;
  sayfa: DmSayfa;
  onSec: (dmId: string) => void;
  onArkadaslar: () => void;
  onSunucuya: () => void;
  onProfil: (uyeId: string) => void;
  onHata: (metin: string) => void;
  onBilgi: (metin: string) => void;
  /** Sesli odadaysak sunucu görünümüne dönüş için kısa bilgi. */
  sesBilgisi?: string | null;
  /** Dar ekranda hangi bölme görünür (Chat, #app[data-pane] için kullanır). */
  mobil: "liste" | "icerik";
  onMobil: (m: "liste" | "icerik") => void;
};

function zamanMetni(iso: string): string {
  const g = gunEtiketi(iso);
  return g === "Bugün" ? saat(iso) : g;
}

/** DM görünümü: sol liste (arama, arkadaşlar, DM'ler), orta sohbet ya da arkadaşlar sayfası, sağ profil kartı. */
export default function DmAlani({ dm, me, uyeler, cevrimici, bosta, aktifDm, sayfa, onSec, onArkadaslar, onSunucuya, onProfil, onHata, onBilgi, sesBilgisi, mobil, onMobil }: Props) {
  const [ara, setAra] = useState("");
  const [grupAcik, setGrupAcik] = useState(false);
  const setMobil = onMobil;
  const harita = useMemo(() => new Map(uyeler.map((u) => [u.id, u])), [uyeler]);
  const q = ara.trim().toLocaleLowerCase("tr");

  const dmler = useMemo(() => dm.kanallar.map((k) => ({ k, baslik: dmBasligi(k, dm.uyeleri, harita, me.id) }))
    .filter((x) => !q || x.baslik.toLocaleLowerCase("tr").includes(q)), [dm.kanallar, dm.uyeleri, harita, me.id, q]);

  const aktifKanal = dm.kanallar.find((k) => k.id === aktifDm);
  const karsi = aktifKanal ? karsiUye(aktifKanal, dm.uyeleri, me.id) : null;
  const profilUye = sayfa === "sohbet" && karsi ? harita.get(karsi) : undefined;

  function sec(id: string) { onSec(id); setMobil("icerik"); }

  async function eylem(is: Promise<string | null>) { const h = await is; if (h) onHata(h); }

  return (
    <>
      <section className="col side dm-liste" aria-label={t("Özel mesajlar")}>
        <div className="head dm-ust">
          <h1 className="sr">{t("Özel mesajlar")}</h1>
          <button type="button" className="head-dugme" onClick={onSunucuya}><Ikon ad="geri" boyut={16} />{" "}{t("Çember")}</button>
        </div>
        {sesBilgisi && <div className="banner" role="status">{sesBilgisi}</div>}
        <div className="dm-ara">
          <label className="dm-ara-kutu">
            <Ikon ad="ara" boyut={16} />
            <input id="dm-ara" type="text" value={ara} onChange={(e) => setAra(e.target.value)} placeholder={t("Sohbet bul veya başlat")} aria-label={t("Mesajlarda kişi ara")} />
          </label>
        </div>
        <nav className="scroll" aria-label={t("Özel mesaj listesi")}>
          <button type="button" className={"dm-satir" + (sayfa === "arkadaslar" ? " aktif" : "")} onClick={() => { onArkadaslar(); setMobil("icerik"); }}>
            <span className="dm-ikon"><Ikon ad="kullanici" /></span>
            <span className="dm-ad">{t("Arkadaşlar")}</span>
            {dm.gelenIstekler.length > 0 && <span className="rozet rozet-istek" aria-label={`${dm.gelenIstekler.length} bekleyen istek`}>{dm.gelenIstekler.length} istek</span>}
          </button>
          <div className="sec dm-sec">
            <span>{t("Özel mesajlar")}</span>
            <button type="button" className="cb-ibtn dm-yeni" onClick={() => setGrupAcik(true)} aria-label={t("Yeni grup mesajı")} title={t("Yeni grup mesajı")}><Ikon ad="artir" /></button>
          </div>
          {dmler.map(({ k, baslik }) => {
            const kisi = k.tur === "ikili" ? harita.get(karsiUye(k, dm.uyeleri, me.id) ?? "") : undefined;
            const n = dm.okunmamis[k.id] ?? 0;
            return (
              <button key={k.id} type="button" className={"dm-satir" + (sayfa === "sohbet" && aktifDm === k.id ? " aktif" : "") + (n ? " okunmamis" : "")} onClick={() => sec(k.id)}>
                {n > 0 && <span className="sr">{n} okunmamış mesaj, </span>}
                {k.tur === "ikili" && kisi
                  ? <span className="dm-avatar"><Avatar uye={kisi} /><span className="durum-nokta" data-durum={!cevrimici.has(kisi.id) ? "cevrimdisi" : bosta.has(kisi.id) ? "bosta" : (kisi.durum ?? "cevrimici")} aria-hidden="true" /></span>
                  : <span className="dm-ikon dm-grup-ikon">{dm.uyeleri.filter((u) => u.dm_id === k.id).length}+</span>}
                {k.tur === "grup"
                  ? <span className="dm-ad"><span className="dm-ad-ust">{baslik}</span><small>{dm.uyeleri.filter((u) => u.dm_id === k.id).length} üye</small></span>
                  : <span className="dm-ad">{baslik}</span>}
                <span className="dm-zaman">{zamanMetni(k.son_mesaj)}</span>
                {n > 0 && <span className="rozet" aria-hidden="true">{n}</span>}
              </button>
            );
          })}
          {!dmler.length && <p className="hint dm-bos">{q ? "Eşleşen kişi yok." : "Henüz özel mesajın yok. Üye listesinden birinin profilinden mesaj gönderebilirsin."}</p>}
        </nav>
        <div className="me dm-me">
          <button type="button" className="me-profil" onClick={() => onProfil(me.id)} title={t("Profilimi aç")}>
            <Avatar uye={me}><span className="on-dot" style={{ background: DURUM_BILGI[me.durum ?? "cevrimici"].renk }} /></Avatar>
            <div><b>{me.takma_ad}</b><span>{me.durum_metin || DURUM_BILGI[me.durum ?? "cevrimici"].ad}</span></div>
          </button>
        </div>
      </section>

      {sayfa === "arkadaslar" ? (
        <main className="col chat dm-orta">
          <button type="button" className="sq dm-geri dm-geri-liste" onClick={() => setMobil("liste")} aria-label={t("Listeye dön")}><Ikon ad="geri" /></button>
          <ArkadaslarSayfasi dm={dm} benId={me.id} uyeler={uyeler} cevrimici={cevrimici} onHata={onHata} onBilgi={onBilgi}
            onMesaj={(id) => void dm.dmAc(id).then((r) => { if (r.hata) onHata(r.hata); else if (r.id) sec(r.id); })} />
        </main>
      ) : aktifDm ? (
        <DmSohbet key={aktifDm} dmId={aktifDm} dm={dm} me={me} uyeler={uyeler} cevrimici={cevrimici} onProfil={onProfil} onHata={onHata} onGeri={() => setMobil("liste")} />
      ) : (
        <main className="col chat dm-orta"><div className="empty">{t("Bir kişi seç ya da arkadaşlarına göz at.")}</div></main>
      )}

      <aside className="col members dm-sag" aria-label={t("Profil")}>
        {sayfa === "sohbet" && aktifKanal?.tur === "ikili" ? (
          <ProfilKarti uye={profilUye} benimMi={false} cevrimici={profilUye ? cevrimici.has(profilUye.id) : false} bosta={profilUye ? bosta.has(profilUye.id) : false}
            iliski={karsi ? dm.iliski(karsi) : "yok"}
            onArkadasEkle={() => karsi && void dm.arkadasIstek(karsi).then((r) => { if (r.hata) onHata(r.hata); else onBilgi(r.sonuc === "kabul" ? "Arkadaş oldunuz" : "İstek gönderildi"); })}
            onArkadasSil={() => karsi && void eylem(dm.arkadasSil(karsi))}
            onEngelle={() => { if (karsi && confirm("Bu kişiyi engellemek istiyor musun? Birbirinize mesaj gönderemezsiniz.")) void eylem(dm.engelle(karsi)); }}
            onEngelKaldir={() => karsi && void eylem(dm.engelKaldir(karsi))}
            onProfil={() => karsi && onProfil(karsi)} />
        ) : (
          <div className="head"><h2>{sayfa === "arkadaslar" ? "Arkadaşlar" : "Profil"}</h2></div>
        )}
      </aside>

      {grupAcik && (
        <YeniGrupDialog uyeler={uyeler} benId={me.id} iliski={dm.iliski} onKapat={() => setGrupAcik(false)}
          onOlustur={async (ad, ids) => { const r = await dm.grupOlustur(ad, ids); if (r.hata) return r.hata; setGrupAcik(false); if (r.id) sec(r.id); return null; }} />
      )}
    </>
  );
}
