import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./guvenli-alan.css";
import { temaTercihi, temaUygula } from "./tema";

temaUygula(temaTercihi());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
