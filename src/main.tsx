import "./girisDonus";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./tema.css";
import "./styles.css";
import "./guvenli-alan.css";
import { temaTercihi, temaUygula } from "./tema";
import { yaziBoyutuOku, yaziBoyutuUygula } from "./yerel";

temaUygula(temaTercihi());
yaziBoyutuUygula(yaziBoyutuOku());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
