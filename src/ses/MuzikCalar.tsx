import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import Ikon from "../mesaj/Ikon";

export type MuzikParcasi = {
  id: string;
  baslik: string;
  tur: "radyo" | "url";
  url: string;
  ekleyenAd: string;
};

export const HAZIR_RADYOLAR: { baslik: string; url: string; simge: string }[] = [
  { baslik: "Lofi Hip Hop / Chill Study", url: "https://streams.ilovemusic.de/iloveradio17.mp3", simge: "☕" },
  { baslik: "Deep House / Lounge", url: "https://streams.ilovemusic.de/iloveradio2.mp3", simge: "🎧" },
  { baslik: "80s & 90s Hits / Retro", url: "https://streams.ilovemusic.de/iloveradio26.mp3", simge: "📻" },
  { baslik: "Gaming / Synthwave Beats", url: "https://streams.ilovemusic.de/iloveradio27.mp3", simge: "🎮" },
  { baslik: "Klasik & Akustik Piyano", url: "https://stream.radioparadise.com/mellow-128.mp3", simge: "🎹" },
];

type Props = {
  benId: string;
  benAd: string;
  onKapat?: () => void;
};

export default function MuzikCalar({ benId, benAd, onKapat }: Props) {
  const [caliyor, setCaliyor] = useState(false);
  const [seciliRadyo, setSeciliRadyo] = useState<string>(HAZIR_RADYOLAR[0].url);
  const [ses, setSes] = useState<number>(50);
  const [hata, setHata] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = new Audio();
    a.crossOrigin = "anonymous";
    audioRef.current = a;

    a.addEventListener("error", () => {
      setHata("Yayın çalınamadı. Farklı bir istasyon deneyin.");
      setCaliyor(false);
    });

    return () => {
      a.pause();
      a.src = "";
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = ses / 100;
    }
  }, [ses]);

  function baslatDurdur(url: string) {
    const a = audioRef.current;
    if (!a) return;
    setHata("");

    if (caliyor && seciliRadyo === url) {
      a.pause();
      setCaliyor(false);
      return;
    }

    setSeciliRadyo(url);
    a.src = url;
    a.volume = ses / 100;
    a.play()
      .then(() => setCaliyor(true))
      .catch(() => {
        setHata("Yayın başlatılamadı.");
        setCaliyor(false);
      });
  }

  return (
    <div
      className="muzik-panel"
      style={{
        borderRadius: 14,
        background: "var(--card)",
        border: "1.5px solid var(--line)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 480,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>🎵</span>
          <b style={{ fontSize: 16 }}>{t("Oda Müzik Çaları & Radyo")}</b>
        </div>
        {onKapat && (
          <button type="button" className="linkbtn" onClick={onKapat}>
            {t("Kapat")}
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        {t("Sesli odada arka planda kesintisiz müzik ve lofi dinleyin:")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {HAZIR_RADYOLAR.map((r) => {
          const aktif = seciliRadyo === r.url && caliyor;
          return (
            <button
              key={r.url}
              type="button"
              className={"kontrol" + (aktif ? " vurgulu" : "")}
              onClick={() => baslatDurdur(r.url)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                height: "auto",
                textAlign: "left",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{r.simge}</span>
                <b>{r.baslik}</b>
              </span>
              <span>{aktif ? "⏸ Durdur" : "▶️ Çal"}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
        <Ikon ad="ses" boyut={16} />
        <input
          type="range"
          min={0}
          max={100}
          value={ses}
          onChange={(e) => setSes(Number(e.target.value))}
          style={{ flex: 1 }}
          aria-label={t("Müzik ses düzeyi")}
        />
        <span style={{ fontSize: 12, minWidth: 32, textAlign: "right" }}>%{ses}</span>
      </div>

      {hata && <div className="err" role="alert">{t(hata)}</div>}
    </div>
  );
}
