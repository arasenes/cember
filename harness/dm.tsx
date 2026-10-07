import { axeIstenirse } from "./axe-calistir";
axeIstenirse();
import { createRoot } from "react-dom/client";
import "../src/tema.css";
import "../src/styles.css";
import "../src/tasarim.css";
import "../src/guvenli-alan.css";
import { temaUygula } from "../src/tema";
import DmAlani from "../src/dm/DmAlani";
import { iliskiBul } from "../src/dm/tipler";
import type { DmDurumu } from "../src/dm/useDm";
import type { Uye } from "../src/types";
import { demoCevrimici, demoUyeler } from "./demoSupabase";

temaUygula("gece");
const uyeler = demoUyeler as unknown as Uye[];
const ben = uyeler[0];
const sayfa = (new URLSearchParams(location.search).get("sayfa") ?? "sohbet") as "sohbet" | "arkadaslar";
const simdi = new Date().toISOString();
const arkadasliklar = [
  { id: "r1", a: "u-aras", b: "u-enes", durum: "kabul" as const, olusturma: "" },
  { id: "r2", a: "u-can", b: "u-aras", durum: "kabul" as const, olusturma: "" },
  { id: "r3", a: "u-elif", b: "u-aras", durum: "bekliyor" as const, olusturma: "" },
  { id: "r4", a: "u-zeynep", b: "u-aras", durum: "bekliyor" as const, olusturma: "" },
  { id: "r5", a: "u-aras", b: "u-mert", durum: "engelli" as const, olusturma: "" },
];
const noop = async () => null;
const dm = {
  kanallar: [
    { id: "d1", tur: "ikili", ad: null, olusturan: "u-aras", olusturma: simdi, son_mesaj: simdi },
    { id: "d2", tur: "grup", ad: "Cuma ekibi", olusturan: "u-aras", olusturma: simdi, son_mesaj: simdi },
    { id: "d3", tur: "ikili", ad: null, olusturan: "u-aras", olusturma: simdi, son_mesaj: simdi },
    { id: "d4", tur: "ikili", ad: null, olusturan: "u-aras", olusturma: simdi, son_mesaj: simdi },
  ],
  uyeleri: [
    { dm_id: "d1", uye_id: "u-aras", son_okuma: new Date(Date.now() - 60 * 60000).toISOString() }, { dm_id: "d1", uye_id: "u-elif", son_okuma: "" },
    ...["u-aras", "u-can", "u-enes", "u-zeynep"].map((u) => ({ dm_id: "d2", uye_id: u, son_okuma: "" })),
    { dm_id: "d3", uye_id: "u-aras", son_okuma: "" }, { dm_id: "d3", uye_id: "u-can", son_okuma: "" },
    { dm_id: "d4", uye_id: "u-aras", son_okuma: "" }, { dm_id: "d4", uye_id: "u-enes", son_okuma: "" },
  ],
  arkadasliklar, okunmamis: { d1: 3 }, toplamOkunmamis: 3, gelenIstekler: arkadasliklar.filter((r) => r.durum === "bekliyor"), hazir: true,
  iliski: (id: string) => iliskiBul(arkadasliklar, "u-aras", id), okundu: async () => {}, yenile: async () => {},
  dmAc: async () => ({ id: "d1", hata: null }), grupOlustur: async () => ({ id: "d2", hata: null }), grupUyeEkle: noop, grupAyril: noop,
  arkadasIstek: async () => ({ sonuc: "bekliyor", hata: null }), arkadasYanit: noop, arkadasSil: noop, engelle: noop, engelKaldir: noop,
} as unknown as DmDurumu;

createRoot(document.getElementById("root")!).render(
  <div id="app" className="on dm-modu" data-pane="chat">
    <nav className="sunucu-serit" aria-label="Sunucular">
      <button type="button" className="sr-dugme aktif" aria-label="Özel mesajlar"><span>M</span><span className="rozet sr-rozet">3</span></button>
      <span className="sr-ayrac" />
      <button type="button" className="sr-dugme sr-sunucu" aria-label="Çember sunucusu">Ç</button>
    </nav>
    <DmAlani dm={dm} me={ben} uyeler={uyeler} cevrimici={demoCevrimici} bosta={new Set(["u-can"])} aktifDm={sayfa === "sohbet" ? "d1" : null} sayfa={sayfa}
      mobil="icerik" onMobil={() => {}} onSec={() => {}} onArkadaslar={() => {}} onSunucuya={() => {}} onProfil={() => {}} onHata={() => {}} onBilgi={() => {}} />
  </div>,
);
