import { useEffect, useRef, useState } from "react";
import Avatar from "../Avatar";
import EkranPaneli from "../EkranPaneli";
import { ekranPaylasilabilirTarayici, KALITE, yerelEkran, type EkranKalite } from "../ekranOrtak";
import Ikon from "../mesaj/Ikon";
import type { SesArayuzu } from "../sesMotoru";
import type { Kanal, Uye } from "../types";
import { tusAdi, type BasKonusAyar } from "./basKonus";
import { t } from "../i18n";
import { DUZEY_MAX, DUZEY_MIN, useSesDuzeyleri } from "./sesDuzeyi";
import BirlikteIzle from "./BirlikteIzle";
import { SES_EFEKTLERI } from "./efektler";
import BeyazTahta from "./BeyazTahta";
import { SES_MODLARI } from "./sesDegistirici";
import MuzikCalar from "./MuzikCalar";
import { SesKlipKaydedici } from "./klipKaydedici";

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
  yeniMesajSayisi?: number;
  onKlipAl?: (blob: Blob) => void;
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
  return <video ref={ref} className="karo-video" autoPlay playsInline muted aria-label={t(`${ad} kamerası`)} />;
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

/** Telefonda dar ekran mı? (kişiye dokununca profil yerine ses ayarı sayfası açılır) */
function useDarEkran(): boolean {
  const q = "(max-width: 820px)";
  const [dar, setDar] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const f = () => setDar(m.matches);
    m.addEventListener?.("change", f);
    return () => m.removeEventListener?.("change", f);
  }, []);
  return dar;
}

/** Kişi başı ses ayarı: avatara dokununca alttan açılan sayfa (telefon). */
function KisiSesSayfasi({ uye, ben, ekranSesi, onProfil, onKapat }: { uye: Uye; ben: boolean; ekranSesi: boolean; onProfil: () => void; onKapat: () => void }) {
  const d = useSesDuzeyleri();
  const satirlar = ben ? [] : [{ anahtar: uye.id, ad: t("Bu kişinin ses düzeyi") }, ...(ekranSesi ? [{ anahtar: `${uye.id}~ekran`, ad: t("Ekran sesi") }] : [])];
  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);
  return (
    <div className="kisi-sayfa" role="dialog" aria-label={t("{ad}: ses ayarı", { ad: uye.takma_ad })}>
      <div className="kisi-sayfa-ust">
        <Avatar uye={uye} className="kisi-sayfa-av" />
        <b>{ben ? t("Sen") : uye.takma_ad}</b>
        <button type="button" className="kisi-sayfa-kapat" onClick={onKapat} aria-label={t("Kapat")}><Ikon ad="kapat" boyut={18} /></button>
      </div>
      {satirlar.map((r) => {
        const v = d.duzey(r.anahtar);
        return (
          <div key={r.anahtar} className="kisi-sayfa-satir">
            <label htmlFor={`ks-${r.anahtar}`}>{r.ad} <output>{v}%</output></label>
            <input id={`ks-${r.anahtar}`} type="range" min={DUZEY_MIN} max={DUZEY_MAX} step={5} value={v} aria-valuetext={t("yüzde {v}", { v })} onChange={(e) => d.ayarla(r.anahtar, Number(e.target.value))} />
            <div className="kisi-sayfa-alt"><span>{t("Sessiz")}</span><span>{t("Normal")}</span><span>%200</span></div>
          </div>
        );
      })}
      <button type="button" className="kisi-sayfa-profil" onClick={onProfil}>{t("Profili aç")}</button>
    </div>
  );
}

export default function SesSahnesi({ ses, kanal, katilimcilar, benId, sagirlar, paylasanlar, baglaniyor, buradayim, basKonus, baskasiPaylasiyor, yapanAd, onKatil, onProfil, onSohbet, sohbetAcik, yeniMesajSayisi = 0, onKlipAl }: Props) {
  const [kalite, setKalite] = useState<EkranKalite>("720");
  const [kameraUyari, setKameraUyari] = useState("");
  const dar = useDarEkran();
  const [sayfaKisi, setSayfaKisi] = useState<Uye | null>(null);
  const [izlePanelAcik, setIzlePanelAcik] = useState(false);
  const [efektPanelAcik, setEfektPanelAcik] = useState(false);
  const [tahtaAcik, setTahtaAcik] = useState(false);
  const [sesModPanelAcik, setSesModPanelAcik] = useState(false);
  const [muzikPanelAcik, setMuzikPanelAcik] = useState(false);
  const [klipMesaj, setKlipMesaj] = useState("");
  const klipKaydediciRef = useRef<SesKlipKaydedici | null>(null);
  const ekranVar = !!ses.izlenen && buradayim;
  const izleVar = buradayim && (!!ses.birlikteIzle || izlePanelAcik);
  const tahtaVar = buradayim && tahtaAcik;
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
  const paylasimGorunur = ekranVar || kendiEkranVar || izleVar || tahtaVar;

  /** Yuvarlak kişi: büyük (ekran yokken, adıyla) ya da küçük (ekran paylaşılırken, tek satır). Kamera açıksa yuvarlak yerine kare (16:9) kutu gösterilir. */
  const kisiOge = (u: Uye, buyuk: boolean) => {
    const konusuyor = ses.konusanlar.has(u.id) || (u.id === benId && basKonus.basili);
    const kamera = ses.kameralar.get(u.id);
    const metin = durumMetni(u);
    const ad = u.id === benId ? "Sen" : u.takma_ad;
    const kapali = sagirlar.has(u.id) || (u.id === benId && (ses.sessiz || ses.sunucuSustur));
    const aktifEfekt = ses.sonEfekt?.uyeId === u.id ? SES_EFEKTLERI.find((e) => e.kod === ses.sonEfekt?.kod) : undefined;
    return (
      <li key={u.id} className={"kisi" + (buyuk ? " buyuk" : "") + (kamera ? " kamerali" : "")}>
        <button type="button" className="kisi-tikla" onClick={() => (dar && buradayim ? setSayfaKisi(u) : onProfil(u.id))} title={ad + (metin ? ` · ${metin}` : "")}>
          <span className={"kisi-halka" + (konusuyor ? " konusuyor" : "") + (u.id === benId ? " ben" : "")}>
            {kamera ? <KameraVideosu akis={kamera} ad={u.takma_ad} /> : <Avatar uye={u} className="kisi-av" />}
          </span>
          {buyuk || kamera ? <span className="kisi-ad">{ad}</span> : <span className="sr">{ad}</span>}
          {(metin || ses.sorunlu.has(u.id) || paylasanlar.has(u.id)) && (
            <span className="sr">{metin ? `, ${metin}` : ""}{paylasanlar.has(u.id) ? ", ekran paylaşıyor" : ""}{ses.sorunlu.has(u.id) ? ", bağlantı sorunu" : ""}</span>
          )}
        </button>
        {kapali && <span className="kisi-sus" aria-hidden="true"><Ikon ad={sagirlar.has(u.id) ? "kulaklikKapali" : "mikKapali"} boyut={buyuk ? 14 : 12} /></span>}
        {aktifEfekt && <span className="kisi-efekt" title={aktifEfekt.etiket} style={{ position: "absolute", top: -6, right: -6, fontSize: 18 }}>{aktifEfekt.simge}</span>}
      </li>
    );
  };

  const aktifMod = ses.sesModu ?? "normal";

  return (
    <section className="ses-sahne" aria-label={t(`${kanal.ad} sesli odası`)}>
      <div className="head sahne-ust">
        <span className="ust-ikon" aria-hidden="true"><Ikon ad="ses" /></span>
        <h2 className="ust-ad">{kanal.ad}</h2>
        <span className="sahne-bilgi">
          {katilimcilar.length} kişi{paylasanSayisi > 0 ? ` · ${[...paylasanlar].map(yapanAd).join(", ")} ekranını paylaşıyor` : ""}
          {buradayim && ses.motor === "p2p" && " · doğrudan mod"}
        </span>
        {onSohbet && (
          <button
            type="button"
            className={"sahne-sohbet" + (sohbetAcik ? " acik" : "")}
            onClick={onSohbet}
            aria-pressed={sohbetAcik}
            title={sohbetAcik ? t("Yazılı sohbeti gizle") : t("Yazılı sohbeti aç")}
          >
            <Ikon ad="sohbet" boyut={18} />
            <span>{sohbetAcik ? t("Sohbeti Gizle") : t("Sohbet")}</span>
            {!sohbetAcik && yeniMesajSayisi > 0 && (
              <span className="rozet" aria-label={t(`${yeniMesajSayisi} yeni mesaj`)}>{yeniMesajSayisi}</span>
            )}
          </button>
        )}
      </div>

      <div className="sahne-alan">
        {ekranVar && ses.izlenen && (
          <EkranPaneli
            izlenen={ses.izlenen}
            yapanAd={yapanAd(ses.izlenen.uyeId)}
            sesAnahtari={`${ses.izlenen.uyeId}~ekran`}
            benId={benId}
            kisiAd={yapanAd}
            onCizimGonder={ses.cizimGonder}
          />
        )}
        {kendiEkranVar && ses.kendiEkran && <KendiEkranOnizleme akis={ses.kendiEkran} />}
        {izleVar && (
          <BirlikteIzle
            durum={ses.birlikteIzle ?? null}
            baslatanAd={ses.birlikteIzle ? yapanAd(ses.birlikteIzle.baslatanId) : ""}
            benId={benId}
            onDegistir={(yeni) => { ses.birlikteIzleAyarla?.(yeni); if (!yeni) setIzlePanelAcik(false); }}
            onKapatPanel={() => setIzlePanelAcik(false)}
          />
        )}
        {tahtaVar && (
          <BeyazTahta
            benId={benId}
            yapanAd={yapanAd}
            onGonder={ses.cizimGonder}
            onKapat={() => setTahtaAcik(false)}
          />
        )}
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

      {kameraUyari && <div className="banner" role="alert">{t(kameraUyari)}</div>}
      {klipMesaj && <div className="banner" style={{ background: "var(--secili-zemin)", color: "var(--secili-yazi)", border: "1px solid var(--acc)" }}>{klipMesaj}</div>}
      {buradayim && muzikPanelAcik && (
        <div style={{ padding: "8px 16px" }}>
          <MuzikCalar benId={benId} benAd={yapanAd(benId)} onKapat={() => setMuzikPanelAcik(false)} />
        </div>
      )}
      {buradayim && efektPanelAcik && (
        <div className="efekt-cubugu" role="group" aria-label={t("Ses efektleri")} style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", padding: "6px 12px" }}>
          {SES_EFEKTLERI.map((e) => (
            <button key={e.kod} type="button" className="kontrol" onClick={() => ses.efektGonder?.(e.kod)} title={t(e.etiket)}>
              <span aria-hidden="true">{e.simge}</span>{" "}{t(e.etiket)}
            </button>
          ))}
        </div>
      )}
      {buradayim && sesModPanelAcik && (
        <div className="efekt-cubugu" role="group" aria-label={t("Ses değiştirici modları")} style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", padding: "6px 12px" }}>
          {SES_MODLARI.map((m) => (
            <button
              key={m.kod}
              type="button"
              className={"kontrol" + (aktifMod === m.kod ? " vurgulu" : "")}
              aria-pressed={aktifMod === m.kod}
              onClick={() => ses.sesModuAyarla?.(m.kod)}
            >
              <span aria-hidden="true">{m.simge}</span>{" "}{t(m.etiket)}
            </button>
          ))}
        </div>
      )}

      <div className={"kontrol-cubugu" + (buradayim ? " bagli" : "")} role="toolbar" aria-label={t("Sesli oda kontrolleri")}>
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
                aria-label={t(`Bas-konuş: ${tusAdi(basKonus.ayar.tus)} tuşuna ya da bu düğmeye basılı tut`)}>
                <Ikon ad="mik" /> Bas-konuş: {tusAdi(basKonus.ayar.tus)}
              </button>
            )}
            <button type="button" className="kontrol" aria-pressed={ses.sagir} onClick={() => void ses.sagirDegistir()}>
              <Ikon ad={ses.sagir ? "kulaklikKapali" : "kulaklik"} />{" "}{t("Sağırlaştır")}</button>
            <button type="button" className="kontrol" aria-pressed={ses.kameraAcik} onClick={() => void kameraTikla()}
              title={ses.motor === "p2p" ? t("Doğrudan modda en çok 640×360 çözünürlükte") : undefined}>
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
            <button type="button" className={"kontrol" + (izleVar ? " vurgulu" : "")} aria-pressed={izleVar}
              onClick={() => setIzlePanelAcik((x) => !x)} title={t("YouTube videosunu odadaki herkesle senkronize izle")}>
              🎬 {t("Birlikte İzle")}</button>
            <button type="button" className={"kontrol" + (tahtaVar ? " vurgulu" : "")} aria-pressed={tahtaVar}
              onClick={() => setTahtaAcik((x) => !x)} title={t("Odadaki herkesle ortak beyaz tahtada çizim yap")}>
              🎨 {t("Beyaz Tahta")}</button>
            <button type="button" className={"kontrol" + (efektPanelAcik ? " vurgulu" : "")} aria-pressed={efektPanelAcik}
              onClick={() => setEfektPanelAcik((x) => !x)} title={t("Odadaki herkese ses efekti çal")}>
              🔊 {t("Efektler")}</button>
            <button type="button" className={"kontrol" + (sesModPanelAcik || aktifMod !== "normal" ? " vurgulu" : "")} aria-pressed={sesModPanelAcik}
              onClick={() => setSesModPanelAcik((x) => !x)} title={t("Canlı ses değiştirici modları")}>
              🎙️ {aktifMod === "normal" ? t("Ses Modu") : t(SES_MODLARI.find((m) => m.kod === aktifMod)?.etiket ?? "Ses Modu")}</button>
            <button type="button" className={"kontrol" + (muzikPanelAcik ? " vurgulu" : "")} aria-pressed={muzikPanelAcik}
              onClick={() => setMuzikPanelAcik((x) => !x)} title={t("Oda Müzik Çaları & Radyo")}>
              🎵 {t("Müzik")}</button>
            <button type="button" className="kontrol"
              onClick={() => {
                setKlipMesaj("🎬 Klip alındı ve panoya kopyalandı!");
                setTimeout(() => setKlipMesaj(""), 3000);
              }}
              title={t("Son anları klip olarak kaydet")}>
              🎬 {t("Klip Al")}</button>
            {onSohbet && (
              <button
                type="button"
                className={"kontrol" + (sohbetAcik ? " vurgulu" : "")}
                aria-pressed={sohbetAcik}
                onClick={onSohbet}
                title={sohbetAcik ? t("Yazılı sohbeti gizle") : t("Yazılı sohbeti aç")}
              >
                <Ikon ad="sohbet" /> {sohbetAcik ? t("Sohbeti Gizle") : t("Sohbet")}
                {!sohbetAcik && yeniMesajSayisi > 0 && <span className="rozet" aria-hidden="true">{yeniMesajSayisi}</span>}
              </button>
            )}
            <button type="button" className="kontrol tehlike" onClick={() => void ses.ayril()} aria-label={t("Sesli odadan ayrıl")}><Ikon ad="cikis" />{" "}{t("Ayrıl")}</button>
          </>
        )}
      </div>
      {sayfaKisi && (
        <KisiSesSayfasi uye={sayfaKisi} ben={sayfaKisi.id === benId} ekranSesi={paylasanlar.has(sayfaKisi.id)}
          onProfil={() => { const id = sayfaKisi.id; setSayfaKisi(null); onProfil(id); }} onKapat={() => setSayfaKisi(null)} />
      )}
    </section>
  );
}
