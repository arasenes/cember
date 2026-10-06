import { useEffect, useRef, useState } from "react";
import type { Izlenen } from "./ekranOrtak";

type Props = { izlenen: Izlenen; yapanAd: string };

type TamEkranVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/** Başkasının paylaştığı ekranı gösterir. Ses düzeyi için tarayıcının kendi denetimleri kullanılır. */
export default function EkranPaneli({ izlenen, yapanAd }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [buyuk, setBuyuk] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = izlenen.akis;
    // Tarayıcı sesli otomatik oynatmayı engellerse kullanıcı denetimlerdeki oynat düğmesine basar
    try { void Promise.resolve(v.play()).catch(() => {}); } catch { /* oynatma engellendi */ }
    return () => { v.srcObject = null; };
  }, [izlenen.akis]);
  useEffect(() => {
    if (!buyuk) return;
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") setBuyuk(false); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [buyuk]);

  function tamEkran() {
    const v = ref.current as TamEkranVideo | null;
    if (!v) return;
    try {
      if (v.requestFullscreen) void v.requestFullscreen().catch(() => setBuyuk(true));
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      else setBuyuk(true);
    } catch { setBuyuk(true); }
  }

  return (
    <section className={"ekran-panel" + (buyuk ? " buyuk" : "")} aria-label={`${yapanAd} ekranını paylaşıyor`}>
      <div className="ekran-ust">
        <span><span aria-hidden="true">🖥️</span> <b>{yapanAd}</b> ekranını paylaşıyor</span>
        <span className="ekran-dugmeler">
          <button className="linkbtn" onClick={() => setBuyuk((b) => !b)} aria-pressed={buyuk}>{buyuk ? "Küçült" : "Büyüt"}</button>
          <button className="linkbtn" onClick={tamEkran}>Tam ekran</button>
        </span>
      </div>
      <video ref={ref} controls autoPlay playsInline disablePictureInPicture={false} aria-label={`${yapanAd} ekran yayını`} />
    </section>
  );
}
