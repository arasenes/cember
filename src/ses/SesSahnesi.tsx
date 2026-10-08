import { useEffect, useRef, useState } from "react";
import Avatar from "../Avatar";
import EkranPaneli from "../EkranPaneli";
import { ekranPaylasilabilirTarayici, KALITE, yerelEkran, type EkranKalite } from "../ekranOrtak";
import Ikon from "../mesaj/Ikon";
import type { SesArayuzu } from "../sesMotoru";
import type { Kanal, Uye } from "../types";
import { tusAdi, type BasKonusAyar } from "./basKonus";
import { t } from "../i18n";

type BasKonusDurumu = { ayar: BasKonusAyar; basili: boolean; bas: () => void; birak: () => void };

type Props = {
  ses: SesArayuzu;
  kanal: Kanal;
  katilimcilar: Uye[];
  benId: string;
  sagirlar: Set<string>;
  paylasanlar: Set<string>;
  baglaniyor: boolean;
  buradayim: boolean;
  basKonus: BasKonusDurumu;
  baskasiPaylasiyor: string | null;
  yapanAd: (uyeId: string) => string;
  onKatil: () => void;
  onProfil: (uyeId: string) => void;
  onSohbet?: () => void;
  /** Yazılı sohbet şu an görünüyor mu (düğme basılı durumu). */
  sohbetAcik?: boolean;
};

/** Kamera akışını gösterir (kendi kameran sessiz önizlenir). */
export function KameraVideosu({ akis, ad }: { akis: MediaStream; ad: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = akis;
    void Promise.resolve(v.play()).catch(() => {});
    return () => { v.srcObject = null; };
  }, [akis]);
  return <video ref={ref} className="karo-video" autoPlay playsInline muted aria-label={`${ad} kamerası`} />;
}

/** Sesli oda sahnesi: paylaşılan ekran + katılımcı kareleri (kamera ya da avatar) + kontrol çubuğu. */
/** Kendi paylaştığım ekranın küçük önizlemesi (sessiz; karşıdakiler tam boyutta izler). */
function KendiEkranOnizleme({ akis }: { akis: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = akis;
    try { void Promise.resolve(v.play()).catch(() => {}); } catch { /* oynatma engellendi */ }
    return () => { v.srcObject = null; };
  }, [akis]);
  return (
    <figure className="kendi-ekran">
      <video ref={ref} muted playsInline aria-label={t("Paylaştığın ekran")} />
      <figcaption>{t("Paylaştığın ekran")}</figcaption>
    </figure>
  );
}

export default function SesSahnesi({ ses, kanal, katilimcilar, benId, sagirlar, paylasanlar, baglaniyor, buradayim, basKonus, baskasiPaylasiyor, yapanAd, onKatil, onProfil, onSohbet, sohbetAcik }: Props) {
  const [kalite, setKalite] = useState<EkranKalite>("720");
  const [kameraUyari, setKameraUyari] = useState("");
  const ekranVar = !!ses.izlenen && buradayim;
  const paylasanSayisi = paylasanlar.size;

  async function kameraTikla() {
    setKameraUyari("");
    const r = await ses.kameraDegistir();
    if (!r.ok && r.mesaj) setKameraUyari(r.mesaj);
  }

  const durumMetni = (u: Uye) => {
    if (sagirlar.has(u.id)) return "sağırlaştırdı";
    if (u.id === benId && ses.sunucuSustur) return "susturuldu";
    if (u.id === benId && basKonus.ayar.acik) return basKonus.basili ? "konuşuyor" : "bas-konuş bekliyor";
    if (ses.konusanlar.has(u.id)) return "konuşuyor";
    if (u.id === benId && ses.sessiz) return "mikrofon kapalı";
    return "";
  };

  const kendiEkranVar = buradayim && ses.paylasiyorum && !!ses.kendiEkran && !ekranVar;
  const paylasimGorunur = ekranVar || kendiEkranVar;

  /** Yuvarlak kişi: büyük (ekran yokken, adıyla) ya da küçük (ekran paylaşılırken, tek satır). Kamera açıksa yuvarlak yerine kare (16:9) kutu gösterilir. */
  const kisiOge = (u: Uye, buyuk: boolean) => {
    const konusuyor = ses.konusanlar.has(u.id) || (u.id === benId && basKonus.basili);
    const kamera = ses.kameralar.get(u.id);
    const metin = durumMetni(u);
    const ad = u.id === benId ? "Sen" : u.takma_ad;
    const kapali = sagirlar.has(u.id) || (u.id === benId && (ses.sessiz || ses.sunucuSustur));
    return (
      <li key={u.id} className={"kisi" + (buyuk ? " buyuk" : "") + (kamera ? " kamerali" : "")}>
        <button type="button" className="kisi-tikla" onClick={() => onProfil(u.id)} title={ad + (metin ? ` · ${metin}` : "")}>
          <span className={"kisi-halka" + (konusuyor ? " konusuyor" : "") + (u.id === benId ? " ben" : "")}>
            {kamera ? <KameraVideosu akis={kamera} ad={u.takma_ad} /> : <Avatar uye={u} className="kisi-av" />}
          </span>
          {buyuk || kamera ? <span className="kisi-ad">{ad}</span> : <span className="sr">{ad}</span>}
          {(metin || ses.sorunlu.has(u.id) || paylasanlar.has(u.id)) && (
            <span className="sr">{metin ? `, ${metin}` : ""}{paylasanlar.has(u.id) ? ", ekran paylaşıyor" : ""}{ses.sorunlu.has(u.id) ? ", bağlantı sorunu" : ""}</span>
          )}
        </button>
        {kapali && <span className="kisi-sus" aria-hidden="true"><Ikon ad={sagirlar.has(u.id) ? "kulaklikKapali" : "mikKapali"} boyut={buyuk ? 14 : 12} /></span>}
      </li>
    );
  };

  return (
    <section className="ses-sahne" aria-label={`${kanal.ad} sesli odası`}>
      <div className="head sahne-ust">
        <span className="ust-ikon" aria-hidden="true"><Ikon ad="ses" /></span>
        <h2 className="ust-ad">{kanal.ad}</h2>
        <span className="sahne-bilgi">
          {katilimcilar.length} kişi{paylasanSayisi > 0 ? ` · ${[...paylasanlar].map(yapanAd).join(", ")} ekranını paylaşıyor` : ""}
          {buradayim && ses.motor === "p2p" && " · doğrudan mod"}
        </span>
      </div>

      <div className="sahne-alan">
        {ekranVar && ses.izlenen && <EkranPaneli izlenen={ses.izlenen} yapanAd={yapanAd(ses.izlenen.uyeId)} />}
        {kendiEkranVar && ses.kendiEkran && <KendiEkranOnizleme akis={ses.kendiEkran} />}
        {!paylasimGorunur && (
          <ul className="buyuk-liste" aria-label={t("Sesli odadaki katılımcılar")}>
            {katilimcilar.map((u) => kisiOge(u, true))}
            {katilimcilar.length === 0 && <li className="sahne-bos">{t("Odada kimse yok.")}</li>}
          </ul>
        )}
      </div>

      {paylasimGorunur && (
        <ul className="kisiler-satir" aria-label={t("Sesli odadaki katılımcılar")}>
          {katilimcilar.map((u) => kisiOge(u, false))}
        </ul>
      )}

      {kameraUyari && <div className="banner" role="alert">{kameraUyari}</div>}

      <div className="kontrol-cubugu" role="toolbar" aria-label={t("Sesli oda kontrolleri")}>
        {!buradayim ? (
          <button type="button" className="kontrol vurgulu" onClick={onKatil} disabled={baglaniyor}>{baglaniyor ? "Bağlanılıyor…" : "Odaya katıl"}</button>
        ) : (
          <>
            <button type="button" className="kontrol" aria-pressed={ses.sessiz} onClick={() => void ses.sessizDegistir()} disabled={baglaniyor}>
              <Ikon ad={ses.sessiz ? "mikKapali" : "mik"} />{" "}{t("Mikrofon")}</button>
            {basKonus.ayar.acik && (
              <button type="button" className={"kontrol" + (basKonus.basili ? " vurgulu" : "")} aria-pressed={basKonus.basili}
                onPointerDown={(e) => { e.preventDefault(); basKonus.bas(); }} onPointerUp={basKonus.birak} onPointerLeave={basKonus.birak} onPointerCancel={basKonus.birak}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) basKonus.bas(); } }}
                onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") basKonus.birak(); }}
                aria-label={`Bas-konuş: ${tusAdi(basKonus.ayar.tus)} tuşuna ya da bu düğmeye basılı tut`}>
                <Ikon ad="mik" /> Bas-konuş: {tusAdi(basKonus.ayar.tus)}
              </button>
            )}
            <button type="button" className="kontrol" aria-pressed={ses.sagir} onClick={() => void ses.sagirDegistir()}>
              <Ikon ad={ses.sagir ? "kulaklikKapali" : "kulaklik"} />{" "}{t("Sağırlaştır")}</button>
            <button type="button" className="kontrol" aria-pressed={ses.kameraAcik} onClick={() => void kameraTikla()}
              title={ses.motor === "p2p" ? "Doğrudan modda en çok 640×360 çözünürlükte" : undefined}>
              <Ikon ad={ses.kameraAcik ? "kamera" : "kameraKapali"} />{" "}{t("Kamera")}</button>
            {ses.ekranDestegi && (
              ses.paylasiyorum
                ? <button type="button" className="kontrol vurgulu" aria-pressed={true} onClick={() => void ses.ekranDurdur()}><Ikon ad="ekran" />{" "}{t("Paylaşımı durdur")}</button>
                : (
                  <span className="kontrol-grup">
                    {ekranPaylasilabilirTarayici() && !yerelEkran() && (
                      <select className="ekran-kalite" aria-label={t("Ekran paylaşım kalitesi")} value={kalite} onChange={(e) => setKalite(e.target.value as EkranKalite)} disabled={baglaniyor}>
                        {(Object.keys(KALITE) as EkranKalite[]).map((k) => <option key={k} value={k} title={KALITE[k].etiket}>{k}p</option>)}
                      </select>
                    )}
                    <button type="button" className="kontrol" onClick={() => void ses.ekranPaylas(kalite)} disabled={baglaniyor || !!baskasiPaylasiyor}
                      title={baskasiPaylasiyor ? `${baskasiPaylasiyor} ekran paylaşıyor` : undefined}>
                      <Ikon ad="ekran" />{" "}{t("Ekran")}</button>
                  </span>
                )
            )}
            <button type="button" className="kontrol tehlike" onClick={() => void ses.ayril()} aria-label={t("Sesli odadan ayrıl")}><Ikon ad="cikis" />{" "}{t("Ayrıl")}</button>
          </>
        )}
      </div>
    </section>
  );
}
