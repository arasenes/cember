import { useEffect, useRef, useState } from "react";
import {
  cikartmalariGetir,
  cikartmaMetni,
  ozelCikartmaEkle,
  ozelCikartmaSil,
  type Cikartma,
} from "./cikartmalar";
import { t } from "../i18n";

type Props = {
  onSec: (metin: string) => void;
  onKapat: () => void;
};

const KATEGORILER = [
  { id: "hepsi", ad: "Tümü", simge: "🏷️" },
  { id: "kedi", ad: "Kediler", simge: "🐱" },
  { id: "meme", ad: "Memeler", simge: "🐸" },
  { id: "oyun", ad: "Oyun", simge: "🎮" },
  { id: "tepki", ad: "Tepkiler", simge: "✨" },
  { id: "ozel", ad: "Özel", simge: "⭐" },
];

export default function CikartmaSecici({ onSec, onKapat }: Props) {
  const [kategori, setKategori] = useState<string>("hepsi");
  const [liste, setListe] = useState<Cikartma[]>(() => cikartmalariGetir());
  const [ozelUrl, setOzelUrl] = useState("");
  const [ozelAd, setOzelAd] = useState("");
  const [ekleFormAcik, setEkleFormAcik] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKapat();
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  function ozelEkle(e: React.FormEvent) {
    e.preventDefault();
    if (!ozelUrl.trim()) return;
    ozelCikartmaEkle(ozelUrl, ozelAd);
    setListe(cikartmalariGetir());
    setOzelUrl("");
    setOzelAd("");
    setEkleFormAcik(false);
    setKategori("ozel");
  }

  function sil(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    ozelCikartmaSil(id);
    setListe(cikartmalariGetir());
  }

  const filtrelenmis =
    kategori === "hepsi"
      ? liste
      : liste.filter((c) => c.kategori === kategori);

  return (
    <div
      ref={panelRef}
      className="cikartma-secici"
      role="dialog"
      aria-label={t("Çıkartma seç")}
      style={{
        position: "absolute",
        bottom: 56,
        left: 8,
        width: 340,
        maxWidth: "92vw",
        maxHeight: 400,
        background: "var(--card)",
        border: "1.5px solid var(--line)",
        borderRadius: 16,
        boxShadow: "0 12px 36px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        zIndex: 40,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <b style={{ fontSize: 14 }}>🏷️ {t("Çıkartma Çantası")}</b>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            type="button"
            className="linkbtn"
            style={{ fontSize: 12, padding: "2px 6px" }}
            onClick={() => setEkleFormAcik(!ekleFormAcik)}
          >
            {ekleFormAcik ? t("Kapat") : "+ " + t("Özel Ekle")}
          </button>
          <button
            type="button"
            className="linkbtn"
            onClick={onKapat}
            aria-label={t("Kapat")}
            style={{ fontSize: 14, padding: "0 4px" }}
          >
            ✕
          </button>
        </div>
      </div>

      {ekleFormAcik && (
        <form
          onSubmit={ozelEkle}
          style={{
            padding: "8px 12px",
            background: "var(--bg)",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <input
            type="url"
            placeholder={t("Resim / GIF bağlantısı (URL)")}
            value={ozelUrl}
            onChange={(e) => setOzelUrl(e.target.value)}
            required
            style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid var(--line)" }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              placeholder={t("Çıkartma adı")}
              value={ozelAd}
              onChange={(e) => setOzelAd(e.target.value)}
              style={{ flex: 1, fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid var(--line)" }}
            />
            <button type="submit" className="pk-btn" style={{ minHeight: "auto", padding: "4px 10px", fontSize: 12 }}>
              {t("Ekle")}
            </button>
          </div>
        </form>
      )}

      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "6px 8px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg)",
          overflowX: "auto",
        }}
      >
        {KATEGORILER.map((k) => (
          <button
            key={k.id}
            type="button"
            className={"ciple" + (kategori === k.id ? " acik" : "")}
            onClick={() => setKategori(k.id)}
            style={{
              padding: "4px 8px",
              fontSize: 11,
              whiteSpace: "nowrap",
              borderRadius: 999,
              border: "1px solid var(--line)",
              background: kategori === k.id ? "var(--vurgu)" : "transparent",
              color: kategori === k.id ? "var(--vurgu-yazi)" : "var(--fg)",
            }}
          >
            {k.simge} {k.ad}
          </button>
        ))}
      </div>

      <div
        className="scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 10,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          alignContent: "start",
        }}
      >
        {filtrelenmis.length === 0 ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 12 }}>
            {t("Bu kategoride henüz çıkartma yok.")}
          </div>
        ) : (
          filtrelenmis.map((c) => (
            <button
              key={c.id}
              type="button"
              className="cikartma-kare"
              onClick={() => onSec(cikartmaMetni(c.url, c.ad))}
              title={c.ad}
              style={{
                position: "relative",
                aspectRatio: "1",
                padding: 4,
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "var(--bg)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.15s, border-color 0.15s",
              }}
            >
              <img
                src={c.url}
                alt={c.ad}
                loading="lazy"
                style={{ width: "80%", height: "80%", objectFit: "contain" }}
              />
              <span style={{ fontSize: 9, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center" }}>
                {c.ad}
              </span>
              {c.kategori === "ozel" && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => sil(c.id, e)}
                  title={t("Sil")}
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 4,
                    fontSize: 10,
                    color: "var(--danger, #ef4444)",
                    fontWeight: 800,
                  }}
                >
                  ✕
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
