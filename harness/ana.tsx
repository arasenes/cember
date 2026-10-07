import { createRoot } from "react-dom/client";
import "../src/tema.css";
import "../src/styles.css";
import "../src/tasarim.css";
import "../src/guvenli-alan.css";
import { temaUygula } from "../src/tema";
import Chat from "../src/Chat";
import type { Uye } from "../src/types";
import { demoBen } from "./demoSupabase";

temaUygula("gece");
createRoot(document.getElementById("root")!).render(
  <Chat me={demoBen as unknown as Uye} onExit={() => {}} />,
);
