import { useCallback, useRef, useState } from "react";
import { sesYoneticisi } from "./ses/sesDuzeyi";
import { useSesP2P } from "./p2p";
import { gurultuTercihi, gurultuTercihiKaydet } from "./gurultu";
import { IOS_PAYLASIM_MESAJI, ekranPaylasilabilir, ekranPaylasilabilirTarayici, iosMu, type EkranKalite, type EkranSonuc } from "./ekranOrtak";
import { sesCal } from "./sesler";

export type Motor = "livekit" | "p2p";
const BOS_KUME: Set<string> = new Set();
const BOS_KAMERALAR: Map<string, MediaStream> = new Map();

/**
 * Çember'in kendi doğrudan (P2P / WebRTC) ses motorunu yönetir.
 * LiveKit ve aylık dakika kotası kaldırılmıştır; tüm kullanıcılar doğrudan ücretsiz ses motorunda buluşur.
 *
 * onKanal: (kanal, motor) presence ile odadaki herkese duyurulur.
 */
export function useSesMotoru(
  uyeId: string,
  onKanal: (kanalId: string | null, motor: Motor | null) => void,
  _motorSor?: (kanalId: string) => Motor | null,
) {
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const [gurultu, setGurultu] = useState(gurultuTercihi);
  const [sagir, setSagir] = useState(false);
  const [sunucuSustur, setSunucuSusturState] = useState(false);
  const sagirOncesiSessiz = useRef(false);
  const baglanRef = useRef<(k: string) => Promise<void>>(async () => {});

  const p2p = useSesP2P(uyeId, (k) => onKanal(k, k ? "p2p" : null));

  const baglan = useCallback(async (hedef: string) => {
    setHata(""); setBilgi("");
    sesYoneticisi.sagirlastir(false); setSagir(false); setSunucuSusturState(false);
    await p2p.ayril();
    const r = await p2p.baglan(hedef);
    if (r.ok) {
      sesCal("katil");
      if (r.mikYok) setBilgi("Mikrofon bulunamadı; odaya yalnızca dinleyici olarak katıldın.");
      return;
    }
    if (r.neden === "iptal") return;
    setHata(r.mesaj ?? "Sese bağlanılamadı.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p2p.ayril, p2p.baglan]);
  baglanRef.current = baglan;

  const sagirSifirla = () => { sesYoneticisi.sagirlastir(false); setSagir(false); setSunucuSusturState(false); };
  const motor: Motor | null = p2p.durum !== "kapali" ? "p2p" : null;

  return {
    durum: p2p.durum,
    kanalId: p2p.kanalId,
    sessiz: p2p.sessiz,
    konusanlar: p2p.konusanlar,
    kullanilan: null as number | null,
    sorunlu: motor === "p2p" ? p2p.sorunlu : BOS_KUME,
    turnVar: p2p.turnVar,
    motor,
    hata,
    bilgi,
    kabiRefleri: [p2p.sesKabi],
    baglan,
    ayril: async () => {
      const baglantiVardi = p2p.durum !== "kapali";
      await p2p.ayril();
      sagirSifirla();
      if (baglantiVardi) sesCal("ayril");
    },
    sessizDegistir: async () => {
      if (sunucuSustur) { setBilgi("Bir yönetici seni sustur; sesin yönetici kaldırınca açılır."); return; }
      if (sagir) { setBilgi("Sağırlaştırma açıkken mikrofon da kapalıdır. Önce sağırlaştırmayı kapat."); return; }
      const acilacak = p2p.sessiz;
      await p2p.sessizDegistir();
      sesCal(acilacak ? "mikAc" : "mikKapat");
    },
    /** Bas-konuş için: mikrofonu doğrudan aç/kapat (sunucu susturması ve sağırlaştırma varsa yok sayılır). */
    mikAyarla: async (acik: boolean) => { if (sunucuSustur || sagir) return; await p2p.sessizAyarla(!acik); },
    sagir,
    /** Sağırlaştır: tüm uzak sesleri keser ve mikrofonu kapatır; kapatınca önceki mikrofon durumuna döner. */
    sagirDegistir: async () => {
      if (!sagir) {
        sagirOncesiSessiz.current = p2p.sessiz;
        sesCal("sagir");
        sesYoneticisi.sagirlastir(true); setSagir(true);
        await p2p.sessizAyarla(true);
      } else {
        sesYoneticisi.sagirlastir(false); setSagir(false);
        await p2p.sessizAyarla(sunucuSustur ? true : sagirOncesiSessiz.current);
      }
    },
    sunucuSustur,
    /** Yönetici sunucudan susturdu (true) ya da kaldırdı (false). */
    sunucuSusturAyarla: async (v: boolean) => {
      setSunucuSusturState(v);
      if (v) await p2p.sessizAyarla(true);
    },
    kameralar: motor === "p2p" ? p2p.kameralar : BOS_KAMERALAR,
    kameraAcik: motor === "p2p" ? p2p.kameraAcik : false,
    kameraDegistir: async () => {
      const r = await p2p.kameraDegistir();
      if (!r.ok && r.mesaj) setHata(r.mesaj);
      return r;
    },
    gurultu,
    gurultuDegistir: async () => {
      const yeni = !gurultu;
      setGurultu(yeni); gurultuTercihiKaydet(yeni);
      await p2p.gurultuAyarla(yeni);
    },
    // Ekran paylaşımı: izleyenin gördüğü yayın, benim paylaşıp paylaşmadığım ve başlat/durdur
    izlenen: p2p.izlenen,
    paylasiyorum: p2p.paylasiyorum,
    kendiEkran: p2p.kendiEkran,
    ekranDestegi: ekranPaylasilabilir(false),
    ekranPaylas: async (kalite: EkranKalite): Promise<EkranSonuc> => {
      if (iosMu() && !ekranPaylasilabilirTarayici()) {
        setHata(IOS_PAYLASIM_MESAJI);
        return { ok: false, mesaj: IOS_PAYLASIM_MESAJI };
      }
      if (!ekranPaylasilabilirTarayici()) {
        const m = "Telefondan ekran paylaşımı şu an desteklenmiyor; bilgisayardan paylaşabilirsin.";
        setHata(m);
        return { ok: false, mesaj: m };
      }
      const r = await p2p.ekranPaylas(kalite);
      if (!r.ok && r.mesaj) setHata(r.mesaj);
      if (r.ok && r.mesaj) setBilgi(r.mesaj);
      return r;
    },
    ekranDurdur: p2p.ekranDurdur,
    sonEfekt: p2p.sonEfekt,
    efektGonder: p2p.efektGonder,
    birlikteIzle: p2p.birlikteIzle,
    birlikteIzleAyarla: p2p.birlikteIzleAyarla,
    cizimGonder: p2p.cizimGonder,
    sesModu: p2p.sesModu,
    sesModuAyarla: p2p.sesModuAyarla,
    hataTemizle: () => { setHata(""); setBilgi(""); },
  };
}
export type SesArayuzu = ReturnType<typeof useSesMotoru>;
