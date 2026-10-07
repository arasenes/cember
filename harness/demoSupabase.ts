// Görsel deneme düzeneği: gerçek Supabase yerine tasarım ekranlarındaki demo verisi. Yalnızca harness/ içinde kullanılır.
export const SUPABASE_URL = "http://127.0.0.1:1";
export const SUPABASE_KEY = "x";

const simdi = Date.now();
const dk = (n: number) => new Date(simdi - n * 60000).toISOString();

const uyeler = [
  { id: "u-aras", oda_id: "o1", user_id: "x1", takma_ad: "Aras", renk: "#4fd1a5", rol: "sahip", son_gorulme: dk(0), durum: "cevrimici", hakkinda: "Çember'in kurucusu", durum_metin: null },
  { id: "u-enes", oda_id: "o1", user_id: "x2", takma_ad: "Enes", renk: "#f5b94a", rol: "moderator", son_gorulme: dk(1), durum: "cevrimici", hakkinda: null, durum_metin: "Sesli odadayım" },
  { id: "u-can", oda_id: "o1", user_id: "x3", takma_ad: "Can", renk: "#7aa8ff", rol: "moderator", son_gorulme: dk(2), durum: "cevrimici", hakkinda: null, durum_metin: null },
  { id: "u-elif", oda_id: "o1", user_id: "x4", takma_ad: "Elif", renk: "#ff8a80", rol: "uye", son_gorulme: dk(3), durum: "mesgul", hakkinda: null, durum_metin: null },
  { id: "u-zeynep", oda_id: "o1", user_id: "x5", takma_ad: "Zeynep", renk: "#c9a7ff", rol: "uye", son_gorulme: dk(4), durum: "cevrimici", hakkinda: null, durum_metin: null },
  { id: "u-mert", oda_id: "o1", user_id: "x6", takma_ad: "Mert", renk: "#9aa3b5", rol: "uye", son_gorulme: dk(5), durum: "cevrimici", hakkinda: null, durum_metin: null },
  { id: "u-burak", oda_id: "o1", user_id: "x7", takma_ad: "Burak", renk: "#9aa3b5", rol: "uye", son_gorulme: dk(600), durum: "cevrimici", hakkinda: null, durum_metin: null },
  { id: "u-selin", oda_id: "o1", user_id: "x8", takma_ad: "Selin", renk: "#9aa3b5", rol: "uye", son_gorulme: dk(900), durum: "cevrimici", hakkinda: null, durum_metin: null },
];
const cevrimiciIdler = ["u-aras", "u-enes", "u-can", "u-elif", "u-zeynep", "u-mert"];

const kanallar = [
  { id: "k1", oda_id: "o1", ad: "duyurular", tur: "yazili", sira: 1, sifreli: false, aciklama: "Önemli duyurular" },
  { id: "k2", oda_id: "o1", ad: "kurallar", tur: "yazili", sira: 2, sifreli: false, aciklama: null },
  { id: "k3", oda_id: "o1", ad: "genel-sohbet", tur: "yazili", sira: 3, sifreli: false, aciklama: "Günlük laflar, planlar, her şey" },
  { id: "k4", oda_id: "o1", ad: "oyun-planı", tur: "yazili", sira: 4, sifreli: false, aciklama: null },
  { id: "k5", oda_id: "o1", ad: "müzik-önerileri", tur: "yazili", sira: 5, sifreli: false, aciklama: null },
  { id: "k6", oda_id: "o1", ad: "Salon", tur: "sesli", sira: 6, sifreli: false, aciklama: null },
  { id: "k7", oda_id: "o1", ad: "Oyun odası", tur: "sesli", sira: 7, sifreli: false, aciklama: null },
];

const m = (id: string, uye: string, metin: string, ek: number, ekstra: Record<string, unknown> = {}) => ({
  id, kanal_id: "k3", uye_id: uye, metin, olusturma: dk(ek), duzenleme: null, silindi: false, ek_yol: null, ek_tur: null, ek_boyut: null,
  ek_genislik: null, ek_yukseklik: null, sabit: false, sabit_zaman: null, ust_mesaj_id: null, yanit_id: null, ...ekstra,
});
const mesajlar = [
  m("m1", "u-enes", "akşam **toplantı** yapalım mı? ben `21:00` gibi boşum. Maç skoru: ||3-1 bitti||", 50),
  m("m2", "u-aras", "@Enes olur, sesli odada buluşalım. *Can* da gelsin, ona da yaz.", 48, { yanit_id: "m1" }),
  m("m3", "u-can", "Cuma akşamı ne oynayalım?", 40),
  m("m4", "u-elif", "ben Minecraft'a oy verdim ama kimse beni dinlemez zaten", 38),
  m("m5", "u-zeynep", "https://minecraft.net sunucu rehberine bakın", 36, { onizleme: { url: "https://minecraft.net", baslik: "Minecraft sunucu rehberi", aciklama: "Arkadaşlarınla ortak dünya kur: kurulum, mod ve ayar önerileri.", resim: null, site: "minecraft.net" } }),
];
const tepkiler = [
  { id: "t1", mesaj_id: "m2", uye_id: "u-aras", emoji: "👍" }, { id: "t2", mesaj_id: "m2", uye_id: "u-can", emoji: "👍" }, { id: "t3", mesaj_id: "m2", uye_id: "u-elif", emoji: "👍" },
  { id: "t4", mesaj_id: "m2", uye_id: "u-enes", emoji: "🎉" }, { id: "t5", mesaj_id: "m2", uye_id: "u-can", emoji: "🎉" },
];
const dmMesajlari = [
  { id: "dm-1", dm_id: "d1", uye_id: "u-elif", metin: "notları atabilir misin? yarın sabah bakacağım", olusturma: dk(140), duzenleme: null, silindi: false },
  { id: "dm-2", dm_id: "d1", uye_id: "u-aras", metin: "tabii, hemen atıyorum", olusturma: dk(137), duzenleme: null, silindi: false },
  { id: "dm-3", dm_id: "d1", uye_id: "u-elif", metin: "çok sağ ol, hayat kurtardın", olusturma: dk(20), duzenleme: null, silindi: false },
  { id: "dm-4", dm_id: "d1", uye_id: "u-elif", metin: "Cuma ekibine de ekleyebilir misin beni?", olusturma: dk(19), duzenleme: null, silindi: false },
];
const anketler = [{ id: "a1", mesaj_id: "m3", soru: "Cuma akşamı ne oynayalım?", bitis: new Date(simdi + 23 * 3600000).toISOString(), coklu: false }];
const secenekler = [
  { id: "s1", anket_id: "a1", metin: "Valorant", sira: 1 }, { id: "s2", anket_id: "a1", metin: "Minecraft", sira: 2 }, { id: "s3", anket_id: "a1", metin: "Film izleyelim", sira: 3 },
];
const oylar = [
  ...["u-aras", "u-can", "u-zeynep", "u-mert", "u-burak", "u-selin", "u-enes"].map((u) => ({ anket_id: "a1", uye_id: u, secenek_id: "s1" })),
  ...["u-elif", "u-x1", "u-x2"].map((u) => ({ anket_id: "a1", uye_id: u, secenek_id: "s2" })),
  ...["u-x3", "u-x4"].map((u) => ({ anket_id: "a1", uye_id: u, secenek_id: "s3" })),
];

function veri(tablo: string, f: { not: boolean; in_: boolean; eqs: Record<string, unknown> }): unknown[] {
  switch (tablo) {
    case "odalar": return [{ ad: "Çember Ailesi" }];
    case "kanallar": return kanallar;
    case "uyeler": return uyeler;
    case "mesajlar":
      if (f.not || f.eqs.sabit === true) return [];
      return [...mesajlar].reverse();
    case "tepkiler": return f.in_ ? tepkiler : [];
    case "dm_mesajlari": return [...dmMesajlari].reverse();
    case "anketler": return anketler;
    case "anket_secenekleri": return secenekler;
    case "anket_oylari": return oylar;
    default: return [];
  }
}

function zincir(tablo: string) {
  const f = { not: false, in_: false, eqs: {} as Record<string, unknown> };
  const o: Record<string, unknown> = {};
  for (const ad of ["select", "order", "limit", "lt", "gt", "lte", "neq", "update", "delete", "is", "or"]) o[ad] = () => o;
  o.eq = (k: string, v: unknown) => { f.eqs[k] = v; return o; };
  o.not = () => { f.not = true; return o; };
  o.in = () => { f.in_ = true; return o; };
  o.maybeSingle = async () => ({ data: veri(tablo, f)[0] ?? null, error: null });
  o.single = async () => ({ data: veri(tablo, f)[0] ?? null, error: null });
  o.then = (res: (v: unknown) => unknown) => res({ data: veri(tablo, f), error: null });
  return o;
}

type Isleyici = { tur: string; olay?: string; cb: (p: unknown) => void };
function kanalOlustur() {
  const isleyiciler: Isleyici[] = [];
  const k = {
    on(tur: string, f: { event?: string }, cb: (p: unknown) => void) { isleyiciler.push({ tur, olay: f.event, cb }); return k; },
    subscribe(cb?: (d: string) => void) {
      setTimeout(() => { cb?.("SUBSCRIBED"); isleyiciler.filter((h) => h.tur === "presence" && h.olay === "sync").forEach((h) => h.cb({})); }, 20);
      return k;
    },
    track: async () => {},
    send: async () => "ok",
    presenceState: () => Object.fromEntries(cevrimiciIdler.map((id) => [id, [{ ses: id === "u-enes" || id === "u-can" ? "k6" : null, motor: null, ekran: false, bosta: id === "u-can" }]])),
  };
  return k;
}

export const supabase = {
  from: (t: string) => zincir(t),
  channel: () => kanalOlustur(),
  removeChannel: async () => {},
  rpc: async () => ({ data: [], error: null }),
  functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: null }), remove: async () => ({}), upload: async () => ({ error: null }) }) },
  auth: { signOut: async () => {}, getSession: async () => ({ data: { session: { access_token: "t" } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
};
export const demoBen = uyeler[0];
export const demoUyeler = uyeler;
export const demoCevrimici = new Set(cevrimiciIdler);
