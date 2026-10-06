import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, supabase } from "./supabase";
import { sesHatasiMetni, type BaglanSonuc, type SesDurumu } from "./voice";
import { ekranHatasi, ekranIstegi, KALITE, type EkranKalite, type EkranSonuc, type Izlenen } from "./ekranOrtak";

/**
 * Doğrudan (P2P) motor: konuşanlar tarayıcıdan tarayıcıya bağlanır (mesh).
 * Sinyalleşme, özel bir Supabase Realtime kanalı ("ses:<kanal_id>") üzerinden yapılır;
 * yalnızca odanın üyeleri o kanala girebilir (bkz. 004 migration).
 * Aşağıdaki sınır, mesh'in 5-6 kişiye kadar rahat çalışması içindir.
 */
export const P2P_MAX_KISI = Number(import.meta.env.VITE_SES_MAX_KISI ?? 6);
const VARSAYILAN_ICE: RTCIceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];

// Ekran paylaşımı için ayrı "ekran-*" sinyalleri kullanılır: ses bağlantılarına dokunmaz ve ekran paylaşımını bilmeyen eski sürümler bunları yok sayar.
// Ekranı paylaşan her izleyiciye ayrı bir bağlantı kurar (teklifi her zaman paylaşan verir).
type Sinyal = { to: string; from: string; tur: "offer" | "answer" | "ice" | "ekran-offer" | "ekran-answer" | "ekran-ice"; veri: unknown };
type EkranEs = { pc: RTCPeerConnection; bekleyenIce: RTCIceCandidateInit[]; uzakVar: boolean };
type Es = { pc: RTCPeerConnection; bekleyenIce: RTCIceCandidateInit[]; uzakVar: boolean; baslatan: boolean; el?: HTMLAudioElement; analiz?: AnalyserNode; sonlandir: () => void; sorunZamani?: number };

async function iceSunuculariniAl(): Promise<{ iceServers: RTCIceServer[]; turn: boolean }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/turn-bilgi`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: "{}",
    });
    if (!r.ok) return { iceServers: VARSAYILAN_ICE, turn: false };
    const j = await r.json();
    return Array.isArray(j.iceServers) && j.iceServers.length ? { iceServers: j.iceServers, turn: j.turn === true } : { iceServers: VARSAYILAN_ICE, turn: false };
  } catch {
    return { iceServers: VARSAYILAN_ICE, turn: false };
  }
}

export function useSesP2P(uyeId: string, onKanal: (kanalId: string | null) => void) {
  const [durum, setDurum] = useState<SesDurumu>("kapali");
  const [kanalId, setKanalId] = useState<string | null>(null);
  const [sessiz, setSessiz] = useState(false);
  const [konusanlar, setKonusanlar] = useState<Set<string>>(new Set());
  const sesKabi = useRef<HTMLDivElement | null>(null);
  const islemRef = useRef(0);
  const kapatRef = useRef<(() => Promise<void>) | null>(null);
  const yerelRef = useRef<MediaStream | null>(null);
  const [sorunlu, setSorunlu] = useState<Set<string>>(new Set());
  const [turnVar, setTurnVar] = useState<boolean | null>(null);
  const [izlenen, setIzlenen] = useState<Izlenen | null>(null);
  const [paylasiyorum, setPaylasiyorum] = useState(false);
  const ekranRef = useRef<{ baslat: (k: EkranKalite) => Promise<EkranSonuc>; durdur: () => Promise<void> } | null>(null);

  const temizle = useCallback(async () => {
    const k = kapatRef.current;
    kapatRef.current = null;
    if (k) await k();
    yerelRef.current = null;
    ekranRef.current = null;
    setKonusanlar(new Set()); setSorunlu(new Set());
    setIzlenen(null); setPaylasiyorum(false);
  }, []);

  const ayril = useCallback(async () => {
    islemRef.current++;
    await temizle();
    setDurum("kapali"); setKanalId(null); setSessiz(false);
    onKanal(null);
  }, [temizle, onKanal]);

  const baglan = useCallback(async (hedef: string): Promise<BaglanSonuc> => {
    const islem = ++islemRef.current;
    await temizle();
    setDurum("baglaniyor"); setKanalId(hedef); setSessiz(false);

    let stream: MediaStream | null = null;
    let kanal: RealtimeChannel | null = null;
    let ctx: AudioContext | null = null;
    let olcum: ReturnType<typeof setInterval> | null = null;
    let bekci: ReturnType<typeof setInterval> | null = null;
    let sesAc: (() => void) | null = null;
    const esler = new Map<string, Es>();
    const bekleyenIcePeer = new Map<string, RTCIceCandidateInit[]>();
    let kuyruk: Promise<void> = Promise.resolve();
    let kapandi = false;
    // Ekran paylaşımı
    let ekranAkis: MediaStream | null = null; // benim yakaladığım ekran
    let ekranBitHizi = KALITE["720"].bitHizi;
    const ekranGiden = new Map<string, EkranEs>(); // paylaşan olarak: izleyici -> bağlantı
    let ekranGelen: { peerId: string; es: EkranEs } | null = null; // izleyen olarak
    const ekranIcePeer = new Map<string, RTCIceCandidateInit[]>();

    const kapat = async () => {
      kapandi = true;
      if (olcum) clearInterval(olcum);
      if (bekci) clearInterval(bekci);
      if (sesAc) { document.removeEventListener("pointerdown", sesAc, true); document.removeEventListener("keydown", sesAc, true); sesAc = null; }
      for (const e of esler.values()) e.sonlandir();
      esler.clear();
      ekranAkis?.getTracks().forEach((t) => t.stop());
      for (const e of ekranGiden.values()) { try { e.pc.close(); } catch { /* yoksay */ } }
      ekranGiden.clear();
      if (ekranGelen) { try { ekranGelen.es.pc.close(); } catch { /* yoksay */ } ekranGelen = null; }
      stream?.getTracks().forEach((t) => t.stop());
      if (kanal) { try { await kanal.untrack(); } catch { /* yoksay */ } await supabase.removeChannel(kanal); }
      if (ctx) { try { await ctx.close(); } catch { /* yoksay */ } }
      sesKabi.current?.replaceChildren();
    };
    kapatRef.current = kapat;

    const basarisiz = async (neden: NonNullable<BaglanSonuc["neden"]>, mesaj: string): Promise<BaglanSonuc> => {
      if (islem === islemRef.current) {
        await temizle();
        setDurum("kapali"); setKanalId(null);
        onKanal(null);
      }
      return { ok: false, neden, mesaj };
    };

    try {
      if (!navigator.mediaDevices?.getUserMedia) return await basarisiz("izin", "Sesli odalar yalnızca güvenli (https) bağlantıda çalışır.");
      const { iceServers, turn } = await iceSunuculariniAl();
      setTurnVar(turn);
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (islem !== islemRef.current) { stream.getTracks().forEach((t) => t.stop()); return { ok: false, neden: "iptal" }; }
      yerelRef.current = stream;

      // Konuşma algılama (yeşil halka)
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      void ctx.resume();
      const olcumNoktalari = new Map<string, AnalyserNode>();
      const analizEkle = (id: string, ms: MediaStream) => {
        if (!ctx) return;
        const an = ctx.createAnalyser(); an.fftSize = 512;
        ctx.createMediaStreamSource(ms).connect(an);
        olcumNoktalari.set(id, an);
      };
      analizEkle(uyeId, stream);
      let sonKonusan = "";
      const sonSesli = new Map<string, number>();
      olcum = setInterval(() => {
        const simdi = performance.now();
        const buf = new Uint8Array(512);
        for (const [id, an] of olcumNoktalari) {
          an.getByteTimeDomainData(buf);
          let toplam = 0;
          for (const v of buf) { const d = (v - 128) / 128; toplam += d * d; }
          if (Math.sqrt(toplam / buf.length) > 0.03) sonSesli.set(id, simdi);
        }
        // Kısa sessizliklerde halka titremesin diye 400 ms tutulur
        const konusan = [...sonSesli.entries()].filter(([id, t]) => olcumNoktalari.has(id) && simdi - t < 400).map(([id]) => id);
        const imza = konusan.sort().join(",");
        if (imza !== sonKonusan) { sonKonusan = imza; setKonusanlar(new Set(konusan)); }
      }, 60);

      // Tarayıcı sesi otomatik çalmayı engellediyse, ilk dokunuşta/tuşta tüm karşı seslerini yeniden başlat
      sesAc = () => {
        void ctx?.resume();
        for (const e of esler.values()) if (e.el && e.el.paused) void e.el.play().catch(() => {});
      };
      document.addEventListener("pointerdown", sesAc, true);
      document.addEventListener("keydown", sesAc, true);

      const benimT = Date.now();
      kanal = supabase.channel(`ses:${hedef}`, { config: { private: true, broadcast: { self: false }, presence: { key: uyeId } } });
      const aktifKanal = kanal;
      const gonder = (to: string, tur: Sinyal["tur"], veri: unknown) => {
        void aktifKanal.send({ type: "broadcast", event: "sinyal", payload: { to, from: uyeId, tur, veri } satisfies Sinyal });
      };

      const esKur = (peerId: string, baslatan: boolean): Es => {
        const pc = new RTCPeerConnection({ iceServers });
        const es: Es = { pc, bekleyenIce: bekleyenIcePeer.get(peerId) ?? [], uzakVar: false, baslatan, sonlandir: () => {}, sorunZamani: Date.now() };
        bekleyenIcePeer.delete(peerId);
        stream!.getTracks().forEach((t) => pc.addTrack(t, stream!));
        pc.onicecandidate = (e) => { if (e.candidate) gonder(peerId, "ice", e.candidate.toJSON()); };
        pc.ontrack = (e) => {
          const uzak = e.streams[0] ?? new MediaStream([e.track]);
          if (!es.el) {
            const el = document.createElement("audio");
            el.autoplay = true; el.setAttribute("playsinline", "");
            el.srcObject = uzak;
            sesKabi.current?.appendChild(el);
            void el.play().catch(() => { /* tarayıcı engelledi: bir sonraki dokunuşta tekrar denenir */ });
            es.el = el;
            analizEkle(peerId, uzak);
          }
        };
        pc.onconnectionstatechange = () => {
          if (kapandi) return;
          if (pc.connectionState === "failed" && esler.get(peerId) === es) {
            es.sonlandir(); esler.delete(peerId);
            if (es.baslatan) setTimeout(() => { if (!kapandi && !esler.has(peerId)) void teklifGonder(peerId); }, 1500);
          }
        };
        es.sonlandir = () => {
          pc.onicecandidate = null; pc.ontrack = null; pc.onconnectionstatechange = null;
          try { pc.close(); } catch { /* yoksay */ }
          es.el?.remove();
          olcumNoktalari.delete(peerId);
        };
        esler.set(peerId, es);
        return es;
      };

      const teklifGonder = async (peerId: string) => {
        const es = esKur(peerId, true);
        const teklif = await es.pc.createOffer();
        await es.pc.setLocalDescription(teklif);
        gonder(peerId, "offer", es.pc.localDescription?.toJSON());
      };

      // Bağlantı bekçisi: 10 sn içinde kurulamayan / kopan bağlantılar yeniden denenir; takılanlar arayüzde işaretlenir
      bekci = setInterval(() => {
        if (kapandi) return;
        const simdi = Date.now();
        const sorunluYeni = new Set<string>();
        for (const [id, es] of [...esler]) {
          if (es.pc.connectionState === "connected") { es.sorunZamani = undefined; continue; }
          es.sorunZamani ??= simdi;
          if (simdi - es.sorunZamani < 10_000) continue;
          sorunluYeni.add(id);
          if (es.baslatan) {
            es.sonlandir(); esler.delete(id);
            kuyruk = kuyruk.then(() => (kapandi || esler.has(id) ? undefined : teklifGonder(id))).catch(() => {});
          }
        }
        setSorunlu((onceki) => (onceki.size === sorunluYeni.size && [...sorunluYeni].every((x) => onceki.has(x)) ? onceki : sorunluYeni));
      }, 4000);

      const bitHiziSinirla = async (pc: RTCPeerConnection, bps: number) => {
        for (const g of pc.getSenders()) {
          if (g.track?.kind !== "video") continue;
          try {
            const p = g.getParameters();
            if (!p.encodings?.length) p.encodings = [{}];
            p.encodings[0].maxBitrate = bps;
            await g.setParameters(p);
          } catch { /* tarayıcı desteklemiyorsa varsayılan bit hızı kalır */ }
        }
      };

      const ekranTeklif = async (peerId: string) => {
        const akis = ekranAkis;
        if (!akis || kapandi) return;
        try { ekranGiden.get(peerId)?.pc.close(); } catch { /* yoksay */ }
        const pc = new RTCPeerConnection({ iceServers });
        const e: EkranEs = { pc, bekleyenIce: [], uzakVar: false };
        ekranGiden.set(peerId, e);
        akis.getTracks().forEach((t) => pc.addTrack(t, akis));
        pc.onicecandidate = (ev) => { if (ev.candidate) gonder(peerId, "ekran-ice", { c: ev.candidate.toJSON(), rol: "gonderen" }); };
        pc.onconnectionstatechange = () => {
          if (kapandi || pc.connectionState !== "failed" || ekranGiden.get(peerId) !== e) return;
          try { pc.close(); } catch { /* yoksay */ }
          ekranGiden.delete(peerId);
          setTimeout(() => { if (!kapandi && ekranAkis && !ekranGiden.has(peerId)) kuyruk = kuyruk.then(() => ekranTeklif(peerId)).catch(() => {}); }, 1500);
        };
        const teklif = await pc.createOffer();
        await pc.setLocalDescription(teklif);
        gonder(peerId, "ekran-offer", pc.localDescription?.toJSON());
      };

      const ekranGelenKapat = () => {
        if (ekranGelen) { try { ekranGelen.es.pc.close(); } catch { /* yoksay */ } ekranGelen = null; }
        setIzlenen(null);
      };

      const ekranTeklifiAl = async (s: Sinyal) => {
        if (ekranGelen) { try { ekranGelen.es.pc.close(); } catch { /* yoksay */ } }
        const pc = new RTCPeerConnection({ iceServers });
        const es: EkranEs = { pc, bekleyenIce: ekranIcePeer.get(s.from) ?? [], uzakVar: false };
        ekranIcePeer.delete(s.from);
        ekranGelen = { peerId: s.from, es };
        pc.onicecandidate = (ev) => { if (ev.candidate) gonder(s.from, "ekran-ice", { c: ev.candidate.toJSON(), rol: "alici" }); };
        pc.ontrack = (ev) => {
          const akis = ev.streams[0] ?? new MediaStream([ev.track]);
          setIzlenen((i) => (i?.akis === akis ? i : { uyeId: s.from, akis }));
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" && ekranGelen?.es === es) ekranGelenKapat();
        };
        await pc.setRemoteDescription(s.veri as RTCSessionDescriptionInit);
        es.uzakVar = true;
        for (const c of es.bekleyenIce) await pc.addIceCandidate(c).catch(() => {});
        es.bekleyenIce = [];
        const cevap = await pc.createAnswer();
        await pc.setLocalDescription(cevap);
        gonder(s.from, "ekran-answer", pc.localDescription?.toJSON());
      };

      const ekranBirak = async () => {
        const akis = ekranAkis;
        ekranAkis = null;
        akis?.getTracks().forEach((t) => { t.onended = null; t.stop(); });
        for (const e of ekranGiden.values()) { try { e.pc.close(); } catch { /* yoksay */ } }
        ekranGiden.clear();
        setPaylasiyorum(false);
        if (!kapandi && kanal) { try { await kanal.track({ t: benimT, ekran: false }); } catch { /* yoksay */ } }
      };

      ekranRef.current = {
        baslat: async (kalite) => {
          if (ekranAkis) return { ok: true };
          if (ekranGelen) return { ok: false, mesaj: "Şu an biri ekran paylaşıyor. Önce onun bitirmesini bekle." };
          try {
            const yakalanan = await navigator.mediaDevices.getDisplayMedia(ekranIstegi(kalite));
            if (kapandi) { yakalanan.getTracks().forEach((t) => t.stop()); return { ok: false }; }
            ekranAkis = yakalanan;
            ekranBitHizi = KALITE[kalite].bitHizi;
            const v = yakalanan.getVideoTracks()[0];
            if (v) { v.contentHint = "motion"; v.onended = () => { void ekranBirak(); }; }
            setPaylasiyorum(true);
            await kanal?.track({ t: benimT, ekran: true });
            // Odadakilere hemen başla (yeni gelenler için presence senkronu devam ettirir)
            for (const id of Object.keys(kanal?.presenceState() ?? {})) {
              if (id !== uyeId && !ekranGiden.has(id)) kuyruk = kuyruk.then(() => ekranTeklif(id)).catch(() => {});
            }
            return { ok: true };
          } catch (e) {
            return ekranHatasi(e);
          }
        },
        durdur: ekranBirak,
      };

      const sinyalIsle = async (s: Sinyal) => {
        if (kapandi || s.to !== uyeId || s.from === uyeId) return;
        if (s.tur === "offer") {
          esler.get(s.from)?.sonlandir(); esler.delete(s.from);
          const es = esKur(s.from, false);
          await es.pc.setRemoteDescription(s.veri as RTCSessionDescriptionInit);
          es.uzakVar = true;
          for (const c of es.bekleyenIce) await es.pc.addIceCandidate(c).catch(() => {});
          es.bekleyenIce = [];
          const cevap = await es.pc.createAnswer();
          await es.pc.setLocalDescription(cevap);
          gonder(s.from, "answer", es.pc.localDescription?.toJSON());
        } else if (s.tur === "answer") {
          const es = esler.get(s.from);
          if (!es || es.uzakVar) return;
          await es.pc.setRemoteDescription(s.veri as RTCSessionDescriptionInit);
          es.uzakVar = true;
          for (const c of es.bekleyenIce) await es.pc.addIceCandidate(c).catch(() => {});
          es.bekleyenIce = [];
        } else if (s.tur === "ekran-offer") {
          await ekranTeklifiAl(s);
        } else if (s.tur === "ekran-answer") {
          const e = ekranGiden.get(s.from);
          if (!e || e.uzakVar) return;
          await e.pc.setRemoteDescription(s.veri as RTCSessionDescriptionInit);
          e.uzakVar = true;
          for (const c of e.bekleyenIce) await e.pc.addIceCandidate(c).catch(() => {});
          e.bekleyenIce = [];
          await bitHiziSinirla(e.pc, ekranBitHizi);
        } else if (s.tur === "ekran-ice") {
          const { c, rol } = s.veri as { c: RTCIceCandidateInit; rol: "gonderen" | "alici" };
          // rol, adayı üreten tarafın rolüdür: izleyiciden geliyorsa paylaşan olarak benim bağlantımdır ve tersi
          const e = rol === "alici" ? ekranGiden.get(s.from) : ekranGelen?.peerId === s.from ? ekranGelen.es : undefined;
          if (e && e.uzakVar) await e.pc.addIceCandidate(c).catch(() => {});
          else if (e) e.bekleyenIce.push(c);
          else if (rol === "gonderen") ekranIcePeer.set(s.from, [...(ekranIcePeer.get(s.from) ?? []), c]);
        } else if (s.tur === "ice") {
          const es = esler.get(s.from);
          if (es && es.uzakVar) await es.pc.addIceCandidate(s.veri as RTCIceCandidateInit).catch(() => {});
          else if (es) es.bekleyenIce.push(s.veri as RTCIceCandidateInit);
          else bekleyenIcePeer.set(s.from, [...(bekleyenIcePeer.get(s.from) ?? []), s.veri as RTCIceCandidateInit]);
        }
      };

      let doluHatasi = false;
      kanal.on("broadcast", { event: "sinyal" }, ({ payload }) => {
        kuyruk = kuyruk.then(() => sinyalIsle(payload as Sinyal)).catch(() => {});
      });
      kanal.on("presence", { event: "sync" }, () => {
        if (kapandi || !kanal) return;
        const durumlar = kanal.presenceState<{ t: number; ekran?: boolean }>();
        const kisiler = Object.entries(durumlar).map(([id, m]) => ({ id, t: m[0]?.t ?? 0, ekran: !!m[m.length - 1]?.ekran }));
        kisiler.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
        // Kapasite: ilk P2P_MAX_KISI kişi sığar
        const sira = kisiler.findIndex((k) => k.id === uyeId);
        if (sira >= P2P_MAX_KISI) { doluHatasi = true; void ayril(); return; }
        const varOlanlar = new Set(kisiler.map((k) => k.id));
        for (const k of kisiler) {
          if (k.id === uyeId || esler.has(k.id)) continue;
          // Daha yeni katılan, eskilere teklif gönderir
          const benYeniyim = benimT > k.t || (benimT === k.t && uyeId > k.id);
          if (benYeniyim) kuyruk = kuyruk.then(() => teklifGonder(k.id)).catch(() => {});
        }
        for (const [id, e] of esler) {
          if (!varOlanlar.has(id)) { e.sonlandir(); esler.delete(id); }
        }
        // Ekran paylaşıyorsam: odaya yeni gelenlere de yayını başlat; ayrılanların bağlantısını kapat
        for (const [id, e] of ekranGiden) {
          if (!varOlanlar.has(id)) { try { e.pc.close(); } catch { /* yoksay */ } ekranGiden.delete(id); }
        }
        if (ekranAkis) {
          for (const k of kisiler) {
            if (k.id !== uyeId && !ekranGiden.has(k.id)) kuyruk = kuyruk.then(() => ekranTeklif(k.id)).catch(() => {});
          }
        }
        // Başkasının yayınını izliyorsam ve o paylaşımı bıraktıysa / odadan çıktıysa kapat
        if (ekranGelen) {
          const kaynak = kisiler.find((k) => k.id === ekranGelen!.peerId);
          if (!kaynak || !kaynak.ekran) ekranGelenKapat();
        }
      });

      await new Promise<void>((coz, red) => {
        const zamanasimi = setTimeout(() => red(Object.assign(new Error("zaman aşımı"), { name: "AgHatasi" })), 12000);
        kanal!.subscribe(async (d) => {
          if (d === "SUBSCRIBED") {
            clearTimeout(zamanasimi);
            await kanal!.track({ t: benimT });
            coz();
          } else if (d === "CHANNEL_ERROR" || d === "TIMED_OUT") {
            clearTimeout(zamanasimi);
            red(Object.assign(new Error("kanal"), { name: "AgHatasi" }));
          }
        });
      });
      if (doluHatasi) return { ok: false, neden: "dolu", mesaj: `Sesli oda dolu (en fazla ${P2P_MAX_KISI} kişi).` };
      if (islem !== islemRef.current) { await kapat(); return { ok: false, neden: "iptal" }; }
      setDurum("bagli");
      onKanal(hedef);
      return { ok: true };
    } catch (e) {
      const ad = (e as { name?: string }).name;
      const izin = ad === "NotAllowedError" || ad === "NotFoundError";
      return basarisiz(izin ? "izin" : "ag", sesHatasiMetni(e));
    }
  }, [temizle, ayril, onKanal, uyeId]);

  const sessizDegistir = useCallback(async () => {
    const yeni = !sessiz;
    yerelRef.current?.getAudioTracks().forEach((t) => { t.enabled = !yeni; });
    setSessiz(yeni);
  }, [sessiz]);

  useEffect(() => {
    const kapat = () => { void temizle(); };
    window.addEventListener("pagehide", kapat);
    return () => { window.removeEventListener("pagehide", kapat); void temizle(); };
  }, [temizle]);

  const ekranPaylas = useCallback(async (kalite: EkranKalite): Promise<EkranSonuc> => ekranRef.current ? ekranRef.current.baslat(kalite) : { ok: false, mesaj: "Önce sesli odaya katıl." }, []);
  const ekranDurdur = useCallback(async () => { await ekranRef.current?.durdur(); }, []);

  return { durum, kanalId, sessiz, konusanlar, sorunlu, turnVar, sesKabi, baglan, ayril, sessizDegistir, izlenen, paylasiyorum, ekranPaylas, ekranDurdur };
}
