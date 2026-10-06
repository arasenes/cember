import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { useSesP2P } from "../src/p2p";

const pcs: RTCPeerConnection[] = [];
const Orijinal = window.RTCPeerConnection;
(window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = class extends Orijinal { constructor(c?: RTCConfiguration) { super(c); pcs.push(this); } };

function H() {
  const id = new URLSearchParams(location.search).get("id")!;
  const ses = useSesP2P(id, () => {});
  const [sonuc, setSonuc] = useState("");
  useEffect(() => {
    const t = setInterval(() => {
      const kabi = ses.sesKabi.current;
      const out = {
        durum: ses.durum, konusanlar: [...ses.konusanlar].sort(), sessiz: ses.sessiz,
        audio: kabi ? kabi.querySelectorAll("audio").length : -1,
        pc: pcs.filter((p) => p.connectionState !== "closed").map((p) => p.connectionState),
      };
      (window as unknown as { __out: unknown }).__out = out; setSonuc(JSON.stringify(out));
    }, 200);
    return () => clearInterval(t);
  });
  (window as unknown as { __ses: unknown }).__ses = ses;
  return <div><button id="join" onClick={() => ses.baglan("kanal1").then((r) => ((window as unknown as { __sonuc: unknown }).__sonuc = r))}>join</button><button id="leave" onClick={() => ses.ayril()}>leave</button><pre id="out">{sonuc}</pre><div ref={ses.sesKabi} /></div>;
}
createRoot(document.getElementById("root")!).render(<H />);
