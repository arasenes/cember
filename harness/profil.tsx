import { createRoot } from "react-dom/client";
import "../src/styles.css";
import ProfilDialog from "../src/ProfilDialog";
import Avatar from "../src/Avatar";
import type { Uye } from "../src/types";

const u: Uye = { id: "1", oda_id: "o", user_id: "x", takma_ad: "Ayşe", renk: "#C2548A", rol: "sahip", son_gorulme: "", avatar_yol: null, hakkinda: "Gitar çalarım, hafta sonları yürüyüşe çıkarım." };
const baskasi = new URLSearchParams(location.search).get("baskasi") === "1";
createRoot(document.getElementById("root")!).render(
  <div id="app" className="on" style={{ padding: 20 }}>
    <div style={{ display: "flex", gap: 8 }}><Avatar uye={u} /><Avatar uye={{ ...u, renk: "#B3261E" }} /><Avatar uye={{ ...u, renk: "#E8A33D" }} /></div>
    <ProfilDialog uye={u} benim={!baskasi} cevrimici onKapat={() => {}} onKaydet={async () => null} />
  </div>,
);
