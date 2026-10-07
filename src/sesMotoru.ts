import { useCallback, useRef, useState } from "react";
import { sesYoneticisi } from "./ses/sesDuzeyi";
import { useSes } from "./voice";
import { useSesP2P } from "./p2p";
import { gurultuTercihi, gurultuTercihiKaydet } from "./gurultu";
import { IOS_PAYLASIM_MESAJI, ekranPaylasilabilir, ekranPaylasilabilirTarayici, iosMu, type EkranKalite, type EkranSonuc } from "./ekranOrtak";

export type Motor = "livekit" | "p2p";
const BOS_KUME: Set<string> = new Set();
const BOS_KAMERALAR: Map<string, MediaStream> = new Map();

/**
 * İki sesli motoru birleştirir:
 *  - Önce LiveKit denenir (daha sağlam; ücretsiz planda aylık 5.000 dakika sınırı var).
 *  - LiveKit kurulu değilse, kotası dolduysa ya da bağlanamazsa otomatik olarak doğrudan (P2P, ücretsiz, kotasız) moda geçilir.
 *  - Bağlantı sırasında LiveKit koparsa (kota dolması dahil) yine P2P'ye geçilir.
 * Aynı kanaldaki herkesin aynı motorda olması gerekir: odada zaten biri varsa onun motoru kullanılır.
 *
 * onKanal: (kanal, motor) presence ile odadaki herkese duyurulur.
 * motorSor: bir kanalda şu an kullanılan motoru (varsa) söyler.
 */
export function useSesMotoru(
  uyeId: string,
  onKanal: (kanalId: string | null, motor: Motor | null) => void,
  motorSor: (kanalId: string) => Motor | null,
) {
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [gurultu, setGurultu] = useState(gurultuTercihi);
  const [sagir, setSagir] = useState(false);
  const [sunucuSustur, setSunucuSusturState] = useState(false);
  const sagirOncesiSessiz = useRef(false);
  const baglanRef = useRef<(k: string) => Promise<void>>(async () => {});

  const lk = useSes(uyeId, (k) => onKanal(k, k ? "livekit" : null), (k) => {
    // LiveKit beklenmedik şekilde koptu: ücretsiz moda geç
    setBilgi("LiveKit bağlantısı koptu, ücretsiz doğrudan moda geçiliyor.");
    void p2pBaglan(k);
  });
  const p2p = useSesP2P(uyeId, (k) => onKanal(k, k ? "p2p" : null));

  async function p2pBaglan(k: string) {
    const r = await p2p.baglan(k);
    if (!r.ok && r.neden !== "iptal") setHata(r.mesaj ?? "Sese bağlanılamadı.");
  }

  const baglan = useCallback(async (hedef: string) => {
    setHata(""); setBilgi("");
    sesYoneticisi.sagirlastir(false); setSagir(false); setSunucuSusturState(false);
    await Promise.all([lk.ayril(), p2p.ayril()]);
    const mevcut = motorSor(hedef);

    if (mevcut === "p2p") { await p2pBaglan(hedef); return; }

    const r = await lk.baglan(hedef);
    if (r.ok) { if (r.izinYok) setBilgi("Bu sunucuda sesli odada konuşma iznin yok; yalnızca dinleyici olarak katıldın."); else if (r.mikYok) setBilgi("Mikrofon bulunamadı; odaya yalnızca dinleyici olarak katıldın."); return; }
    if (r.neden === "iptal") return;
    // Kullanıcıdan kaynaklı ya da oda dolu hatalarında yedeğe geçme
    if (r.neden === "izin" || r.neden === "dolu") { setHata(r.mesaj ?? "Sese bağlanılamadı."); return; }
    // Odada zaten LiveKit kullanan biri varsa, yedek mod onlarla konuşamaz
    if (mevcut === "livekit") { setHata(`${r.mesaj ?? "LiveKit'e bağlanılamadı."} Odadakiler çıkıp yeniden girerse ücretsiz moda geçilir.`); return; }
    setBilgi(r.neden === "limit" ? "LiveKit kotası doldu, ücretsiz doğrudan mod kullanılıyor." : "Ücretsiz doğrudan mod kullanılıyor.");
    await p2pBaglan(hedef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lk.ayril, p2p.ayril, lk.baglan, p2p.baglan, motorSor]);
  baglanRef.current = baglan;

  const aktif = lk.durum !== "kapali" ? lk : p2p;
  const sagirSifirla = () => { sesYoneticisi.sagirlastir(false); setSagir(false); setSunucuSusturState(false); };
  const motor: Motor | null = lk.durum !== "kapali" ? "livekit" : p2p.durum !== "kapali" ? "p2p" : null;

  return {
    durum: aktif.durum,
    kanalId: aktif.kanalId,
    sessiz: aktif.sessiz,
    konusanlar: aktif.konusanlar,
    kullanilan: lk.kullanilan,
    sorunlu: motor === "p2p" ? p2p.sorunlu : BOS_KUME,
    turnVar: p2p.turnVar,
    motor,
    hata,
    bilgi,
    kabiRefleri: [lk.sesKabi, p2p.sesKabi],
    baglan,
    ayril: async () => { await Promise.all([lk.ayril(), p2p.ayril()]); sagirSifirla(); },
    sessizDegistir: async () => {
      if (sunucuSustur) { setBilgi("Bir yönetici seni sustur; sesin yönetici kaldırınca açılır."); return; }
      if (sagir) { setBilgi("Sağırlaştırma açıkken mikrofon da kapalıdır. Önce sağırlaştırmayı kapat."); return; }
      await aktif.sessizDegistir();
    },
    /** Bas-konuş için: mikrofonu doğrudan aç/kapat (sunucu susturması ve sağırlaştırma varsa yok sayılır). */
    mikAyarla: async (acik: boolean) => { if (sunucuSustur || sagir) return; await aktif.sessizAyarla(!acik); },
    sagir,
    /** Sağırlaştır: tüm uzak sesleri keser ve mikrofonu kapatır; kapatınca önceki mikrofon durumuna döner. */
    sagirDegistir: async () => {
      if (!sagir) {
        sagirOncesiSessiz.current = aktif.sessiz;
        sesYoneticisi.sagirlastir(true); setSagir(true);
        await aktif.sessizAyarla(true);
      } else {
        sesYoneticisi.sagirlastir(false); setSagir(false);
        await aktif.sessizAyarla(sunucuSustur ? true : sagirOncesiSessiz.current);
      }
    },
    sunucuSustur,
    /** Yönetici sunucudan susturdu (true) ya da kaldırdı (false). */
    sunucuSusturAyarla: async (v: boolean) => {
      setSunucuSusturState(v);
      if (v) await aktif.sessizAyarla(true);
    },
    kameralar: motor === "livekit" ? lk.kameralar : motor === "p2p" ? p2p.kameralar : BOS_KAMERALAR,
    kameraAcik: motor === "livekit" ? lk.kameraAcik : motor === "p2p" ? p2p.kameraAcik : false,
    kameraDegistir: async () => {
      const r = await (motor === "p2p" ? p2p : lk).kameraDegistir();
      if (!r.ok && r.mesaj) setHata(r.mesaj);
      return r;
    },
    gurultu,
    gurultuDegistir: async () => {
      const yeni = !gurultu;
      setGurultu(yeni); gurultuTercihiKaydet(yeni);
      await Promise.all([lk.gurultuAyarla(yeni), p2p.gurultuAyarla(yeni)]);
    },
    // Ekran paylaşımı: izleyenin gördüğü yayın, benim paylaşıp paylaşmadığım ve başlat/durdur
    izlenen: aktif.izlenen,
    paylasiyorum: aktif.paylasiyorum,
    ekranDestegi: ekranPaylasilabilir(true),
    ekranPaylas: async (kalite: EkranKalite): Promise<EkranSonuc> => {
      if (iosMu() && !ekranPaylasilabilirTarayici()) {
        setHata(IOS_PAYLASIM_MESAJI);
        return { ok: false, mesaj: IOS_PAYLASIM_MESAJI };
      }
      if (motor === "p2p" && !ekranPaylasilabilirTarayici()) {
        const m = "Doğrudan (ücretsiz) modda telefondan ekran paylaşımı çalışmıyor; LiveKit'e bağlanılamamış. Sesli odadan çıkıp tekrar gir.";
        setHata(m);
        return { ok: false, mesaj: m };
      }
      const r = await aktif.ekranPaylas(kalite);
      if (!r.ok && r.mesaj) setHata(r.mesaj);
      if (r.ok && r.mesaj) setBilgi(r.mesaj);
      return r;
    },
    ekranDurdur: aktif.ekranDurdur,
    hataTemizle: () => { setHata(""); setBilgi(""); },
  };
}
export type SesArayuzu = ReturnType<typeof useSesMotoru>;
