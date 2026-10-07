import { useEffect, useRef, useState } from "react";
import type { Mesaj, Tepki, Uye } from "./types";
import MessageView from "./MessageView";

type Props = {
  ana: Mesaj;
  yanitlar: Mesaj[];
  uyeHaritasi: Map<string, Uye>;
  ben: Uye;
  tepkiler: Tepki[];
  yazamaz: boolean;
  onTepki: (mesajId: string, emoji: string) => void;
  onSil: (mesaj: Mesaj) => void;
  onDuzenle?: (mesaj: Mesaj, metin: string) => Promise<boolean> | boolean;
  onProfil: (uyeId: string) => void;
  onGonder: (metin: string) => Promise<boolean>;
  onKapat: () => void;
};

/** Bir mesajın altındaki konu (alt sohbet): ana mesaj + yanıtlar + yazma kutusu. */
export default function KonuPaneli({ ana, yanitlar, uyeHaritasi, ben, tepkiler, yazamaz, onTepki, onSil, onDuzenle, onProfil, onGonder, onKapat }: Props) {
  const [metin, setMetin] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const akisRef = useRef<HTMLDivElement>(null);
  const girdiRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { girdiRef.current?.focus(); }, [ana.id]);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);
  useEffect(() => {
    const el = akisRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [yanitlar.length, ana.id]);

  async function gonder() {
    const t = metin.trim();
    if (!t || mesgul || yazamaz) return;
    setMesgul(true);
    const ok = await onGonder(t);
    setMesgul(false);
    if (ok) { setMetin(""); girdiRef.current?.focus(); }
  }

  const goster = (m: Mesaj) => (
    <MessageView key={m.id} mesaj={m} yazar={uyeHaritasi.get(m.uye_id)} benim={ben}
      tepkiler={tepkiler.filter((t) => t.mesaj_id === m.id)} onTepki={onTepki} onSil={onSil} onDuzenle={onDuzenle} onProfil={onProfil} />
  );

  return (
    <aside className="konu-panel" role="complementary" aria-label="Konu">
      <div className="konu-ust">
        <h2>💬 Konu</h2>
        <button className="lb-kapat modal-x" onClick={onKapat} aria-label="Konuyu kapat">✕</button>
      </div>
      <div className="konu-akis" ref={akisRef} role="log" aria-live="polite">
        {goster(ana)}
        <div className="konu-sayac">{yanitlar.length ? `${yanitlar.length} yanıt` : "Henüz yanıt yok"}</div>
        {yanitlar.map(goster)}
      </div>
      <div className="konu-yaz">
        <textarea ref={girdiRef} rows={1} value={metin} maxLength={4000} aria-label="Konuya yanıt yaz" disabled={yazamaz}
          placeholder={yazamaz ? "Susturuldun; yazamazsın" : "Konuya yanıt yaz…"}
          onChange={(e) => setMetin(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void gonder(); } }} />
        <button className="sq send" onClick={() => void gonder()} aria-label="Yanıtı gönder" disabled={!metin.trim() || mesgul || yazamaz}>{mesgul ? "…" : "➤"}</button>
      </div>
    </aside>
  );
}
