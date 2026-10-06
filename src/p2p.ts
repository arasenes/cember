import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, supabase } from "./supabase";
import { sesHatasiMetni, type BaglanSonuc, type SesDurumu } from "./voice";

/**
 * Doğrudan (P2P) motor: konuşanlar tarayıcıdan tarayıcıya bağlanır (mesh).
 * Sinyalleşme, özel bir Supabase Realtime kanalı ("ses:<kanal_id>") üzerinden yapılır;
 * yalnızca odanın üyeleri o kanala girebilir (bkz. 004 migration).
 * Aşağıdaki sınır, mesh'in 5-6 kişiye kadar rahat çalışması içindir.
 */
export const P2P_MAX_KISI = Number(import.meta.env.VITE_SES_MAX_KISI ?? 6);
const VARSAYILAN_ICE: RTCIceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];

type Sinyal = { to: string; from: string; tur: "offer" | "answer" | "ice"; veri: unknown };
type Es = { pc: RTCPeerConnection; bekleyenIce: RTCIceCandidateInit[]; uzakVar: boolean; baslatan: boolean; el?: HTMLAudioElement; analiz?: AnalyserNode; sonlandir: () => void };

async function iceSunuculariniAl(): Promise<RTCIceServer[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/turn-bilgi`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: "{}",
    });
    if (!r.ok) return VARSAYILAN_ICE;
    const j = await r.json();
    return Array.isArray(j.iceServers) && j.iceServers.length ? j.iceServers : VARSAYILAN_ICE;
  } catch {
    return VARSAYILAN_ICE;
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

  const temizle = useCallback(async () => {
    const k = kapatRef.current;
    kapatRef.current = null;
    if (k) await k();
    yerelRef.current = null;
    setKonusanlar(new Set());
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
    const esler = new Map<string, Es>();
    const bekleyenIcePeer = new Map<string, RTCIceCandidateInit[]>();
    let kuyruk: Promise<void> = Promise.resolve();
    let kapandi = false;

    const kapat = async () => {
      kapandi = true;
      if (olcum) clearInterval(olcum);
      for (const e of esler.values()) e.sonlandir();
      esler.clear();
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
      const iceServers = await iceSunuculariniAl();
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

      const benimT = Date.now();
      kanal = supabase.channel(`ses:${hedef}`, { config: { private: true, broadcast: { self: false }, presence: { key: uyeId } } });
      const aktifKanal = kanal;
      const gonder = (to: string, tur: Sinyal["tur"], veri: unknown) => {
        void aktifKanal.send({ type: "broadcast", event: "sinyal", payload: { to, from: uyeId, tur, veri } satisfies Sinyal });
      };

      const esKur = (peerId: string, baslatan: boolean): Es => {
        const pc = new RTCPeerConnection({ iceServers });
        const es: Es = { pc, bekleyenIce: bekleyenIcePeer.get(peerId) ?? [], uzakVar: false, baslatan, sonlandir: () => {} };
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
            void el.play().catch(() => {});
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
        const durumlar = kanal.presenceState<{ t: number }>();
        const kisiler = Object.entries(durumlar).map(([id, m]) => ({ id, t: m[0]?.t ?? 0 }));
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

  return { durum, kanalId, sessiz, konusanlar, sesKabi, baglan, ayril, sessizDegistir };
}
