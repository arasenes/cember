import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { SUPABASE_KEY, SUPABASE_URL, supabase } from "./supabase";
import { gurultuTercihi, gurultuUygula } from "./gurultu";
import { sesYoneticisi } from "./ses/sesDuzeyi";
import { ekranHatasi, ekranPaylasilabilirTarayici, KALITE, uygulamaIci, yerelEkran, type EkranKalite, type EkranSonuc, type Izlenen } from "./ekranOrtak";

/** Yerel eklenti yanıt vermese bile bağlantı akışını kilitlemesin diye zaman aşımı ile durdurur. */
async function yerelDurdur(y: { durdur(): Promise<void> }) {
  try { await Promise.race([y.durdur(), new Promise((r) => setTimeout(r, 3000))]); } catch { /* yoksay */ }
}

export type SesDurumu = "kapali" | "baglaniyor" | "bagli";
export type BaglanSonuc = { ok: boolean; neden?: "limit" | "kurulmadi" | "dolu" | "izin" | "ag" | "iptal"; mesaj?: string; mikYok?: boolean; izinYok?: boolean };

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
/** ses-token'dan jeton ister; oturum sunucuda sona ermişse (başka cihazdan çıkış gibi) önce yeniler, olmazsa girişe döner. */
async function tokenIste(govde: Record<string, unknown>): Promise<Response> {
  const dene = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(`${SUPABASE_URL}/functions/v1/ses-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify(govde),
    });
  };
  let r = await dene();
  if (r.status !== 401) return r;
  const { error } = await supabase.auth.refreshSession();
  if (!error) { r = await dene(); if (r.status !== 401) return r; }
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  window.location.reload();
  return r;
}

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
  const [izlenen, setIzlenen] = useState<Izlenen | null>(null);
  const [paylasiyorum, setPaylasiyorum] = useState(false);
  const [kameralar, setKameralar] = useState<Map<string, MediaStream>>(new Map());
  const [kameraAcik, setKameraAcik] = useState(false);
  const yerelDinleyici = useRef<{ remove: () => Promise<void> } | null>(null);
  const yerelAktif = useRef(false); // telefonda ekran paylaşımı başlatıldı mı (yerel eklentiyi gereksiz çağırmamak için)

  const temizle = useCallback(async () => {
    if (nabizRef.current) { clearInterval(nabizRef.current); nabizRef.current = null; }
    const o = oturumRef.current;
    oturumRef.current = null;
    if (o) { try { await supabase.rpc("ses_nabiz", { p_oturum: o }); } catch { /* yoksay */ } }
    const room = odaRef.current;
    odaRef.current = null;
    if (room) { try { await room.disconnect(); } catch { /* yoksay */ } }
    if (sesKabi.current) sesKabi.current.replaceChildren();
    sesYoneticisi.hepsiniKaldir();
    setKameralar(new Map()); setKameraAcik(false);
    setKonusanlar(new Set());
    setIzlenen(null); setPaylasiyorum(false);
    const y = yerelEkran();
    if (y && yerelAktif.current) { yerelAktif.current = false; void yerelDurdur(y); }
    try { await yerelDinleyici.current?.remove(); } catch { /* yoksay */ }
    yerelDinleyici.current = null;
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
      const r = await tokenIste({ kanal_id: hedef });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(j.hata ?? "token"), { kullaniciMesaji: j.hata ?? "Sese bağlanılamadı.", kod: j.kod });
      if (islem !== islemRef.current) return { ok: false, neden: "iptal" };
      setKullanilan(j.kullanilan ?? null);
      oturumRef.current = j.oturum_id;

      const { Room: LkRoom, RoomEvent, Track } = await import("livekit-client");
      const room = new LkRoom({
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: gurultuTercihi(), autoGainControl: gurultuTercihi() },
      });
      odaRef.current = room;
      // Ses anahtarı: mikrofon "<üye>", paylaşılan ekranın sesi (tarayıcı ya da telefon) "<üye>~ekran" (kişi başı ses düzeyi için)
      const sesAnahtari = (kimlik: string, kaynak: string) => {
        const uye = kimlik.split("~")[0];
        return kaynak === Track.Source.ScreenShareAudio || kimlik.includes("~ekran") ? `${uye}~ekran` : uye;
      };
      room.on(RoomEvent.TrackSubscribed, (track, yayin, katilimci) => {
        if (track.kind === Track.Kind.Audio) {
          // Mikrofon sesi ve paylaşılan ekranın sesi aynı yoldan çalınır; ses düzeyi WebAudio kazancıyla ayarlanır
          const el = track.attach();
          sesKabi.current?.appendChild(el);
          sesYoneticisi.kaydet(sesAnahtari(katilimci.identity, yayin.source), new MediaStream([track.mediaStreamTrack]), el);
        } else if (track.kind === Track.Kind.Video && yayin.source === Track.Source.ScreenShare) {
          setIzlenen({ uyeId: katilimci.identity.split("~")[0], akis: new MediaStream([track.mediaStreamTrack]) });
        } else if (track.kind === Track.Kind.Video && yayin.source === Track.Source.Camera) {
          const uye = katilimci.identity.split("~")[0];
          setKameralar((x) => new Map(x).set(uye, new MediaStream([track.mediaStreamTrack])));
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, yayin, katilimci) => {
        track.detach().forEach((el) => el.remove());
        if (track.kind === Track.Kind.Audio) sesYoneticisi.kaldir(sesAnahtari(katilimci.identity, yayin.source));
        if (yayin.source === Track.Source.ScreenShare && track.kind === Track.Kind.Video) {
          setIzlenen((i) => (i?.uyeId === katilimci.identity.split("~")[0] ? null : i));
        }
        if (yayin.source === Track.Source.Camera && track.kind === Track.Kind.Video) {
          const uye = katilimci.identity.split("~")[0];
          setKameralar((x) => { const y = new Map(x); y.delete(uye); return y; });
        }
      });
      // Yönetici sunucudan susturduğunda (ya da kaldırdığında) kendi mikrofon durumumuz güncellenir
      room.on(RoomEvent.TrackMuted, (pub, p) => { if (p.isLocal && pub.source === Track.Source.Microphone) setSessiz(true); });
      room.on(RoomEvent.TrackUnmuted, (pub, p) => { if (p.isLocal && pub.source === Track.Source.Microphone) setSessiz(false); });
      // Tarayıcının kendi "Paylaşımı durdur" düğmesine basılırsa
      room.on(RoomEvent.LocalTrackUnpublished, (yayin) => {
        if (yayin.source === Track.Source.ScreenShare) setPaylasiyorum(false);
        if (yayin.source === Track.Source.Camera) { setKameraAcik(false); setKameralar((x) => { const y = new Map(x); y.delete(uyeId); return y; }); }
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (liste) => setKonusanlar(new Set(liste.map((p) => p.identity))));
      room.on(RoomEvent.Disconnected, () => {
        if (odaRef.current !== room) return;
        odaRef.current = null;
        const k = hedefRef.current;
        void ayril().then(() => { if (k) onKoptu?.(k); });
      });
      // Tarayıcı sesi otomatik çalmayı engellediyse ilk dokunuşta/tuşta başlat
      const sesiAc = () => { if (!room.canPlaybackAudio) void room.startAudio().catch(() => {}); };
      document.addEventListener("pointerdown", sesiAc, true);
      document.addEventListener("keydown", sesiAc, true);
      room.on(RoomEvent.Disconnected, () => {
        document.removeEventListener("pointerdown", sesiAc, true);
        document.removeEventListener("keydown", sesiAc, true);
      });
      await room.connect(j.url, j.token);
      // Mikrofon yoksa odaya yine de girilir (yalnızca dinleyici olarak)
      let mikYok = false;
      let izinYok = false;
      try { await room.localParticipant.setMicrophoneEnabled(true); } catch (e) {
        const mesaj = String((e as Error)?.message ?? "");
        if ((e as { name?: string })?.name === "NotFoundError" || /requested device not found/i.test(mesaj)) mikYok = true;
        else if (/permission|not allowed|insufficient|publish/i.test(mesaj) && (e as { name?: string })?.name !== "NotAllowedError") { mikYok = true; izinYok = true; }
        else throw e;
      }
      if (islem !== islemRef.current) { await room.disconnect(); return { ok: false, neden: "iptal" }; }

      nabizRef.current = setInterval(() => {
        if (oturumRef.current) supabase.rpc("ses_nabiz", { p_oturum: oturumRef.current }).then(() => {});
      }, 30000);
      setDurum("bagli");
      if (mikYok) setSessiz(true);
      onKanal(hedef);
      return { ok: true, mikYok, izinYok };
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

  const gurultuAyarla = useCallback(async (acik: boolean) => {
    const pub = odaRef.current?.localParticipant.getTrackPublications().find((p) => p.kind === "audio" && p.source === "microphone");
    await gurultuUygula(pub?.track?.mediaStreamTrack, acik);
  }, []);

  /** Mikrofonu açar/kapatır (sessiz=true: kapalı). Bas-konuş ve sağırlaştırma da bunu kullanır. */
  const sessizAyarla = useCallback(async (yeni: boolean) => {
    const room = odaRef.current;
    if (!room) return;
    try { await room.localParticipant.setMicrophoneEnabled(!yeni); } catch { return; }
    setSessiz(yeni);
  }, []);
  const sessizDegistir = useCallback(async () => { await sessizAyarla(!sessiz); }, [sessiz, sessizAyarla]);

  /** Kamera aç/kapat (en çok 720p, 30 kare). Yalnızca LiveKit motorunda çalışır. */
  const kameraDegistir = useCallback(async (): Promise<{ ok: boolean; mesaj?: string }> => {
    const room = odaRef.current;
    if (!room) return { ok: false, mesaj: "Önce sesli odaya katıl." };
    const ac = !kameraAcik;
    try {
      await room.localParticipant.setCameraEnabled(
        ac,
        ac ? { resolution: { width: 1280, height: 720, frameRate: 30 } } : undefined,
        ac ? { videoEncoding: { maxBitrate: 1_500_000, maxFramerate: 30 }, videoSimulcastLayers: [] } : undefined,
      );
    } catch (e) {
      const ad = (e as { name?: string })?.name;
      return { ok: false, mesaj: ad === "NotAllowedError" ? "Kamera izni verilmedi. Tarayıcının adres çubuğundan kameraya izin ver." : ad === "NotFoundError" ? "Kamera bulunamadı." : "Kamera açılamadı." };
    }
    if (ac) {
      const iz = room.localParticipant.getTrackPublications().find((p) => p.source === "camera")?.track?.mediaStreamTrack;
      if (iz) setKameralar((x) => new Map(x).set(uyeId, new MediaStream([iz])));
    } else {
      setKameralar((x) => { const y = new Map(x); y.delete(uyeId); return y; });
    }
    setKameraAcik(ac);
    return { ok: true };
  }, [kameraAcik, uyeId]);

  const ekranPaylas = useCallback(async (kalite: EkranKalite): Promise<EkranSonuc> => {
    const room = odaRef.current;
    if (!room) return { ok: false, mesaj: "Önce sesli odaya katıl." };
    const k = KALITE[kalite];
    const yerel = yerelEkran();
    if (yerel) {
      // Android uygulaması: ekran, yerel eklenti üzerinden ayrı bir katılımcı olarak yayınlanır
      try {
        const kanal = hedefRef.current;
        const r = await tokenIste({ kanal_id: kanal, ekran: true });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return { ok: false, mesaj: j.hata ?? "Ekran paylaşımı başlatılamadı." };
        try { await yerelDinleyici.current?.remove(); } catch { /* yoksay */ }
        yerelDinleyici.current = await yerel.addListener("durdu", () => setPaylasiyorum(false));
        yerelAktif.current = true;
        await yerel.baslat({ url: j.url, token: j.token });
        setPaylasiyorum(true);
        return { ok: true };
      } catch (e) {
        setPaylasiyorum(false);
        const m = String((e as { message?: string })?.message ?? "");
        if (/iptal|cancel|denied|reddedildi/i.test(m)) return { ok: false, mesaj: `Ekran paylaşımı başlamadı: izin verilmedi ya da iptal edildi (${m}).` };
        return { ok: false, mesaj: "Ekran paylaşılamadı. " + m };
      }
    }
    if (!ekranPaylasilabilirTarayici()) {
      return { ok: false, mesaj: uygulamaIci()
        ? "Bu uygulama sürümünde ekran paylaşımı yok. Güncel APK'yı indirip kur: github.com/arasenes/cember/releases/download/apk-son/cember.apk"
        : "Telefon tarayıcısı ekranı paylaşamaz. Tüm ekranı paylaşmak için Çember Android uygulamasını (APK) kur: github.com/arasenes/cember/releases/download/apk-son/cember.apk" };
    }
    try {
      await room.localParticipant.setScreenShareEnabled(
        true,
        {
          audio: true, contentHint: "motion", selfBrowserSurface: "exclude", systemAudio: "include", surfaceSwitching: "include",
          resolution: { width: k.genislik, height: k.yukseklik, frameRate: k.kare },
        },
        { screenShareEncoding: { maxBitrate: k.bitHizi, maxFramerate: k.kare }, screenShareSimulcastLayers: [], degradationPreference: "maintain-framerate" },
      );
      setPaylasiyorum(true);
      // Ses paylaşılmadıysa (pencere paylaşımı ya da kutu işaretlenmedi) kullanıcıyı uyar
      const sesVar = room.localParticipant.getTrackPublications().some((p) => p.source === "screen_share_audio");
      return sesVar ? { ok: true } : { ok: true, mesaj: "Ekran paylaşılıyor ama SES gitmiyor. Ses için paylaşırken 'Sistem sesini / Sekme sesini paylaş' kutusunu işaretle (Chrome'da sekme ya da tüm ekran seç)." };
    } catch (e) {
      setPaylasiyorum(false);
      return ekranHatasi(e);
    }
  }, []);

  const ekranDurdur = useCallback(async () => {
    setPaylasiyorum(false);
    const y = yerelEkran();
    if (y) { yerelAktif.current = false; await yerelDurdur(y); return; }
    try { await odaRef.current?.localParticipant.setScreenShareEnabled(false); } catch { /* yoksay */ }
  }, []);

  // Sekme kapanırken / bileşen sökülürken bağlantıyı kapat
  useEffect(() => {
    const kapat = () => { void temizle(); };
    window.addEventListener("pagehide", kapat);
    return () => { window.removeEventListener("pagehide", kapat); void temizle(); };
  }, [temizle]);

  return { durum, kanalId, sessiz, konusanlar, kullanilan, sesKabi, baglan, ayril, sessizDegistir, sessizAyarla, gurultuAyarla, izlenen, paylasiyorum, ekranPaylas, ekranDurdur, kameralar, kameraAcik, kameraDegistir };
}
