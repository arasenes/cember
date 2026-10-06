import { useEffect, useRef } from "react";
import type { Izlenen } from "./ekranOrtak";

type Props = { izlenen: Izlenen; yapanAd: string };

/** Başkasının paylaştığı ekranı gösterir. Ses/tam ekran/ses düzeyi için tarayıcının kendi denetimleri kullanılır. */
export default function EkranPaneli({ izlenen, yapanAd }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = izlenen.akis;
    // Tarayıcı sesli otomatik oynatmayı engellerse kullanıcı denetimlerdeki oynat düğmesine basar
    try { void Promise.resolve(v.play()).catch(() => {}); } catch { /* oynatma engellendi */ }
    return () => { v.srcObject = null; };
  }, [izlenen.akis]);
  return (
    <section className="ekran-panel" aria-label={`${yapanAd} ekranını paylaşıyor`}>
      <div className="ekran-ust"><span aria-hidden="true">🖥️</span> <b>{yapanAd}</b> ekranını paylaşıyor</div>
      <video ref={ref} controls autoPlay playsInline disablePictureInPicture={false} aria-label={`${yapanAd} ekran yayını`} />
    </section>
  );
}
