import { axeIstenirse } from "./axe-calistir";
axeIstenirse();
import { createRoot } from "react-dom/client";
import "../src/tema.css";
import "../src/styles.css";
import "../src/tasarim.css";
import "../src/guvenli-alan.css";
import { temaUygula } from "../src/tema";
import SesSahnesi from "../src/ses/SesSahnesi";
import SesYani from "../src/ses/SesYani";
import type { SesArayuzu } from "../src/sesMotoru";
import type { Kanal, Mesaj, Uye } from "../src/types";
import { demoUyeler } from "./demoSupabase";

temaUygula("gece");
const uyeler = demoUyeler as unknown as Uye[];
const ben = uyeler[0];
const kanal: Kanal = { id: "k6", oda_id: "o1", ad: "Salon", tur: "sesli", sira: 1, sifreli: false, aciklama: null };

function tuval(renk: string, yazi: string, w = 640, h = 360): MediaStream {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  const ciz = () => {
    g.fillStyle = renk; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(40, 40, w - 80, 24); g.fillRect(40, 90, (w - 100) / 2, h - 140); g.fillRect(w / 2 + 10, 90, (w - 100) / 2, h - 140);
    g.fillStyle = "#e8eaf0"; g.font = "bold 22px sans-serif"; g.fillText(yazi, 60, 58);
  };
  ciz();
  return c.captureStream(5);
}

const q = new URLSearchParams(location.search);
const ekranli = q.get("ekran") === "1";
const kameralar = new Map<string, MediaStream>([["u-can", tuval("#46385c", "Can kamera")]]);
const ses = {
  durum: "bagli", kanalId: "k6", sessiz: false, konusanlar: new Set(["u-enes"]), sorunlu: new Set<string>(), motor: "livekit",
  izlenen: ekranli ? { uyeId: "u-enes", akis: tuval("#1f2937", "Enes ekranı", 1280, 720) } : null,
  paylasiyorum: false, ekranDestegi: true, kameralar, kameraAcik: false, sagir: false, sunucuSustur: false,
  sessizDegistir: async () => {}, sagirDegistir: async () => {}, kameraDegistir: async () => ({ ok: true }), ayril: async () => {}, ekranPaylas: async () => ({ ok: true }), ekranDurdur: async () => {},
} as unknown as SesArayuzu;
const katilimcilar = ["u-enes", "u-can", "u-aras", "u-elif"].map((id) => uyeler.find((u) => u.id === id)!);
const mesajlar: Mesaj[] = [
  { id: "m1", kanal_id: "k6", uye_id: "u-enes", metin: "linki buraya bırakıyorum", olusturma: "", duzenleme: null, silindi: false, ek_yol: null, ek_tur: null, ek_boyut: null, ek_genislik: null, ek_yukseklik: null, sabit: false, sabit_zaman: null, ust_mesaj_id: null },
  { id: "m2", kanal_id: "k6", uye_id: "u-can", metin: "mikrofonum bozuk, yazıyorum", olusturma: "", duzenleme: null, silindi: false, ek_yol: null, ek_tur: null, ek_boyut: null, ek_genislik: null, ek_yukseklik: null, sabit: false, sabit_zaman: null, ust_mesaj_id: null },
];
const harita = new Map(uyeler.map((u) => [u.id, u]));

createRoot(document.getElementById("root")!).render(
  <div id="app" className="on ses-modu" data-pane="chat">
    <nav className="sunucu-serit" aria-label="Sunucular"><button type="button" className="sr-dugme sr-sunucu aktif">Ç</button></nav>
    <section className="col side sunucu-kolon"><div className="head kanal-ust"><h1>Çember Ailesi</h1></div></section>
    <section className="col chat">
      <SesSahnesi ses={ses} kanal={kanal} katilimcilar={katilimcilar} benId="u-aras" sagirlar={new Set(["u-elif"])} paylasanlar={new Set(ekranli ? ["u-enes"] : [])}
        baglaniyor={false} buradayim basKonus={{ ayar: { acik: true, tus: "KeyV" }, basili: false, bas: () => {}, birak: () => {} }}
        baskasiPaylasiyor={ekranli ? "Enes" : null} yapanAd={(id) => harita.get(id)?.takma_ad ?? "Biri"} onKatil={() => {}} onProfil={() => {}} onSohbet={() => {}} />
    </section>
    <aside className="col members">
      <SesYani ben={ben} digerleri={katilimcilar.filter((u) => u.id !== "u-aras")} paylasanlar={new Set(ekranli ? ["u-enes"] : [])} uyeHaritasi={harita}
        yonetici islemYapabilir={() => true} susturulanlar={new Set()} onSustur={async () => null} onAt={async () => null}
        mesajlar={mesajlar} onGonder={async () => true} yazamaz={false} onHata={() => {}} />
    </aside>
  </div>,
);

