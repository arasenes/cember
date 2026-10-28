import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import Ikon from "../mesaj/Ikon";

export type IzlemeTuru = "youtube" | "dosya" | "link" | "vimeo" | "dailymotion";

/** Gömülü (iframe) oynatıcıyla izlenen platformlar */
const GOMULU: IzlemeTuru[] = ["youtube", "vimeo", "dailymotion"];

export type IzlemeDurumu = {
  tur?: IzlemeTuru;
  videoId: string; // YouTube videoId, dosya için dosya adı, link için video adresi
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

const VIMEO_ID = /^\d{1,12}(\/[0-9a-f]{6,20})?$/;
const DM_ID = /^[A-Za-z0-9]{5,12}$/;

/** Vimeo ya da Dailymotion bağlantısından tür ve video kimliğini çıkarır (Vimeo özel videolarda "id/hash"). */
export function platformCikar(metin: string): { tur: "vimeo" | "dailymotion"; videoId: string } | null {
  try {
    const u = new URL(metin.trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const p = /(?:^|\/)(\d{1,12})(?:\/([0-9a-f]{6,20}))?(?:\/|$)/.exec(u.pathname);
      if (!p) return null;
      const hash = p[2] ?? u.searchParams.get("h") ?? "";
      const id = hash && /^[0-9a-f]{6,20}$/.test(hash) ? `${p[1]}/${hash}` : p[1];
      return VIMEO_ID.test(id) ? { tur: "vimeo", videoId: id } : null;
    }
    if (host === "dailymotion.com" || host === "dai.ly") {
      const p = host === "dai.ly" ? /^\/([A-Za-z0-9]+)/.exec(u.pathname) : /\/video\/([A-Za-z0-9]+)/.exec(u.pathname);
      return p && DM_ID.test(p[1]) ? { tur: "dailymotion", videoId: p[1] } : null;
    }
  } catch { /* URL değil */ }
  return null;
}

/** Gömülü oynatıcının adresi. Kimlik karşıdan geldiği için burada yeniden doğrulanır; geçersizse null. */
export function gomuluAdres(tur: IzlemeTuru, videoId: string, ilkSn: number): string | null {
  if (tur === "youtube") {
    return YT_ID.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&start=${ilkSn}` : null;
  }
  if (tur === "vimeo") {
    if (!VIMEO_ID.test(videoId)) return null;
    const [id, h] = videoId.split("/");
    return `https://player.vimeo.com/video/${id}?autoplay=1${h ? `&h=${h}` : ""}#t=${ilkSn}s`;
  }
  if (tur === "dailymotion") {
    return DM_ID.test(videoId) ? `https://www.dailymotion.com/embed/video/${videoId}?api=postMessage&autoplay=1&start=${ilkSn}` : null;
  }
  return null;
}

/**
 * İnternetteki doğrudan video adresini doğrular: yalnızca https, kullanıcı bilgisi yok.
 * Odadaki herkesin tarayıcısı bu adresi açacağı için, karşıdan gelen adresler de aynı kuraldan geçirilir.
 */
export function videoLinkiCoz(metin: string): string | null {
  const s = metin.trim();
  if (!s || s.length > 2000) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
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
  /** Verilirse "Ekran / Site Paylaş" sekmesi görünür; herhangi bir siteyi ekran paylaşımıyla canlı gösterir */
  onEkranPaylas?: () => void;
  ekranEngeli?: string;
};

export default function BirlikteIzle({ durum, baslatanAd, benId, onDegistir, onKapatPanel, onEkranPaylas, ekranEngeli }: Props) {
  const [sekme, setSekme] = useState<"youtube" | "dosya" | "link" | "ekran">("youtube");
  const [videoHatasi, setVideoHatasi] = useState(false);
  const [girdi, setGirdi] = useState("");
  const [hata, setHata] = useState("");
  const [buyuk, setBuyuk] = useState(false);
  const [yerelUrl, setYerelUrl] = useState<string | null>(null);
  const [yerelDosyaAdi, setYerelDosyaAdi] = useState<string>("");

  const kutuRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ilkSnRef = useRef<number>(0);
  const sonVideoRef = useRef<string>("");
  const dosyaGirdiRef = useRef<HTMLInputElement>(null);

  const tur: IzlemeTuru = durum?.tur ?? "youtube";
  const baslatanBenim = durum ? durum.baslatanId === benId : false;
  const videoMu = tur === "dosya" || tur === "link"; // HTML5 <video> ile oynatılanlar
  const linkKaynak = durum && tur === "link" ? videoLinkiCoz(durum.videoId) : null;
  const videoKaynak = tur === "link" ? linkKaynak : yerelUrl;

  if (durum && sonVideoRef.current !== durum.videoId) {
    sonVideoRef.current = durum.videoId;
    ilkSnRef.current = hesaplananKonum(durum);
  } else if (!durum) {
    sonVideoRef.current = "";
  }

  // Gömülü oynatıcıya (YouTube / Vimeo / Dailymotion) konum ve oynat-duraklat komutu gönderir
  function gomuluSenkron(d: IzlemeDurumu) {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    const hedefSn = hesaplananKonum(d);
    const k = d.tur ?? "youtube";
    try {
      if (k === "youtube") {
        const yt = (func: string, args: unknown[] = []) => w.postMessage(JSON.stringify({ event: "command", func, args }), "*");
        yt("seekTo", [hedefSn, true]);
        yt(d.oynuyor ? "playVideo" : "pauseVideo");
      } else if (k === "vimeo") {
        w.postMessage(JSON.stringify({ method: "setCurrentTime", value: hedefSn }), "https://player.vimeo.com");
        w.postMessage(JSON.stringify({ method: d.oynuyor ? "play" : "pause" }), "https://player.vimeo.com");
      } else if (k === "dailymotion") {
        w.postMessage(`seek|${hedefSn}`, "https://www.dailymotion.com");
        w.postMessage(d.oynuyor ? "play" : "pause", "https://www.dailymotion.com");
      }
    } catch { /* yoksay */ }
  }

  // Gömülü oynatıcı senkronu
  useEffect(() => {
    if (!durum || !GOMULU.includes(durum.tur ?? "youtube")) return;
    gomuluSenkron(durum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum]);

  // Yerel HTML5 Video senkronu
  useEffect(() => {
    if (!durum || (durum.tur !== "dosya" && durum.tur !== "link") || !videoRef.current) return;
    const v = videoRef.current;
    const hedefSn = hesaplananKonum(durum);
    if (Math.abs(v.currentTime - hedefSn) > 1.5) {
      v.currentTime = hedefSn;
    }
    if (durum.oynuyor && v.paused) {
      void v.play().catch(() => {});
    } else if (!durum.oynuyor && !v.paused) {
      v.pause();
    }
  }, [durum]);

  useEffect(() => { setVideoHatasi(false); }, [durum?.videoId]);

  useEffect(() => {
    if (!buyuk) return;
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") setBuyuk(false); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [buyuk]);

  // Bellek sızıntısını önlemek için oluşturulan Blob URL'yi temizle
  useEffect(() => {
    return () => {
      if (yerelUrl) URL.revokeObjectURL(yerelUrl);
    };
  }, [yerelUrl]);

  function baslat(e: React.FormEvent) {
    e.preventDefault();
    const id = youtubeIdCikar(girdi);
    const p = id ? null : platformCikar(girdi);
    if (!id && !p) {
      setHata("Geçerli bir YouTube, Vimeo veya Dailymotion bağlantısı yapıştır.");
      return;
    }
    setHata("");
    setGirdi("");
    onDegistir({ tur: id ? "youtube" : p!.tur, videoId: id ?? p!.videoId, baslatanId: benId, baslangicSn: 0, oynuyor: true, guncelleme: Date.now() });
  }

  function linkBaslat(e: React.FormEvent) {
    e.preventDefault();
    const adres = videoLinkiCoz(girdi);
    if (!adres) {
      setHata("Geçerli bir https video bağlantısı yapıştır (örn. https://.../film.mp4).");
      return;
    }
    setHata("");
    setGirdi("");
    onDegistir({ tur: "link", videoId: adres, baslatanId: benId, baslangicSn: 0, oynuyor: true, guncelleme: Date.now() });
  }

  function yerelDosyaSec(dosya: File) {
    setHata("");
    if (yerelUrl) URL.revokeObjectURL(yerelUrl);
    const url = URL.createObjectURL(dosya);
    setYerelUrl(url);
    setYerelDosyaAdi(dosya.name);
    onDegistir({
      tur: "dosya",
      videoId: dosya.name,
      baslatanId: benId,
      baslangicSn: 0,
      oynuyor: true,
      guncelleme: Date.now(),
    });
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
    const el = (videoMu ? videoRef.current : iframeRef.current) ?? kutuRef.current;
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
          {durum && (
            <span className="hint">
              {" "}· {tur === "dosya" ? `📁 ${durum.videoId}` : tur === "link" ? `🔗 ${linkKaynak ? new URL(linkKaynak).hostname : t("geçersiz bağlantı")}` : tur === "vimeo" ? "Vimeo" : tur === "dailymotion" ? "Dailymotion" : "YouTube"} ({baslatanAd})
            </span>
          )}
        </span>
        <span className="ekran-dugmeler">
          {durum && (
            <>
              <button type="button" className="linkbtn" onClick={() => sar(-15)} title={t("15 saniye geri")}>⏪ -15s</button>
              <button type="button" className="linkbtn" onClick={oynatDuraklat}>{durum.oynuyor ? "⏸ Duraklat" : "▶️ Oynat"}</button>
              <button type="button" className="linkbtn" onClick={() => sar(15)} title={t("15 saniye ileri")}>+15s ⏩</button>
              <button type="button" className="linkbtn" onClick={() => setBuyuk((b) => !b)} aria-pressed={buyuk}>{buyuk ? t("Küçült") : t("Büyüt")}</button>
              <button type="button" className="linkbtn" onClick={tamEkran}>{t("Tam ekran")}</button>
              <button
                type="button"
                className="linkbtn"
                onClick={() => {
                  setBuyuk(false);
                  if (yerelUrl) { URL.revokeObjectURL(yerelUrl); setYerelUrl(null); }
                  onDegistir(null);
                }}
              >
                {t("Yayını Kapat")}
              </button>
            </>
          )}
          {!durum && onKapatPanel && (
            <button type="button" className="linkbtn" onClick={onKapatPanel}>{t("Kapat")}</button>
          )}
        </span>
      </div>

      {!durum && (
        <div style={{ display: "flex", gap: 6, padding: "8px 12px 0", borderBottom: "1px solid var(--line)" }}>
          <button
            type="button"
            className={"ciple" + (sekme === "youtube" ? " acik" : "")}
            onClick={() => { setSekme("youtube"); setHata(""); }}
          >
            📺 YouTube / Vimeo / Dailymotion
          </button>
          <button
            type="button"
            className={"ciple" + (sekme === "dosya" ? " acik" : "")}
            onClick={() => { setSekme("dosya"); setHata(""); }}
          >
            📁 Bilgisayar / USB Dosyası
          </button>
          <button
            type="button"
            className={"ciple" + (sekme === "link" ? " acik" : "")}
            onClick={() => { setSekme("link"); setHata(""); setGirdi(""); }}
          >
            🔗 Video Bağlantısı
          </button>
          {onEkranPaylas && (
            <button
              type="button"
              className={"ciple" + (sekme === "ekran" ? " acik" : "")}
              onClick={() => { setSekme("ekran"); setHata(""); }}
            >
              🖥️ Site / Ekran Paylaş
            </button>
          )}
        </div>
      )}

      {!durum && sekme === "ekran" && onEkranPaylas && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "10px 12px", alignItems: "center" }}>
          <button type="button" className="pk-btn" onClick={onEkranPaylas} disabled={!!ekranEngeli}>
            🖥️ {t("Paylaşmaya Başla")}
          </button>
          <span style={{ flexBasis: "100%", fontSize: 13, color: "var(--muted)" }}>
            {ekranEngeli ?? t("İzlemek istediğin siteyi başka bir sekmede aç, sonra paylaşırken o sekmeyi seç ve \"Sekme sesini paylaş\"ı işaretle. Odadaki herkes canlı izler. Netflix gibi korumalı içeriklerde görüntü siyah gelebilir.")}
          </span>
        </div>
      )}

      {!durum && sekme === "youtube" && (
        <form className="birlikte-izle-form" onSubmit={baslat} style={{ display: "flex", gap: 8, padding: "10px 12px", alignItems: "center", flex: "none" }}>
          <input
            type="url"
            value={girdi}
            onChange={(e) => { setGirdi(e.target.value); if (hata) setHata(""); }}
            placeholder={t("YouTube, Vimeo veya Dailymotion bağlantısı yapıştır")}
            aria-label={t("Video sitesi bağlantısı")}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="submit" className="pk-btn" disabled={!girdi.trim()}>{t("Başlat")}</button>
        </form>
      )}

      {!durum && sekme === "link" && (
        <form className="birlikte-izle-form" onSubmit={linkBaslat} style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 12px", alignItems: "center", flex: "none" }}>
          <input
            type="url"
            value={girdi}
            onChange={(e) => { setGirdi(e.target.value); if (hata) setHata(""); }}
            placeholder={t("Video bağlantısı yapıştır (örn. https://.../film.mp4)")}
            aria-label={t("Video bağlantısı")}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="submit" className="pk-btn" disabled={!girdi.trim()}>{t("Başlat")}</button>
          <span style={{ flexBasis: "100%", fontSize: 13, color: "var(--muted)" }}>
            {t("Doğrudan video dosyası adresi olmalı: MP4, WebM, OGG veya MOV (https). Netflix, Twitch gibi sayfa bağlantıları oynatılamaz.")}
          </span>
        </form>
      )}

      {!durum && sekme === "dosya" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "10px 12px", alignItems: "center" }}>
          <input
            ref={dosyaGirdiRef}
            type="file"
            accept="video/*,.mkv,.mp4,.webm,.mov,.avi"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) yerelDosyaSec(f);
            }}
          />
          <button
            type="button"
            className="pk-btn"
            onClick={() => dosyaGirdiRef.current?.click()}
          >
            📂 Bilgisayardan veya USB'den Video Seç
          </button>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            MP4, WebM, MKV veya MOV desteklenir.
          </span>
        </div>
      )}

      {hata && <div className="err" role="alert" style={{ padding: "0 12px 8px", flex: "none" }}>{t(hata)}</div>}

      {durum ? (
        <div className="birlikte-izle-video" style={{ position: "relative", flex: "1 1 0", minHeight: 220, width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {GOMULU.includes(tur) ? (
            gomuluAdres(tur, durum.videoId, ilkSnRef.current) ? (
              <iframe
                ref={iframeRef}
                title={t("Birlikte İzle oynatıcısı")}
                src={gomuluAdres(tur, durum.videoId, ilkSnRef.current)!}
                onLoad={() => gomuluSenkron(durum)}
                style={{ flex: 1, width: "100%", height: "100%", border: 0, display: "block" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              <div style={{ color: "#fff", textAlign: "center", padding: 24, maxWidth: 520 }}>
                <div style={{ fontSize: 32 }}>⚠️</div>
                <p>{t("Geçersiz video bağlantısı, oynatılamıyor.")}</p>
              </div>
            )
          ) : (
            videoKaynak ? (
              <video
                ref={videoRef}
                src={videoKaynak}
                onError={() => { if (tur === "link") setVideoHatasi(true); }}
                controls
                playsInline
                autoPlay
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                onSeeked={(e) => {
                  if (baslatanBenim) {
                    const yeniSn = Math.floor(e.currentTarget.currentTime);
                    onDegistir({ ...durum, baslangicSn: yeniSn, guncelleme: Date.now() });
                  }
                }}
                onPlay={() => {
                  if (baslatanBenim && !durum.oynuyor) {
                    const simdiSn = videoRef.current ? Math.floor(videoRef.current.currentTime) : durum.baslangicSn;
                    onDegistir({ ...durum, baslangicSn: simdiSn, oynuyor: true, guncelleme: Date.now() });
                  }
                }}
                onPause={() => {
                  if (baslatanBenim && durum.oynuyor) {
                    const simdiSn = videoRef.current ? Math.floor(videoRef.current.currentTime) : durum.baslangicSn;
                    onDegistir({ ...durum, baslangicSn: simdiSn, oynuyor: false, guncelleme: Date.now() });
                  }
                }}
              />
            ) : tur === "link" ? (
              <div style={{ color: "#fff", textAlign: "center", padding: 24, maxWidth: 520 }}>
                <div style={{ fontSize: 32 }}>⚠️</div>
                <p>{t("Bu bağlantı geçerli bir https video adresi değil, oynatılamıyor.")}</p>
              </div>
            ) : (
              <div style={{ color: "#fff", textAlign: "center", padding: 24, maxWidth: 520, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 32 }}>📁</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{baslatanAd} bir yerel video başlattı:</div>
                <div style={{ background: "rgba(255,255,255,0.1)", padding: "6px 14px", borderRadius: 8, fontFamily: "monospace" }}>
                  {durum.videoId}
                </div>
                <p style={{ fontSize: 13, color: "#ccc", margin: 0 }}>
                  Aynı dosyayı bilgisayarınızdan veya USB'nizden seçerek tam senkronize olarak izleyebilirsiniz:
                </p>
                <input
                  type="file"
                  accept="video/*,.mkv,.mp4,.webm,.mov,.avi"
                  style={{ display: "none" }}
                  id="yerel-katil-dosya"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (yerelUrl) URL.revokeObjectURL(yerelUrl);
                      setYerelUrl(URL.createObjectURL(f));
                      setYerelDosyaAdi(f.name);
                    }
                  }}
                />
                <button
                  type="button"
                  className="pk-btn"
                  onClick={() => document.getElementById("yerel-katil-dosya")?.click()}
                >
                  📂 Dosyayı Bilgisayardan / USB'den Seç
                </button>
              </div>
            )
          )}
          {videoHatasi && tur === "link" && (
            <div role="alert" style={{ position: "absolute", left: 12, right: 12, bottom: 12, background: "rgba(179,38,30,0.92)", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
              {t("Video yüklenemedi. Bağlantı doğrudan bir video dosyasına (MP4, WebM, OGG, MOV) çıkmıyor ya da site başka sitelerden oynatmayı engelliyor.")}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--muted)", padding: 24, textAlign: "center" }}>
          🎬 {t("Yukarıdan bir YouTube ya da video bağlantısı yapıştırın veya Bilgisayar / USB'den video dosyası seçin; odadaki herkes birlikte izlesin.")}
        </div>
      )}
    </section>
  );
}
