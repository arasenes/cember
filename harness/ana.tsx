import { axeIstenirse } from "./axe-calistir";
axeIstenirse();
import { createRoot } from "react-dom/client";
import "../src/tema.css";
import "../src/styles.css";
import "../src/tasarim.css";
import "../src/guvenli-alan.css";
import "../src/temalar.css";
import { temaUygula } from "../src/temalar";
import Chat from "../src/Chat";
import type { Uye } from "../src/types";
import { demoBen } from "./demoSupabase";

temaUygula(new URLSearchParams(location.search).get("tema") as never ?? "komur-turuncu");
createRoot(document.getElementById("root")!).render(
  <Chat me={demoBen as unknown as Uye} onExit={() => {}} />,
);

// ?sesli=1: sesli odayı otomatik aç (görsel kontrol için)
if (location.search.includes("sesli=1")) {
  setTimeout(() => {
    const b = [...document.querySelectorAll<HTMLButtonElement>(".ch")].find((x) => /Salon sesli odası/.test(x.getAttribute("aria-label") ?? ""));
    b?.click();
  }, 1500);
}
if (location.search.includes("sohbet=1")) {
  setTimeout(() => { document.querySelector<HTMLButtonElement>(".sahne-sohbet")?.click(); }, 2500);
}
