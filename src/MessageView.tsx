import { useState } from "react";
import type { Mesaj, Tepki, Uye } from "./types";
import { HIZLI_TEPKILER, saat } from "./util";
import Avatar from "./Avatar";
import EkResim from "./EkResim";
import { metinOge } from "./mesaj/markdown";
import EmojiDeposu from "./EmojiDeposu";

type Props = {
  mesaj: Mesaj;
  yazar?: Uye;
  benim: Uye;
  tepkiler: Tepki[];
  onTepki: (mesajId: string, emoji: string) => void;
  onSil: (mesaj: Mesaj) => void;
  /** Kendi mesajını düzenleme; false dönerse düzenleme kutusu açık kalır. */
  onDuzenle?: (mesaj: Mesaj, metin: string) => Promise<boolean> | boolean;
  onSabitle?: (mesaj: Mesaj, sabit: boolean) => void;
  onProfil?: (uyeId: string) => void;
  yanitSayisi?: number;
  onKonu?: (mesaj: Mesaj) => void;
  /** Aynı kişinin art arda mesajı: avatar ve isim gizlenir. */
  devam?: boolean;
};

// Metin her zaman düz metin olarak render edilir: React içeriği kaçışlar, dangerouslySetInnerHTML kullanılmaz.
export default function MessageView({ mesaj, yazar, benim, tepkiler, onTepki, onSil, onDuzenle, onSabitle, onProfil, yanitSayisi, onKonu, devam = false }: Props) {
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
    <article className={"msg" + (benimMi ? " mine" : "") + (devam ? " devam" : "") + (arac ? " arac-ac" : "")} data-testid="mesaj"
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
            <button className="ad-btn" onClick={() => onProfil(yazar.id)}><b>{yazar.takma_ad}</b></button>
          ) : (
            <b>{yazar?.takma_ad ?? "Eski üye"}</b>
          )}
          <time dateTime={mesaj.olusturma}>{saat(mesaj.olusturma)}</time>
          {mesaj.duzenleme && !mesaj.silindi && <span className="hint">(düzenlendi)</span>}
        </div>
        {mesaj.sabit && !mesaj.silindi && <span className="pin-isaret" title="Sabitlenmiş mesaj"><span aria-hidden="true">📌</span><span className="sr"> sabitlenmiş</span></span>}
        {mesaj.silindi ? (
          <div className="txt silindi">Bu mesaj silindi.</div>
        ) : (
          <>
            {duzenle ? (
              <div className="duzenle-kutu">
                <textarea autoFocus value={taslak} maxLength={4000} rows={2} aria-label="Mesajı düzenle"
                  onChange={(e) => setTaslak(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setDuzenle(false);
                    else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void kaydet(); }
                  }} />
                <div className="duzenle-alt">
                  <button type="button" onClick={() => void kaydet()} disabled={!taslak.trim()}>Kaydet</button>
                  <button type="button" onClick={() => setDuzenle(false)}>İptal</button>
                  <span className="hint">Enter kaydeder, Esc iptal eder</span>
                </div>
              </div>
            ) : mesaj.metin && <div className="txt">{metinOge(mesaj.metin, benim.takma_ad)}</div>}
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
                <button onClick={() => setTum(!tum)} aria-expanded={tum} aria-label="Tüm emojiler">⋯</button>
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
        <div className="arac" role="toolbar" aria-label="Mesaj eylemleri">
          <button onClick={() => setSec(!sec)} aria-expanded={sec} aria-label="Tepki ekle" title="Tepki ekle">😀</button>
          {onKonu && !yanitSayisi && <button onClick={() => onKonu(mesaj)} aria-label="Konu aç ve yanıtla" title="Yanıtla (konu aç)">💬</button>}
          {pinGoster && (
            <button className="pin-btn" onClick={() => onSabitle!(mesaj, !mesaj.sabit)} title={mesaj.sabit ? "Sabitlemeyi kaldır" : "Sabitle"}
              aria-label={mesaj.sabit ? "Sabitlemeyi kaldır" : "Mesajı sabitle"}>{mesaj.sabit ? "📍" : "📌"}</button>
          )}
          {duzenlenebilir && <button onClick={() => { setTaslak(mesaj.metin); setDuzenle(true); setArac(false); }} aria-label="Mesajı düzenle" title="Düzenle">✏️</button>}
          {silebilir && <button className="del" onClick={() => onSil(mesaj)} aria-label="Mesajı sil" title="Sil">🗑️</button>}
        </div>
      )}
    </article>
  );
}
