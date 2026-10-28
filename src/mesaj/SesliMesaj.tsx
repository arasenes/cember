import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { gosterimBoyutu } from "../ekler";
import { t } from "../i18n";
import { cloudflareWhisper, cloudflareYukle } from "../cloudflareApi";

const SESLI_DESEN = /^\[sesli:(https?:\/\/[^\s|]+|[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:webp|jpg))\|(\d{1,3})\]$/;
const DM_RESIM_DESEN = /^\[dmresim:(https?:\/\/[^\s|]+|[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:webp|jpg))\|(\d{1,5})x(\d{1,5})\](?:\n([\s\S]*))?$/;

export function sesliMesajCoz(metin: string): { yol: string; sureSn: number } | null {
  const m = SESLI_DESEN.exec(metin.trim());
  if (!m) return null;
  return { yol: m[1], sureSn: Math.max(1, Number(m[2]) || 1) };
}

export function dmResimCoz(metin: string): { yol: string; genislik: number; yukseklik: number; yazi: string } | null {
  const m = DM_RESIM_DESEN.exec(metin.trim());
  if (!m) return null;
  return {
    yol: m[1],
    genislik: Math.max(1, Number(m[2]) || 320),
    yukseklik: Math.max(1, Number(m[3]) || 240),
    yazi: (m[4] ?? "").trim(),
  };
}

function sureBicimle(sn: number): string {
  const s = Math.max(0, Math.round(sn));
  const dk = Math.floor(s / 60);
  const kal = s % 60;
  return `${dk}:${kal < 10 ? "0" : ""}${kal}`;
}

const urlOnbellek = new Map<string, { url: string; bitis: number }>();

async function imzaliUrlAl(yol: string): Promise<string | null> {
  if (yol.startsWith("http://") || yol.startsWith("https://")) return yol;
  const simdi = Date.now();
  const varOlan = urlOnbellek.get(yol);
  if (varOlan && varOlan.bitis > simdi) return varOlan.url;
  const { data, error } = await supabase.storage.from("avatarlar").createSignedUrl(yol, 3600);
  if (error || !data?.signedUrl) return null;
  try {
    const r = await fetch(data.signedUrl);
    if (!r.ok) return data.signedUrl;
    const b = await r.blob();
    const sesBlob = new Blob([b], { type: "audio/webm" });
    const nesneUrl = URL.createObjectURL(sesBlob);
    urlOnbellek.set(yol, { url: nesneUrl, bitis: simdi + 50 * 60_000 });
    return nesneUrl;
  } catch {
    return data.signedUrl;
  }
}

/** Sohbet içindeki sesli mesaj oynatıcısı. */
export function SesliMesajOynatici({ yol, sureSn }: { yol: string; sureSn: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [oynuyor, setOynuyor] = useState(false);
  const [gecen, setGecen] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [transkript, setTranskript] = useState<string | null>(null);
  const [transkriptYukleniyor, setTranskriptYukleniyor] = useState(false);
  const sesRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      sesRef.current?.pause();
      sesRef.current = null;
    };
  }, []);

  async function oynatDuraklat() {
    if (oynuyor && sesRef.current) {
      sesRef.current.pause();
      setOynuyor(false);
      return;
    }
    let u = url;
    if (!u) {
      setYukleniyor(true);
      u = await imzaliUrlAl(yol);
      setYukleniyor(false);
      if (!u) return;
      setUrl(u);
    }
    if (!sesRef.current) {
      const a = new Audio(u);
      a.ontimeupdate = () => setGecen(a.currentTime);
      a.onended = () => { setOynuyor(false); setGecen(0); };
      a.onpause = () => setOynuyor(false);
      sesRef.current = a;
    }
    try {
      await sesRef.current.play();
      setOynuyor(true);
    } catch {
      setOynuyor(false);
    }
  }

  async function metneDok() {
    if (transkriptYukleniyor) return;
    if (transkript) {
      setTranskript(null);
      return;
    }
    setTranskriptYukleniyor(true);
    try {
      let u = url;
      if (!u) {
        u = await imzaliUrlAl(yol);
        if (u) setUrl(u);
      }
      if (!u) throw new Error("Ses adresi alınamadı");
      const metin = await cloudflareWhisper(u);
      setTranskript(metin?.trim() ? metin.trim() : "Ses anlaşılamadı veya sessiz.");
    } catch {
      setTranskript("Metne dökülemedi.");
    } finally {
      setTranskriptYukleniyor(false);
    }
  }

  const oran = Math.min(100, Math.round((gecen / Math.max(1, sureSn)) * 100));

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
      <div
        className="sesli-mesaj-kutu"
        role="group"
        aria-label={t("Sesli mesaj")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.06)",
          minWidth: 230,
          maxWidth: 320,
        }}
      >
        <button
          type="button"
          className="sq"
          onClick={() => void oynatDuraklat()}
          disabled={yukleniyor}
          aria-label={oynuyor ? t("Duraklat") : t("Sesli mesajı oynat")}
          style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }}
        >
          {yukleniyor ? "…" : oynuyor ? "⏸" : "▶️"}
        </button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
            <div style={{ width: `${oran}%`, height: "100%", background: "var(--acc, #5865f2)", transition: "width 0.12s linear" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="hint" style={{ fontSize: 11 }}>
              🎤 {oynuyor ? `${sureBicimle(gecen)} / ${sureBicimle(sureSn)}` : sureBicimle(sureSn)}
            </span>
            <button
              type="button"
              onClick={() => void metneDok()}
              disabled={transkriptYukleniyor}
              title="Cloudflare Whisper AI ile metne dök"
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#ff9f1c",
                background: "rgba(255,159,28,0.12)",
                border: "none",
                borderRadius: 4,
                padding: "2px 6px",
                cursor: "pointer",
              }}
            >
              {transkriptYukleniyor ? "…" : "🎙️ Yazı"}
            </button>
          </div>
        </div>
      </div>
      {transkript && (
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.3)",
            borderLeft: "3px solid #ff9f1c",
            fontSize: 12,
            color: "rgba(255,255,255,0.9)",
            lineHeight: 1.4,
            maxWidth: 320,
          }}
        >
          <span style={{ fontSize: 10, color: "#ff9f1c", fontWeight: 700, display: "block", marginBottom: 2 }}>
            ✨ Whisper AI:
          </span>
          {transkript}
        </div>
      )}
    </div>
  );
}

/** DM içinde gönderilen resmi imzalı adresle gösterir. */
export function DmEkResim({ yol, genislik, yukseklik, alt }: { yol: string; genislik: number; yukseklik: number; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [buyuk, setBuyuk] = useState(false);
  const { g, y } = gosterimBoyutu(genislik, yukseklik);

  useEffect(() => {
    let iptal = false;
    imzaliUrlAl(yol).then((u) => {
      if (!iptal && u) setUrl(u);
    });
    return () => { iptal = true; };
  }, [yol]);

  if (!url) return <div className="ek-iskelet" style={{ width: g, height: y }} aria-label={t("Resim yükleniyor")} />;
  return (
    <>
      <button type="button" className="ek-resim-btn" onClick={() => setBuyuk(true)} aria-label={alt} style={{ padding: 0, border: 0, background: "none", cursor: "zoom-in", display: "block", marginTop: 4 }}>
        <img src={url} alt={alt} width={g} height={y} loading="lazy" style={{ borderRadius: 10, maxWidth: "100%", height: "auto", display: "block" }} />
      </button>
      {buyuk && (
        <div className="ek-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setBuyuk(false)}>
          <img src={url} alt={alt} />
        </div>
      )}
    </>
  );
}

/** Yazı alanının yanında sesli mesaj kaydetme düğmesi (en çok 60 sn). */
export function SesKayitDugmesi({
  odaId,
  uyeId,
  disabled,
  onGonder,
  onHata,
}: {
  odaId: string;
  uyeId: string;
  disabled?: boolean;
  onGonder: (etiketMetni: string) => Promise<void> | void;
  onHata: (mesaj: string) => void;
}) {
  const [kayitta, setKayitta] = useState(false);
  const [sure, setSure] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const parcalarRef = useRef<BlobPart[]>([]);
  const akisRef = useRef<MediaStream | null>(null);
  const sayacRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baslangicRef = useRef(0);

  function temizle() {
    if (sayacRef.current) { clearInterval(sayacRef.current); sayacRef.current = null; }
    akisRef.current?.getTracks().forEach((tr) => tr.stop());
    akisRef.current = null;
    recRef.current = null;
    parcalarRef.current = [];
    setKayitta(false);
    setSure(0);
  }

  useEffect(() => () => temizle(), []);

  async function baslat() {
    if (disabled || yukleniyor) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onHata("Tarayıcın ses kaydını desteklemiyor.");
      return;
    }
    try {
      const akis = await navigator.mediaDevices.getUserMedia({ audio: true });
      akisRef.current = akis;
      parcalarRef.current = [];
      const mime = MediaRecorder.isTypeSupported?.("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported?.("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = mime ? new MediaRecorder(akis, { mimeType: mime, audioBitsPerSecond: 24000 }) : new MediaRecorder(akis);
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) parcalarRef.current.push(e.data); };
      recRef.current = rec;
      rec.start(200);
      baslangicRef.current = Date.now();
      setKayitta(true);
      setSure(0);
      sayacRef.current = setInterval(() => {
        const sn = Math.floor((Date.now() - baslangicRef.current) / 1000);
        setSure(sn);
        if (sn >= 60) void bitirVeGonder();
      }, 500);
    } catch {
      temizle();
      onHata("Mikrofon izni verilmedi veya mikrofon bulunamadı.");
    }
  }

  async function bitirVeGonder() {
    const rec = recRef.current;
    if (!rec) return;
    const gecenSn = Math.max(1, Math.round((Date.now() - baslangicRef.current) / 1000));
    await new Promise<void>((coz) => {
      rec.onstop = () => coz();
      try { if (rec.state !== "inactive") rec.stop(); else coz(); } catch { coz(); }
    });
    const parcalar = [...parcalarRef.current];
    temizle();
    if (!parcalar.length) return;
    const blob = new Blob(parcalar, { type: "image/webp" });
    if (blob.size > 1000 * 1024) {
      onHata("Ses kaydı çok uzun (en fazla 1 MB).");
      return;
    }
    const yol = `${odaId}/${uyeId}/${crypto.randomUUID()}.webp`;
    setYukleniyor(true);
    // Cloudflare R2'ye yükle
    const r2 = await cloudflareYukle(blob, `ses-${Date.now()}.webp`);
    let finalYol = yol;
    if (r2?.url) {
      finalYol = r2.url;
    } else {
      const { error } = await supabase.storage.from("avatarlar").upload(yol, blob, { contentType: "image/webp", upsert: false });
      if (error) {
        setYukleniyor(false);
        onHata("Sesli mesaj yüklenemedi.");
        return;
      }
    }
    setYukleniyor(false);
    await onGonder(`[sesli:${finalYol}|${gecenSn}]`);
  }

  if (!kayitta) {
    return (
      <button
        type="button"
        className="sq ek-sec"
        onClick={() => void baslat()}
        disabled={disabled || yukleniyor}
        aria-label={t("Sesli mesaj kaydet")}
        title={t("Sesli mesaj kaydet")}
      >
        🎤
      </button>
    );
  }

  return (
    <span className="ses-kayit-cubuk" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className="hint" style={{ color: "#ef4444", fontWeight: 600, fontSize: 12 }}>🔴 {sureBicimle(sure)}</span>
      <button type="button" className="sq send" onClick={() => void bitirVeGonder()} aria-label={t("Sesli mesajı gönder")} title={t("Gönder")}>✓</button>
      <button type="button" className="sq" onClick={temizle} aria-label={t("Kaydı iptal et")} title={t("İptal")}>✕</button>
    </span>
  );
}
