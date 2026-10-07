import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useSesMotoru, type Motor } from "./sesMotoru";
import SesCubugu from "./SesCubugu";
import EkranPaneli from "./EkranPaneli";
import type { Kanal, Mesaj, Tepki, Uye } from "./types";
import MessageView from "./MessageView";
import { EMOJILER, gunEtiketi, rolEtiketi } from "./util";
import { bildirim, bildirimIzniIste, duyur, etiketVar, seslerAcik, seslerKaydet, sesleriHazirla } from "./uyari";
import YonetimPaneli, { susturulmus } from "./YonetimPaneli";
import Avatar from "./Avatar";
import KanalSifre from "./KanalSifre";
import SabitlerDialog from "./SabitlerDialog";
import KonuPaneli from "./KonuPaneli";
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

export default function Chat({ me, onExit }: { me: Uye; onExit: () => void }) {
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
  const [yonBilgi, setYonBilgi] = useState("");
  const [sabitler, setSabitler] = useState<Mesaj[]>([]);
  const [sabitAcik, setSabitAcik] = useState(false);
  const [konuDuzen, setKonuDuzen] = useState<string | null>(null);
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [sifreKanal, setSifreKanal] = useState<{ kanal: Kanal; sonra: () => void } | null>(null);
  const [simdi, setSimdi] = useState(() => Date.now());
  const [yanitlar, setYanitlar] = useState<Mesaj[]>([]);
  const [konuId, setKonuId] = useState<string | null>(null);
  const [sesler, setSesler] = useState(seslerAcik);
  const [sesOlay, setSesOlay] = useState("");
  const olayZamanRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const duyuruRef = useRef<{ ses: string | null; motor: Motor | null }>({ ses: null, motor: null });
  const kanalDuyur = useCallback((k: string | null, motor: Motor | null) => {
    duyuruRef.current = { ses: k, motor };
    void kanalRef.current?.track({ t: Date.now(), ses: k, motor, ekran: false });
  }, []);
  const motorSor = useCallback((kanalId: string): Motor | null => {
    for (const [uid, v] of sesKonumRef.current) if (uid !== me.id && v.kanal === kanalId && v.motor) return v.motor;
    return null;
  }, [me.id]);
  const ses = useSesMotoru(me.id, kanalDuyur, motorSor);
  const sesRef = useRef(ses);
  sesRef.current = ses;
  // Ekran paylaşımı başlayınca/bitince odadaki herkese duyurulur ("🖥️ yayında" göstergesi ve çift paylaşımı engelleme için)
  useEffect(() => {
    if (!duyuruRef.current.ses) return;
    void kanalRef.current?.track({ t: Date.now(), ...duyuruRef.current, ekran: ses.paylasiyorum });
  }, [ses.paylasiyorum]);
  uyelerRef.current = uyeler;
  mesajlarRef.current = mesajlar;
  useEffect(() => sesleriHazirla(), []);
  const etiketAday = useMemo(() => {
    const x = /(?:^|\s)@([^\s@]*)$/.exec(metin);
    if (!x) return [];
    const q = x[1].toLocaleLowerCase("tr");
    return uyeler.filter((u) => u.id !== me.id && u.takma_ad.toLocaleLowerCase("tr").includes(q)).slice(0, 5);
  }, [metin, uyeler, me.id]);
  const uyeHaritasi = useMemo(() => new Map(uyeler.map((u) => [u.id, u])), [uyeler]);
  const aktifKanal = kanallar.find((k) => k.id === aktif);
  const ben = uyeHaritasi.get(me.id) ?? me;
  const paylasanId = ses.kanalId ? [...sesKonum].find(([uid, v]) => uid !== me.id && v.kanal === ses.kanalId && v.ekran)?.[0] ?? null : null;
  const paylasanAd = paylasanId ? uyeHaritasi.get(paylasanId)?.takma_ad ?? "Biri" : null;
  const profilUyesi = profilId ? uyeHaritasi.get(profilId) : undefined;
  const yonetici = ben.rol !== "uye";
  const benSusturuldu = susturulmus(ben, simdi);

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
      const [o, k, u, a] = await Promise.all([
        supabase.from("odalar").select("ad").eq("id", me.oda_id).maybeSingle(),
        supabase.from("kanallar").select("*").eq("oda_id", me.oda_id).order("sira"),
        supabase.from("uyeler").select("*").eq("oda_id", me.oda_id),
        supabase.from("kanal_acik").select("kanal_id"),
      ]);
      if (o.data) setOdaAdi(o.data.ad);
      const acikSet = new Set(((a?.data ?? []) as { kanal_id: string }[]).map((x) => x.kanal_id));
      setAcik(acikSet);
      if (k.data) {
        setKanallar(k.data as Kanal[]);
        const yon = ((u.data ?? []) as Uye[]).find((x) => x.id === me.id)?.rol ?? me.rol;
        const ilk = (k.data as Kanal[]).find((x) => x.tur === "yazili" && (!x.sifreli || yon !== "uye" || acikSet.has(x.id)));
        if (ilk) setAktif(ilk.id);
      }
      if (u.data) setUyeler(u.data as Uye[]);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "mesajlar" }, (p) => {
        const m = (p.eventType === "DELETE" ? p.old : p.new) as Mesaj;
        if (p.eventType === "INSERT" && m.uye_id !== me.id && !m.silindi) {
          const yazar = uyelerRef.current.find((u) => u.id === m.uye_id)?.takma_ad ?? "Biri";
          const benAd = uyelerRef.current.find((u) => u.id === me.id)?.takma_ad ?? me.takma_ad;
          const ust = m.ust_mesaj_id ? mesajlarRef.current.find((x) => x.id === m.ust_mesaj_id) : undefined;
          if (etiketVar(m.metin ?? "", benAd)) { duyur("etiket", `${yazar} seni etiketledi`); bildirim(`${yazar} seni etiketledi`, m.metin); }
          else if (ust && ust.uye_id === me.id) { duyur("etiket", `${yazar} mesajına yanıt verdi`); bildirim(`${yazar} mesajına yanıt verdi`, m.metin); }
          else duyur("mesaj");
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
          if (u.id === me.id) { supabase.auth.signOut().then(onExit); return; }
          setUyeler((x) => x.filter((y) => y.id !== u.id));
        } else {
          const u = p.new as Uye;
          setUyeler((x) => (x.some((y) => y.id === u.id) ? x.map((y) => (y.id === u.id ? u : y)) : [...x, u]));
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "yonetim_komutlari", filter: `hedef_uye=eq.${me.id}` }, (p) => {
        const k = p.new as { tur: "ses-at" | "tasi"; kanal_id: string | null };
        const s = sesRef.current;
        if (!s.kanalId) return;
        if (k.tur === "tasi" && k.kanal_id) {
          setYonBilgi("Yönetici seni başka bir sesli odaya taşıdı.");
          void s.baglan(k.kanal_id);
        } else {
          setYonBilgi("Yönetici seni sesli odadan çıkardı.");
          void s.ayril();
        }
      })
      .on("presence", { event: "sync" }, () => {
        const durum = kanal.presenceState<{ ses?: string | null; motor?: Motor | null; ekran?: boolean }>();
        setCevrimici(new Set(Object.keys(durum)));
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
            duyur(girdi ? "baglandi" : "ayrildi", metin);
            setSesOlay(`${girdi ? "🟢" : "🔴"} ${metin}`);
            if (olayZamanRef.current) clearTimeout(olayZamanRef.current);
            olayZamanRef.current = setTimeout(() => setSesOlay(""), 4000);
          };
          for (const [id, k] of konum) if (id !== me.id && k.kanal === benimKanal && onc.konum.get(id) !== benimKanal) olay(id, true);
          for (const [id, kk] of onc.konum) if (id !== me.id && kk === benimKanal && konum.get(id)?.kanal !== benimKanal) olay(id, false);
        }
        oncekiKonumRef.current = { kanal: benimKanal, konum: new Map([...konum].map(([id, k]) => [id, k.kanal])) };
      })
      .subscribe(async (durum) => { if (durum === "SUBSCRIBED") await kanal.track({ t: Date.now(), ses: null, motor: null }); });

    const nabiz = setInterval(() => {
      supabase.from("uyeler").update({ son_gorulme: new Date().toISOString() }).eq("id", me.id).then(() => {});
    }, 60000);
    return () => { clearInterval(nabiz); kanalRef.current = null; supabase.removeChannel(kanal); };
  }, [me.id, me.oda_id, onExit]);

  useEffect(() => {
    const el = akisRef.current;
    if (el && altaKaydir.current) el.scrollTop = el.scrollHeight;
  }, [mesajlar]);

  useEffect(() => () => { if (ekRef.current) URL.revokeObjectURL(ekRef.current.onizleme); }, []);

  // Hazırlanan resim yanlış kanala gitmesin diye kanal değişince bırakılır
  useEffect(() => { ekTemizle(); }, [aktif]);

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
        kanal_id: aktif, uye_id: me.id, metin: t,
        ...(gonderilenEk && yol ? {
          ek_yol: yol, ek_tur: gonderilenEk.tur, ek_boyut: gonderilenEk.boyut,
          ek_genislik: gonderilenEk.genislik, ek_yukseklik: gonderilenEk.yukseklik,
        } : {}),
      }).select().single();
      if (error) {
        if (yol) void supabase.storage.from("ekler").remove([yol]);
        return setHata("Mesaj gönderilemedi.");
      }
      setMetin(""); setEmojiAcik(false); ekTemizle();
      altaKaydir.current = true;
      setMesajlar((x) => birlestir(x, [data as Mesaj]));
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

  async function profilKaydet(d: ProfilDegisiklik): Promise<string | null> {
    const guncel = uyeHaritasi.get(me.id) ?? me;
    const eskiYol = guncel.avatar_yol ?? null;
    let yeniYol: string | null = null;
    const alanlar: Record<string, unknown> = {};
    if (d.takma_ad !== guncel.takma_ad) alanlar.takma_ad = d.takma_ad;
    if (d.renk !== guncel.renk) alanlar.renk = d.renk;
    if (d.hakkinda !== (guncel.hakkinda ?? "")) alanlar.hakkinda = d.hakkinda === "" ? null : d.hakkinda;
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

  async function cikis() {
    if (!confirm("Çıkış yapılsın mı? Bu takma adla bu tarayıcıdan tekrar giremezsin; oda sahibi seni silerse yeniden katılabilirsin.")) return;
    await supabase.auth.signOut();
    onExit();
  }

  const yaziKanallari = kanallar.filter((k) => k.tur === "yazili");
  const sesKanallari = kanallar.filter((k) => k.tur === "sesli");
  const cevrimiciUyeler = uyeler.filter((u) => cevrimici.has(u.id) || u.id === me.id);
  const cevrimdisiUyeler = uyeler.filter((u) => !cevrimiciUyeler.includes(u));

  let sonGun = "";
  const satirlar: React.ReactNode[] = [];
  for (const m of mesajlar) {
    const g = gunEtiketi(m.olusturma);
    if (g !== sonGun) { sonGun = g; satirlar.push(<div className="day" key={"g" + m.id}>{g}</div>); }
    satirlar.push(
      <MessageView key={m.id} mesaj={m} yazar={uyeHaritasi.get(m.uye_id)} benim={ben}
        tepkiler={tepkiler.filter((t) => t.mesaj_id === m.id)} onTepki={tepkiDegistir} onSil={sil} onSabitle={sabitle} onProfil={setProfilId}
        yanitSayisi={yanitlar.filter((y) => y.ust_mesaj_id === m.id && !y.silindi).length} onKonu={(x) => setKonuId(x.id)} />,
    );
  }

  const uyeSatiri = (u: Uye, acik: boolean) => (
    <button key={u.id} className={"mem" + (acik ? "" : " off")} onClick={() => setProfilId(u.id)}
      aria-label={`${u.takma_ad} profilini aç${u.rol !== "uye" ? `, ${rolEtiketi(u.rol).toLowerCase()}` : ""}`}>
      <Avatar uye={u}>{acik && <span className="on-dot" />}</Avatar>
      <div className="mem-ad">{u.takma_ad}{u.rol !== "uye" && <small>{rolEtiketi(u.rol)}</small>}{u.hakkinda && <small className="mem-hk">{u.hakkinda}</small>}</div>
    </button>
  );

  return (
    <div id="app" className="on" data-pane={pane}>
      <section className="col side" aria-label="Kanallar">
        <div className="head"><h1>{odaAdi}</h1></div>
        <nav className="scroll" aria-label="Kanal listesi">
          <div className="sec sec-satir">
            <span>Yazılı kanallar</span>
            {yonetici && <button className="sec-ekle" onClick={() => setYonetimAcik(true)} aria-label="Kanal veya sesli oda aç" title="Kanal / oda aç">+</button>}
          </div>
          {yaziKanallari.map((k) => (
            <button key={k.id} className="ch" aria-current={k.id === aktif}
              aria-label={k.sifreli ? `${k.ad}, şifreli kanal` : undefined}
              onClick={() => kanalaGir(k, () => { setAktif(k.id); setPane("chat"); })}>
              <span className="hash" aria-hidden="true">#</span>{k.ad}
              {k.sifreli && <span className="kilit" aria-hidden="true">🔒</span>}
            </button>
          ))}
          <div className="sec sec-satir">
            <span>Sesli odalar</span>
            {yonetici && <button className="sec-ekle" onClick={() => setYonetimAcik(true)} aria-label="Kanal veya sesli oda aç" title="Kanal / oda aç">+</button>}
          </div>
          {sesKanallari.map((k) => {
            const icindekiler = uyeler.filter((u) => sesKonum.get(u.id)?.kanal === k.id);
            const buradayim = ses.kanalId === k.id && ses.durum !== "kapali";
            return (
              <div key={k.id}>
                <div className="ch-satir">
                <button className="ch" aria-pressed={buradayim} disabled={ses.durum === "baglaniyor"}
                  onClick={() => (buradayim ? ses.ayril() : kanalaGir(k, () => { void ses.baglan(k.id); }))}
                  aria-label={`${k.ad} sesli odası${k.sifreli ? ", şifreli" : ""}, ${buradayim ? "ayrılmak için tıkla" : "katılmak için tıkla"}`}>
                  <span className="hash" aria-hidden="true">🔊</span>{k.ad}
                  {k.sifreli && <span className="kilit" aria-hidden="true">🔒</span>}
                  {buradayim && <span className="soon">bağlı</span>}
                </button>
                <button className="ch-sohbet" aria-current={k.id === aktif} title="Bu odanın yazılı sohbetini aç"
                  aria-label={`${k.ad} sesli odasının yazılı sohbetini aç`}
                  onClick={() => kanalaGir(k, () => { setAktif(k.id); setPane("chat"); })}>💬</button>
                </div>
                {icindekiler.length > 0 && (
                  <ul className="vlist" aria-label={`${k.ad} katılımcıları`}>
                    {icindekiler.map((u) => (
                      <li key={u.id} className="vp">
                        <Avatar uye={u} className={ses.konusanlar.has(u.id) ? "speak" : ""} />
                        {u.takma_ad}{ses.konusanlar.has(u.id) && <span className="sr"> konuşuyor</span>}
                        {ses.sorunlu.has(u.id) && <span className="yayin" title="Bu kişiyle bağlantı kurulamıyor"><span aria-hidden="true">⚠️</span><span className="sr"> bağlantı sorunu</span></span>}
                        {sesKonum.get(u.id)?.ekran && <span className="yayin" title="Ekran paylaşıyor"><span aria-hidden="true">🖥️</span><span className="sr"> ekran paylaşıyor</span></span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
        <SesCubugu className="vbar-side" ses={ses} baskasiPaylasiyor={paylasanAd} kanalAdi={kanallar.find((k) => k.id === ses.kanalId)?.ad ?? ""} />
        <div className="me">
          <button className="me-profil" onClick={() => setProfilId(me.id)} aria-label="Profilimi aç ve düzenle">
            <Avatar uye={ben} />
            <div><b>{ben.takma_ad}</b><span>{rolEtiketi(ben.rol)} · Profili düzenle</span></div>
          </button>
          {yonetici && <button className="yon-ac" onClick={() => setYonetimAcik(true)} aria-label="Yönetim panelini aç" title="Yönetim">🛡️</button>}
          <button className="yon-ac" aria-pressed={sesler} aria-label={sesler ? "Uyarı seslerini kapat" : "Uyarı seslerini aç"}
            title={sesler ? "Uyarı sesleri: açık (mesaj, etiket, odaya giriş/çıkış)" : "Uyarı sesleri: kapalı"}
            onClick={() => { const y = !sesler; setSesler(y); seslerKaydet(y); if (y) bildirimIzniIste(); }}>{sesler ? "🔔" : "🔕"}</button>
          <button className="linkbtn" style={{ marginLeft: "auto" }} onClick={cikis}>Çıkış</button>
        </div>
      </section>

      <section className={"col chat" + (surukle ? " surukle" : "")} aria-label="Sohbet"
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setSurukle(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setSurukle(false); }}
        onDrop={(e) => { e.preventDefault(); setSurukle(false); const f = resimBul(e.dataTransfer.files); if (f) void ekSec(f); else if (e.dataTransfer.files.length) setHata("Yalnızca resim dosyaları gönderilebilir."); }}>
        <div className="head">
          <div className="kanal-baslik">
            <h2>{aktifKanal?.tur === "sesli" ? "🔊" : "#"} {aktifKanal?.ad ?? "…"}</h2>
            {konuDuzen !== null ? (
              <form className="kanal-konu-duzen" onSubmit={(e) => { e.preventDefault(); void konuKaydet(); }}>
                <input type="text" value={konuDuzen} onChange={(e) => setKonuDuzen(e.target.value)} maxLength={200} placeholder="Kanal açıklaması" aria-label="Kanal açıklaması" autoFocus />
                <button className="linkbtn" type="submit">Kaydet</button>
                <button className="linkbtn" type="button" onClick={() => setKonuDuzen(null)}>Vazgeç</button>
              </form>
            ) : aktifKanal?.aciklama ? (
              <div className="kanal-konu" title={aktifKanal.aciklama}>{aktifKanal.aciklama}</div>
            ) : null}
          </div>
          <div className="head-dugmeler">
            {yonetici && aktifKanal && konuDuzen === null && (
              <button className="head-dugme" onClick={() => setKonuDuzen(aktifKanal.aciklama ?? "")} aria-label="Kanal açıklamasını düzenle">✎ {aktifKanal.aciklama ? "Açıklama" : "Açıklama ekle"}</button>
            )}
            {sabitler.length > 0 && (
              <button className="head-dugme" onClick={() => setSabitAcik(true)} aria-label={`${sabitler.length} sabitlenmiş mesajı göster`}>📌 {sabitler.length}</button>
            )}
          </div>
        </div>
        {ses.izlenen && <EkranPaneli izlenen={ses.izlenen} yapanAd={uyeHaritasi.get(ses.izlenen.uyeId)?.takma_ad ?? "Biri"} />}
        {sesOlay && <div className="ses-toast" role="status">{sesOlay}</div>}
        {hata && <div className="banner" role="alert">{hata}</div>}
        {yonBilgi && <div className="banner info" role="status">{yonBilgi} <button className="linkbtn" onClick={() => setYonBilgi("")}>Tamam</button></div>}
        {ses.hata && <div className="banner" role="alert">{ses.hata} <button className="linkbtn" onClick={ses.hataTemizle}>Kapat</button></div>}
        {ses.sorunlu.size > 0 && (
          <div className="banner" role="status">
            {[...ses.sorunlu].map((id) => uyeHaritasi.get(id)?.takma_ad ?? "Biri").join(", ")} ile ses bağlantısı kurulamıyor; tekrar deneniyor.
            {ses.turnVar === false && " (Ağ kısıtlı olabilir; yönetici TURN sunucusunu açmalı.)"}
          </div>
        )}
        {ses.bilgi && !ses.hata && <div className="banner info" role="status">{ses.bilgi} <button className="linkbtn" onClick={ses.hataTemizle}>Tamam</button></div>}
        {me.rol === "sahip" && kullanimDk !== null && kullanimDk >= SES_LIMIT * 0.8 && (
          <div className="banner" role="status">Bu ay sesli odada {kullanimDk} / {SES_LIMIT} dakika kullanıldı{kullanimDk >= SES_LIMIT ? "; limit doldu, ses kapandı" : "; limite yaklaşıyorsunuz"}. Yazılı sohbet çalışmaya devam eder.</div>
        )}
        <div className="msgs" ref={akisRef} role="log" aria-live="polite" aria-label="Mesajlar">
          {dahaVar && <button className="more" onClick={eskileriYukle}>Eski mesajları yükle</button>}
          {!mesajlar.length && <div className="empty">Henüz mesaj yok. İlk mesajı sen yaz.</div>}
          {satirlar}
        </div>
        {ek && (
          <div className="ekon" role="group" aria-label="Eklenecek resim">
            <img src={ek.onizleme} alt="Eklenecek resmin önizlemesi" />
            <div className="ekon-bilgi"><b>{ek.ad || "Resim"}</b><span>{ek.genislik}×{ek.yukseklik} · {boyutMetni(ek.boyut)}</span></div>
            <button className="linkbtn" onClick={ekTemizle} aria-label="Resmi kaldır" disabled={gonderiliyor}>Kaldır</button>
          </div>
        )}
        <div className="composer">
          {etiketAday.length > 0 && (
            <div className="etiket-liste" role="listbox" aria-label="Etiketlenecek kişi">
              {etiketAday.map((u) => (
                <button key={u.id} role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setMetin((m) => m.replace(/@[^\s@]*$/, `@${u.takma_ad} `)); metinRef.current?.focus(); }}>@{u.takma_ad}</button>
              ))}
            </div>
          )}
          {emojiAcik && (
            <div className="picker on" role="group" aria-label="Emoji seç">
              {EMOJILER.map((e) => (
                <button key={e} aria-label={e} onClick={() => { setMetin((m) => m + e); metinRef.current?.focus(); }}>{e}</button>
              ))}
            </div>
          )}
          <button className="sq" onClick={() => setEmojiAcik(!emojiAcik)} aria-label="Emoji seçici" aria-expanded={emojiAcik}>🙂</button>
          <button className="sq" onClick={() => dosyaRef.current?.click()} aria-label="Resim ekle" disabled={gonderiliyor || benSusturuldu}>📎</button>
          <input ref={dosyaRef} type="file" accept={IZINLI_TURLER.join(",")} hidden
            onChange={(e) => { void ekSec(e.target.files?.[0]); e.target.value = ""; }} />
          <textarea ref={metinRef} rows={1} value={metin} maxLength={4000} aria-label="Mesaj yaz" disabled={benSusturuldu}
            placeholder={benSusturuldu ? `Susturuldun; ${new Date(ben.susturma_bitis!).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}'e kadar yazamazsın` : `#${aktifKanal?.ad ?? ""} kanalına yaz`}
            onChange={(e) => setMetin(e.target.value)}
            onPaste={(e) => { const f = resimBul(e.clipboardData.files); if (f) { e.preventDefault(); void ekSec(f, "Ekran görüntüsü"); } }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); gonder(); } }} />
          <button className="sq send" onClick={gonder} aria-label="Gönder" disabled={(!metin.trim() && !ek) || gonderiliyor || benSusturuldu}>{gonderiliyor ? "…" : "➤"}</button>
        </div>
      </section>

      <aside className="col members" aria-label="Üyeler">
        <div className="head"><h2>Üyeler — {uyeler.length}</h2></div>
        <div className="scroll">
          <div className="sec">Çevrimiçi — {cevrimiciUyeler.length}</div>
          {cevrimiciUyeler.map((u) => uyeSatiri(u, true))}
          {cevrimdisiUyeler.length > 0 && <div className="sec">Çevrimdışı — {cevrimdisiUyeler.length}</div>}
          {cevrimdisiUyeler.map((u) => uyeSatiri(u, false))}
        </div>
      </aside>

      {profilUyesi && (
        <ProfilDialog key={profilUyesi.id} uye={profilUyesi} benim={profilUyesi.id === me.id}
          cevrimici={cevrimici.has(profilUyesi.id) || profilUyesi.id === me.id}
          onKapat={() => setProfilId(null)} onKaydet={profilKaydet} />
      )}
      {konuId && (() => {
        const ana = mesajlar.find((x) => x.id === konuId);
        if (!ana) return null;
        const liste = yanitlar.filter((y) => y.ust_mesaj_id === konuId);
        return (
          <KonuPaneli ana={ana} yanitlar={liste} uyeHaritasi={uyeHaritasi} ben={ben} yazamaz={benSusturuldu}
            tepkiler={tepkiler.filter((t) => t.mesaj_id === ana.id || liste.some((y) => y.id === t.mesaj_id))}
            onTepki={tepkiDegistir} onSil={sil} onProfil={setProfilId} onGonder={yanitGonder} onKapat={() => setKonuId(null)} />
        );
      })()}
      {yonetimAcik && yonetici && (
        <YonetimPaneli ben={ben} uyeler={uyeler} kanallar={kanallar} sesKonum={sesKonum} cevrimici={cevrimici}
          onKapat={() => setYonetimAcik(false)} />
      )}
      {sabitAcik && (
        <SabitlerDialog mesajlar={sabitler} uyeler={uyeHaritasi} kanalAdi={aktifKanal?.ad ?? ""} yonetici={yonetici}
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
      {ses.kabiRefleri.map((r, i) => <div key={i} ref={r} className="sr" aria-hidden="true" />)}
      <SesCubugu className="vbar-dock" ses={ses} baskasiPaylasiyor={paylasanAd} kanalAdi={kanallar.find((k) => k.id === ses.kanalId)?.ad ?? ""} />
      <nav className="nav" aria-label="Bölme seçimi">
        <button aria-current={pane === "side"} onClick={() => setPane("side")}>Kanallar</button>
        <button aria-current={pane === "chat"} onClick={() => setPane("chat")}>Sohbet</button>
        <button aria-current={pane === "mem"} onClick={() => setPane("mem")}>Üyeler</button>
      </nav>
    </div>
  );
}
