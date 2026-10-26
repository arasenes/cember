import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";

export type IzlemeDurumu = {
  videoId: string;
  baslatanId: string;
  baslangicSn: number;
  oynuyor: boolean;
  guncelleme: number;
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** YouTube bağlantısından ya da doğrudan 11 karakterlik kimlikten video kimliğini çıkarır. */
export function youtubeIdCikar(metin: string): string | null {
  const s = metin.trim();
  if (YT_ID.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0] ?? "";
      return YT_ID.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v && YT_ID.test(v)) return v;
      const p = /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname);
      if (p) return p[1];
    }
  } catch { /* URL değil */ }
  return null;
}

/** O anki senkronize saniyeyi hesaplar. */
export function hesaplananKonum(d: IzlemeDurumu, simdi = Date.now()): number {
  if (!d.oynuyor) return Math.max(0, Math.floor(d.baslangicSn));
  const gecen = Math.max(0, Math.floor((simdi - d.guncelleme) / 1000));
  return Math.max(0, Math.floor(d.baslangicSn) + gecen);
}

type Props = {
  durum: IzlemeDurumu | null;
  baslatanAd: string;
  benId: string;
  onDegistir: (yeni: IzlemeDurumu | null) => void;
  onKapatPanel?: () => void;
};

export default function BirlikteIzle({ durum, baslatanAd, benId, onDegistir, onKapatPanel }: Props) {
  const [girdi, setGirdi] = useState("");
  const [hata, setHata] = useState("");
  const [buyuk, setBuyuk] = useState(false);
  const kutuRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ilkSnRef = useRef<number>(0);
  const sonVideoRef = useRef<string>("");

  if (durum && sonVideoRef.current !== durum.videoId) {
    sonVideoRef.current = durum.videoId;
    ilkSnRef.current = hesaplananKonum(durum);
  } else if (!durum) {
    sonVideoRef.current = "";
  }

  function ytKomut(func: string, args: unknown[] = []) {
    try {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    } catch { /* yoksay */ }
  }

  useEffect(() => {
    if (!durum) return;
    const hedefSn = hesaplananKonum(durum);
    ytKomut("seekTo", [hedefSn, true]);
    ytKomut(durum.oynuyor ? "playVideo" : "pauseVideo");
  }, [durum]);

  useEffect(() => {
    if (!buyuk) return;
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") setBuyuk(false); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [buyuk]);

  function baslat(e: React.FormEvent) {
    e.preventDefault();
    const id = youtubeIdCikar(girdi);
    if (!id) {
      setHata("Geçerli bir YouTube bağlantısı yapıştır.");
      return;
    }
    setHata("");
    setGirdi("");
    onDegistir({ videoId: id, baslatanId: benId, baslangicSn: 0, oynuyor: true, guncelleme: Date.now() });
  }

  function sar(farkSn: number) {
    if (!durum) return;
    const yeniSn = Math.max(0, hesaplananKonum(durum) + farkSn);
    onDegistir({ ...durum, baslangicSn: yeniSn, guncelleme: Date.now() });
  }

  function oynatDuraklat() {
    if (!durum) return;
    const simdiSn = hesaplananKonum(durum);
    onDegistir({ ...durum, baslangicSn: simdiSn, oynuyor: !durum.oynuyor, guncelleme: Date.now() });
  }

  function tamEkran() {
    const el = iframeRef.current ?? kutuRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) void el.requestFullscreen().catch(() => setBuyuk((x) => !x));
      else setBuyuk((x) => !x);
    } catch {
      setBuyuk((x) => !x);
    }
  }

  return (
    <section
      ref={kutuRef}
      className={"ekran-panel birlikte-izle-panel" + (buyuk ? " buyuk" : "")}
      aria-label={t("Birlikte İzle")}
      style={buyuk ? { position: "fixed", inset: 0, zIndex: 80, borderRadius: 0 } : { flex: 1, minHeight: 0, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}
    >
      <div className="ekran-ust" style={{ flex: "none" }}>
        <span className="ekran-ust-ad">
          🎬 <b>{t("Birlikte İzle")}</b>
          {durum && <span className="hint"> · {baslatanAd}</span>}
        </span>
        <span className="ekran-dugmeler">
          {durum && (
            <>
              <button type="button" className="linkbtn" onClick={() => sar(-15)} title={t("15 saniye geri")}>⏪ -15s</button>
              <button type="button" className="linkbtn" onClick={oynatDuraklat}>{durum.oynuyor ? "⏸ Duraklat" : "▶️ Oynat"}</button>
              <button type="button" className="linkbtn" onClick={() => sar(15)} title={t("15 saniye ileri")}>+15s ⏩</button>
              <button type="button" className="linkbtn" onClick={() => setBuyuk((b) => !b)} aria-pressed={buyuk}>{buyuk ? t("Küçült") : t("Büyüt")}</button>
              <button type="button" className="linkbtn" onClick={tamEkran}>{t("Tam ekran")}</button>
              <button type="button" className="linkbtn" onClick={() => { setBuyuk(false); onDegistir(null); }}>{t("Videoyu kapat")}</button>
            </>
          )}
          {!durum && onKapatPanel && (
            <button type="button" className="linkbtn" onClick={onKapatPanel}>{t("Kapat")}</button>
          )}
        </span>
      </div>

      <form className="birlikte-izle-form" onSubmit={baslat} style={{ display: "flex", gap: 8, padding: "6px 12px", alignItems: "center", flex: "none" }}>
        <input
          type="url"
          value={girdi}
          onChange={(e) => { setGirdi(e.target.value); if (hata) setHata(""); }}
          placeholder={t("YouTube bağlantısı yapıştır (örn. https://youtu.be/...)")}
          aria-label={t("YouTube bağlantısı")}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="submit" className="pk-btn" disabled={!girdi.trim()}>{t("Başlat")}</button>
      </form>
      {hata && <div className="err" role="alert" style={{ padding: "0 12px 8px", flex: "none" }}>{t(hata)}</div>}

      {durum ? (
        <div className="birlikte-izle-video" style={{ position: "relative", flex: "1 1 0", minHeight: 220, width: "100%", height: "100%", background: "#000", display: "flex" }}>
          <iframe
            ref={iframeRef}
            title={t("Birlikte İzle YouTube oynatıcısı")}
            src={`https://www.youtube-nocookie.com/embed/${durum.videoId}?autoplay=1&enablejsapi=1&rel=0&start=${ilkSnRef.current}`}
            style={{ flex: 1, width: "100%", height: "100%", border: 0, display: "block" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--muted)", padding: 24, textAlign: "center" }}>
          🎬 {t("Yukarıya bir YouTube bağlantısı yapıştırıp Başlat'a bas; odadaki herkes aynı anda izler.")}
        </div>
      )}
    </section>
  );
}
