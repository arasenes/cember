import SeslerAyari from "./SeslerAyari";
import type { SesAyar } from "./sesler";
import { useEffect, useRef, useState } from "react";
import { googleAcikMi, googleBagla, googleBagliMi } from "./google";
import { TEMALAR, type TemaId } from "./temalar";
import type { YaziBoyutu } from "./yerel";
import { tusAdi, tusAtanabilir, type BasKonusAyar } from "./ses/basKonus";
import { cevir, dilOku, dilYaz, type Dil, t, DILLER } from "./i18n";
import { pushAc, pushAcikMi, pushDestekli, pushKapat, pushSadeceEtiket, pushTercih } from "./push";

type Props = {
  tema: TemaId; onTema: (t: TemaId) => void;
  /** Dil seçilince (hesaba kaydetmek için). */
  onDil?: (d: Dil) => void;
  yazi: YaziBoyutu; onYazi: (b: YaziBoyutu) => void;
  onSesAyar?: (a: SesAyar) => void; onSeslerAcildi?: () => void;
  basKonus?: BasKonusAyar; onBasKonus?: (a: BasKonusAyar) => void;
  onKapat: () => void;
};

const BOYUTLAR: { id: YaziBoyutu; ad: string }[] = [{ id: "kucuk", ad: t("Küçük") }, { id: "orta", ad: t("Orta") }, { id: "buyuk", ad: t("Büyük") }];

export default function AyarlarDialog({ tema, onTema, onDil, yazi, onYazi, onSesAyar, onSeslerAcildi, basKonus, onBasKonus, onKapat }: Props) {
  const [tusBekleniyor, setTusBekleniyor] = useState(false);
  const kutu = useRef<HTMLDivElement>(null);
  const [googleDurum, setGoogleDurum] = useState<"yok" | "bagla" | "bagli">("yok");
  const [googleHata, setGoogleHata] = useState("");
  useEffect(() => {
    let iptal = false;
    (async () => {
      if (!(await googleAcikMi())) return;
      const bagli = await googleBagliMi();
      if (!iptal) setGoogleDurum(bagli ? "bagli" : "bagla");
    })();
    return () => { iptal = true; };
  }, []);
  const [pushAcik, setPushAcik] = useState(pushAcikMi());
  const [sadeceEtiket, setSadeceEtiket] = useState(pushSadeceEtiket());
  const [pushHata, setPushHata] = useState("");
  const [pushMesgul, setPushMesgul] = useState(false);
  async function pushDegistir() {
    setPushHata("");
    setPushMesgul(true);
    if (pushAcik) { await pushKapat(); setPushAcik(false); }
    else {
      const s = await pushAc(sadeceEtiket);
      if (s.ok) setPushAcik(true); else setPushHata(s.mesaj ?? "Bildirim açılamadı.");
    }
    setPushMesgul(false);
  }
  async function etiketDegistir(v: boolean) {
    setSadeceEtiket(v);
    const s = await pushTercih(v);
    if (!s.ok) setPushHata(s.mesaj ?? "Kaydedilemedi.");
  }
  // Bas-konuş tuşu atama: bir sonraki tuş basışı yakalanır (Esc iptal eder)
  useEffect(() => {
    if (!tusBekleniyor || !basKonus || !onBasKonus) return;
    const yakala = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.code === "Escape") return setTusBekleniyor(false);
      if (!tusAtanabilir(e.code)) return;
      onBasKonus({ ...basKonus, tus: e.code });
      setTusBekleniyor(false);
    };
    window.addEventListener("keydown", yakala, true);
    return () => window.removeEventListener("keydown", yakala, true);
  }, [tusBekleniyor, basKonus, onBasKonus]);
  useEffect(() => {
    kutu.current?.querySelector<HTMLElement>("button[aria-checked=true]")?.focus();
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  return (
    <div className="modal-arka" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <div className="modal ayarlar" role="dialog" aria-modal="true" aria-labelledby="ayar-baslik" ref={kutu}>
        <div className="modal-ust">
          <h2 id="ayar-baslik">{t("Ayarlar")}</h2>
          <button className="lb-kapat modal-x" onClick={onKapat} aria-label={t("Kapat")}>✕</button>
        </div>

        <div className="ayar-grup">
          <div className="yon-baslik" id="palet-baslik">{t("Görünüm")}</div>
          <div className="palet-kartlari" role="radiogroup" aria-labelledby="palet-baslik"
            onKeyDown={(e) => {
              const yon = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (!yon) return;
              e.preventDefault();
              const i = TEMALAR.findIndex((x) => x.id === tema);
              const s = TEMALAR[(i + yon + TEMALAR.length) % TEMALAR.length];
              onTema(s.id);
              requestAnimationFrame(() => e.currentTarget.querySelector<HTMLButtonElement>(`[data-palet="${s.id}"]`)?.focus());
            }}>
            {TEMALAR.map((p) => (
              <button key={p.id} type="button" role="radio" data-palet={p.id} aria-checked={tema === p.id} tabIndex={tema === p.id ? 0 : -1}
                className={"palet-kart" + (tema === p.id ? " secili" : "")} onClick={() => onTema(p.id)}>
                <span className="palet-onizleme" aria-hidden="true">
                  {p.renkler.map((r, k) => <i key={k} style={{ background: r }} />)}
                </span>
                <span className="palet-ad">{p.ad}{tema === p.id && <span className="palet-tik" aria-hidden="true"> ✓</span>}</span>
                <small>{p.not}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="ayar-grup" role="radiogroup" aria-label={t("Yazı boyutu")}>
          <div className="yon-baslik">{t("Yazı boyutu")}</div>
          <div className="segment">
            {BOYUTLAR.map((b) => (
              <button key={b.id} role="radio" aria-checked={yazi === b.id} onClick={() => onYazi(b.id)}>{b.ad}</button>
            ))}
          </div>
        </div>

        <div className="ayar-grup" role="radiogroup" aria-label={cevir("ayar.dil")}>
          <div className="yon-baslik">{cevir("ayar.dil")}</div>
          <div className="segment">
            {DILLER.map((d) => (
              <button key={d.id} role="radio" lang={d.id} aria-checked={dilOku() === d.id} onClick={() => { dilYaz(d.id); if (onDil) onDil(d.id); location.reload(); }}>{d.ad}</button>
            ))}
          </div>
        </div>

        <SeslerAyari onDegisti={onSesAyar} onAcildi={onSeslerAcildi} />

        {basKonus && onBasKonus && (
          <div className="ayar-grup">
            <div className="yon-baslik">{t("Bas-konuş")}</div>
            <button className="ayar-anahtar" role="switch" aria-checked={basKonus.acik} onClick={() => onBasKonus({ ...basKonus, acik: !basKonus.acik })}>
              <span>{basKonus.acik ? "Açık" : "Kapalı"} <small>{t("mikrofon yalnızca tuşa basılıyken açılır (sesli odadayken)")}</small></span>
              <span className="anahtar" aria-hidden="true" />
            </button>
            <div className="ayar-tus">
              <span>{t("Tuş:")}{" "}<kbd>{tusAdi(basKonus.tus)}</kbd></span>
              <button type="button" className="pk-btn" onClick={() => setTusBekleniyor(true)} aria-live="polite">{tusBekleniyor ? "Bir tuşa bas… (Esc: iptal)" : "Tuşu değiştir"}</button>
            </div>
          </div>
        )}

        {pushDestekli() && (
          <div className="ayar-grup">
            <div className="yon-baslik">{t("Bildirimler")}</div>
            <button className="ayar-anahtar" role="switch" aria-checked={pushAcik} disabled={pushMesgul} onClick={() => void pushDegistir()}>
              <span>{pushAcik ? "📲 Açık" : "📴 Kapalı"} <small>{t("uygulama kapalıyken de yeni mesajda haber ver")}</small></span>
              <span className="anahtar" aria-hidden="true" />
            </button>
            {pushAcik && (
              <div className="segment" role="radiogroup" aria-label={t("Bildirim kapsamı")}>
                <button role="radio" aria-checked={!sadeceEtiket} onClick={() => void etiketDegistir(false)}>{t("Tüm mesajlar")}</button>
                <button role="radio" aria-checked={sadeceEtiket} onClick={() => void etiketDegistir(true)}>{t("Sadece etiketlenince")}</button>
              </div>
            )}
            {pushHata && <p className="err" role="alert">{t(pushHata)}</p>}
          </div>
        )}

        {googleDurum !== "yok" && (
          <div className="ayar-grup">
            <div className="yon-baslik">{t("Hesap")}</div>
            {googleDurum === "bagli" ? (
              <p className="ayar-not">{t("✓ Google hesabın bağlı. Başka cihazdan Google ile girebilirsin.")}</p>
            ) : (
              <>
                <button className="ayar-anahtar" onClick={async () => setGoogleHata(await googleBagla())}>
                  <span>{t("Google hesabını bağla")}{" "}<small>{t("başka cihazdan da aynı hesapla girmek için")}</small></span>
                </button>
                {googleHata && <p className="err" role="alert">{t(googleHata)}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
