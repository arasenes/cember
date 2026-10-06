import { useState } from "react";
import type { Mesaj, Tepki, Uye } from "./types";
import { HIZLI_TEPKILER, saat } from "./util";
import Avatar from "./Avatar";
import EkResim from "./EkResim";
import { etiketParcala } from "./uyari";

type Props = {
  mesaj: Mesaj;
  yazar?: Uye;
  benim: Uye;
  tepkiler: Tepki[];
  onTepki: (mesajId: string, emoji: string) => void;
  onSil: (mesaj: Mesaj) => void;
  onSabitle?: (mesaj: Mesaj, sabit: boolean) => void;
  onProfil?: (uyeId: string) => void;
};

// Metin her zaman düz metin olarak render edilir: React içeriği kaçışlar, dangerouslySetInnerHTML kullanılmaz.
export default function MessageView({ mesaj, yazar, benim, tepkiler, onTepki, onSil, onSabitle, onProfil }: Props) {
  const [sec, setSec] = useState(false);
  const benimMi = yazar?.id === benim.id;
  const silebilir = benimMi || benim.rol !== "uye";

  const gruplar = new Map<string, Tepki[]>();
  for (const t of tepkiler) gruplar.set(t.emoji, [...(gruplar.get(t.emoji) ?? []), t]);

  return (
    <article className={"msg" + (benimMi ? " mine" : "")} data-testid="mesaj">
      {yazar && onProfil ? (
        <button className="avatar-btn" onClick={() => onProfil(yazar.id)} aria-label={`${yazar.takma_ad} profilini aç`}>
          <Avatar uye={yazar} />
        </button>
      ) : (
        <Avatar uye={yazar} />
      )}
      <div className="mb">
        <div className="mh">
          {yazar && onProfil ? (
            <button className="ad-btn" onClick={() => onProfil(yazar.id)}><b>{yazar.takma_ad}</b></button>
          ) : (
            <b>{yazar?.takma_ad ?? "Eski üye"}</b>
          )}
          <time dateTime={mesaj.olusturma}>{saat(mesaj.olusturma)}</time>
          {mesaj.duzenleme && !mesaj.silindi && <span className="hint">(düzenlendi)</span>}
          {mesaj.sabit && !mesaj.silindi && <span className="pin-isaret" title="Sabitlenmiş mesaj"><span aria-hidden="true">📌</span><span className="sr"> sabitlenmiş</span></span>}
          {onSabitle && benim.rol !== "uye" && !mesaj.silindi && (
            <button className="pin-btn" onClick={() => onSabitle(mesaj, !mesaj.sabit)}
              aria-label={mesaj.sabit ? "Sabitlemeyi kaldır" : "Mesajı sabitle"}>{mesaj.sabit ? "Sabitlemeyi kaldır" : "Sabitle"}</button>
          )}
          {silebilir && !mesaj.silindi && (
            <button className="del" onClick={() => onSil(mesaj)} aria-label="Mesajı sil">Sil</button>
          )}
        </div>
        {mesaj.silindi ? (
          <div className="txt silindi">Bu mesaj silindi.</div>
        ) : (
          <>
            {mesaj.metin && <div className="txt">{etiketParcala(mesaj.metin, benim.takma_ad).map((p, i) => (p.etiket ? <mark key={i} className="etiket-ben">{p.m}</mark> : p.m))}</div>}
            {mesaj.ek_yol && mesaj.ek_genislik && mesaj.ek_yukseklik && (
              <EkResim yol={mesaj.ek_yol} genislik={mesaj.ek_genislik} yukseklik={mesaj.ek_yukseklik}
                alt={`${yazar?.takma_ad ?? "Eski üye"} tarafından gönderilen resim`} />
            )}
            <div className="rx">
              {[...gruplar.entries()].map(([emoji, liste]) => {
                const benimki = liste.some((t) => t.uye_id === benim.id);
                return (
                  <button key={emoji} aria-pressed={benimki} onClick={() => onTepki(mesaj.id, emoji)} aria-label={`${emoji} tepkisi, ${liste.length} kişi`}>
                    {emoji} {liste.length}
                  </button>
                );
              })}
              <button className="add" onClick={() => setSec(!sec)} aria-expanded={sec} aria-label="Tepki ekle">＋</button>
            </div>
            {sec && (
              <div className="rxpick">
                {HIZLI_TEPKILER.map((e) => (
                  <button key={e} onClick={() => { onTepki(mesaj.id, e); setSec(false); }} aria-label={`${e} ekle`}>{e}</button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
