import { useMemo, useState } from "react";
import { KATEGORILER, emojiAra, sonKullanilanEkle, sonKullanilanlar } from "./emojiVeri";

type Props = { onSec: (emoji: string) => void; className?: string };

// Emoji deposu: arama, kategori sekmeleri ve son kullanılanlar.
export default function EmojiDeposu({ onSec, className }: Props) {
  const [q, setQ] = useState("");
  const [kat, setKat] = useState("son");
  const [son, setSon] = useState(sonKullanilanlar);

  const sekmeler = useMemo(() => [{ id: "son", simge: "🕘", ad: "Son kullanılanlar", liste: son }, ...KATEGORILER], [son]);
  const secili = sekmeler.find((k) => k.id === kat) ?? sekmeler[1];
  const liste = q.trim() ? emojiAra(q) : secili.liste.length || kat !== "son" ? secili.liste : KATEGORILER[0].liste;

  function sec(e: string) { sonKullanilanEkle(e); setSon(sonKullanilanlar()); onSec(e); }

  return (
    <div className={`deposu ${className ?? ""}`} role="group" aria-label="Emoji deposu">
      <input className="deposu-ara" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Emoji ara (kalp, ateş, kedi…)" aria-label="Emoji ara" />
      {!q.trim() && (
        <div className="deposu-sekme" role="tablist">
          {sekmeler.map((k) => (
            <button key={k.id} role="tab" aria-selected={k.id === secili.id} aria-label={k.ad} title={k.ad} onClick={() => setKat(k.id)}>{k.simge}</button>
          ))}
        </div>
      )}
      <div className="deposu-baslik">{q.trim() ? `“${q.trim()}” sonuçları` : kat === "son" && !son.length ? "Yüzler" : secili.ad}</div>
      <div className="deposu-izgara">
        {liste.length === 0 && <div className="deposu-bos">Sonuç yok</div>}
        {liste.map((e) => <button key={e} aria-label={e} onClick={() => sec(e)}>{e}</button>)}
      </div>
    </div>
  );
}
