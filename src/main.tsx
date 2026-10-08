import "./girisDonus";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./tema.css";
import "./styles.css";
import "./tasarim.css";
import "./guvenli-alan.css";
import "./temalar.css";
import { temaOku, temaUygula } from "./temalar";
import { dilUygula } from "./i18n";
import { yaziBoyutuOku, yaziBoyutuUygula } from "./yerel";

temaUygula(temaOku());
dilUygula();
yaziBoyutuUygula(yaziBoyutuOku());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
