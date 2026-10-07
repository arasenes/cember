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
export default function SesSahnesi({ ses, kanal, katilimcilar, benId, sagirlar, paylasanlar, baglaniyor, buradayim, basKonus, baskasiPaylasiyor, yapanAd, onKatil, onProfil, onSohbet }: Props) {
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

  return (
    <section className="ses-sahne" aria-label={`${kanal.ad} sesli odası`}>
      <div className="head sahne-ust">
        <span className="ust-ikon" aria-hidden="true"><Ikon ad="ses" /></span>
        <h2 className="ust-ad">{kanal.ad}</h2>
        <span className="sahne-bilgi">
          {katilimcilar.length} kişi{paylasanSayisi > 0 ? ` · ${[...paylasanlar].map(yapanAd).join(", ")} ekranını paylaşıyor` : ""}
          {buradayim && ses.motor === "p2p" && " · doğrudan mod"}
        </span>
        {onSohbet && <button type="button" className="sahne-sohbet" onClick={onSohbet}><Ikon ad="sohbet" boyut={18} />{" "}{t("Sohbet")}</button>}
      </div>

      <div className={"sahne-alan" + (ekranVar ? " ekranli" : "")}>
        {ekranVar && ses.izlenen && <EkranPaneli izlenen={ses.izlenen} yapanAd={yapanAd(ses.izlenen.uyeId)} />}
        <ul className="karo-izgara" aria-label={t("Sesli odadaki katılımcılar")}>
          {katilimcilar.map((u) => {
            const konusuyor = ses.konusanlar.has(u.id) || (u.id === benId && basKonus.basili);
            const kamera = ses.kameralar.get(u.id);
            const metin = durumMetni(u);
            return (
              <li key={u.id} className={"sahne-karo" + (konusuyor ? " konusuyor" : "") + (kamera ? " kameralı" : "")}>
                <button type="button" className="karo-tikla" onClick={() => onProfil(u.id)}>
                  {kamera ? <KameraVideosu akis={kamera} ad={u.takma_ad} /> : <Avatar uye={u} className="karo-avatar" />}
                  <span className="karo-etiket">
                    {sagirlar.has(u.id) ? <Ikon ad="kulaklikKapali" boyut={14} /> : konusuyor ? <Ikon ad="ses" boyut={14} /> : (u.id === benId && ses.sessiz) ? <Ikon ad="mikKapali" boyut={14} /> : null}
                    {u.id === benId ? "Sen" : u.takma_ad}{metin ? ` · ${metin}` : ""}{ses.sorunlu.has(u.id) && <span className="sr">, bağlantı sorunu</span>}
                  </span>
                </button>
                <span className="sahne-rozetler">
                  {kamera && <span className="sahne-rozet"><Ikon ad="kamera" boyut={12} />{" "}{t("Kamera")}</span>}
                  {paylasanlar.has(u.id) && <span className="sahne-rozet sahne-ekran"><Ikon ad="ekran" boyut={12} />{" "}{t("Ekran")}</span>}
                  {ses.sorunlu.has(u.id) && <span className="sahne-rozet sahne-sorun">{t("Bağlantı sorunu")}</span>}
                </span>
              </li>
            );
          })}
          {katilimcilar.length === 0 && <li className="sahne-bos">{t("Odada kimse yok.")}</li>}
        </ul>
      </div>

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
              title={ses.motor === "p2p" ? "Kamera yalnızca LiveKit modunda çalışır" : undefined}>
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
