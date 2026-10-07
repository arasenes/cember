import { useState } from "react";
import type { Mesaj, Tepki, Uye } from "./types";
import { HIZLI_TEPKILER, saat } from "./util";
import Avatar from "./Avatar";
import EkResim from "./EkResim";
import { duzMetin, metinOge } from "./mesaj/markdown";
import Ikon from "./mesaj/Ikon";
import AnketKart from "./mesaj/AnketKart";
import OnizlemeKarti from "./mesaj/OnizlemeKarti";
import { gifUrlMi } from "./mesaj/gif";
import type { Anket } from "./mesaj/anket";
import EmojiDeposu from "./EmojiDeposu";
import { t } from "./i18n";

/** Aşama 1 mesaj özellikleri: alıntılı yanıt, iletme, anket. Hepsi isteğe bağlıdır. */
export type Zengin = {
  alinti?: { mesaj?: Mesaj; yazar?: Uye };
  onAlintiGit?: (mesajId: string) => void;
  onYanitla?: (mesaj: Mesaj) => void;
  onIlet?: (mesaj: Mesaj) => void;
  anket?: Anket;
  onOyla?: (mesajId: string, secenekId: string, oy: boolean) => Promise<string | null>;
  onHata?: (metin: string) => void;
};

type Props = {
  mesaj: Mesaj;
  yazar?: Uye;
  benim: Uye;
  tepkiler: Tepki[];
  onTepki: (mesajId: string, emoji: string) => void;
  zengin?: Zengin;
  onSil: (mesaj: Mesaj) => void;
  /** Kendi mesajını düzenleme; false dönerse düzenleme kutusu açık kalır. */
  onDuzenle?: (mesaj: Mesaj, metin: string) => Promise<boolean> | boolean;
  onSabitle?: (mesaj: Mesaj, sabit: boolean) => void;
  onProfil?: (uyeId: string) => void;
  yanitSayisi?: number;
  onKonu?: (mesaj: Mesaj) => void;
  /** Aynı kişinin art arda mesajı: avatar ve isim gizlenir. */
  devam?: boolean;
  /** Arama/alıntıdan gidilen mesajı kısa süre vurgular. */
  vurgu?: boolean;
  /** Tepki gerektirmeyen akışlarda (DM) tepki düğmesini gizler. */
  tepkisiz?: boolean;
};

// Metin her zaman düz metin olarak render edilir: React içeriği kaçışlar, dangerouslySetInnerHTML kullanılmaz.
export default function MessageView({ mesaj, yazar, benim, tepkiler, onTepki, onSil, onDuzenle, onSabitle, onProfil, yanitSayisi, onKonu, devam = false, vurgu = false, tepkisiz = false, zengin }: Props) {
  const [sec, setSec] = useState(false);
  const [tum, setTum] = useState(false);
  const [arac, setArac] = useState(false);
  const [duzenle, setDuzenle] = useState(false);
  const [taslak, setTaslak] = useState("");
  const benimMi = yazar?.id === benim.id;
  const silebilir = benimMi || benim.rol !== "uye";

  const gruplar = new Map<string, Tepki[]>();
  for (const t of tepkiler) gruplar.set(t.emoji, [...(gruplar.get(t.emoji) ?? []), t]);

  const pinGoster = !!onSabitle && benim.rol !== "uye" && !mesaj.silindi;
  const aracVar = !mesaj.silindi;
  const duzenlenebilir = !!onDuzenle && benimMi && !mesaj.silindi && !!mesaj.metin;

  async function kaydet() {
    const t = taslak.trim();
    if (!t || t.length > 4000) return;
    if (t === mesaj.metin) return setDuzenle(false);
    if (await onDuzenle!(mesaj, t)) setDuzenle(false);
  }

  return (
    <article id={`mesaj-${mesaj.id}`} className={"msg" + (benimMi ? " mine" : "") + (devam ? " devam" : "") + (vurgu ? " vurgu" : "") + (arac ? " arac-ac" : "")} data-testid="mesaj"
      onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a, input, .deposu")) setArac((x) => !x); }}>
      {devam ? (
        <time className="gutter-saat" dateTime={mesaj.olusturma} aria-hidden="true">{saat(mesaj.olusturma)}</time>
      ) : yazar && onProfil ? (
        <button className="avatar-btn" onClick={() => onProfil(yazar.id)} aria-label={`${yazar.takma_ad} profilini aç`}>
          <Avatar uye={yazar} />
        </button>
      ) : (
        <Avatar uye={yazar} />
      )}
      <div className="mb">
        <div className={"mh" + (devam ? " sr" : "")}>
          {yazar && onProfil ? (
            <button className="ad-btn" onClick={() => onProfil(yazar.id)}><b className={"rol-" + yazar.rol}>{yazar.takma_ad}</b></button>
          ) : (
            <b className={"rol-" + (yazar?.rol ?? "uye")}>{yazar?.takma_ad ?? "Eski üye"}</b>
          )}
          <time dateTime={mesaj.olusturma}>{saat(mesaj.olusturma)}</time>
          {mesaj.duzenleme && !mesaj.silindi && <span className="hint">{t("(düzenlendi)")}</span>}
        </div>
        {mesaj.sabit && !mesaj.silindi && <span className="pin-isaret" title={t("Sabitlenmiş mesaj")}><Ikon ad="pin" boyut={14} /><span className="sr">{" "}{t("sabitlenmiş")}</span></span>}
        {mesaj.silindi ? (
          <div className="txt silindi">{t("Bu mesaj silindi.")}</div>
        ) : (
          <>
            {mesaj.iletilen_ad && <div className="iletildi"><Ikon ad="ilet" boyut={13} /> {mesaj.iletilen_ad}'ten iletildi</div>}
            {mesaj.yanit_id && (
              <button type="button" className="alinti-satir" onClick={() => zengin?.onAlintiGit?.(mesaj.yanit_id!)}
                aria-label={zengin?.alinti?.mesaj ? `${zengin.alinti.yazar?.takma_ad ?? "Eski üye"} kişisinin mesajına git` : "Yanıtlanan mesaja git"}>
                <Ikon ad="yanit" boyut={13} />
                {zengin?.alinti?.mesaj && !zengin.alinti.mesaj.silindi ? (
                  <>
                    <b>{zengin.alinti.yazar?.takma_ad ?? "Eski üye"}</b>
                    <span>{zengin.alinti.mesaj.metin ? duzMetin(zengin.alinti.mesaj.metin).slice(0, 100) : zengin.alinti.mesaj.ek_yol ? "Resim" : ""}</span>
                  </>
                ) : (
                  <span>{zengin?.alinti?.mesaj?.silindi ? "Bu mesaj silindi." : "Önceki mesaj"}</span>
                )}
              </button>
            )}
            {duzenle ? (
              <div className="duzenle-kutu">
                <textarea autoFocus value={taslak} maxLength={4000} rows={2} aria-label={t("Mesajı düzenle")}
                  onChange={(e) => setTaslak(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setDuzenle(false);
                    else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void kaydet(); }
                  }} />
                <div className="duzenle-alt">
                  <button type="button" onClick={() => void kaydet()} disabled={!taslak.trim()}>{t("Kaydet")}</button>
                  <button type="button" onClick={() => setDuzenle(false)}>{t("İptal")}</button>
                  <span className="hint">{t("Enter kaydeder, Esc iptal eder")}</span>
                </div>
              </div>
            ) : zengin?.anket ? null : mesaj.metin && gifUrlMi(mesaj.metin) ? (
              <img className="gif-mesaj" src={mesaj.metin.trim()} alt="GIF" loading="lazy" referrerPolicy="no-referrer" />
            ) : mesaj.metin && <div className="txt">{metinOge(mesaj.metin, benim.takma_ad)}</div>}
            {zengin?.anket && zengin.onOyla && (
              <AnketKart anket={zengin.anket} benUyeId={benim.id} onOyla={(sid, oy) => zengin.onOyla!(mesaj.id, sid, oy)} onHata={(h) => zengin.onHata?.(h)} />
            )}
            {mesaj.onizleme && !zengin?.anket && !gifUrlMi(mesaj.metin) && <OnizlemeKarti o={mesaj.onizleme} />}
            {mesaj.ek_yol && mesaj.ek_genislik && mesaj.ek_yukseklik && (
              <EkResim yol={mesaj.ek_yol} genislik={mesaj.ek_genislik} yukseklik={mesaj.ek_yukseklik}
                alt={`${yazar?.takma_ad ?? "Eski üye"} tarafından gönderilen resim`} />
            )}
            {gruplar.size > 0 && (
              <div className="rx">
                {[...gruplar.entries()].map(([emoji, liste]) => {
                  const benimki = liste.some((t) => t.uye_id === benim.id);
                  return (
                    <button key={emoji} aria-pressed={benimki} onClick={() => onTepki(mesaj.id, emoji)} aria-label={`${emoji} tepkisi, ${liste.length} kişi`}>
                      {emoji} {liste.length}
                    </button>
                  );
                })}
              </div>
            )}
            {sec && (
              <div className="rxpick">
                {HIZLI_TEPKILER.map((e) => (
                  <button key={e} onClick={() => { onTepki(mesaj.id, e); setSec(false); }} aria-label={`${e} ekle`}>{e}</button>
                ))}
                <button onClick={() => setTum(!tum)} aria-expanded={tum} aria-label={t("Tüm emojiler")}>⋯</button>
                {tum && <EmojiDeposu className="deposu-tepki" onSec={(e) => { onTepki(mesaj.id, e); setSec(false); setTum(false); }} />}
              </div>
            )}
          </>
        )}
        {!!yanitSayisi && onKonu && (
          <button className="konu-btn" onClick={() => onKonu(mesaj)} aria-label={`Konuyu aç, ${yanitSayisi} yanıt`}>💬 {yanitSayisi} yanıt</button>
        )}
      </div>
      {aracVar && (
        <div className="arac" role="toolbar" aria-label={t("Mesaj eylemleri")}>
          {!tepkisiz && <button onClick={() => setSec(!sec)} aria-expanded={sec} aria-label={t("Tepki ekle")} title={t("Tepki ekle")}><Ikon ad="gulen" /></button>}
          {zengin?.onYanitla && <button onClick={() => zengin.onYanitla!(mesaj)} aria-label={t("Yanıtla")} title={t("Yanıtla")}><Ikon ad="yanit" /></button>}
          {onKonu && !yanitSayisi && <button onClick={() => onKonu(mesaj)} aria-label={t("Konu aç ve yanıtla")} title={t("Yanıtla (konu aç)")}><Ikon ad="sohbet" /></button>}
          {pinGoster && (
            <button className="pin-btn" onClick={() => onSabitle!(mesaj, !mesaj.sabit)} title={mesaj.sabit ? "Sabitlemeyi kaldır" : "Sabitle"}
              aria-label={mesaj.sabit ? "Sabitlemeyi kaldır" : "Mesajı sabitle"}><Ikon ad="pin" /></button>
          )}
          {duzenlenebilir && <button onClick={() => { setTaslak(mesaj.metin); setDuzenle(true); setArac(false); }} aria-label={t("Mesajı düzenle")} title={t("Düzenle")}><Ikon ad="duzenle" /></button>}
          {zengin?.onIlet && !mesaj.ek_yol && !!mesaj.metin && !zengin.anket && <button onClick={() => zengin.onIlet!(mesaj)} aria-label={t("İlet")} title={t("İlet")}><Ikon ad="ilet" /></button>}
          {silebilir && <button className="del" onClick={() => onSil(mesaj)} aria-label={t("Mesajı sil")} title={t("Sil")}><Ikon ad="sil" /></button>}
        </div>
      )}
    </article>
  );
}
