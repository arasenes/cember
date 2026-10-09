import { useEffect, useRef, useState } from "react";
import type { Izlenen } from "./ekranOrtak";
import { sesYoneticisi } from "./ses/sesDuzeyi";
import Ikon from "./mesaj/Ikon";
import { t } from "./i18n";

type Props = { izlenen: Izlenen; yapanAd: string; sesAnahtari?: string };

type TamEkranVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/** Başkasının paylaştığı ekranı gösterir. Görüntü ve (varsa) ses aynı akıştan, aynı elemandan çalınır ki
 *  ikisi birbirinden kopmasın; kişi başı ses düzeyi (sesAnahtari verilmişse) o elemandan WebAudio ile ayarlanır. */
export default function EkranPaneli({ izlenen, yapanAd, sesAnahtari }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [buyuk, setBuyuk] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = izlenen.akis;
    // Tarayıcı sesli otomatik oynatmayı engellerse kullanıcı denetimlerdeki oynat düğmesine basar
    try { void Promise.resolve(v.play()).catch(() => {}); } catch { /* oynatma engellendi */ }
    if (sesAnahtari && izlenen.akis.getAudioTracks().length) sesYoneticisi.kaydetElemandan(sesAnahtari, v);
    return () => { v.srcObject = null; };
  }, [izlenen.akis, sesAnahtari]);
  useEffect(() => {
    return () => { if (sesAnahtari) sesYoneticisi.kaldir(sesAnahtari); };
  }, [sesAnahtari]);
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
    <section className={"ekran-panel" + (buyuk ? " buyuk" : "")} aria-label={t(`${yapanAd} ekranını paylaşıyor`)}>
      <div className="ekran-ust">
        <span className="ekran-ust-ad"><Ikon ad="ekran" boyut={16} /> <b>{yapanAd}</b>{" "}{t("ekranını paylaşıyor")}</span>
        <span className="ekran-dugmeler">
          <button className="linkbtn" onClick={() => setBuyuk((b) => !b)} aria-pressed={buyuk}>{buyuk ? "Küçült" : "Büyüt"}</button>
          <button className="linkbtn" onClick={tamEkran}>{t("Tam ekran")}</button>
        </span>
      </div>
      <video ref={ref} controls autoPlay playsInline disablePictureInPicture={false} aria-label={t(`${yapanAd} ekran yayını`)} />
    </section>
  );
}
