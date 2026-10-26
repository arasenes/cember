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
  { baslik: "Groove Salad / Chill & Downtempo", url: "https://ice1.somafm.com/groovesalad-128-mp3", simge: "☕" },
  { baslik: "Vaporwaves / 80s Synth Beats", url: "https://ice1.somafm.com/vaporwaves-128-mp3", simge: "🎮" },
  { baslik: "DEF CON / Cyber Electronic", url: "https://ice1.somafm.com/defcon-128-mp3", simge: "🎧" },
  { baslik: "Drone Zone / Derin Odak & Ambient", url: "https://ice1.somafm.com/dronezone-128-mp3", simge: "🌌" },
  { baslik: "Secret Agent / Retro Spy Lounge", url: "https://ice1.somafm.com/secretagent-128-mp3", simge: "🎷" },
  { baslik: "Indie Pop Rocks / Alternatif Rock", url: "https://ice1.somafm.com/indiepop-128-mp3", simge: "🎸" },
];

type Props = {
  benId?: string;
  benAd?: string;
  onKapat?: () => void;
};

export default function MuzikCalar({ onKapat }: Props) {
  const [caliyor, setCaliyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [seciliRadyo, setSeciliRadyo] = useState<string>(HAZIR_RADYOLAR[0].url);
  const [ses, setSes] = useState<number>(50);
  const [hata, setHata] = useState("");
  const [ozelUrl, setOzelUrl] = useState("");
  const [ozelAcik, setOzelAcik] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = new Audio();
    audioRef.current = a;

    const onPlaying = () => {
      setCaliyor(true);
      setYukleniyor(false);
      setHata("");
    };

    const onPause = () => {
      setCaliyor(false);
      setYukleniyor(false);
    };

    const onError = () => {
      setHata("Yayın çalınamadı. İstasyon geçici olarak meşgul olabilir veya bağlantı kesildi.");
      setCaliyor(false);
      setYukleniyor(false);
    };

    a.addEventListener("playing", onPlaying);
    a.addEventListener("pause", onPause);
    a.addEventListener("error", onError);

    return () => {
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("error", onError);
      a.pause();
      a.src = "";
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, ses / 100));
    }
  }, [ses]);

  function baslatDurdur(url: string) {
    const a = audioRef.current;
    if (!a) return;
    setHata("");

    if (caliyor && seciliRadyo === url) {
      a.pause();
      setCaliyor(false);
      setYukleniyor(false);
      return;
    }

    setSeciliRadyo(url);
    setYukleniyor(true);
    a.src = url;
    a.volume = Math.max(0, Math.min(1, ses / 100));
    a.play()
      .then(() => {
        setCaliyor(true);
        setYukleniyor(false);
      })
      .catch(() => {
        setYukleniyor(false);
        setCaliyor(false);
        setHata("Yayın başlatılamadı. Tarayıcınız otomatik oynatmayı kısıtlamış olabilir. Lütfen düğmeye tekrar tıklayın.");
      });
  }

  function ozelYayinBaslat(e: React.FormEvent) {
    e.preventDefault();
    const u = ozelUrl.trim();
    if (!u) return;
    baslatDurdur(u);
  }

  return (
    <div
      className="muzik-panel"
      style={{
        borderRadius: 16,
        background: "var(--card)",
        border: "1.5px solid var(--line)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 480,
        boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>🎵</span>
          <div>
            <b style={{ fontSize: 16, display: "block" }}>{t("Oda Müzik Çaları & Radyo")}</b>
            {caliyor && (
              <span style={{ fontSize: 11, color: "var(--live, #10b981)", fontWeight: 700 }}>
                ● {t("Canlı Çalıyor")}
              </span>
            )}
          </div>
        </div>
        {onKapat && (
          <button type="button" className="linkbtn" onClick={onKapat} aria-label={t("Kapat")}>
            {t("Kapat")}
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        {t("Sesli odada arka planda kesintisiz müzik ve lofi dinleyin:")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {HAZIR_RADYOLAR.map((r) => {
          const secili = seciliRadyo === r.url;
          const aktif = secili && caliyor;
          const bekliyor = secili && yukleniyor;
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
                borderRadius: 10,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{r.simge}</span>
                <b style={{ fontSize: 13 }}>{r.baslik}</b>
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, flex: "none", marginLeft: 8 }}>
                {bekliyor ? "⏳ " + t("Bağlanıyor…") : aktif ? "⏸ " + t("Durdur") : "▶️ " + t("Çal")}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <button
          type="button"
          className="linkbtn"
          style={{ fontSize: 12, padding: "2px 0" }}
          onClick={() => setOzelAcik(!ozelAcik)}
        >
          {ozelAcik ? "▲ " + t("Özel bağlantıyı gizle") : "▼ " + t("Özel radyo veya ses bağlantısı gir")}
        </button>
        {ozelAcik && (
          <form onSubmit={ozelYayinBaslat} style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input
              type="url"
              placeholder="https://...mp3 veya radyo akışı"
              value={ozelUrl}
              onChange={(e) => setOzelUrl(e.target.value)}
              style={{
                flex: 1,
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--bg)",
                color: "var(--fg)",
              }}
            />
            <button
              type="submit"
              className="pk-btn"
              style={{ minHeight: "auto", padding: "6px 12px", fontSize: 12 }}
            >
              ▶️ {t("Çal")}
            </button>
          </form>
        )}
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

      {hata && (
        <div
          className="err"
          role="alert"
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12,
            background: "var(--kirmizi-zemin, rgba(239, 68, 68, 0.1))",
            color: "var(--kirmizi, #ef4444)",
            border: "1px solid var(--kirmizi, #ef4444)",
          }}
        >
          {t(hata)}
        </div>
      )}
    </div>
  );
}
