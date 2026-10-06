import type { SesArayuzu } from "./sesMotoru";

type Props = { ses: SesArayuzu; kanalAdi: string; className: string };

export default function SesCubugu({ ses, kanalAdi, className }: Props) {
  if (ses.durum === "kapali") return null;
  const baglaniyor = ses.durum === "baglaniyor";
  return (
    <div className={`voicebar on ${className}`} role="region" aria-label="Sesli oda kontrolleri">
      <div className="vstat"><i aria-hidden="true" />{baglaniyor ? "Bağlanılıyor…" : "Sesli bağlı"}{!baglaniyor && ses.motor === "p2p" && <span className="hint" title="Ücretsiz doğrudan bağlantı modu"> (doğrudan)</span>}<span className="hint" style={{ marginLeft: "auto" }}>{kanalAdi}</span></div>
      <div className="vbtns">
        <button className="ib" aria-pressed={ses.sessiz} onClick={ses.sessizDegistir} disabled={baglaniyor}>
          {ses.sessiz ? "🔇 Sessiz" : "🎙️ Sessize al"}
        </button>
        <button className="ib leave" onClick={ses.ayril}>Ayrıl</button>
      </div>
    </div>
  );
}
