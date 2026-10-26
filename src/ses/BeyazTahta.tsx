import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";

export type CizimOlayi = {
  uyeId: string;
  renk: string;
  mod: "kalem" | "lazer" | "temizle";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  zaman: number;
};

export const TAHTA_RENKLERI = [
  { kod: "#ff4d4f", ad: "Kırmızı" },
  { kod: "#ffd43b", ad: "Sarı" },
  { kod: "#51cf66", ad: "Yeşil" },
  { kod: "#339af0", ad: "Mavi" },
  { kod: "#cc5de8", ad: "Mor" },
  { kod: "#ffffff", ad: "Beyaz" },
];

export function gecerliCizimOlayiMi(v: unknown): v is CizimOlayi {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.uyeId === "string" &&
    typeof o.renk === "string" &&
    (o.mod === "kalem" || o.mod === "lazer" || o.mod === "temizle") &&
    typeof o.x0 === "number" &&
    typeof o.y0 === "number" &&
    typeof o.x1 === "number" &&
    typeof o.y1 === "number"
  );
}

/**
 * Ekran paylaşımı üzerinde şeffaf lazer işaretçi ve 3.5 saniyede sönen fosforlu kalem katmanı.
 */
export function EkranCizimKatmani({
  aktif,
  benId,
  renk,
  yapanAd,
  onGonder,
}: {
  aktif: boolean;
  benId: string;
  renk: string;
  yapanAd?: (uyeId: string) => string;
  onGonder?: (olay: CizimOlayi) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const izlerRef = useRef<(CizimOlayi & { yerelZaman: number })[]>([]);
  const ciziyorRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const dinle = (e: Event) => {
      const olay = (e as CustomEvent<CizimOlayi>).detail;
      if (!gecerliCizimOlayiMi(olay)) return;
      if (olay.mod === "temizle") {
        izlerRef.current = [];
        return;
      }
      izlerRef.current.push({ ...olay, yerelZaman: performance.now() });
    };
    window.addEventListener("cember-cizim-olayi", dinle);
    return () => window.removeEventListener("cember-cizim-olayi", dinle);
  }, []);

  useEffect(() => {
    let raf = 0;
    const ciz = () => {
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx && typeof ctx.clearRect === "function") {
          const simdi = performance.now();
          izlerRef.current = izlerRef.current.filter((iz) => simdi - iz.yerelZaman < 3500);
          ctx.clearRect(0, 0, c.width, c.height);
          for (const iz of izlerRef.current) {
            const yas = simdi - iz.yerelZaman;
            const alfa = Math.max(0, 1 - yas / 3500);
            ctx.save();
            ctx.globalAlpha = alfa;
            ctx.strokeStyle = iz.renk;
            ctx.lineWidth = iz.mod === "lazer" ? 5 : 3.5;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(iz.x0 * c.width, iz.y0 * c.height);
            ctx.lineTo(iz.x1 * c.width, iz.y1 * c.height);
            ctx.stroke();
            ctx.restore();
          }
          // Son lazer noktalarında kişinin adını göster
          const sonNoktalar = new Map<string, CizimOlayi & { yerelZaman: number }>();
          for (const iz of izlerRef.current) {
            if (simdi - iz.yerelZaman < 900) sonNoktalar.set(iz.uyeId, iz);
          }
          for (const [uid, iz] of sonNoktalar) {
            const x = iz.x1 * c.width;
            const y = iz.y1 * c.height;
            ctx.save();
            ctx.fillStyle = iz.renk;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
            if (yapanAd) {
              const etiket = uid === benId ? "Sen" : yapanAd(uid);
              ctx.font = "bold 12px sans-serif";
              ctx.fillStyle = iz.renk;
              ctx.fillText(etiket, x + 10, y + 4);
            }
            ctx.restore();
          }
        }
      }
      raf = requestAnimationFrame(ciz);
    };
    raf = requestAnimationFrame(ciz);
    return () => cancelAnimationFrame(raf);
  }, [benId, yapanAd]);

  const konumBul = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0.5, y: 0.5 };
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };

  const yayinla = (x0: number, y0: number, x1: number, y1: number) => {
    const olay: CizimOlayi = {
      uyeId: benId,
      renk,
      mod: "lazer",
      x0,
      y0,
      x1,
      y1,
      zaman: Date.now(),
    };
    window.dispatchEvent(new CustomEvent("cember-cizim-olayi", { detail: olay }));
    onGonder?.(olay);
  };

  return (
    <canvas
      ref={canvasRef}
      width={960}
      height={540}
      data-testid="ekran-cizim-katmani"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: aktif ? "auto" : "none",
        cursor: aktif ? "crosshair" : "default",
        zIndex: 5,
      }}
      onPointerDown={(e) => {
        if (!aktif) return;
        const k = konumBul(e);
        ciziyorRef.current = k;
        yayinla(k.x, k.y, k.x, k.y);
      }}
      onPointerMove={(e) => {
        if (!aktif || !ciziyorRef.current) return;
        const k = konumBul(e);
        const onc = ciziyorRef.current;
        ciziyorRef.current = k;
        yayinla(onc.x, onc.y, k.x, k.y);
      }}
      onPointerUp={() => { ciziyorRef.current = null; }}
      onPointerLeave={() => { ciziyorRef.current = null; }}
    />
  );
}

/**
 * Sesli odada herkesin gerçek zamanlı birlikte çizim yapabildiği ortak Beyaz Tahta bileşeni.
 */
export default function BeyazTahta({
  benId,
  yapanAd,
  onGonder,
  onKapat,
}: {
  benId: string;
  yapanAd: (uyeId: string) => string;
  onGonder?: (olay: CizimOlayi) => void;
  onKapat: () => void;
}) {
  const [renk, setRenk] = useState("#ff4d4f");
  const [mod, setMod] = useState<"kalem" | "lazer">("kalem");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kaliciIzler = useRef<CizimOlayi[]>([]);
  const geciciIzler = useRef<(CizimOlayi & { yerelZaman: number })[]>([]);
  const ciziyorRef = useRef<{ x: number; y: number } | null>(null);

  const yenidenCiz = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx || typeof ctx.clearRect !== "function") return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const iz of kaliciIzler.current) {
      ctx.save();
      ctx.strokeStyle = iz.renk;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(iz.x0 * c.width, iz.y0 * c.height);
      ctx.lineTo(iz.x1 * c.width, iz.y1 * c.height);
      ctx.stroke();
      ctx.restore();
    }
    const simdi = performance.now();
    geciciIzler.current = geciciIzler.current.filter((g) => simdi - g.yerelZaman < 3000);
    for (const iz of geciciIzler.current) {
      const alfa = Math.max(0, 1 - (simdi - iz.yerelZaman) / 3000);
      ctx.save();
      ctx.globalAlpha = alfa;
      ctx.strokeStyle = iz.renk;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(iz.x0 * c.width, iz.y0 * c.height);
      ctx.lineTo(iz.x1 * c.width, iz.y1 * c.height);
      ctx.stroke();
      ctx.restore();
    }
  };

  useEffect(() => {
    const dinle = (e: Event) => {
      const olay = (e as CustomEvent<CizimOlayi>).detail;
      if (!gecerliCizimOlayiMi(olay)) return;
      if (olay.mod === "temizle") {
        kaliciIzler.current = [];
        geciciIzler.current = [];
        yenidenCiz();
        return;
      }
      if (olay.mod === "kalem") {
        kaliciIzler.current.push(olay);
      } else {
        geciciIzler.current.push({ ...olay, yerelZaman: performance.now() });
      }
      yenidenCiz();
    };
    window.addEventListener("cember-cizim-olayi", dinle);
    const t = setInterval(yenidenCiz, 80);
    return () => {
      window.removeEventListener("cember-cizim-olayi", dinle);
      clearInterval(t);
    };
  }, []);

  const konumBul = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0.5, y: 0.5 };
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };

  const cizgiGonder = (x0: number, y0: number, x1: number, y1: number) => {
    const olay: CizimOlayi = {
      uyeId: benId,
      renk,
      mod,
      x0,
      y0,
      x1,
      y1,
      zaman: Date.now(),
    };
    window.dispatchEvent(new CustomEvent("cember-cizim-olayi", { detail: olay }));
    onGonder?.(olay);
  };

  const temizle = () => {
    const olay: CizimOlayi = {
      uyeId: benId,
      renk,
      mod: "temizle",
      x0: 0,
      y0: 0,
      x1: 0,
      y1: 0,
      zaman: Date.now(),
    };
    window.dispatchEvent(new CustomEvent("cember-cizim-olayi", { detail: olay }));
    onGonder?.(olay);
  };

  // suppress unused warning while keeping yapanAd available for tooltip/info
  void yapanAd;

  return (
    <section className="ekran-panel beyaz-tahta" aria-label={t("Ortak Beyaz Tahta")} style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
      <div className="ekran-ust" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <span className="ekran-ust-ad">🎨 <b>{t("Ortak Beyaz Tahta")}</b></span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {TAHTA_RENKLERI.map((r) => (
            <button
              key={r.kod}
              type="button"
              onClick={() => setRenk(r.kod)}
              aria-label={t(r.ad)}
              aria-pressed={renk === r.kod}
              style={{
                width: 20, height: 20, borderRadius: "50%", background: r.kod,
                border: renk === r.kod ? "2px solid #fff" : "1px solid rgba(255,255,255,0.3)",
                cursor: "pointer", padding: 0,
              }}
            />
          ))}
          <button type="button" className={"linkbtn" + (mod === "kalem" ? " vurgulu" : "")} aria-pressed={mod === "kalem"} onClick={() => setMod("kalem")}>
            ✏️ {t("Kalem")}
          </button>
          <button type="button" className={"linkbtn" + (mod === "lazer" ? " vurgulu" : "")} aria-pressed={mod === "lazer"} onClick={() => setMod("lazer")}>
            🎯 {t("Lazer")}
          </button>
          <button type="button" className="linkbtn" onClick={temizle}>
            🗑️ {t("Temizle")}
          </button>
          <button type="button" className="linkbtn" onClick={onKapat}>
            {t("Kapat")}
          </button>
        </div>
      </div>
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#14171f", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          aria-label={t("Çizim alanı")}
          style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair", touchAction: "none" }}
          onPointerDown={(e) => {
            const k = konumBul(e);
            ciziyorRef.current = k;
            cizgiGonder(k.x, k.y, k.x, k.y);
          }}
          onPointerMove={(e) => {
            if (!ciziyorRef.current) return;
            const k = konumBul(e);
            const onc = ciziyorRef.current;
            ciziyorRef.current = k;
            cizgiGonder(onc.x, onc.y, k.x, k.y);
          }}
          onPointerUp={() => { ciziyorRef.current = null; }}
          onPointerLeave={() => { ciziyorRef.current = null; }}
        />
      </div>
    </section>
  );
}
