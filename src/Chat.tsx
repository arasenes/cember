import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import { useSesMotoru, type Motor } from "./sesMotoru";
import SesCubugu from "./SesCubugu";
import EkranPaneli from "./EkranPaneli";
import type { Durum, Kanal, Mesaj, Tepki, Uye, Kategori } from "./types";
import MessageView from "./MessageView";
import { DURUM_BILGI, gunEtiketi, rolEtiketi } from "./util";
import AyarlarDialog from "./AyarlarDialog";
import { pushKapat, pushYenile } from "./push";
import KatilimciSeridi from "./KatilimciSeridi";
import { katlanmisOku, katlanmisYaz, okunduOku, okunduYaz, sessizOku, sessizYaz, siraOku, siraYaz, sirala, yaziBoyutuKaydet, yaziBoyutuOku } from "./yerel";
import EmojiDeposu from "./EmojiDeposu";
import { temaKaydet, temaTercihi } from "./tema";
import { bildirim, bildirimIzniIste, duyur, etiketVar, seslerAcik, seslerKaydet, sesleriHazirla } from "./uyari";
import { islemYapabilir, susturulmus, yonetCagir } from "./YonetimPaneli";
import SunucuAyarlari, { type Bolum } from "./ayarlar/SunucuAyarlari";
import SunucuDialog from "./sunucu/SunucuDialog";
import KomutPaleti from "./komut/KomutPaleti";
import type { Komut } from "./komut/komutlar";
import { cevir, t } from "./i18n";
import { sunucuBasHarf, type Sunucu } from "./sunucu/sunucular";
import { IZIN, useIzinler } from "./sunucu/izin";
import { gruplariKur } from "./sunucu/siralama";
import Avatar from "./Avatar";
import GuncellemeBandi from "./GuncellemeBandi";
import KanalSifre from "./KanalSifre";
import SabitlerDialog from "./SabitlerDialog";
import KonuPaneli from "./KonuPaneli";
import { useYaziyorTakip, YAZIYOR_YAYIN_ARALIK_MS } from "./mesaj/yaziyor";
import { useAnketler } from "./mesaj/anket";
import AnketOlustur, { type AnketTaslak } from "./mesaj/AnketOlustur";
import AramaPaneli from "./mesaj/AramaPaneli";
import GifSecici from "./mesaj/GifSecici";
import IletDialog from "./mesaj/IletDialog";
import Ikon from "./mesaj/Ikon";
import SesSahnesi from "./ses/SesSahnesi";
import SesYani from "./ses/SesYani";
import { ayarOku as basKonusAyarOku, ayarYaz as basKonusAyarYaz, useBasKonus, type BasKonusAyar } from "./ses/basKonus";
import DmAlani, { type DmSayfa } from "./dm/DmAlani";
import { useDm } from "./dm/useDm";
import type { DmMesaj } from "./dm/tipler";
import ProfilDialog, { type ProfilDegisiklik } from "./ProfilDialog";
import { boyutMetni, ekHazirla, ekYolu, EkHatasi, IZINLI_TURLER, type HazirEk } from "./ekler";

const SAYFA = 50;
type Pane = "side" | "chat" | "mem";
const SES_LIMIT = Number(import.meta.env.VITE_SES_AYLIK_DAKIKA ?? 5000);

function birlestir(eski: Mesaj[], yeni: Mesaj[]): Mesaj[] {
  const m = new Map<string, Mesaj>();
  for (const x of [...eski, ...yeni]) m.set(x.id, x);
  return [...m.values()].sort((a, b) => a.olusturma.localeCompare(b.olusturma));
}

// Silinen misafirin mesajları kalır; adı ve fotoğrafı gizlenir
const silinmisGoster = (u: Uye): Uye => (u.silindi ? { ...u, takma_ad: "Silinmiş üye", avatar_yol: null, hakkinda: null } : u);

type ChatProps = { me: Uye; sunucular?: Sunucu[]; onSunucuSec?: (odaId: string) => void; onSunucularYenile?: (git?: string) => void; onExit: () => void };

export default function Chat({ me, sunucular = [], onSunucuSec, onSunucularYenile, onExit }: ChatProps) {
  const [odaAdi, setOdaAdi] = useState("Çember");
  const [kanallar, setKanallar] = useState<Kanal[]>([]);
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const [cevrimici, setCevrimici] = useState<Set<string>>(new Set());
  const [aktif, setAktif] = useState<string | null>(null);
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [tepkiler, setTepkiler] = useState<Tepki[]>([]);
  const [dahaVar, setDahaVar] = useState(false);
  const [metin, setMetin] = useState("");
  const [emojiAcik, setEmojiAcik] = useState(false);
  const [pane, setPane] = useState<Pane>("chat");
  const [hata, setHata] = useState("");
  const [ek, setEk] = useState<HazirEk | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [surukle, setSurukle] = useState(false);
  const [profilId, setProfilId] = useState<string | null>(null);
  const [yonetimAcik, setYonetimAcik] = useState(false);
  const [ayarBolum, setAyarBolum] = useState<Bolum>("genel");
  const [sunucuDialogAcik, setSunucuDialogAcik] = useState(false);
  const [paletAcik, setPaletAcik] = useState(false);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [yonBilgi, setYonBilgi] = useState("");
  const [sabitler, setSabitler] = useState<Mesaj[]>([]);
  const [sabitAcik, setSabitAcik] = useState(false);
  const [konuDuzen, setKonuDuzen] = useState<string | null>(null);
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [sifreKanal, setSifreKanal] = useState<{ kanal: Kanal; sonra: () => void } | null>(null);
  const [simdi, setSimdi] = useState(() => Date.now());
  const [yanitlar, setYanitlar] = useState<Mesaj[]>([]);
  const [konuId, setKonuId] = useState<string | null>(null);
  const [gorunum, setGorunum] = useState<"sunucu" | "dm">("sunucu");
  const [dmSayfa, setDmSayfa] = useState<DmSayfa>("arkadaslar");
  const [aktifDm, setAktifDm] = useState<string | null>(null);
  const [dmMobil, setDmMobil] = useState<"liste" | "icerik">("liste");
  const [bosta, setBosta] = useState<Set<string>>(new Set());
  const [sagirlar, setSagirlar] = useState<Set<string>>(new Set());
  const [susturulanlar, setSusturulanlar] = useState<Set<string>>(new Set());
  const [basKonusAyar, setBasKonusAyar] = useState<BasKonusAyar>(basKonusAyarOku);
  const [yanitlanan, setYanitlanan] = useState<Mesaj | null>(null);
  const [iletMesaj, setIletMesaj] = useState<Mesaj | null>(null);
  const [aramaAcik, setAramaAcik] = useState(false);
  const [anketAcik, setAnketAcik] = useState(false);
  const [gifAcik, setGifAcik] = useState(false);
  const [vurguId, setVurguId] = useState<string | null>(null);
  const [alintiOnbellek, setAlintiOnbellek] = useState<Map<string, Mesaj>>(new Map());
  const alintiSorulan = useRef(new Set<string>());
  const gitRef = useRef<Mesaj | null>(null);
  const [bolucu, setBolucu] = useState<{ kanal: string; zaman: string } | null>(null);
  const [okumaHazir, setOkumaHazir] = useState(false);
  const okunduGonderim = useRef<Record<string, number>>({});
  const [sesler, setSesler] = useState(seslerAcik);
  const [tema, setTema] = useState(temaTercihi);
  const [yazi, setYazi] = useState(yaziBoyutuOku);
  const [ayarAcik, setAyarAcik] = useState(false);
  const [okunmamis, setOkunmamis] = useState<Record<string, { n: number; etiket: number }>>({});
  const okunduRef = useRef<Record<string, string>>(okunduOku());
  const ozetRef = useRef(false);
  const [katlanmis, setKatlanmis] = useState<string[]>(katlanmisOku);
  const [sessiz, setSessiz] = useState<string[]>(sessizOku);
  const sessizRef = useRef(sessiz);
  sessizRef.current = sessiz;
  const [sira, setSira] = useState(siraOku);
  const [duzenle, setDuzenle] = useState(false);
  const [surukId, setSurukId] = useState<string | null>(null);
  const [bildirimler, setBildirimler] = useState<{ id: number; metin: string; tur: "bilgi" | "hata" }[]>([]);
  const bildirimNo = useRef(0);
  const toastAt = useCallback((metin: string, tur: "bilgi" | "hata" = "bilgi", ms = 4000) => {
    const id = ++bildirimNo.current;
    setBildirimler((x) => [...x.slice(-2), { id, metin, tur }]);
    setTimeout(() => setBildirimler((x) => x.filter((b) => b.id !== id)), ms);
  }, []);
  const okunduIsaretle = useCallback((kanalId: string, zaman?: string) => {
    const simdi = new Date().toISOString();
    okunduRef.current = { ...okunduRef.current, [kanalId]: zaman && zaman > simdi ? zaman : simdi };
    okunduYaz(okunduRef.current);
    setOkunmamis((x) => { if (!x[kanalId]) return x; const y = { ...x }; delete y[kanalId]; return y; });
    // Cihazlar arası okundu bilgisi: kanal başına en fazla 3 saniyede bir sunucuya yaz
    const t = Date.now();
    if (t - (okunduGonderim.current[kanalId] ?? 0) > 3000) {
      okunduGonderim.current[kanalId] = t;
      void supabase.rpc("okundu_isaretle", { p_kanal: kanalId }).then(() => {});
    }
  }, []);
  const oncekiKonumRef = useRef<{ kanal: string | null; konum: Map<string, string> }>({ kanal: null, konum: new Map() });
  const uyelerRef = useRef<Uye[]>([]);
  const mesajlarRef = useRef<Mesaj[]>([]);
  const dosyaRef = useRef<HTMLInputElement>(null);
  const ekRef = useRef<HazirEk | null>(null);
  ekRef.current = ek;
  const aktifRef = useRef<string | null>(null);
  const akisRef = useRef<HTMLDivElement>(null);
  const altaKaydir = useRef(true);
  const metinRef = useRef<HTMLTextAreaElement>(null);
  const kanalRef = useRef<RealtimeChannel | null>(null);
  const [sesKonum, setSesKonum] = useState<Map<string, { kanal: string; motor: Motor | null; ekran: boolean }>>(new Map());
  const sesKonumRef = useRef(sesKonum);
  sesKonumRef.current = sesKonum;
  const [kullanimDk, setKullanimDk] = useState<number | null>(null);

  aktifRef.current = aktif;
  const yaziyor = useYaziyorTakip(aktif);
  const yaziyorRef = useRef(yaziyor);
  yaziyorRef.current = yaziyor;
  const { anketler, oyla: anketOyla } = useAnketler(mesajlar.map((m) => m.id), me.id);
  const dmGoruluyor = gorunum === "dm" && dmSayfa === "sohbet";
  const dm = useDm(me.id, dmGoruluyor ? aktifDm : null, {
    odaId: me.oda_id,
    // Yeni özel mesaj: ses + küçük bildirim (açık DM'deysek ve sekme görünürse sessiz)
    onYeniMesaj: (m: DmMesaj) => {
      if (dmGoruluyor && aktifDmRefDm.current === m.dm_id && document.visibilityState === "visible") return;
      if (uyelerRef.current.find((u) => u.id === me.id)?.durum === "rahatsiz") return;
      const ad = uyelerRef.current.find((u) => u.id === m.uye_id)?.takma_ad ?? "Biri";
      duyur("mesaj");
      toastAt(`${ad}: ${m.metin.slice(0, 60)}`);
    },
  });
  const aktifDmRefDm = useRef<string | null>(null);
  aktifDmRefDm.current = aktifDm;
  const sonYaziyorYayin = useRef(0);
  // Boşta: 5 dakika hareketsizlik; presence ile herkese duyurulur
  const bostaRef = useRef(false);
  const sagirRef = useRef(false);
  const duyuruRef = useRef<{ ses: string | null; motor: Motor | null }>({ ses: null, motor: null });
  const kanalDuyur = useCallback((k: string | null, motor: Motor | null) => {
    duyuruRef.current = { ses: k, motor };
    void kanalRef.current?.track({ t: Date.now(), ses: k, motor, ekran: false, bosta: bostaRef.current, sagir: sagirRef.current });
  }, []);
  const motorSor = useCallback((kanalId: string): Motor | null => {
    for (const [uid, v] of sesKonumRef.current) if (uid !== me.id && v.kanal === kanalId && v.motor) return v.motor;
    return null;
  }, [me.id]);
  const ses = useSesMotoru(me.id, kanalDuyur, motorSor);
  const sesRef = useRef(ses);
  sesRef.current = ses;
  sagirRef.current = ses.sagir;
  const basKonus = useBasKonus(basKonusAyar, { kanalId: ses.kanalId, mikAyarla: ses.mikAyarla });
  // Sağırlaştırma durumu odadakilere duyurulur
  useEffect(() => {
    if (!duyuruRef.current.ses) return;
    void kanalRef.current?.track({ t: Date.now(), ...duyuruRef.current, ekran: ses.paylasiyorum, bosta: bostaRef.current, sagir: ses.sagir });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ses.sagir]);
  // Ekran paylaşımı başlayınca/bitince odadaki herkese duyurulur ("🖥️ yayında" göstergesi ve çift paylaşımı engelleme için)
  useEffect(() => {
    if (!duyuruRef.current.ses) return;
    void kanalRef.current?.track({ t: Date.now(), ...duyuruRef.current, ekran: ses.paylasiyorum, bosta: bostaRef.current, sagir: sagirRef.current });
  }, [ses.paylasiyorum]);
  useEffect(() => {
    let sayac: ReturnType<typeof setTimeout>;
    const ayarla = (b: boolean) => {
      if (bostaRef.current === b) return;
      bostaRef.current = b;
      void kanalRef.current?.track({ t: Date.now(), ...duyuruRef.current, ekran: false, bosta: b, sagir: sagirRef.current });
    };
    const hareket = () => { ayarla(false); clearTimeout(sayac); sayac = setTimeout(() => ayarla(true), 5 * 60 * 1000); };
    const olaylar = ["pointerdown", "keydown", "visibilitychange"] as const;
    for (const o of olaylar) window.addEventListener(o, hareket);
    hareket();
    return () => { clearTimeout(sayac); for (const o of olaylar) window.removeEventListener(o, hareket); };
  }, []);
  uyelerRef.current = uyeler;
  mesajlarRef.current = mesajlar;
  useEffect(() => sesleriHazirla(), []);
  useEffect(() => { void pushYenile(); }, [me.id]);
  const etiketAday = useMemo(() => {
    const x = /(?:^|\s)@([^\s@]*)$/.exec(metin);
    if (!x) return [];
    const q = x[1].toLocaleLowerCase("tr");
    return uyeler.filter((u) => !u.silindi && u.id !== me.id && u.takma_ad.toLocaleLowerCase("tr").includes(q)).slice(0, 5);
  }, [metin, uyeler, me.id]);
  const uyeHaritasi = useMemo(() => new Map(uyeler.map((u) => [u.id, u])), [uyeler]);
  // Alıntılanan mesajlar: yüklü olanlar + gerekirse tek tek getirilenler
  const mesajIndex = useMemo(() => {
    const m = new Map<string, Mesaj>(alintiOnbellek);
    for (const x of yanitlar) m.set(x.id, x);
    for (const x of mesajlar) m.set(x.id, x);
    return m;
  }, [alintiOnbellek, yanitlar, mesajlar]);
  useEffect(() => {
    const eksik = [...new Set([...mesajlar, ...yanitlar].map((m) => m.yanit_id).filter((id): id is string => !!id && !mesajIndex.has(id) && !alintiSorulan.current.has(id)))];
    if (!eksik.length) return;
    eksik.forEach((id) => alintiSorulan.current.add(id));
    supabase.from("mesajlar").select("*").in("id", eksik).then(({ data }) => {
      if (data) setAlintiOnbellek((x) => { const y = new Map(x); for (const r of data as Mesaj[]) y.set(r.id, r); return y; });
    });
  }, [mesajlar, yanitlar, mesajIndex]);
  const aktifKanal = kanallar.find((k) => k.id === aktif);
  const ben = uyeHaritasi.get(me.id) ?? me;
  const paylasanId = ses.kanalId ? [...sesKonum].find(([uid, v]) => uid !== me.id && v.kanal === ses.kanalId && v.ekran)?.[0] ?? null : null;
  const paylasanAd = paylasanId ? uyeHaritasi.get(paylasanId)?.takma_ad ?? "Biri" : null;
  const profilUyesi = profilId ? uyeHaritasi.get(profilId) : undefined;
  const yonetici = ben.rol !== "uye";
  const izinler = useIzinler(me.oda_id, ben.rol);
  const kanalYonet = izinler.var(IZIN.KANAL_YONET);
  const mesajYonet = izinler.var(IZIN.MESAJ_YONET);
  const ayarGoster = ben.rol === "sahip" || izinler.yonetim;
  const ayarAc = (b: Bolum) => { setAyarBolum(b); setYonetimAcik(true); };
  const seciliSunucu = sunucular.find((x) => x.oda_id === me.oda_id);
  const benSusturuldu = susturulmus(ben, simdi);
  // Kanal bazlı izin: bu kanalda yazabilir miyim / dosya ekleyebilir miyim (sunucu RLS ile zorlar; burası yalnızca arayüz)
  const [kanalMaske, setKanalMaske] = useState<number | null>(null);
  useEffect(() => {
    if (!aktif) return;
    let iptal = false;
    const getir = () => supabase.rpc("kanal_izni", { p_kanal: aktif }).then(({ data }) => { if (!iptal && typeof data === "number") setKanalMaske(data); });
    setKanalMaske(null);
    void getir();
    const k = supabase.channel(`kanal-izin-${aktif}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kanal_izinleri" }, () => void getir())
      .on("postgres_changes", { event: "*", schema: "public", table: "uye_rolleri" }, () => void getir())
      .subscribe();
    return () => { iptal = true; void supabase.removeChannel(k); };
  }, [aktif, izinler.maske]);
  const kanalYazabilir = kanalMaske === null || (kanalMaske & IZIN.MESAJ_YAZ) !== 0;
  const kanalDosyaEkleyebilir = kanalMaske === null || (kanalMaske & IZIN.DOSYA) !== 0;
  const yazamaz = benSusturuldu || !kanalYazabilir;

  // Okunmamış göstergesi: kanal açılınca / sekme görünür olunca okundu say
  useEffect(() => {
    if (!aktif || !okumaHazir) return;
    // "Yeni mesajlar" çizgisi: kanal açılmadan önceki son okuma zamanı
    const onceki = okunduRef.current[aktif];
    setBolucu(onceki ? { kanal: aktif, zaman: onceki } : null);
    okunduIsaretle(aktif);
  }, [aktif, okunduIsaretle, okumaHazir]);
  useEffect(() => {
    const g = () => { if (document.visibilityState === "visible" && aktifRef.current) okunduIsaretle(aktifRef.current); };
    document.addEventListener("visibilitychange", g);
    return () => document.removeEventListener("visibilitychange", g);
  }, [okunduIsaretle]);
  // Açılışta her kanalın okunmamış sayısını hesapla (okundu işaretleri bu cihazda tutulur)
  useEffect(() => {
    if (ozetRef.current || !kanallar.length || !uyeler.length) return;
    ozetRef.current = true;
    void (async () => {
    // Sunucudaki okuma zamanlarını (diğer cihazlar dahil) yerel kayıtla birleştir: en yenisi geçerli
    const { data: sunucu } = await supabase.from("kanal_okuma").select("kanal_id, son_okuma");
    for (const r of (sunucu ?? []) as { kanal_id: string; son_okuma: string }[]) {
      if (!okunduRef.current[r.kanal_id] || r.son_okuma > okunduRef.current[r.kanal_id]) okunduRef.current[r.kanal_id] = r.son_okuma;
    }
    okunduYaz(okunduRef.current);
    setOkumaHazir(true);
    const simdi = new Date().toISOString();
    let yeni = false;
    for (const k of kanallar) if (!okunduRef.current[k.id]) { okunduRef.current[k.id] = simdi; yeni = true; }
    if (yeni) okunduYaz(okunduRef.current);
    const enEski = new Date(Date.now() - 30 * 86400000).toISOString();
    const sinir = [enEski, Object.values(okunduRef.current).reduce((a, b) => (a < b ? a : b), simdi)].reduce((a, b) => (a > b ? a : b));
    const benAd = uyeler.find((u) => u.id === me.id)?.takma_ad ?? me.takma_ad;
    supabase.from("mesajlar").select("kanal_id,uye_id,metin,olusturma,ust_mesaj_id")
      .in("kanal_id", kanallar.map((k) => k.id)).gt("olusturma", sinir).neq("uye_id", me.id).eq("silindi", false)
      .order("olusturma", { ascending: false }).limit(1000)
      .then(({ data }) => {
        const toplam: Record<string, { n: number; etiket: number }> = {};
        for (const r of (data ?? []) as Pick<Mesaj, "kanal_id" | "metin" | "olusturma" | "ust_mesaj_id">[]) {
          if (r.olusturma <= (okunduRef.current[r.kanal_id] ?? simdi) || r.kanal_id === aktifRef.current) continue;
          const etiketli = etiketVar(r.metin ?? "", benAd);
          if (r.ust_mesaj_id && !etiketli) continue;
          const t = (toplam[r.kanal_id] ??= { n: 0, etiket: 0 });
          t.n++; if (etiketli) t.etiket++;
        }
        setOkunmamis((x) => ({ ...toplam, ...x }));
      });
    })();
  }, [kanallar, uyeler, me.id, me.takma_ad]);
  useEffect(() => {
    const e = Object.entries(okunmamis).filter(([id]) => !sessiz.includes(id)).reduce((a, [, v]) => a + v.etiket, 0) + dm.toplamOkunmamis + dm.gelenIstekler.length;
    document.title = e > 0 ? `(${e}) ${odaAdi}` : odaAdi;
  }, [okunmamis, sessiz, odaAdi, dm.toplamOkunmamis, dm.gelenIstekler.length]);
  // Sesli odanın kısa uyarıları ve yönetici bilgileri ekranda kalmak yerine küçük bildirim olarak çıkıp kaybolur
  useEffect(() => { if (ses.hata) { toastAt(ses.hata, "hata", 7000); sesRef.current.hataTemizle(); } }, [ses.hata, toastAt]);
  useEffect(() => { if (ses.bilgi) { toastAt(ses.bilgi, "bilgi", 5000); sesRef.current.hataTemizle(); } }, [ses.bilgi, toastAt]);
  useEffect(() => { if (yonBilgi) { toastAt(yonBilgi, "bilgi", 6000); setYonBilgi(""); } }, [yonBilgi, toastAt]);

  // Biri ekranını paylaşmaya başlayınca izleme alanı (Sohbet bölmesi) kendiliğinden açılır
  const izlenenUye = ses.izlenen?.uyeId ?? null;
  useEffect(() => { if (izlenenUye) setPane("chat"); }, [izlenenUye]);
  const girebilir = useCallback((k: Kanal) => !k.sifreli || yonetici || acik.has(k.id), [yonetici, acik]);

  // Şifresi sonradan konan/değişen ya da silinen kanalda kalma
  useEffect(() => {
    if (!kanallar.length) return;
    const a = kanallar.find((k) => k.id === aktif);
    if (aktif && (!a || !girebilir(a))) {
      const yedek = kanallar.find((k) => k.tur === "yazili" && girebilir(k));
      setAktif(yedek?.id ?? null);
      if (!yedek) { setMesajlar([]); setTepkiler([]); }
    }
    const sk = ses.kanalId ? kanallar.find((k) => k.id === ses.kanalId) : null;
    if (ses.kanalId && ses.durum !== "kapali" && (!sk || !girebilir(sk))) {
      setYonBilgi("Bu sesli odanın şifresi değişti ya da oda kapandı; yeniden girmen gerekebilir.");
      void ses.ayril();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanallar, girebilir]);

  function kanalaGir(k: Kanal, sonra: () => void) {
    if (girebilir(k)) sonra();
    else setSifreKanal({ kanal: k, sonra });
  }

  // Bildirime dokunulunca (servis işçisi mesajı ya da ?kanal= adresi) ilgili yazılı kanala geç
  const kanalIstegi = useRef<string | null>(null);
  const dmAcRef = useRef<(id: string) => void>(() => {});
  dmAcRef.current = (id: string) => { setAktifDm(id); setDmSayfa("sohbet"); setDmMobil("icerik"); setGorunum("dm"); };
  const bildirimKanalinaGit = useRef<(id: string) => void>(() => {});
  bildirimKanalinaGit.current = (id: string) => {
    const k = kanallar.find((x) => x.id === id && x.tur === "yazili");
    if (!k) { kanalIstegi.current = id; return; }
    kanalIstegi.current = null;
    kanalaGir(k, () => { setAktif(k.id); setPane("chat"); });
  };
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("kanal");
    if (id) { kanalIstegi.current = id; url.searchParams.delete("kanal"); window.history.replaceState(null, "", url.pathname + url.search + url.hash); }
    const dmAdres = url.searchParams.get("dm");
    if (dmAdres) { url.searchParams.delete("dm"); window.history.replaceState(null, "", url.pathname + url.search + url.hash); dmAcRef.current(dmAdres); }
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const dinle = (e: MessageEvent) => {
      if (e.data?.tip === "kanal-ac" && typeof e.data.kanal_id === "string") bildirimKanalinaGit.current(e.data.kanal_id);
      else if (e.data?.tip === "dm-ac" && typeof e.data.dm_id === "string") dmAcRef.current(e.data.dm_id);
    };
    sw.addEventListener("message", dinle);
    return () => sw.removeEventListener("message", dinle);
  }, []);
  useEffect(() => { if (kanalIstegi.current && kanallar.length) bildirimKanalinaGit.current(kanalIstegi.current); }, [kanallar]);

  // Susturma süresi dolunca yazma kutusu kendiliğinden açılır
  useEffect(() => {
    if (!ben.susturma_bitis) return;
    const kalan = new Date(ben.susturma_bitis).getTime() - Date.now();
    if (kalan <= 0) { setSimdi(Date.now()); return; }
    const t = setTimeout(() => setSimdi(Date.now()), Math.min(kalan + 500, 2_000_000_000));
    return () => clearTimeout(t);
  }, [ben.susturma_bitis]);

  // İlk yükleme: oda, kanallar, üyeler
  useEffect(() => {
    (async () => {
      const [o, k, u, a, c] = await Promise.all([
        supabase.from("odalar").select("ad").eq("id", me.oda_id).maybeSingle(),
        supabase.from("kanallar").select("*").eq("oda_id", me.oda_id).order("sira"),
        supabase.from("uyeler").select("*").eq("oda_id", me.oda_id),
        supabase.from("kanal_acik").select("kanal_id"),
        supabase.from("kategoriler").select("*").eq("oda_id", me.oda_id).order("sira"),
      ]);
      if (o.data) setOdaAdi(o.data.ad);
      if (c?.data) setKategoriler(c.data as Kategori[]);
      const acikSet = new Set(((a?.data ?? []) as { kanal_id: string }[]).map((x) => x.kanal_id));
      setAcik(acikSet);
      if (k.data) {
        setKanallar(k.data as Kanal[]);
        const yon = ((u.data ?? []) as Uye[]).find((x) => x.id === me.id)?.rol ?? me.rol;
        const ilk = (k.data as Kanal[]).find((x) => x.tur === "yazili" && (!x.sifreli || yon !== "uye" || acikSet.has(x.id)));
        if (ilk) setAktif(ilk.id);
      }
      if (u.data) setUyeler((u.data as Uye[]).map(silinmisGoster));
    })();
  }, [me.oda_id]);

  // Kanal değişince son 50 mesajı yükle
  useEffect(() => {
    if (!aktif) return;
    let iptal = false;
    setMesajlar([]); setTepkiler([]); setDahaVar(false); setYanitlar([]); setKonuId(null);
    (async () => {
      const { data, error } = await supabase.from("mesajlar").select("*").eq("kanal_id", aktif).is("ust_mesaj_id", null)
        .order("olusturma", { ascending: false }).limit(SAYFA);
      if (iptal) return;
      if (error) return setHata("Mesajlar yüklenemedi.");
      const liste = ((data ?? []) as Mesaj[]).reverse();
      altaKaydir.current = true;
      setMesajlar(liste);
      setDahaVar((data ?? []).length === SAYFA);
      if (liste.length) {
        const { data: t } = await supabase.from("tepkiler").select("*").in("mesaj_id", liste.map((m) => m.id));
        if (!iptal && t) setTepkiler(t as Tepki[]);
      }
      if (!iptal) void gitIsle(liste);
    })();
    return () => { iptal = true; };
  }, [aktif]);

  // Kanaldaki konu yanıtları (en yeni 500)
  useEffect(() => {
    if (!aktif) return;
    let iptal = false;
    (async () => {
      const { data } = await supabase.from("mesajlar").select("*").eq("kanal_id", aktif).not("ust_mesaj_id", "is", null)
        .order("olusturma", { ascending: false }).limit(500);
      if (!iptal && data) setYanitlar(((data as Mesaj[]).reverse()));
    })();
    return () => { iptal = true; };
  }, [aktif]);

  // Konu açılınca yanıtların tepkilerini getir
  useEffect(() => {
    if (!konuId) return;
    const idler = yanitlar.filter((y) => y.ust_mesaj_id === konuId).map((y) => y.id);
    if (!idler.length) return;
    supabase.from("tepkiler").select("*").in("mesaj_id", idler).then(({ data }) => {
      if (data) setTepkiler((x) => [...x, ...(data as Tepki[]).filter((n) => !x.some((y) => y.id === n.id))]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [konuId]);

  // Kanaldaki sabit mesajlar
  useEffect(() => {
    setSabitler([]); setSabitAcik(false); setKonuDuzen(null);
    if (!aktif) return;
    let iptal = false;
    (async () => {
      const { data } = await supabase.from("mesajlar").select("*").eq("kanal_id", aktif).eq("sabit", true).eq("silindi", false)
        .order("sabit_zaman", { ascending: false });
      if (!iptal && data) setSabitler(data as Mesaj[]);
    })();
    return () => { iptal = true; };
  }, [aktif]);

  const eskileriYukle = useCallback(async () => {
    if (!aktif || !mesajlar.length) return;
    const { data } = await supabase.from("mesajlar").select("*").eq("kanal_id", aktif).is("ust_mesaj_id", null)
      .lt("olusturma", mesajlar[0].olusturma).order("olusturma", { ascending: false }).limit(SAYFA);
    const liste = ((data ?? []) as Mesaj[]).reverse();
    altaKaydir.current = false;
    const el = akisRef.current, eskiYuk = el?.scrollHeight ?? 0;
    setMesajlar((m) => birlestir(m, liste));
    setDahaVar((data ?? []).length === SAYFA);
    if (liste.length) {
      const { data: t } = await supabase.from("tepkiler").select("*").in("mesaj_id", liste.map((m) => m.id));
      if (t) setTepkiler((x) => [...x, ...(t as Tepki[]).filter((n) => !x.some((y) => y.id === n.id))]);
    }
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - eskiYuk; });
  }, [aktif, mesajlar]);

  // Realtime + presence
  useEffect(() => {
    const kanal = supabase.channel(`oda-${me.oda_id}`, { config: { presence: { key: me.id } } });
    kanalRef.current = kanal;
    kanal
      .on("broadcast", { event: "yaziyor" }, ({ payload }) => {
        const v = payload as { uye?: string; ad?: string; kanal?: string };
        if (!v?.uye || v.uye === me.id || typeof v.ad !== "string" || typeof v.kanal !== "string") return;
        yaziyorRef.current.kaydet(v.uye, v.ad.slice(0, 24), v.kanal);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "mesajlar" }, (p) => {
        const m = (p.eventType === "DELETE" ? p.old : p.new) as Mesaj;
        if (p.eventType === "INSERT") yaziyorRef.current.sil(m.uye_id);
        if (p.eventType === "INSERT" && m.uye_id !== me.id && !m.silindi) {
          const yazar = uyelerRef.current.find((u) => u.id === m.uye_id)?.takma_ad ?? "Biri";
          const benAd = uyelerRef.current.find((u) => u.id === me.id)?.takma_ad ?? me.takma_ad;
          const ust = m.ust_mesaj_id ? mesajlarRef.current.find((x) => x.id === m.ust_mesaj_id) : undefined;
          const etiketli = etiketVar(m.metin ?? "", benAd);
          const yanitBana = !!ust && ust.uye_id === me.id;
          const rahatsiz = uyelerRef.current.find((u) => u.id === me.id)?.durum === "rahatsiz";
          if (!m.ust_mesaj_id || etiketli || yanitBana) {
            if (m.kanal_id === aktifRef.current && document.visibilityState === "visible") okunduIsaretle(m.kanal_id, m.olusturma);
            else setOkunmamis((x) => ({ ...x, [m.kanal_id]: { n: (x[m.kanal_id]?.n ?? 0) + 1, etiket: (x[m.kanal_id]?.etiket ?? 0) + (etiketli || yanitBana ? 1 : 0) } }));
          }
          if (!rahatsiz) {
            if (etiketli) { duyur("etiket", `${yazar} seni etiketledi`); bildirim(`${yazar} seni etiketledi`, m.metin); }
            else if (yanitBana) { duyur("etiket", `${yazar} mesajına yanıt verdi`); bildirim(`${yazar} mesajına yanıt verdi`, m.metin); }
            else if (!sessizRef.current.includes(m.kanal_id)) duyur("mesaj");
          }
        }
        if (p.eventType === "DELETE") setYanitlar((x) => x.filter((y) => y.id !== m.id));
        if (m.kanal_id !== aktifRef.current) return;
        if (m.ust_mesaj_id) {
          setYanitlar((x) => { const i = x.findIndex((y) => y.id === m.id); return i < 0 ? [...x, m].sort((a, b) => a.olusturma.localeCompare(b.olusturma)) : x.map((y) => (y.id === m.id ? m : y)); });
          return;
        }
        if (p.eventType === "DELETE") { setSabitler((x) => x.filter((y) => y.id !== m.id)); return setMesajlar((x) => x.filter((y) => y.id !== m.id)); }
        setMesajlar((x) => birlestir(x, [m]));
        setSabitler((x) => {
          const kalan = x.filter((y) => y.id !== m.id);
          return m.sabit && !m.silindi ? [m, ...kalan].sort((a, b) => (b.sabit_zaman ?? "").localeCompare(a.sabit_zaman ?? "")) : kalan;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tepkiler" }, (p) => {
        if (p.eventType === "DELETE") {
          const t = p.old as Tepki;
          setTepkiler((x) => x.filter((y) => y.id !== t.id));
        } else {
          const t = p.new as Tepki;
          setTepkiler((x) => (x.some((y) => y.id === t.id) ? x : [...x, t]));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kategoriler" }, (p) => {
        if (p.eventType === "DELETE") { const c = p.old as Kategori; setKategoriler((x) => x.filter((y) => y.id !== c.id)); return; }
        const c = p.new as Kategori;
        if (c.oda_id !== me.oda_id) return;
        setKategoriler((x) => (x.some((y) => y.id === c.id) ? x.map((y) => (y.id === c.id ? c : y)) : [...x, c]).sort((a, b) => a.sira - b.sira));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanallar" }, (p) => {
        if (p.eventType === "DELETE") {
          const k = p.old as Kanal;
          setKanallar((x) => x.filter((y) => y.id !== k.id));
          return;
        }
        const k = p.new as Kanal;
        setKanallar((x) => (x.some((y) => y.id === k.id) ? x.map((y) => (y.id === k.id ? k : y)) : [...x, k]).sort((a, b) => a.sira - b.sira));
        // Şifre değişince herkesin açık kaydı sıfırlanır: güncel durumu sunucudan al
        if (p.eventType === "UPDATE") {
          supabase.from("kanal_acik").select("kanal_id").then(({ data }) => {
            if (data) setAcik(new Set((data as { kanal_id: string }[]).map((x) => x.kanal_id)));
          });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "uyeler" }, (p) => {
        if (p.eventType === "DELETE") {
          const u = p.old as Uye;
          if (u.id === me.id) { supabase.auth.signOut({ scope: "local" }).then(onExit); return; }
          setUyeler((x) => x.filter((y) => y.id !== u.id));
        } else {
          const u = silinmisGoster(p.new as Uye);
          setUyeler((x) => (x.some((y) => y.id === u.id) ? x.map((y) => (y.id === u.id ? u : y)) : [...x, u]));
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "yonetim_komutlari", filter: `hedef_uye=eq.${me.id}` }, (p) => {
        const k = p.new as { tur: "ses-at" | "tasi" | "sustur" | "sustur-kaldir"; kanal_id: string | null };
        const s = sesRef.current;
        if (!s.kanalId) return;
        if (k.tur === "sustur") { void s.sunucuSusturAyarla(true); setYonBilgi("Bir yönetici seni susturdu; sesin yönetici kaldırınca açılır."); return; }
        if (k.tur === "sustur-kaldir") { void s.sunucuSusturAyarla(false); setYonBilgi("Susturman kaldırıldı."); return; }
        if (k.tur === "tasi" && k.kanal_id) {
          setYonBilgi("Yönetici seni başka bir sesli odaya taşıdı.");
          void s.baglan(k.kanal_id);
        } else {
          setYonBilgi("Yönetici seni sesli odadan çıkardı.");
          void s.ayril();
        }
      })
      .on("presence", { event: "sync" }, () => {
        const durum = kanal.presenceState<{ ses?: string | null; motor?: Motor | null; ekran?: boolean; bosta?: boolean; sagir?: boolean }>();
        setCevrimici(new Set(Object.keys(durum)));
        setBosta(new Set(Object.entries(durum).filter(([, m]) => m[m.length - 1]?.bosta).map(([id]) => id)));
        setSagirlar(new Set(Object.entries(durum).filter(([, m]) => m[m.length - 1]?.sagir).map(([id]) => id)));
        const konum = new Map<string, { kanal: string; motor: Motor | null; ekran: boolean }>();
        for (const [uyeId, metalar] of Object.entries(durum)) {
          const son = metalar[metalar.length - 1];
          if (son?.ses) konum.set(uyeId, { kanal: son.ses, motor: son.motor ?? null, ekran: !!son.ekran });
        }
        setSesKonum(konum);
        // Benim bulunduğum sesli odaya girenleri / çıkanları duyur
        const benimKanal = sesRef.current.kanalId;
        const onc = oncekiKonumRef.current;
        if (benimKanal && onc.kanal === benimKanal) {
          const olay = (id: string, girdi: boolean) => {
            const ad = uyelerRef.current.find((u) => u.id === id)?.takma_ad ?? "Biri";
            const metin = `${ad} ${girdi ? "bağlandı" : "ayrıldı"}`;
            if (uyelerRef.current.find((u) => u.id === me.id)?.durum !== "rahatsiz") duyur(girdi ? "baglandi" : "ayrildi", metin);
            toastAt(`${girdi ? "🟢" : "🔴"} ${metin}`);
          };
          for (const [id, k] of konum) if (id !== me.id && k.kanal === benimKanal && onc.konum.get(id) !== benimKanal) olay(id, true);
          for (const [id, kk] of onc.konum) if (id !== me.id && kk === benimKanal && konum.get(id)?.kanal !== benimKanal) olay(id, false);
        }
        oncekiKonumRef.current = { kanal: benimKanal, konum: new Map([...konum].map(([id, k]) => [id, k.kanal])) };
      })
      .subscribe(async (durum) => { if (durum === "SUBSCRIBED") await kanal.track({ t: Date.now(), ses: null, motor: null, bosta: bostaRef.current, sagir: sagirRef.current }); });

    const nabiz = setInterval(() => {
      supabase.from("uyeler").update({ son_gorulme: new Date().toISOString() }).eq("id", me.id).then(() => {});
    }, 60000);
    return () => { clearInterval(nabiz); kanalRef.current = null; supabase.removeChannel(kanal); };
  }, [me.id, me.oda_id, onExit, okunduIsaretle, toastAt]);

  useEffect(() => {
    const el = akisRef.current;
    if (el && altaKaydir.current) el.scrollTop = el.scrollHeight;
  }, [mesajlar]);

  useEffect(() => () => { if (ekRef.current) URL.revokeObjectURL(ekRef.current.onizleme); }, []);

  // Hazırlanan resim yanlış kanala gitmesin diye kanal değişince bırakılır
  useEffect(() => { ekTemizle(); setYanitlanan(null); setGifAcik(false); }, [aktif]);

  // Oda sahibi için aylık ses kullanımı (bağlantı durumu değişince yenilenir)
  useEffect(() => {
    if (me.rol !== "sahip") return;
    supabase.rpc("ses_kullanim", { p_oda: me.oda_id }).then(({ data }) => { if (typeof data === "number") setKullanimDk(data); });
  }, [me.rol, me.oda_id, ses.durum]);

  function ekTemizle() {
    setEk((e) => { if (e) URL.revokeObjectURL(e.onizleme); return null; });
  }

  async function ekSec(dosya: File | Blob | undefined | null, ad?: string) {
    if (!dosya) return;
    setHata("");
    try {
      const hazir = await ekHazirla(dosya, ad ?? (dosya as File).name ?? "resim");
      setEk((eski) => { if (eski) URL.revokeObjectURL(eski.onizleme); return hazir; });
      metinRef.current?.focus();
    } catch (e) {
      setHata(e instanceof EkHatasi ? e.message : "Resim eklenemedi.");
    }
  }

  function resimBul(liste: FileList | null | undefined): File | undefined {
    return liste ? [...liste].find((f) => f.type.startsWith("image/")) : undefined;
  }

  const mesajaKaydir = useCallback((id: string) => {
    setTimeout(() => {
      const el = document.getElementById(`mesaj-${id}`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setVurguId(id);
      setTimeout(() => setVurguId((v) => (v === id ? null : v)), 2200);
    }, 60);
  }, []);

  /** Aranan / alıntılanan mesaja gider; yüklü değilse etrafındaki mesajları yükler. */
  async function gitIsle(liste?: Mesaj[]) {
    const h = gitRef.current;
    if (!h || h.kanal_id !== aktifRef.current) return;
    gitRef.current = null;
    const anaId = h.ust_mesaj_id ?? h.id;
    if (h.ust_mesaj_id) setKonuId(h.ust_mesaj_id);
    if (!(liste ?? mesajlarRef.current).some((m) => m.id === anaId)) {
      let ana: Mesaj | undefined = h.ust_mesaj_id ? undefined : h;
      if (!ana) {
        const { data } = await supabase.from("mesajlar").select("*").eq("id", anaId).maybeSingle();
        ana = (data as Mesaj | null) ?? undefined;
      }
      if (!ana) return setHata("Mesaj bulunamadı.");
      const [once, sonra] = await Promise.all([
        supabase.from("mesajlar").select("*").eq("kanal_id", ana.kanal_id).is("ust_mesaj_id", null).lte("olusturma", ana.olusturma).order("olusturma", { ascending: false }).limit(25),
        supabase.from("mesajlar").select("*").eq("kanal_id", ana.kanal_id).is("ust_mesaj_id", null).gt("olusturma", ana.olusturma).order("olusturma", { ascending: true }).limit(25),
      ]);
      const pencere = birlestir([], [...((once.data ?? []) as Mesaj[]), ...((sonra.data ?? []) as Mesaj[])]);
      altaKaydir.current = false;
      setMesajlar(pencere);
      setDahaVar(true);
      const { data: t } = await supabase.from("tepkiler").select("*").in("mesaj_id", pencere.map((m) => m.id));
      if (t) setTepkiler(t as Tepki[]);
    }
    mesajaKaydir(anaId);
  }

  function mesajaGit(m: Mesaj) {
    setAramaAcik(false);
    gitRef.current = m;
    if (m.kanal_id === aktifRef.current) return void gitIsle();
    const k = kanallar.find((x) => x.id === m.kanal_id);
    if (k) kanalaGir(k, () => { setAktif(k.id); setPane("chat"); });
  }

  async function alintiyaGit(id: string) {
    if (document.getElementById(`mesaj-${id}`)) return mesajaKaydir(id);
    const m = mesajIndex.get(id) ?? ((await supabase.from("mesajlar").select("*").eq("id", id).maybeSingle()).data as Mesaj | null);
    if (!m) return toastAt("Mesaj bulunamadı.", "hata");
    if (m.silindi) return toastAt("Bu mesaj silindi.");
    gitRef.current = m;
    await gitIsle();
  }

  async function sesSohbetGonder(t: string): Promise<boolean> {
    if (!aktif) return false;
    const { data, error } = await supabase.from("mesajlar").insert({ kanal_id: aktif, uye_id: me.id, metin: t }).select().single();
    if (error) { setHata("Mesaj gönderilemedi."); return false; }
    altaKaydir.current = true;
    setMesajlar((x) => birlestir(x, [data as Mesaj]));
    return true;
  }

  async function sesSustur(u: Uye, sustur: boolean): Promise<string | null> {
    const h = await yonetCagir({ islem: "ses", uye_id: u.id, tur: sustur ? "sustur" : "sustur-kaldir" });
    if (!h) setSusturulanlar((x) => { const y = new Set(x); if (sustur) y.add(u.id); else y.delete(u.id); return y; });
    return h;
  }

  async function sesAt(u: Uye): Promise<string | null> {
    return yonetCagir({ islem: "ses", uye_id: u.id, tur: "at" });
  }

  async function gifGonder(url: string) {
    if (!aktif) return;
    setGifAcik(false);
    const { data, error } = await supabase.from("mesajlar").insert({ kanal_id: aktif, uye_id: me.id, metin: url, yanit_id: yanitlanan?.id ?? null }).select().single();
    if (error) return setHata("GIF gönderilemedi.");
    setYanitlanan(null);
    altaKaydir.current = true;
    setMesajlar((x) => birlestir(x, [data as Mesaj]));
  }

  async function anketOlustur(t: AnketTaslak): Promise<string | null> {
    if (!aktif) return "Kanal seçili değil.";
    const { error } = await supabase.rpc("anket_olustur", { p_kanal: aktif, p_soru: t.soru, p_secenekler: t.secenekler, p_sure_dk: t.sureDk, p_coklu: t.coklu });
    if (error) return error.message;
    setAnketAcik(false);
    altaKaydir.current = true;
    return null;
  }

  async function iletGonder(k: Kanal) {
    const m = iletMesaj;
    if (!m) return;
    const yazarAd = uyeHaritasi.get(m.uye_id)?.takma_ad ?? "Eski üye";
    const { data, error } = await supabase.from("mesajlar").insert({ kanal_id: k.id, uye_id: me.id, metin: m.metin, iletilen_ad: yazarAd.slice(0, 24) }).select().single();
    setIletMesaj(null);
    if (error) return setHata("Mesaj iletilemedi.");
    toastAt(`İletildi: #${k.ad}`);
    if (k.id === aktifRef.current) { altaKaydir.current = true; setMesajlar((x) => birlestir(x, [data as Mesaj])); }
  }

  function yaziyorYayinla() {
    const simdi = Date.now();
    if (!aktif || simdi - sonYaziyorYayin.current < YAZIYOR_YAYIN_ARALIK_MS) return;
    sonYaziyorYayin.current = simdi;
    void kanalRef.current?.send({ type: "broadcast", event: "yaziyor", payload: { uye: me.id, ad: ben.takma_ad, kanal: aktif } });
  }

  async function gonder() {
    const t = metin.trim();
    if ((!t && !ek) || !aktif || gonderiliyor) return;
    setHata("");
    setGonderiliyor(true);
    const gonderilenEk = ek;
    let yol: string | null = null;
    try {
      if (gonderilenEk) {
        yol = ekYolu(me.oda_id, aktif, crypto.randomUUID(), gonderilenEk.tur);
        const { error: yErr } = await supabase.storage.from("ekler")
          .upload(yol, gonderilenEk.blob, { contentType: gonderilenEk.tur, cacheControl: "3600", upsert: false });
        if (yErr) { yol = null; return setHata("Resim yüklenemedi. Biraz sonra tekrar dene."); }
      }
      const { data, error } = await supabase.from("mesajlar").insert({
        kanal_id: aktif, uye_id: me.id, metin: t, yanit_id: yanitlanan?.id ?? null,
        ...(gonderilenEk && yol ? {
          ek_yol: yol, ek_tur: gonderilenEk.tur, ek_boyut: gonderilenEk.boyut,
          ek_genislik: gonderilenEk.genislik, ek_yukseklik: gonderilenEk.yukseklik,
        } : {}),
      }).select().single();
      if (error) {
        if (yol) void supabase.storage.from("ekler").remove([yol]);
        return setHata("Mesaj gönderilemedi.");
      }
      setMetin(""); setEmojiAcik(false); ekTemizle(); setYanitlanan(null);
      altaKaydir.current = true;
      setMesajlar((x) => birlestir(x, [data as Mesaj]));
      if (/https?:\/\//i.test(t)) void supabase.functions.invoke("onizleme", { body: { mesaj_id: (data as Mesaj).id } });
      metinRef.current?.focus();
    } finally {
      setGonderiliyor(false);
    }
  }

  async function yanitGonder(t: string): Promise<boolean> {
    if (!aktif || !konuId) return false;
    setHata("");
    const { data, error } = await supabase.from("mesajlar").insert({ kanal_id: aktif, uye_id: me.id, metin: t, ust_mesaj_id: konuId }).select().single();
    if (error) { setHata("Yanıt gönderilemedi."); return false; }
    setYanitlar((x) => (x.some((y) => y.id === (data as Mesaj).id) ? x : [...x, data as Mesaj]));
    return true;
  }

  async function sil(m: Mesaj) {
    if (!confirm("Bu mesaj silinsin mi?")) return;
    const { error } = await supabase.from("mesajlar").update({ silindi: true }).eq("id", m.id);
    if (error) return setHata("Mesaj silinemedi.");
    if (m.ek_yol) void supabase.storage.from("ekler").remove([m.ek_yol]);
    setMesajlar((x) => x.map((y) => (y.id === m.id ? { ...y, silindi: true } : y)));
  }

  async function mesajDuzenle(m: Mesaj, metin: string): Promise<boolean> {
    const t = metin.trim();
    if (!t || t.length > 4000) { setHata("Mesaj 1-4000 karakter olmalı."); return false; }
    const { data, error } = await supabase.from("mesajlar").update({ metin: t }).eq("id", m.id).select().single();
    if (error || !data) { setHata("Mesaj düzenlenemedi."); return false; }
    const yeni = data as Mesaj;
    setMesajlar((x) => x.map((y) => (y.id === m.id ? yeni : y)));
    setYanitlar((x) => x.map((y) => (y.id === m.id ? yeni : y)));
    return true;
  }

  async function profilKaydet(d: ProfilDegisiklik): Promise<string | null> {
    const guncel = uyeHaritasi.get(me.id) ?? me;
    const eskiYol = guncel.avatar_yol ?? null;
    let yeniYol: string | null = null;
    const alanlar: Record<string, unknown> = {};
    if (d.takma_ad !== guncel.takma_ad) alanlar.takma_ad = d.takma_ad;
    if (d.renk !== guncel.renk) alanlar.renk = d.renk;
    if (d.hakkinda !== (guncel.hakkinda ?? "")) alanlar.hakkinda = d.hakkinda === "" ? null : d.hakkinda;
    if (d.durum_metin !== (guncel.durum_metin ?? "")) alanlar.durum_metin = d.durum_metin === "" ? null : d.durum_metin;
    if (d.yeniAvatar) {
      yeniYol = `${me.oda_id}/${me.id}/${crypto.randomUUID()}.${d.yeniAvatar.uzanti}`;
      const { error: yErr } = await supabase.storage.from("avatarlar")
        .upload(yeniYol, d.yeniAvatar.blob, { contentType: d.yeniAvatar.tur, cacheControl: "3600", upsert: false });
      if (yErr) return "Fotoğraf yüklenemedi. Biraz sonra tekrar dene.";
      alanlar.avatar_yol = yeniYol;
    } else if (d.avatarKaldir && eskiYol) {
      alanlar.avatar_yol = null;
    }
    if (!Object.keys(alanlar).length) return null;
    const { data, error } = await supabase.from("uyeler").update(alanlar).eq("id", me.id).select().single();
    if (error || !data) {
      if (yeniYol) void supabase.storage.from("avatarlar").remove([yeniYol]);
      return error?.code === "23505" ? "Bu takma ad bu odada kullanılıyor." : "Profil kaydedilemedi. Biraz sonra tekrar dene.";
    }
    if ("avatar_yol" in alanlar && eskiYol) void supabase.storage.from("avatarlar").remove([eskiYol]);
    setUyeler((x) => x.map((y) => (y.id === me.id ? { ...y, ...(data as Uye) } : y)));
    return null;
  }

  async function tepkiDegistir(mesajId: string, emoji: string) {
    const var_ = tepkiler.find((t) => t.mesaj_id === mesajId && t.uye_id === me.id && t.emoji === emoji);
    if (var_) {
      setTepkiler((x) => x.filter((t) => t.id !== var_.id));
      const { error } = await supabase.from("tepkiler").delete().eq("id", var_.id);
      if (error) setTepkiler((x) => [...x, var_]);
    } else {
      const { data, error } = await supabase.from("tepkiler").insert({ mesaj_id: mesajId, uye_id: me.id, emoji }).select().single();
      if (!error && data) setTepkiler((x) => (x.some((y) => y.id === data.id) ? x : [...x, data as Tepki]));
    }
  }

  async function sabitle(m: Mesaj, sabit: boolean) {
    setHata("");
    const { error } = await supabase.rpc("mesaj_sabitle", { p_mesaj: m.id, p_sabit: sabit });
    if (error) setHata(error.message || "Sabitleme yapılamadı.");
  }

  async function konuKaydet() {
    if (!aktifKanal || konuDuzen === null) return;
    const { error } = await supabase.rpc("kanal_aciklama_ayarla", { p_kanal: aktifKanal.id, p_metin: konuDuzen });
    if (error) { setHata(error.message || "Açıklama kaydedilemedi."); return; }
    setKanallar((x) => x.map((k) => (k.id === aktifKanal.id ? { ...k, aciklama: konuDuzen.trim() || null } : k)));
    setKonuDuzen(null);
  }

  async function durumDegistir(d: Durum) {
    const eski = ben.durum ?? "cevrimici";
    setUyeler((x) => x.map((y) => (y.id === me.id ? { ...y, durum: d } : y)));
    const { error } = await supabase.from("uyeler").update({ durum: d }).eq("id", me.id);
    if (error) {
      setUyeler((x) => x.map((y) => (y.id === me.id ? { ...y, durum: eski } : y)));
      toastAt("Durum değiştirilemedi.", "hata");
    }
  }

  const paletKomutlari: Komut[] = [
    ...kanallar.map((k): Komut => ({
      id: "k-" + k.id, ad: k.ad, tur: cevir(k.tur === "sesli" ? "palet.ses" : "palet.kanal"), ikon: k.tur === "sesli" ? "ses" : "hash",
      calistir: () => { setGorunum("sunucu"); kanalaGir(k, () => { setAktif(k.id); setPane("chat"); }); },
    })),
    ...sunucular.filter((x) => x.oda_id !== me.oda_id).map((x): Komut => ({ id: "s-" + x.oda_id, ad: x.ad, tur: cevir("palet.sunucu"), ikon: "grup", calistir: () => onSunucuSec?.(x.oda_id) })),
    { id: "c-arama", ad: cevir("komut.arama"), tur: cevir("palet.komut"), ikon: "ara", calistir: () => { setGorunum("sunucu"); setAramaAcik(true); } },
    { id: "c-dm", ad: cevir("komut.dm"), tur: cevir("palet.komut"), ikon: "sohbet", calistir: () => { setGorunum("dm"); setDmMobil("liste"); setDmSayfa(aktifDm ? "sohbet" : "arkadaslar"); } },
    { id: "c-arkadas", ad: cevir("komut.arkadaslar"), tur: cevir("palet.komut"), ikon: "kullanici", calistir: () => { setGorunum("dm"); setDmSayfa("arkadaslar"); setDmMobil("icerik"); } },
    { id: "c-profil", ad: cevir("komut.profil"), tur: cevir("palet.komut"), ikon: "kullanici", calistir: () => setProfilId(me.id) },
    { id: "c-ayar", ad: cevir("komut.ayarlar"), tur: cevir("palet.komut"), ikon: "ayar", calistir: () => setAyarAcik(true) },
    ...(ayarGoster ? [{ id: "c-sunucu-ayar", ad: cevir("komut.sunucuAyar"), tur: cevir("palet.komut"), ikon: "kalkan", calistir: () => ayarAc("genel") } as Komut] : []),
    ...(onSunucularYenile ? [{ id: "c-sunucu-kur", ad: cevir("komut.sunucuKur"), tur: cevir("palet.komut"), ikon: "grup", calistir: () => setSunucuDialogAcik(true) } as Komut] : []),
  ];
  // Kısayollar: Ctrl/Cmd+K palet, Alt+↑/↓ kanal değiştir
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletAcik((a) => !a); return; }
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && gorunum === "sunucu") {
        const yazili = kanallar.filter((k) => k.tur === "yazili" && girebilir(k));
        const i = yazili.findIndex((k) => k.id === aktif);
        const hedef = yazili[i + (e.key === "ArrowUp" ? -1 : 1)];
        if (hedef) { e.preventDefault(); setAktif(hedef.id); setPane("chat"); }
      }
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [kanallar, aktif, gorunum, girebilir]);

  async function kanallariYenile() {
    const [k, c] = await Promise.all([
      supabase.from("kanallar").select("*").eq("oda_id", me.oda_id).order("sira"),
      supabase.from("kategoriler").select("*").eq("oda_id", me.oda_id).order("sira"),
    ]);
    if (k.data) setKanallar(k.data as Kanal[]);
    if (c.data) setKategoriler(c.data as Kategori[]);
  }
  useEffect(() => {
    if (!yonetimAcik) return;
    const kapat = (e: KeyboardEvent) => { if (e.key === "Escape") setYonetimAcik(false); };
    window.addEventListener("keydown", kapat);
    return () => window.removeEventListener("keydown", kapat);
  }, [yonetimAcik]);

  function bolumKatla(b: string) {
    setKatlanmis((x) => { const y = x.includes(b) ? x.filter((i) => i !== b) : [...x, b]; katlanmisYaz(y); return y; });
  }
  function sessizDegistir(id: string) {
    setSessiz((x) => { const y = x.includes(id) ? x.filter((i) => i !== id) : [...x, id]; sessizYaz(y); return y; });
  }
  function kanalTasi(tur: "yazili" | "sesli", id: string, hedef: string | number) {
    const liste = sirala(kanallar.filter((k) => k.tur === tur), sira[tur]).map((k) => k.id);
    const i = liste.indexOf(id);
    if (i < 0) return;
    const j = typeof hedef === "number" ? i + hedef : liste.indexOf(hedef);
    if (j < 0 || j >= liste.length || j === i) return;
    liste.splice(i, 1);
    liste.splice(j, 0, id);
    const yeni = { ...sira, [tur]: liste };
    setSira(yeni);
    siraYaz(yeni);
  }

  async function cikis() {
    if (ben.misafir) {
      if (!confirm("Misafir hesabın silinecek ve bir daha girilemeyecek. Mesajların odada \"Silinmiş üye\" adıyla kalır. Çıkılsın mı?")) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`${SUPABASE_URL}/functions/v1/katil`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session?.access_token ?? ""}` },
          body: JSON.stringify({ misafir_sil: true }),
        });
      } catch { /* ağ yoksa yine de çık; bayat misafirler sonradan temizlenir */ }
      await pushKapat();
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      onExit();
      return;
    }
    if (!confirm("Çıkış yapılsın mı? Google ile istediğin zaman tekrar girebilirsin.")) return;
    await pushKapat();
    await supabase.auth.signOut({ scope: "local" });
    onExit();
  }

  const yaziKanallari = sirala(kanallar.filter((k) => k.tur === "yazili"), sira.yazili);
  const sesKanallari = sirala(kanallar.filter((k) => k.tur === "sesli"), sira.sesli);
  const gruplar = gruplariKur(kanallar, kategoriler);
  const kategoriGruplari = gruplar.slice(1);
  const kategorisizKimlik = new Set(gruplar[0].kanallar.map((k) => k.id));
  const yaziKategorisiz = yaziKanallari.filter((k) => kategorisizKimlik.has(k.id));
  const sesKategorisiz = sesKanallari.filter((k) => kategorisizKimlik.has(k.id));
  const okunmamisBilgi = (id: string) => (sessiz.includes(id) ? undefined : okunmamis[id]);
  const bolumOkunmamis = (liste: Kanal[]) => liste.reduce((a, k) => a + (okunmamisBilgi(k.id)?.etiket ?? 0), 0);
  const bolumKanallari = (bolum: "yazili" | "sesli", liste: Kanal[]) =>
    katlanmis.includes(bolum) ? liste.filter((k) => k.id === aktif || okunmamisBilgi(k.id)) : liste;
  const kanalArac = (k: Kanal) => duzenle && (
    <div className="ch-arac">
      <button onClick={() => kanalTasi(k.tur, k.id, -1)} aria-label={`${k.ad} kanalını yukarı taşı`} title={t("Yukarı")}>▲</button>
      <button onClick={() => kanalTasi(k.tur, k.id, 1)} aria-label={`${k.ad} kanalını aşağı taşı`} title={t("Aşağı")}>▼</button>
      <button onClick={() => sessizDegistir(k.id)} aria-pressed={sessiz.includes(k.id)} aria-label={`${k.ad} kanalını ${sessiz.includes(k.id) ? "sesten çıkar" : "sessize al"}`} title={t("Sessize al")}>{sessiz.includes(k.id) ? "🔕" : "🔔"}</button>
    </div>
  );
  const surukleProps = (k: Kanal) => duzenle ? {
    draggable: true,
    onDragStart: () => setSurukId(k.id),
    onDragOver: (e: React.DragEvent) => { if (surukId && surukId !== k.id) e.preventDefault(); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); if (surukId) kanalTasi(k.tur, surukId, k.id); setSurukId(null); },
    onDragEnd: () => setSurukId(null),
  } : {};
  const sayacRozeti = (id: string) => {
    const o = okunmamisBilgi(id);
    return o?.etiket ? <span className="rozet" aria-hidden="true">{o.etiket > 99 ? "99+" : o.etiket}</span> : null;
  };
  const okunmamisEtiket = (k: Kanal) => {
    const o = okunmamisBilgi(k.id);
    return o ? `, ${o.n} okunmamış mesaj${o.etiket ? `, ${o.etiket} etiket` : ""}` : "";
  };
  const yaziSatiri = (k: Kanal) => {
    const o = okunmamisBilgi(k.id);
    return (
              <div key={k.id} className={"ch-satir" + (duzenle ? " duzenle" : "") + (surukId === k.id ? " surukleniyor" : "")} {...surukleProps(k)}>
                <button className={"ch" + (o ? " okunmamis" : "") + (sessiz.includes(k.id) ? " sessiz" : "")} aria-current={k.id === aktif}
                  aria-label={`${k.ad}${k.sifreli ? ", şifreli kanal" : ""}${sessiz.includes(k.id) ? ", sessizde" : ""}${okunmamisEtiket(k)}`}
                  onClick={() => kanalaGir(k, () => { setAktif(k.id); setPane("chat"); })}>
                  {o && <span className="nokta" aria-hidden="true" />}
                  <span className="hash" aria-hidden="true"><Ikon ad="hash" boyut={16} /></span><span className="ch-ad">{k.ad}</span>
                  {sessiz.includes(k.id) && <span className="kilit" aria-hidden="true"><Ikon ad="zilKapali" boyut={14} /></span>}
                  {k.sifreli && <span className="kilit" aria-hidden="true"><Ikon ad="kilit" boyut={14} /></span>}
                  {sayacRozeti(k.id)}
                </button>
                {kanalArac(k)}
              </div>
    );
  };
  const sesSatiri = (k: Kanal) => {
            const icindekiler = uyeler.filter((u) => sesKonum.get(u.id)?.kanal === k.id);
            const buradayim = ses.kanalId === k.id && ses.durum !== "kapali";
            const o = okunmamisBilgi(k.id);
            return (
              <div key={k.id}>
                <div className={"ch-satir" + (duzenle ? " duzenle" : "") + (surukId === k.id ? " surukleniyor" : "")} {...surukleProps(k)}>
                <button className={"ch" + (o ? " okunmamis" : "") + (sessiz.includes(k.id) ? " sessiz" : "")} aria-pressed={buradayim} disabled={ses.durum === "baglaniyor"}
                  onClick={() => kanalaGir(k, () => { setAktif(k.id); setPane("chat"); if (!buradayim) void ses.baglan(k.id); })}
                  aria-label={`${k.ad} sesli odası${k.sifreli ? ", şifreli" : ""}${okunmamisEtiket(k)}, ${buradayim ? "sohbetini açmak için tıkla; ayrılmak için Ayrıl düğmesini kullan" : "katılmak için tıkla"}`}>
                  {o && <span className="nokta" aria-hidden="true" />}
                  <span className="hash" aria-hidden="true"><Ikon ad="ses" boyut={16} /></span><span className="ch-ad">{k.ad}</span>
                  {sessiz.includes(k.id) && <span className="kilit" aria-hidden="true"><Ikon ad="zilKapali" boyut={14} /></span>}
                  {k.sifreli && <span className="kilit" aria-hidden="true"><Ikon ad="kilit" boyut={14} /></span>}
                  {buradayim && <span className="soon">{t("bağlı")}</span>}
                  {sayacRozeti(k.id)}
                </button>
                <button className="ch-sohbet" aria-current={k.id === aktif} title={t("Bu odanın yazılı sohbetini aç")}
                  aria-label={`${k.ad} sesli odasının yazılı sohbetini aç`}
                  onClick={() => kanalaGir(k, () => { setAktif(k.id); setPane("chat"); })}><Ikon ad="sohbet" boyut={16} /></button>
                {kanalArac(k)}
                </div>
                {icindekiler.length > 0 && (
                  <ul className="vlist" aria-label={`${k.ad} katılımcıları`}>
                    {icindekiler.map((u) => (
                      <li key={u.id} className="vp">
                        <Avatar uye={u} className={ses.konusanlar.has(u.id) ? "speak" : ""} />
                        {u.takma_ad}{ses.konusanlar.has(u.id) && <span className="sr">{" "}{t("konuşuyor")}</span>}
                        {ses.sorunlu.has(u.id) && <span className="yayin" title={t("Bu kişiyle bağlantı kurulamıyor")}><span aria-hidden="true">⚠️</span><span className="sr">{" "}{t("bağlantı sorunu")}</span></span>}
                        {sesKonum.get(u.id)?.ekran && <span className="yayin" title={t("Ekran paylaşıyor")}><span aria-hidden="true">🖥️</span><span className="sr">{" "}{t("ekran paylaşıyor")}</span></span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
  };
  const kategoriBolumu = (c: Kategori, liste: Kanal[]) => {
    const anahtar = "kat:" + c.id;
    const kapali = katlanmis.includes(anahtar);
    const gorunen = kapali ? liste.filter((k) => k.id === aktif || okunmamisBilgi(k.id)) : liste;
    return (
      <div key={c.id}>
        <div className="sec sec-satir">
          <button className="sec-bas" aria-expanded={!kapali} onClick={() => bolumKatla(anahtar)}>
            <Ikon ad={kapali ? "saga" : "asagi"} boyut={12} /> {c.ad}
            {kapali && bolumOkunmamis(liste) > 0 && <span className="rozet" aria-hidden="true">{bolumOkunmamis(liste)}</span>}
          </button>
          {kanalYonet && <div className="sec-sag"><button className="sec-ekle" onClick={() => ayarAc("kanallar")} aria-label={`${c.ad} kategorisine kanal ekle`} title={t("Kanal ekle")}>+</button></div>}
        </div>
        {gorunen.map((k) => (k.tur === "sesli" ? sesSatiri(k) : yaziSatiri(k)))}
      </div>
    );
  };
  const aktifUyeler = uyeler.filter((u) => !u.silindi);
  const cevrimiciUyeler = aktifUyeler.filter((u) => cevrimici.has(u.id) || u.id === me.id);
  const cevrimdisiUyeler = aktifUyeler.filter((u) => !cevrimiciUyeler.includes(u));

  let sonGun = "";
  let onceki: Mesaj | null = null;
  let bolucuYazildi = false;
  const satirlar: React.ReactNode[] = [];
  for (const m of mesajlar) {
    const g = gunEtiketi(m.olusturma);
    if (g !== sonGun) { sonGun = g; onceki = null; satirlar.push(<div className="day" key={"g" + m.id}>{g}</div>); }
    const devam = !!onceki && onceki.uye_id === m.uye_id && !onceki.silindi && !m.silindi
      && new Date(m.olusturma).getTime() - new Date(onceki.olusturma).getTime() < 5 * 60000;
    onceki = m;
    if (bolucu && bolucu.kanal === aktif && !bolucuYazildi && m.olusturma > bolucu.zaman && m.uye_id !== me.id) {
      bolucuYazildi = true;
      satirlar.push(<div className="yeni-cizgi" role="separator" aria-label={t("Buradan sonrası yeni mesajlar")} key={"yeni" + m.id}><span>{t("Yeni mesajlar")}</span></div>);
    }
    const alintilanan = m.yanit_id ? mesajIndex.get(m.yanit_id) : undefined;
    satirlar.push(
      <MessageView key={m.id} devam={devam} vurgu={vurguId === m.id} mesaj={m}
        zengin={{
          alinti: m.yanit_id ? { mesaj: alintilanan, yazar: alintilanan ? uyeHaritasi.get(alintilanan.uye_id) : undefined } : undefined,
          onAlintiGit: (id) => void alintiyaGit(id),
          onYanitla: yazamaz ? undefined : (x) => { setYanitlanan(x); metinRef.current?.focus(); },
          onIlet: (x) => setIletMesaj(x),
          anket: anketler.get(m.id), onOyla: anketOyla, onHata: (h) => toastAt(h, "hata"),
        }} yazar={uyeHaritasi.get(m.uye_id)} benim={ben}
        tepkiler={tepkiler.filter((t) => t.mesaj_id === m.id)} onTepki={tepkiDegistir} onSil={sil} onDuzenle={mesajDuzenle} onSabitle={sabitle} onProfil={setProfilId}
        yanitSayisi={yanitlar.filter((y) => y.ust_mesaj_id === m.id && !y.silindi).length} onKonu={(x) => setKonuId(x.id)} />,
    );
  }

  const uyeSatiri = (u: Uye, acik: boolean) => (
    <button key={u.id} className={"mem" + (acik ? "" : " off")} onClick={() => setProfilId(u.id)} title={`${u.takma_ad} profilini aç`}>
      <Avatar uye={u}>{acik && <span className="on-dot" style={{ background: bosta.has(u.id) && (!u.durum || u.durum === "cevrimici") ? "#f5b94a" : DURUM_BILGI[u.durum ?? "cevrimici"].renk }} />}</Avatar>
      <div className="mem-ad"><span className={"mem-isim rol-" + u.rol}>{u.takma_ad}</span>{u.rol !== "uye" && <span className="sr">, {rolEtiketi(u.rol).toLowerCase()}</span>}{acik && u.durum && u.durum !== "cevrimici" && <small>{DURUM_BILGI[u.durum].ad}</small>}{acik && bosta.has(u.id) && (!u.durum || u.durum === "cevrimici") && <small>{t("Boşta")}</small>}{u.durum_metin && <small className="mem-durum-metin">{u.durum_metin}</small>}{u.hakkinda && <small className="mem-hk">{u.hakkinda}</small>}</div>
    </button>
  );

  return (
    <div id="app" className={"on" + (gorunum === "dm" ? " dm-modu" : "") + (gorunum === "sunucu" && aktifKanal?.tur === "sesli" ? " ses-modu" : "")} data-pane={gorunum === "dm" ? (dmMobil === "liste" ? "side" : "chat") : pane}>
      <nav className="sunucu-serit" aria-label={t("Sunucular")}>
        {(sunucular.length ? sunucular : [{ oda_id: me.oda_id, ad: odaAdi, ikon_metin: null, ikon_renk: "" } as Sunucu]).map((x) => {
          const buradaki = x.oda_id === me.oda_id;
          return (
            <button key={x.oda_id} type="button" className={"sr-dugme sr-sunucu" + (buradaki && gorunum === "sunucu" ? " aktif" : "")} aria-label={`${buradaki ? odaAdi : x.ad} sunucusu`}
              aria-current={buradaki && gorunum === "sunucu"} title={x.ad} style={x.ikon_renk ? { background: x.ikon_renk } : undefined}
              onClick={() => { if (buradaki) setGorunum("sunucu"); else onSunucuSec?.(x.oda_id); }}>
              {sunucuBasHarf({ ad: buradaki ? odaAdi : x.ad, ikon_metin: x.ikon_metin })}
            </button>
          );
        })}
        {onSunucularYenile && <button type="button" className="sr-dugme sr-ekle" aria-label={t("Sunucu oluştur veya katıl")} title={t("Sunucu oluştur veya katıl")} onClick={() => setSunucuDialogAcik(true)}>+</button>}
        <span className="sr-ayrac" aria-hidden="true" />
        <button type="button" className={"sr-dugme" + (gorunum === "dm" ? " aktif" : "")} aria-current={gorunum === "dm"}
          onClick={() => { setGorunum("dm"); setDmMobil("liste"); setDmSayfa(aktifDm ? "sohbet" : "arkadaslar"); }}
          aria-label={`Özel mesajlar${dm.toplamOkunmamis ? `, ${dm.toplamOkunmamis} okunmamış` : ""}${dm.gelenIstekler.length ? `, ${dm.gelenIstekler.length} arkadaş isteği` : ""}`}>
          <Ikon ad="sohbet" boyut={22} />
          {dm.toplamOkunmamis + dm.gelenIstekler.length > 0 && <span className="rozet sr-rozet" aria-hidden="true">{dm.toplamOkunmamis + dm.gelenIstekler.length}</span>}
        </button>
      </nav>
      <section className="col side sunucu-kolon" aria-label={t("Kanallar")}>
        <div className="head kanal-ust">
          <h1>{odaAdi}</h1>
          <Ikon ad="asagi" boyut={16} />
        </div>
        <nav className="scroll" aria-label={t("Kanal listesi")}>
          <div className="sec sec-satir">
            <button className="sec-bas" aria-expanded={!katlanmis.includes("yazili")} onClick={() => bolumKatla("yazili")}>
              <Ikon ad={katlanmis.includes("yazili") ? "saga" : "asagi"} boyut={12} /> Yazılı kanallar
              {katlanmis.includes("yazili") && bolumOkunmamis(yaziKanallari) > 0 && <span className="rozet" aria-hidden="true">{bolumOkunmamis(yaziKanallari)}</span>}
            </button>
            <div className="sec-sag">
              <button className="sec-ekle" aria-pressed={duzenle} onClick={() => setDuzenle(!duzenle)} aria-label={t("Kanalları sırala ve sessize al")} title={t("Sırala / sessize al")}><Ikon ad="sirala" boyut={16} /></button>
              {kanalYonet && <button className="sec-ekle" onClick={() => ayarAc("kanallar")} aria-label={t("Kanal veya sesli oda aç")} title={t("Kanal / oda aç")}>+</button>}
            </div>
          </div>
          {bolumKanallari("yazili", yaziKategorisiz).map(yaziSatiri)}
          <div className="sec sec-satir">
            <button className="sec-bas" aria-expanded={!katlanmis.includes("sesli")} onClick={() => bolumKatla("sesli")}>
              <Ikon ad={katlanmis.includes("sesli") ? "saga" : "asagi"} boyut={12} /> Sesli odalar
              {katlanmis.includes("sesli") && bolumOkunmamis(sesKanallari) > 0 && <span className="rozet" aria-hidden="true">{bolumOkunmamis(sesKanallari)}</span>}
            </button>
            {kanalYonet && <div className="sec-sag"><button className="sec-ekle" onClick={() => ayarAc("kanallar")} aria-label={t("Kanal veya sesli oda aç")} title={t("Kanal / oda aç")}>+</button></div>}
          </div>
          {bolumKanallari("sesli", sesKategorisiz).map(sesSatiri)}
          {kategoriGruplari.map((g) => kategoriBolumu(g.kategori!, g.kanallar))}
        </nav>
        <SesCubugu className="vbar-side" ses={ses} baskasiPaylasiyor={paylasanAd} kanalAdi={kanallar.find((k) => k.id === ses.kanalId)?.ad ?? ""} />
        <div className="me">
          <button className="me-profil" onClick={() => setProfilId(me.id)} title={t("Profilimi aç ve düzenle")}>
            <Avatar uye={ben}><span className="on-dot" style={{ background: DURUM_BILGI[ben.durum ?? "cevrimici"].renk }} /></Avatar>
            <div><b>{ben.takma_ad}</b><span>{ben.durum_metin || DURUM_BILGI[ben.durum ?? "cevrimici"].ad}</span></div>
          </button>
          {ayarGoster && <button className="yon-ac cb-ibtn" onClick={() => ayarAc("genel")} aria-label={t("Sunucu ayarlarını aç")} title={t("Sunucu ayarları")}><Ikon ad="kalkan" /></button>}
          <button className="yon-ac cb-ibtn" onClick={() => setAyarAcik(true)} aria-label={t("Ayarlar")} title={t("Ayarlar: tema, yazı boyutu, sesler")}><Ikon ad="ayar" /></button>
          <button className="yon-ac cb-ibtn" onClick={cikis} aria-label={t("Çıkış yap")} title={t("Çıkış")}><Ikon ad="cikis" /></button>
        </div>
      </section>

      <main className={"col chat sunucu-kolon" + (surukle ? " surukle" : "")} aria-label={t("Sohbet")}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setSurukle(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setSurukle(false); }}
        onDrop={(e) => { e.preventDefault(); setSurukle(false); const f = resimBul(e.dataTransfer.files); if (f) void ekSec(f); else if (e.dataTransfer.files.length) setHata("Yalnızca resim dosyaları gönderilebilir."); }}>
        {aktifKanal?.tur === "sesli" ? (
          <SesSahnesi ses={ses} kanal={aktifKanal} katilimcilar={uyeler.filter((u) => sesKonum.get(u.id)?.kanal === aktifKanal.id)} benId={me.id}
            sagirlar={sagirlar} paylasanlar={new Set([...sesKonum].filter(([, v]) => v.kanal === aktifKanal.id && v.ekran).map(([id]) => id))}
            baglaniyor={ses.durum === "baglaniyor"} buradayim={ses.kanalId === aktifKanal.id && ses.durum !== "kapali"}
            basKonus={{ ayar: basKonusAyar, basili: basKonus.basili, bas: basKonus.bas, birak: basKonus.birak }}
            baskasiPaylasiyor={paylasanAd} yapanAd={(id) => uyeHaritasi.get(id)?.takma_ad ?? "Biri"}
            onKatil={() => kanalaGir(aktifKanal, () => { void ses.baglan(aktifKanal.id); })} onProfil={setProfilId} />
        ) : (<>
        <div className="head sohbet-ust">
          <span className="ust-ikon" aria-hidden="true"><Ikon ad="hash" /></span>
          <h2 className="ust-ad">{aktifKanal?.ad ?? "…"}</h2>
          {konuDuzen !== null ? (
            <form className="kanal-konu-duzen" onSubmit={(e) => { e.preventDefault(); void konuKaydet(); }}>
              <input type="text" value={konuDuzen} onChange={(e) => setKonuDuzen(e.target.value)} maxLength={200} placeholder={t("Kanal açıklaması")} aria-label={t("Kanal açıklaması")} autoFocus />
              <button className="linkbtn" type="submit">{t("Kaydet")}</button>
              <button className="linkbtn" type="button" onClick={() => setKonuDuzen(null)}>{t("Vazgeç")}</button>
            </form>
          ) : aktifKanal?.aciklama ? (
            <>
              <span className="ust-ayrac" aria-hidden="true" />
              <div className="kanal-konu" title={aktifKanal.aciklama}>{aktifKanal.aciklama}</div>
            </>
          ) : <span className="ust-bosluk" />}
          <div className="head-dugmeler">
            {kanalYonet && aktifKanal && konuDuzen === null && (
              <button className="cb-ibtn" onClick={() => setKonuDuzen(aktifKanal.aciklama ?? "")} aria-label={t("Kanal açıklamasını düzenle")} title={aktifKanal.aciklama ? "Açıklamayı düzenle" : "Açıklama ekle"}><Ikon ad="duzenle" /></button>
            )}
            {aktifKanal && (
              <button className="cb-ibtn" aria-pressed={sessiz.includes(aktifKanal.id)} onClick={() => sessizDegistir(aktifKanal.id)}
                aria-label={sessiz.includes(aktifKanal.id) ? "Kanalın sesini aç" : "Kanalı sessize al"} title={sessiz.includes(aktifKanal.id) ? "Sessizde: ses ve sayaç yok" : "Sessize al"}>
                <Ikon ad={sessiz.includes(aktifKanal.id) ? "zilKapali" : "zil"} />
              </button>
            )}
            {sabitler.length > 0 && (
              <button className="cb-ibtn ust-sabit" onClick={() => setSabitAcik(true)} aria-label={`${sabitler.length} sabitlenmiş mesajı göster`}><Ikon ad="pin" /><span className="ust-sayi" aria-hidden="true">{sabitler.length}</span></button>
            )}
            <button className="ust-ara" onClick={() => setAramaAcik(true)} aria-label={t("Mesajlarda ara")} aria-expanded={aramaAcik}><Ikon ad="ara" boyut={16} /><span>{t("Mesajlarda ara")}</span></button>
          </div>
        </div>
        {ses.izlenen && <EkranPaneli izlenen={ses.izlenen} yapanAd={uyeHaritasi.get(ses.izlenen.uyeId)?.takma_ad ?? "Biri"} />}
        <GuncellemeBandi />
        {hata && <div className="banner" role="alert">{hata}</div>}
        {ses.sorunlu.size > 0 && (
          <div className="banner" role="status">
            ⚠️ {[...ses.sorunlu].map((id) => uyeHaritasi.get(id)?.takma_ad ?? "Biri").join(", ")} ile ses bağlantısı kurulamıyor; tekrar deneniyor.
          </div>
        )}
        {me.rol === "sahip" && kullanimDk !== null && kullanimDk >= SES_LIMIT * 0.8 && (
          <div className="banner" role="status">Bu ay sesli odada {kullanimDk} / {SES_LIMIT} dakika kullanıldı{kullanimDk >= SES_LIMIT ? "; limit doldu, ses kapandı" : "; limite yaklaşıyorsunuz"}. Yazılı sohbet çalışmaya devam eder.</div>
        )}
        <div className="msgs" ref={akisRef} role="log" aria-live="polite" aria-label={t("Mesajlar")}>
          {dahaVar && <button className="more" onClick={eskileriYukle}>{t("Eski mesajları yükle")}</button>}
          {!mesajlar.length && <div className="empty">{t("Henüz mesaj yok. İlk mesajı sen yaz.")}</div>}
          {satirlar}
        </div>
        {ek && (
          <div className="ekon" role="group" aria-label={t("Eklenecek resim")}>
            <img src={ek.onizleme} alt={t("Eklenecek resmin önizlemesi")} />
            <div className="ekon-bilgi"><b>{ek.ad || "Resim"}</b><span>{ek.genislik}×{ek.yukseklik} · {boyutMetni(ek.boyut)}</span></div>
            <button className="linkbtn" onClick={ekTemizle} aria-label={t("Resmi kaldır")} disabled={gonderiliyor}>{t("Kaldır")}</button>
          </div>
        )}
        <div className="yaziyor" aria-hidden="true">{yaziyor.metin && <span className="yaziyor-noktalar"><i /><i /><i /></span>}{yaziyor.metin}</div>
        {yanitlanan && (
          <div className="yanit-cubugu" role="status">
            <Ikon ad="yanit" boyut={14} />
            <span><b>{uyeHaritasi.get(yanitlanan.uye_id)?.takma_ad ?? "Eski üye"}</b>{" "}{t("kişisine yanıt veriyorsun")}</span>
            <button type="button" className="sq" aria-label={t("Yanıtı iptal et")} onClick={() => setYanitlanan(null)}><Ikon ad="kapat" boyut={14} /></button>
          </div>
        )}
        <div className="composer">
          {etiketAday.length > 0 && (
            <div className="etiket-liste" role="listbox" aria-label={t("Etiketlenecek kişi")}>
              {etiketAday.map((u) => (
                <button key={u.id} role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setMetin((m) => m.replace(/@[^\s@]*$/, `@${u.takma_ad} `)); metinRef.current?.focus(); }}>@{u.takma_ad}</button>
              ))}
            </div>
          )}
          {emojiAcik && (
            <EmojiDeposu className="deposu-yazi" onSec={(e) => { setMetin((m) => m + e); metinRef.current?.focus(); }} />
          )}
          <button className="sq" onClick={() => dosyaRef.current?.click()} aria-label={t("Resim ekle")} disabled={gonderiliyor || yazamaz || !kanalDosyaEkleyebilir}><Ikon ad="ek" /></button>
          <button className="sq" onClick={() => setAnketAcik(true)} aria-label={t("Anket oluştur")} disabled={yazamaz || aktifKanal?.tur !== "yazili"}><Ikon ad="anket" /></button>
          <button className="sq" onClick={() => setGifAcik((x) => !x)} aria-label={t("GIF seç")} aria-expanded={gifAcik} disabled={yazamaz || aktifKanal?.tur !== "yazili"}><Ikon ad="gif" /></button>
          {gifAcik && <GifSecici onSec={(u) => void gifGonder(u)} onKapat={() => setGifAcik(false)} />}
          <input ref={dosyaRef} type="file" accept={IZINLI_TURLER.join(",")} hidden
            onChange={(e) => { void ekSec(e.target.files?.[0]); e.target.value = ""; }} />
          <textarea ref={metinRef} rows={1} value={metin} maxLength={4000} aria-label={t("Mesaj yaz")} disabled={yazamaz}
            placeholder={!kanalYazabilir && !benSusturuldu ? "Bu kanalda mesaj yazma iznin yok" : benSusturuldu ? `Susturuldun; ${new Date(ben.susturma_bitis!).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}'e kadar yazamazsın` : `#${aktifKanal?.ad ?? ""} kanalına yaz`}
            onChange={(e) => { setMetin(e.target.value); if (e.target.value.trim()) yaziyorYayinla(); }}
            onPaste={(e) => { const f = resimBul(e.clipboardData.files); if (f) { e.preventDefault(); void ekSec(f, "Ekran görüntüsü"); } }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); gonder(); }
              else if (e.key === "Escape" && yanitlanan) setYanitlanan(null);
            }} />
          <button className="sq" onClick={() => setEmojiAcik(!emojiAcik)} aria-label={t("Emoji seçici")} aria-expanded={emojiAcik}><Ikon ad="gulen" /></button>
          <button className="sq send" onClick={gonder} aria-label={t("Gönder")} disabled={(!metin.trim() && !ek) || gonderiliyor || yazamaz}>{gonderiliyor ? "…" : <Ikon ad="gonder" />}</button>
        </div>
        </>)}
      </main>

      <aside className="col members sunucu-kolon" aria-label={t("Üyeler")}>
        {aktifKanal?.tur === "sesli" ? (
          <SesYani ben={ben} digerleri={uyeler.filter((u) => u.id !== me.id && sesKonum.get(u.id)?.kanal === aktifKanal.id)}
            paylasanlar={new Set([...sesKonum].filter(([, v]) => v.kanal === aktifKanal.id && v.ekran).map(([id]) => id))}
            uyeHaritasi={uyeHaritasi} yonetici={mesajYonet} islemYapabilir={(u) => islemYapabilir(ben, u)} susturulanlar={susturulanlar}
            onSustur={sesSustur} onAt={sesAt} mesajlar={mesajlar} onGonder={sesSohbetGonder} yazamaz={yazamaz} onHata={(m) => toastAt(m, "hata")} />
        ) : (<>
        <div className="head"><h2>Üyeler — {aktifUyeler.length}</h2></div>
        <div className="scroll">
          {(["sahip", "moderator", "uye"] as const).map((rol) => {
            const grup = cevrimiciUyeler.filter((u) => u.rol === rol);
            if (!grup.length) return null;
            return (
              <div key={rol}>
                <div className="sec">{rol === "sahip" ? "Sahip" : rol === "moderator" ? "Moderatör" : "Üye"} — {grup.length}</div>
                {grup.map((u) => uyeSatiri(u, true))}
              </div>
            );
          })}
          {cevrimdisiUyeler.length > 0 && <div className="sec">Çevrimdışı — {cevrimdisiUyeler.length}</div>}
          {cevrimdisiUyeler.map((u) => uyeSatiri(u, false))}
        </div>
        </>)}
      </aside>

      {gorunum === "dm" && (
        <DmAlani dm={dm} me={ben} uyeler={uyeler} cevrimici={cevrimici} bosta={bosta} aktifDm={aktifDm} sayfa={dmSayfa}
          mobil={dmMobil} onMobil={setDmMobil}
          onSec={(id) => { setAktifDm(id); setDmSayfa("sohbet"); }}
          onArkadaslar={() => setDmSayfa("arkadaslar")}
          onSunucuya={() => setGorunum("sunucu")}
          onProfil={setProfilId}
          onHata={(m) => toastAt(m, "hata")} onBilgi={(m) => toastAt(m)}
          sesBilgisi={ses.kanalId ? `Sesli odadasın: #${kanallar.find((k) => k.id === ses.kanalId)?.ad ?? ""}` : null} />
      )}
      {profilUyesi && (
        <ProfilDialog key={profilUyesi.id} uye={profilUyesi} benim={profilUyesi.id === me.id}
          cevrimici={cevrimici.has(profilUyesi.id) || profilUyesi.id === me.id}
          onKapat={() => setProfilId(null)} onKaydet={profilKaydet} onDurum={profilUyesi.id === me.id ? (d) => void durumDegistir(d) : undefined}
          eylemler={profilUyesi.id !== me.id && !profilUyesi.silindi ? (
            <>
              <button type="button" className="cta" onClick={() => void dm.dmAc(profilUyesi.id).then((r) => {
                if (r.hata) return toastAt(r.hata, "hata");
                setProfilId(null); setAktifDm(r.id); setDmSayfa("sohbet"); setDmMobil("icerik"); setGorunum("dm");
              })}>{t("Mesaj gönder")}</button>
              {dm.iliski(profilUyesi.id) === "yok" && <button type="button" className="pk-btn" onClick={() => void dm.arkadasIstek(profilUyesi.id).then((r) => toastAt(r.hata ?? (r.sonuc === "kabul" ? "Arkadaş oldunuz" : "Arkadaşlık isteği gönderildi"), r.hata ? "hata" : "bilgi"))}>{t("Arkadaş ekle")}</button>}
              {dm.iliski(profilUyesi.id) === "gelen" && <button type="button" className="pk-btn" onClick={() => void dm.arkadasIstek(profilUyesi.id).then((r) => toastAt(r.hata ?? "Arkadaş oldunuz", r.hata ? "hata" : "bilgi"))}>{t("İsteği kabul et")}</button>}
              {dm.iliski(profilUyesi.id) === "engelli"
                ? <button type="button" className="pk-btn" onClick={() => void dm.engelKaldir(profilUyesi.id)}>{t("Engeli kaldır")}</button>
                : <button type="button" className="pk-btn tehlike" onClick={() => { if (confirm("Bu kişiyi engellemek istiyor musun?")) void dm.engelle(profilUyesi.id); }}>{t("Engelle")}</button>}
            </>
          ) : undefined} />
      )}
      {konuId && (() => {
        const ana = mesajlar.find((x) => x.id === konuId);
        if (!ana) return null;
        const liste = yanitlar.filter((y) => y.ust_mesaj_id === konuId);
        return (
          <KonuPaneli ana={ana} yanitlar={liste} uyeHaritasi={uyeHaritasi} ben={ben} yazamaz={yazamaz}
            tepkiler={tepkiler.filter((t) => t.mesaj_id === ana.id || liste.some((y) => y.id === t.mesaj_id))}
            onTepki={tepkiDegistir} onSil={sil} onDuzenle={mesajDuzenle} onProfil={setProfilId} onGonder={yanitGonder} onKapat={() => setKonuId(null)} />
        );
      })()}
      {yonetimAcik && ayarGoster && seciliSunucu && (
        <SunucuAyarlari sunucu={seciliSunucu} ben={ben} uyeler={uyeler} kanallar={kanallar} kategoriler={kategoriler}
          sesKonum={sesKonum} cevrimici={cevrimici} izin={izinler.maske} baslangic={ayarBolum}
          varsayilanSunucu={sunucular[0]?.oda_id === me.oda_id}
          onKapat={() => setYonetimAcik(false)} onKanallarDegisti={kanallariYenile}
          onSunucuDegisti={() => onSunucularYenile?.(me.oda_id)}
          onSunucuSilindi={() => { setYonetimAcik(false); onSunucularYenile?.(sunucular.find((x) => x.oda_id !== me.oda_id)?.oda_id); }} />
      )}
      {paletAcik && <KomutPaleti komutlar={paletKomutlari} onKapat={() => setPaletAcik(false)} />}
      {sunucuDialogAcik && (
        <SunucuDialog misafir={!!ben.misafir} onKapat={() => setSunucuDialogAcik(false)}
          onTamam={(id) => { setSunucuDialogAcik(false); onSunucularYenile?.(id); }} />
      )}
      {aramaAcik && <AramaPaneli odaId={me.oda_id} kanallar={kanallar} uyeler={uyeler} onGit={mesajaGit} onKapat={() => setAramaAcik(false)} />}
      {anketAcik && <AnketOlustur onOlustur={anketOlustur} onKapat={() => setAnketAcik(false)} />}
      {iletMesaj && (
        <IletDialog mesaj={iletMesaj} yazar={uyeHaritasi.get(iletMesaj.uye_id)} aktifKanal={aktif}
          kanallar={kanallar.filter((k) => k.tur === "yazili" && girebilir(k))} onIlet={(k) => void iletGonder(k)} onKapat={() => setIletMesaj(null)} />
      )}
      {sabitAcik && (
        <SabitlerDialog mesajlar={sabitler} uyeler={uyeHaritasi} kanalAdi={aktifKanal?.ad ?? ""} yonetici={mesajYonet}
          onKaldir={(m) => void sabitle(m, false)} onKapat={() => setSabitAcik(false)} />
      )}
      {sifreKanal && (
        <KanalSifre kanal={sifreKanal.kanal} onKapat={() => setSifreKanal(null)}
          onAcildi={() => {
            const { kanal, sonra } = sifreKanal;
            setAcik((x) => new Set(x).add(kanal.id));
            setSifreKanal(null);
            sonra();
          }} />
      )}
      {ayarAcik && (
        <AyarlarDialog tema={tema} onTema={(t) => { setTema(t); temaKaydet(t); }}
          yazi={yazi} onYazi={(b) => { setYazi(b); yaziBoyutuKaydet(b); }}
          sesler={sesler} onSesler={(a) => { setSesler(a); seslerKaydet(a); if (a) bildirimIzniIste(); }}
          basKonus={basKonusAyar} onBasKonus={(a) => { setBasKonusAyar(a); basKonusAyarYaz(a); }}
          onKapat={() => setAyarAcik(false)} />
      )}
      <div className="toasts" role="status" aria-live="polite">
        {bildirimler.map((b) => <div key={b.id} className={"toast " + b.tur}>{b.metin}</div>)}
      </div>
      {ses.kabiRefleri.map((r, i) => <div key={i} ref={r} className="sr" aria-hidden="true" />)}
      <SesCubugu className="vbar-dock" ses={ses} baskasiPaylasiyor={paylasanAd} kanalAdi={kanallar.find((k) => k.id === ses.kanalId)?.ad ?? ""} />
      <nav className="nav" aria-label={t("Ana sekmeler")}>
        <button aria-current={gorunum === "sunucu" && pane !== "mem"} onClick={() => { setGorunum("sunucu"); setPane(gorunum === "sunucu" && pane === "chat" ? "side" : "chat"); }}>
          <Ikon ad="hash" boyut={22} />{cevir("sekme.sunucu")}{gorunum !== "sunucu" && Object.values(okunmamis).some((o) => o.n > 0) && <span className="nokta nav-nokta" aria-hidden="true" />}
        </button>
        <button aria-current={gorunum === "dm" && dmSayfa !== "arkadaslar"} onClick={() => { setGorunum("dm"); setDmMobil("liste"); setDmSayfa(aktifDm ? "sohbet" : "arkadaslar"); }}>
          <Ikon ad="sohbet" boyut={22} />{cevir("sekme.mesajlar")}{dm.toplamOkunmamis > 0 && <span className="rozet nav-rozet" aria-label={`${dm.toplamOkunmamis} okunmamış`}>{dm.toplamOkunmamis}</span>}
        </button>
        <button aria-current={gorunum === "dm" && dmSayfa === "arkadaslar"} onClick={() => { setGorunum("dm"); setDmSayfa("arkadaslar"); setDmMobil("icerik"); }}>
          <Ikon ad="kullanici" boyut={22} />{cevir("sekme.arkadaslar")}{dm.gelenIstekler.length > 0 && <span className="rozet nav-rozet" aria-label={`${dm.gelenIstekler.length} arkadaş isteği`}>{dm.gelenIstekler.length}</span>}
        </button>
        <button aria-current={gorunum === "sunucu" && pane === "mem"} onClick={() => { setGorunum("sunucu"); setPane("mem"); }}>
          <Ikon ad="grup" boyut={22} />{cevir("sekme.uyeler")}
        </button>
        <button onClick={() => setProfilId(me.id)}><Ikon ad="ayar" boyut={22} />{cevir("sekme.ben")}</button>
      </nav>
    </div>
  );
}
