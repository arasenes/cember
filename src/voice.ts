import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { SUPABASE_KEY, SUPABASE_URL, supabase } from "./supabase";

export type SesDurumu = "kapali" | "baglaniyor" | "bagli";
export type BaglanSonuc = { ok: boolean; neden?: "limit" | "kurulmadi" | "dolu" | "izin" | "ag" | "iptal"; mesaj?: string };

export function sesHatasiMetni(e: unknown): string {
  const ad = (e as { name?: string })?.name ?? "";
  const mesaj = String((e as { message?: string })?.message ?? "");
  if (ad === "NotAllowedError" || /permission|denied/i.test(mesaj)) {
    return "Mikrofon izni verilmedi. Tarayıcının adres çubuğundaki kilit simgesinden mikrofona izin ver, sonra tekrar dene.";
  }
  if (ad === "NotFoundError" || /requested device not found/i.test(mesaj)) {
    return "Mikrofon bulunamadı. Bir mikrofon bağlı olduğundan emin ol.";
  }
  if (!window.isSecureContext) {
    return "Sesli odalar yalnızca güvenli (https) bağlantıda çalışır.";
  }
  return "Sese bağlanılamadı. İnternetini kontrol edip tekrar dene.";
}

/**
 * LiveKit motoru: tek bir sesli kanala bağlantıyı yönetir.
 * onKanal: bağlanılan/ayrılan kanalı (presence ile) odadaki herkese duyurmak için çağrılır.
 * onKoptu: bağlantı beklenmedik şekilde koparsa (kota dolması dahil) çağrılır, üst katman yedek moda geçer.
 */
export function useSes(uyeId: string, onKanal: (kanalId: string | null) => void, onKoptu?: (kanalId: string) => void) {
  const [durum, setDurum] = useState<SesDurumu>("kapali");
  const [kanalId, setKanalId] = useState<string | null>(null);
  const [sessiz, setSessiz] = useState(false);
  const [konusanlar, setKonusanlar] = useState<Set<string>>(new Set());
  const [kullanilan, setKullanilan] = useState<number | null>(null);
  const odaRef = useRef<Room | null>(null);
  const oturumRef = useRef<string | null>(null);
  const nabizRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sesKabi = useRef<HTMLDivElement | null>(null);
  const islemRef = useRef(0);
  const hedefRef = useRef<string | null>(null);

  const temizle = useCallback(async () => {
    if (nabizRef.current) { clearInterval(nabizRef.current); nabizRef.current = null; }
    const o = oturumRef.current;
    oturumRef.current = null;
    if (o) { try { await supabase.rpc("ses_nabiz", { p_oturum: o }); } catch { /* yoksay */ } }
    const room = odaRef.current;
    odaRef.current = null;
    if (room) { try { await room.disconnect(); } catch { /* yoksay */ } }
    if (sesKabi.current) sesKabi.current.replaceChildren();
    setKonusanlar(new Set());
  }, []);

  const ayril = useCallback(async () => {
    islemRef.current++;
    hedefRef.current = null;
    await temizle();
    setDurum("kapali"); setKanalId(null); setSessiz(false);
    onKanal(null);
  }, [temizle, onKanal]);

  const baglan = useCallback(async (hedef: string): Promise<BaglanSonuc> => {
    const islem = ++islemRef.current;
    await temizle();
    setDurum("baglaniyor"); setKanalId(hedef); setSessiz(false);
    hedefRef.current = hedef;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("güvensiz"), { name: "GuvensizBaglanti" });
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${SUPABASE_URL}/functions/v1/ses-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ kanal_id: hedef }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(j.hata ?? "token"), { kullaniciMesaji: j.hata ?? "Sese bağlanılamadı.", kod: j.kod });
      if (islem !== islemRef.current) return { ok: false, neden: "iptal" };
      setKullanilan(j.kullanilan ?? null);
      oturumRef.current = j.oturum_id;

      const { Room: LkRoom, RoomEvent, Track } = await import("livekit-client");
      const room = new LkRoom({
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      odaRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          sesKabi.current?.appendChild(el);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach().forEach((el) => el.remove()); });
      room.on(RoomEvent.ActiveSpeakersChanged, (liste) => setKonusanlar(new Set(liste.map((p) => p.identity))));
      room.on(RoomEvent.Disconnected, () => {
        if (odaRef.current !== room) return;
        odaRef.current = null;
        const k = hedefRef.current;
        void ayril().then(() => { if (k) onKoptu?.(k); });
      });
      await room.connect(j.url, j.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      if (islem !== islemRef.current) { await room.disconnect(); return { ok: false, neden: "iptal" }; }

      nabizRef.current = setInterval(() => {
        if (oturumRef.current) supabase.rpc("ses_nabiz", { p_oturum: oturumRef.current }).then(() => {});
      }, 30000);
      setDurum("bagli");
      onKanal(hedef);
      return { ok: true };
    } catch (e) {
      if (islem !== islemRef.current) return { ok: false, neden: "iptal" };
      const kod = (e as { kod?: string }).kod;
      const km = (e as { kullaniciMesaji?: string }).kullaniciMesaji;
      const ad = (e as { name?: string }).name;
      await temizle();
      setDurum("kapali"); setKanalId(null);
      hedefRef.current = null;
      onKanal(null);
      const izin = ad === "NotAllowedError" || ad === "NotFoundError" || ad === "GuvensizBaglanti";
      const mesaj = km ?? (ad === "GuvensizBaglanti" ? "Sesli odalar yalnızca güvenli (https) bağlantıda çalışır." : sesHatasiMetni(e));
      const neden: BaglanSonuc["neden"] = izin ? "izin" : kod === "limit" ? "limit" : kod === "kurulmadi" ? "kurulmadi" : kod === "dolu" ? "dolu" : "ag";
      return { ok: false, neden, mesaj };
    }
  }, [temizle, ayril, onKanal, onKoptu]);

  const sessizDegistir = useCallback(async () => {
    const room = odaRef.current;
    if (!room) return;
    const yeni = !sessiz;
    await room.localParticipant.setMicrophoneEnabled(!yeni);
    setSessiz(yeni);
  }, [sessiz]);

  // Sekme kapanırken / bileşen sökülürken bağlantıyı kapat
  useEffect(() => {
    const kapat = () => { void temizle(); };
    window.addEventListener("pagehide", kapat);
    return () => { window.removeEventListener("pagehide", kapat); void temizle(); };
  }, [temizle]);

  void uyeId;
  return { durum, kanalId, sessiz, konusanlar, kullanilan, sesKabi, baglan, ayril, sessizDegistir };
}
