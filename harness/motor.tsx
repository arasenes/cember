import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { useSesMotoru } from "../src/sesMotoru";

const pcs: RTCPeerConnection[] = [];
const Orijinal = window.RTCPeerConnection;
(window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = class extends Orijinal { constructor(c?: RTCConfiguration) { super(c); pcs.push(this); } };

function H() {
  const id = new URLSearchParams(location.search).get("id")!;
  const ses = useSesMotoru(id, () => {}, () => null);
  const [sonuc, setSonuc] = useState("");
  useEffect(() => {
    const t = setInterval(() => {
      const out = { durum: ses.durum, motor: ses.motor, bilgi: ses.bilgi, hata: ses.hata, pc: pcs.filter((p) => p.connectionState !== "closed").map((p) => p.connectionState) };
      (window as unknown as { __out: unknown }).__out = out; setSonuc(JSON.stringify(out));
    }, 200);
    return () => clearInterval(t);
  });
  return <div><button id="join" onClick={() => void ses.baglan("kanal1")}>join</button><pre id="out">{sonuc}</pre>{ses.kabiRefleri.map((r, i) => <div key={i} ref={r} />)}</div>;
}
createRoot(document.getElementById("root")!).render(<H />);
