import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { useSesMotoru } from "../src/sesMotoru";

const pcs: RTCPeerConnection[] = [];
const Orijinal = window.RTCPeerConnection;
(window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = class extends Orijinal { constructor(c?: RTCConfiguration) { super(c); pcs.push(this); } };

// Test için ekran yakalamayı canvas akışıyla taklit eder (kafa kesilmiş ortamda gerçek ekran yok)
if (new URLSearchParams(location.search).get("sahteEkran") === "1") {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const c = document.createElement("canvas"); c.width = 1280; c.height = 720;
    const x = c.getContext("2d")!; let n = 0;
    setInterval(() => { x.fillStyle = `hsl(${(n++ * 5) % 360} 80% 50%)`; x.fillRect(0, 0, 1280, 720); x.fillStyle = "#fff"; x.font = "80px sans-serif"; x.fillText("kare " + n, 100, 300); }, 33);
    const st = c.captureStream(30);
    const ac = new AudioContext(); const o = ac.createOscillator(); const d = ac.createMediaStreamDestination(); o.connect(d); o.start();
    d.stream.getAudioTracks().forEach((t) => st.addTrack(t));
    return st;
  };
}

function H() {
  const id = new URLSearchParams(location.search).get("id")!;
  const ses = useSesMotoru(id, () => {}, () => null);
  const [sonuc, setSonuc] = useState("");
  const vRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (vRef.current) vRef.current.srcObject = ses.izlenen?.akis ?? null; }, [ses.izlenen]);
  useEffect(() => {
    const t = setInterval(() => {
      const v = vRef.current;
      const out = {
        durum: ses.durum, motor: ses.motor, bilgi: ses.bilgi, hata: ses.hata, paylasiyorum: ses.paylasiyorum,
        izleyen: ses.izlenen ? ses.izlenen.uyeId : null,
        videoG: v?.videoWidth ?? 0, kare: v?.getVideoPlaybackQuality?.().totalVideoFrames ?? 0,
        sesIzi: ses.izlenen ? ses.izlenen.akis.getAudioTracks().length : 0,
        pc: pcs.filter((p) => p.connectionState !== "closed").map((p) => p.connectionState),
      };
      (window as unknown as { __out: unknown }).__out = out; setSonuc(JSON.stringify(out));
    }, 200);
    return () => clearInterval(t);
  });
  (window as unknown as { __ses: unknown }).__ses = ses;
  return <div><button id="join" onClick={() => void ses.baglan("kanal1")}>join</button>
    <button id="paylas" onClick={() => void ses.ekranPaylas("720")}>paylas</button>
    <button id="durdur" onClick={() => void ses.ekranDurdur()}>durdur</button>
    <video ref={vRef} autoPlay muted playsInline width={320} /><pre id="out">{sonuc}</pre>{ses.kabiRefleri.map((r, i) => <div key={i} ref={r} />)}</div>;
}
createRoot(document.getElementById("root")!).render(<H />);
