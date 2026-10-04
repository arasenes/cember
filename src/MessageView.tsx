import { useState } from "react";
import type { Mesaj, Tepki, Uye } from "./types";
import { bas, HIZLI_TEPKILER, saat } from "./util";

type Props = {
  mesaj: Mesaj;
  yazar?: Uye;
  benim: Uye;
  tepkiler: Tepki[];
  onTepki: (mesajId: string, emoji: string) => void;
  onSil: (mesaj: Mesaj) => void;
};

// Metin her zaman düz metin olarak render edilir: React içeriği kaçışlar, dangerouslySetInnerHTML kullanılmaz.
export default function MessageView({ mesaj, yazar, benim, tepkiler, onTepki, onSil }: Props) {
  const [sec, setSec] = useState(false);
  const benimMi = yazar?.id === benim.id;
  const silebilir = benimMi || benim.rol === "sahip";

  const gruplar = new Map<string, Tepki[]>();
  for (const t of tepkiler) gruplar.set(t.emoji, [...(gruplar.get(t.emoji) ?? []), t]);

  return (
    <article className={"msg" + (benimMi ? " mine" : "")} data-testid="mesaj">
      <div className="dot" style={{ background: yazar?.renk ?? "#999" }} aria-hidden="true">{bas(yazar?.takma_ad ?? "?")}</div>
      <div className="mb">
        <div className="mh">
          <b>{yazar?.takma_ad ?? "Eski üye"}</b>
          <time dateTime={mesaj.olusturma}>{saat(mesaj.olusturma)}</time>
          {mesaj.duzenleme && !mesaj.silindi && <span className="hint">(düzenlendi)</span>}
          {silebilir && !mesaj.silindi && (
            <button className="del" onClick={() => onSil(mesaj)} aria-label="Mesajı sil">Sil</button>
          )}
        </div>
        {mesaj.silindi ? (
          <div className="txt silindi">Bu mesaj silindi.</div>
        ) : (
          <>
            <div className="txt">{mesaj.metin}</div>
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
