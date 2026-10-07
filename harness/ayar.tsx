import { axeIstenirse } from "./axe-calistir";
axeIstenirse();
import { createRoot } from "react-dom/client";
import "../src/tema.css";
import "../src/styles.css";
import "../src/tasarim.css";
import { temaUygula } from "../src/tema";
import SunucuAyarlari, { type Bolum } from "../src/ayarlar/SunucuAyarlari";
import type { Kanal, Kategori, Uye } from "../src/types";
import { demoBen, demoUyeler } from "./demoSupabase";

temaUygula("gece");
const bolum = (new URLSearchParams(location.search).get("bolum") ?? "genel") as Bolum;
const k = (id: string, ad: string, tur: "yazili" | "sesli", sira: number, kategori_id: string | null, yavas_mod = 0): Kanal =>
  ({ id, oda_id: "o1", ad, tur, sira, sifreli: id === "k3", aciklama: null, kategori_id, yavas_mod }) as Kanal;
const kategoriler: Kategori[] = [{ id: "c1", oda_id: "o1", ad: "Sohbet", sira: 1 }, { id: "c2", oda_id: "o1", ad: "Oyun", sira: 2 }];
const kanallar = [k("k1", "genel", "yazili", 1, null), k("k2", "duyurular", "yazili", 2, "c1", 30), k("k3", "gizli", "yazili", 3, "c1"), k("k4", "Sohbet odası", "sesli", 4, "c2")];
const ben = { ...demoBen, rol: "sahip" } as unknown as Uye;
createRoot(document.getElementById("root")!).render(
  <SunucuAyarlari sunucu={{ oda_id: "o1", ad: "Çember", ikon_metin: null, ikon_renk: "#E8A33D", olusturma: "", ben }} baslangic={bolum}
    ben={ben} uyeler={demoUyeler as unknown as Uye[]} kanallar={kanallar} kategoriler={kategoriler} sesKonum={new Map()} cevrimici={new Set()} izin={511}
    varsayilanSunucu={false} onKapat={() => {}} onKanallarDegisti={() => {}} onSunucuDegisti={() => {}} onSunucuSilindi={() => {}} />,
);
