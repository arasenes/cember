// Çember uygulama sesleri (varsayılan takım: Tok): tamamı Web Audio ile üretilen kısa sentez tonlar.
// İnsan sesi yok, ses dosyası yok (APK dahil çevrimdışı çalışır). Ön dinleme: ses önizleme sayfasındaki Pop / Blip / Tok.

export type SesOlayi =
  | "mesaj" | "bahsetme" | "dm" | "gonder"
  | "katil" | "ayril" | "mikAc" | "mikKapat" | "sagir" | "ekran" | "hata";
export type SesTakimi = "muzikal" | "pop" | "blip" | "tok";
export interface SesAyar { acik: boolean; seviye: number; takim: SesTakimi } // seviye: 0–100

type Nota = [frekansHz: number, baslangicSn: number, sureSn: number, kuvvet: number];

export const OLAYLAR: Record<SesOlayi, { ad: string; ne: string; n: Nota[] }> = {
  mesaj:    { ad: "Mesaj geldi", ne: "Açık olmayan kanala ya da pencere arkadayken yeni mesaj", n: [[784, 0, .14, .5], [1047, .08, .22, .5]] },
  bahsetme: { ad: "Seni etiketlediler", ne: "Biri @adını yazınca", n: [[880, 0, .12, .55], [1175, .1, .12, .55], [1568, .2, .3, .55]] },
  dm:       { ad: "Özel mesaj", ne: "DM veya grup mesajı gelince", n: [[659, 0, .12, .55], [880, .1, .12, .55], [1319, .2, .3, .55]] },
  gonder:   { ad: "Mesaj gönderildi", ne: "Gönder tuşuna basınca", n: [[700, 0, .06, .4], [1000, .05, .12, .4]] },
  katil:    { ad: "Sesli odaya katıldı", ne: "Sen ya da başkası odaya girince", n: [[523, 0, .12, .5], [659, .09, .12, .5], [784, .18, .28, .5]] },
  ayril:    { ad: "Sesli odadan çıktı", ne: "Biri odadan ayrılınca", n: [[784, 0, .12, .5], [659, .09, .12, .5], [523, .18, .28, .5]] },
  mikAc:    { ad: "Mikrofon açıldı", ne: "Mikrofonu açınca", n: [[400, 0, .1, .45], [600, .08, .16, .45]] },
  mikKapat: { ad: "Mikrofon kapandı", ne: "Mikrofonu kapatınca", n: [[600, 0, .1, .45], [400, .08, .16, .45]] },
  sagir:    { ad: "Sağırlaştırıldı", ne: "Kendi sesini kapatınca", n: [[500, 0, .1, .45], [330, .09, .1, .45], [250, .18, .22, .45]] },
  ekran:    { ad: "Ekran paylaşımı başladı", ne: "Biri ekranını yayınlayınca", n: [[440, 0, .1, .45], [660, .1, .1, .45], [880, .2, .1, .45], [1100, .3, .26, .45]] },
  hata:     { ad: "Hata", ne: "Bağlantı koptu, işlem olmadı", n: [[220, 0, .16, .5], [196, .15, .26, .5]] },
};

interface TakimTarifi {
  dalga: OscillatorType;
  sure: number;             // nota süresi çarpanı
  ek: [oran: number, pay: number][]; // ek harmonikler
  kuvvet?: number;
  ust?: number;             // frekans çarpanı
  kayma?: number;           // nota başında bu oranla başlayıp 50 ms'de asıl frekansa iner
  atak?: number;            // verilirse doğrusal atak (sn); yoksa 6 ms üstel
  ekDalga?: OscillatorType; // ek harmoniklerin dalgası (yoksa dalga)
  ekSure?: number;          // ek harmoniklerin sönüm süresi çarpanı
  notalar?: Partial<Record<SesOlayi, Nota[]>>; // bu takıma özel melodiler (yoksa OLAYLAR)
}

// Müzikal takım: piyano/marimba/arp tınılı, her olay için kendi melodisi. [Hz, başlangıç sn, süre sn, ses (0–0,25)]
const MUZIKAL_NOTALAR: Record<SesOlayi, [number, number, number, number][]> = {
  mesaj:    [[523.25, 0, .35, .2], [783.99, .08, .45, .2]],
  bahsetme: [[659.25, 0, .3, .18], [830.61, .07, .3, .18], [987.77, .14, .5, .22]],
  dm:       [[440, 0, .3, .22], [554.37, .09, .4, .22]],
  gonder:   [[880, 0, .18, .15]],
  katil:    [[523.25, 0, .3, .15], [659.25, .06, .3, .15], [783.99, .12, .3, .15], [987.77, .18, .6, .2]],
  ayril:    [[987.77, 0, .25, .18], [783.99, .07, .25, .18], [659.25, .14, .4, .18]],
  mikAc:    [[739.99, 0, .15, .15], [1108.73, .05, .25, .18]],
  mikKapat: [[1108.73, 0, .15, .15], [739.99, .05, .25, .15]],
  sagir:    [[440, 0, .3, .18], [523.25, .08, .3, .18], [622.25, .16, .5, .2]],
  ekran:    [[392, 0, .2, .12], [587.33, .05, .2, .12], [783.99, .1, .2, .15], [1174.66, .15, .5, .2]],
  hata:     [[311.13, 0, .25, .15], [293.66, .08, .35, .18]],
};
const muzikalNota = (o: SesOlayi): Nota[] => MUZIKAL_NOTALAR[o].map(([f, b, s, v]) => [f, b, s, v * 2]);

export const TAKIMLAR: Record<SesTakimi, TakimTarifi & { ad: string; not: string }> = {
  muzikal: {
    ad: "Müzikal", not: "Piyano ve marimba tınısı, kısa melodiler.",
    dalga: "sine", sure: 1, ek: [[2, .25]], ekDalga: "triangle", ekSure: .6, atak: .015, kuvvet: 1,
    notalar: Object.fromEntries((Object.keys(MUZIKAL_NOTALAR) as SesOlayi[]).map(o => [o, muzikalNota(o)])) as Partial<Record<SesOlayi, Nota[]>>,
  },
  pop:  { ad: "Pop",  not: "Kısa ve temiz, baloncuk gibi.", dalga: "sine", sure: .45, ek: [[2, .1]], kuvvet: 1, kayma: 1.2 },
  blip: { ad: "Blip", not: "Biraz daha parlak.", dalga: "triangle", sure: .55, ek: [[2, .2]], kuvvet: .95, kayma: .85 },
  tok:  { ad: "Tok",  not: "Daha dolgun ve alçak.", dalga: "sine", sure: .6, ek: [[.5, .5], [3, .08]], ust: .85, kuvvet: 1.1, kayma: .9 },
};

export const VARSAYILAN_AYAR: SesAyar = { acik: true, seviye: 60, takim: "tok" };
const ANAHTAR = "cember-ses-ayar";
const AYNI_SES_ARALIGI_MS = 150; // aynı ses art arda çalmasın (mesaj yağmuru)

let ayar: SesAyar = ayarYukle();
const dinleyiciler = new Set<(a: SesAyar) => void>();
let ctx: AudioContext | null = null;
let ana: GainNode | null = null;
const sonCalinan = new Map<SesOlayi, number>();

function sinirla(x: number, a: number, b: number): number { return Math.min(b, Math.max(a, x)); }

function ayarYukle(): SesAyar {
  try {
    const ham = JSON.parse(localStorage.getItem(ANAHTAR) ?? "null") as Partial<SesAyar> | null;
    if (ham) return {
      acik: ham.acik !== false,
      seviye: sinirla(Number(ham.seviye ?? VARSAYILAN_AYAR.seviye), 0, 100),
      takim: ham.takim && ham.takim in TAKIMLAR ? ham.takim : VARSAYILAN_AYAR.takim,
    };
  } catch { /* özel pencere, bozuk veri */ }
  return { ...VARSAYILAN_AYAR };
}

export function sesAyarOku(): SesAyar { return { ...ayar }; }

// Sağırlaştırılmışken yalnızca bu sesler çalar (kendi durumunu bildiren sesler ve hata)
const SAGIRKEN_CALAN: ReadonlySet<SesOlayi> = new Set<SesOlayi>(["mikAc", "mikKapat", "sagir", "hata"]);
let sagirMi = false;
/** Kullanıcı sağırlaştırıldı mı? Uygulama durumu değişince çağrılır. */
export function sesSagirAyarla(sagir: boolean): void { sagirMi = sagir; }


export function sesAyarKaydet(yeni: Partial<SesAyar>): SesAyar {
  ayar = {
    acik: yeni.acik ?? ayar.acik,
    seviye: sinirla(yeni.seviye ?? ayar.seviye, 0, 100),
    takim: yeni.takim && yeni.takim in TAKIMLAR ? yeni.takim : ayar.takim,
  };
  try { localStorage.setItem(ANAHTAR, JSON.stringify(ayar)); } catch { /* yoksay */ }
  if (ana) ana.gain.value = (ayar.seviye / 100) ** 2;
  dinleyiciler.forEach(f => f(sesAyarOku()));
  return sesAyarOku();
}

export function sesAyarDinle(f: (a: SesAyar) => void): () => void {
  dinleyiciler.add(f);
  return () => { dinleyiciler.delete(f); };
}

/** Tarayıcı/WebView ilk kullanıcı dokunuşundan önce ses açmaz: ilk pointerdown'da bir kez çağır (main.tsx). */
export function sesHazirla(): void {
  try {
    if (!ctx) {
      const Baglam = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Baglam) return;
      ctx = new Baglam();
      ana = ctx.createGain();
      ana.gain.value = (ayar.seviye / 100) ** 2;
      ana.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch { /* ses yoksa uygulama yine çalışır */ }
}

function sentezle(olay: SesOlayi, takimAdi: SesTakimi): void {
  sesHazirla();
  if (!ctx || !ana) return;
  const t = TAKIMLAR[takimAdi];
  const t0 = ctx.currentTime + .02;
  for (const [f, b, s, k] of t.notalar?.[olay] ?? OLAYLAR[olay].n) {
    const sure = s * t.sure, frek = f * (t.ust ?? 1), kuv = (t.kuvvet ?? 1) * k, bas = t0 + b;
    for (const [oran, pay] of [[1, 1] as [number, number], ...t.ek]) {
      const ek = oran !== 1 || pay !== 1;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = ek ? (t.ekDalga ?? t.dalga) : t.dalga;
      if (t.kayma) {
        osc.frequency.setValueAtTime(frek * oran * t.kayma, bas);
        osc.frequency.exponentialRampToValueAtTime(frek * oran, bas + .05);
      } else osc.frequency.value = frek * oran;
      g.gain.setValueAtTime(.0001, bas);
      const en = kuv * pay * .5, atak = t.atak ?? .006, son = sure * (ek ? (t.ekSure ?? 1) : 1);
      if (t.atak) g.gain.linearRampToValueAtTime(en, bas + atak); else g.gain.exponentialRampToValueAtTime(en, bas + atak);
      g.gain.exponentialRampToValueAtTime(.0001, bas + son);
      osc.connect(g); g.connect(ana);
      osc.start(bas); osc.stop(bas + sure + .02);
    }
  }
}

/** Uygulama içinden çağır: ayar kapalıysa ya da çok sık çağrıldıysa çalmaz. */
export function sesCal(olay: SesOlayi): void {
  if (!ayar.acik || ayar.seviye === 0) return;
  if (sagirMi && !SAGIRKEN_CALAN.has(olay)) return;
  const simdi = Date.now();
  if (simdi - (sonCalinan.get(olay) ?? 0) < AYNI_SES_ARALIGI_MS) return;
  sonCalinan.set(olay, simdi);
  try { sentezle(olay, ayar.takim); } catch { /* yoksay */ }
}

/** Ayarlar ekranında dinleme: aç/kapa ayarına bakmaz, seçili olmayan takımı da çalabilir. */
export function sesOnizle(olay: SesOlayi, takim: SesTakimi = ayar.takim): void {
  try { sentezle(olay, takim); } catch { /* yoksay */ }
}
