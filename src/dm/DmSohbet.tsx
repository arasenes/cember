import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import MessageView from "../MessageView";
import Avatar from "../Avatar";
import Ikon from "../mesaj/Ikon";
import type { Uye } from "../types";
import { gunEtiketi } from "../util";
import { dmBasligi, karsiUye, mesajaCevir, type DmMesaj } from "./tipler";
import type { DmDurumu } from "./useDm";
import { durumMetni } from "./ProfilKarti";
import { t, onayla } from "../i18n";
import { sesCal } from "../sesler";
import { boyutMetni, ekHazirla, EkHatasi, type HazirEk } from "../ekler";
import GifSecici from "../mesaj/GifSecici";
import { SesKayitDugmesi } from "../mesaj/SesliMesaj";

const SAYFA = 50;

type Props = {
  dmId: string;
  dm: DmDurumu;
  me: Uye;
  uyeler: Uye[];
  cevrimici: Set<string>;
  onProfil: (uyeId: string) => void;
  onGeri?: () => void;
  onHata: (metin: string) => void;
};

function birlestir(eski: DmMesaj[], yeni: DmMesaj[]): DmMesaj[] {
  const m = new Map<string, DmMesaj>();
  for (const x of [...eski, ...yeni]) m.set(x.id, x);
  return [...m.values()].sort((a, b) => a.olusturma.localeCompare(b.olusturma));
}

/** Bir DM'in mesaj akışı: yükleme, canlı güncelleme, yazma, resim/GIF/sesli mesaj gönderme, düzenleme, silme. */
export default function DmSohbet({ dmId, dm, me, uyeler, cevrimici, onProfil, onGeri, onHata }: Props) {
  const [mesajlar, setMesajlar] = useState<DmMesaj[]>([]);
  const [dahaVar, setDahaVar] = useState(false);
  const [metin, setMetin] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [eklenecek, setEklenecek] = useState("");
  const [ek, setEk] = useState<HazirEk | null>(null);
  const [gifAcik, setGifAcik] = useState(false);
  const dosyaRef = useRef<HTMLInputElement>(null);
  const akisRef = useRef<HTMLDivElement>(null);
  // "Yeni mesaj" çizgisi: sohbet açılırken kayıtlı son okuma zamanı (açılınca okundu sayıldığı için bir kez alınır)
  const okumaRef = useRef<{ dm: string; zaman: string | null } | null>(null);
  const altaKaydir = useRef(true);
  const girdiRef = useRef<HTMLTextAreaElement>(null);
  const harita = useMemo(() => new Map(uyeler.map((u) => [u.id, u])), [uyeler]);
  const kanal = dm.kanallar.find((k) => k.id === dmId);
  const karsi = kanal ? karsiUye(kanal, dm.uyeleri, me.id) : null;
  const karsiUyesi = karsi ? harita.get(karsi) : undefined;
  const iliski = karsi ? dm.iliski(karsi) : "yok";
  const baslik = kanal ? dmBasligi(kanal, dm.uyeleri, harita, me.id) : "Mesaj";
  const grupUyeleri = kanal?.tur === "grup" ? dm.uyeleri.filter((u) => u.dm_id === dmId) : [];
  if (okumaRef.current?.dm !== dmId) {
    const benimki = dm.uyeleri.find((u) => u.dm_id === dmId && u.uye_id === me.id);
    if (benimki) okumaRef.current = { dm: dmId, zaman: benimki.son_okuma || null };
  }
  const sonOkuma = okumaRef.current?.dm === dmId ? okumaRef.current.zaman : null;
  const yeniSayisi = sonOkuma ? mesajlar.filter((m) => m.olusturma > sonOkuma && m.uye_id !== me.id && !m.silindi).length : 0;

  // Mesajları yükle
  useEffect(() => {
    let iptal = false;
    setMesajlar([]); setDahaVar(false); setMetin("");
    (async () => {
      const { data, error } = await supabase.from("dm_mesajlari").select("*").eq("dm_id", dmId).order("olusturma", { ascending: false }).limit(SAYFA);
      if (iptal) return;
      if (error) return onHata("Mesajlar yüklenemedi.");
      altaKaydir.current = true;
      setMesajlar(((data ?? []) as DmMesaj[]).reverse());
      setDahaVar((data ?? []).length === SAYFA);
    })();
    return () => { iptal = true; };
  }, [dmId, onHata]);

  // Canlı: yeni ve güncellenen mesajlar (RLS yalnızca üyelere iletir)
  useEffect(() => {
    const k = supabase.channel(`dm-sohbet-${dmId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_mesajlari", filter: `dm_id=eq.${dmId}` }, (p) => {
        const m = p.new as DmMesaj;
        if (!m?.id) return;
        if (p.eventType === "INSERT") altaKaydir.current = true;
        setMesajlar((x) => birlestir(x, [m]));
        if (p.eventType === "INSERT" && m.uye_id !== me.id && document.visibilityState === "visible") void dm.okundu(dmId);
      })
      .subscribe();
    return () => { void supabase.removeChannel(k); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmId, me.id]);

  useEffect(() => {
    const el = akisRef.current;
    if (el && altaKaydir.current) el.scrollTop = el.scrollHeight;
  }, [mesajlar]);

  const eskileriYukle = useCallback(async () => {
    if (!mesajlar.length) return;
    const { data } = await supabase.from("dm_mesajlari").select("*").eq("dm_id", dmId).lt("olusturma", mesajlar[0].olusturma).order("olusturma", { ascending: false }).limit(SAYFA);
    altaKaydir.current = false;
    setMesajlar((x) => birlestir(((data ?? []) as DmMesaj[]).reverse(), x));
    setDahaVar((data ?? []).length === SAYFA);
  }, [dmId, mesajlar]);

  async function dmMesajGonder(icerik: string): Promise<boolean> {
    const { data, error } = await supabase.from("dm_mesajlari").insert({ dm_id: dmId, uye_id: me.id, metin: icerik }).select().single();
    if (error) {
      onHata(iliski === "engelli" || /row-level/i.test(error.message) ? "Bu kişiyle şu an mesajlaşamazsın." : "Mesaj gönderilemedi.");
      return false;
    }
    sesCal("gonder");
    altaKaydir.current = true;
    setMesajlar((x) => birlestir(x, [data as DmMesaj]));
    return true;
  }

  async function ekSec(dosya: File | Blob, varsayilanAd?: string) {
    try {
      const hazir = await ekHazirla(dosya, varsayilanAd ?? ((dosya as File).name || "resim"));
      if (hazir.boyut > 1024 * 1024) {
        URL.revokeObjectURL(hazir.onizleme);
        onHata("Özel mesajda resim en fazla 1 MB olabilir.");
        return;
      }
      if (ek) URL.revokeObjectURL(ek.onizleme);
      setEk(hazir);
    } catch (e) {
      onHata(e instanceof EkHatasi ? e.message : "Resim hazırlanamadı.");
    }
  }

  async function gonder() {
    const yazi = metin.trim();
    if ((!yazi && !ek) || gonderiliyor) return;
    setGonderiliyor(true);
    let gonderilecek = yazi;
    let yuklenenYol: string | null = null;
    if (ek) {
      const uz = ek.uzanti === "jpg" ? "jpg" : "webp";
      const yol = `${me.oda_id}/${me.id}/${crypto.randomUUID()}.${uz}`;
      const { error: yErr } = await supabase.storage.from("avatarlar").upload(yol, ek.blob, { contentType: uz === "jpg" ? "image/jpeg" : "image/webp", upsert: false });
      if (yErr) { setGonderiliyor(false); return onHata("Resim yüklenemedi."); }
      yuklenenYol = yol;
      gonderilecek = `[dmresim:${yol}|${ek.genislik}x${ek.yukseklik}]` + (yazi ? `\n${yazi}` : "");
    }
    const ok = await dmMesajGonder(gonderilecek);
    setGonderiliyor(false);
    if (!ok) {
      if (yuklenenYol) void supabase.storage.from("avatarlar").remove([yuklenenYol]);
      return;
    }
    if (ek) { URL.revokeObjectURL(ek.onizleme); setEk(null); }
    setMetin("");
    girdiRef.current?.focus();
  }

  async function duzenle(m: { id: string }, yeni: string): Promise<boolean> {
    const t = yeni.trim();
    if (!t || t.length > 4000) { onHata("Mesaj 1-4000 karakter olmalı."); return false; }
    const { data, error } = await supabase.from("dm_mesajlari").update({ metin: t }).eq("id", m.id).select().single();
    if (error || !data) { onHata("Mesaj düzenlenemedi."); return false; }
    setMesajlar((x) => birlestir(x, [data as DmMesaj]));
    return true;
  }

  async function sil(m: { id: string }) {
    if (!onayla("Bu mesaj silinsin mi?")) return;
    const { error } = await supabase.from("dm_mesajlari").update({ silindi: true }).eq("id", m.id);
    if (error) return onHata("Mesaj silinemedi.");
    setMesajlar((x) => x.map((y) => (y.id === m.id ? { ...y, silindi: true } : y)));
  }

  async function ayril() {
    if (!onayla("Bu gruptan ayrılmak istiyor musun?")) return;
    const h = await dm.grupAyril(dmId);
    if (h) onHata("Gruptan ayrılınamadı.");
    else onGeri?.();
  }

  async function ekle() {
    if (!eklenecek) return;
    const h = await dm.grupUyeEkle(dmId, eklenecek);
    if (h) onHata(h); else setEklenecek("");
  }

  const eklenebilir = uyeler.filter((u) => !u.silindi && u.id !== me.id && !grupUyeleri.some((g) => g.uye_id === u.id) && dm.iliski(u.id) !== "engelli");
  const benKurucu = kanal?.olusturan === me.id;

  // Satırlar: gün ayırıcı + art arda aynı kişinin mesajı gruplanır
  const satirlar: React.ReactNode[] = [];
  let sonGun = "";
  let onceki: DmMesaj | null = null;
  let cizgiYazildi = false;
  for (const m of mesajlar) {
    const g = gunEtiketi(m.olusturma);
    if (g !== sonGun) { sonGun = g; onceki = null; satirlar.push(<div className="day" key={"g" + m.id}>{g}</div>); }
    const devam = !!onceki && onceki.uye_id === m.uye_id && !onceki.silindi && !m.silindi && new Date(m.olusturma).getTime() - new Date(onceki.olusturma).getTime() < 5 * 60000;
    onceki = m;
    if (!cizgiYazildi && sonOkuma && yeniSayisi > 0 && m.olusturma > sonOkuma && m.uye_id !== me.id) {
      cizgiYazildi = true;
      satirlar.push(<div className="yeni-cizgi" role="separator" aria-label={t(`${yeniSayisi} yeni mesaj`)} key={"yeni" + m.id}><span>{yeniSayisi} yeni mesaj</span></div>);
    }
    satirlar.push(
      <MessageView key={m.id} devam={devam} mesaj={mesajaCevir(m)} yazar={harita.get(m.uye_id)} benim={me} tepkiler={[]} tepkisiz
        onTepki={() => {}} onSil={() => void sil(m)} onDuzenle={(x, t) => duzenle(x, t)} onProfil={onProfil} />,
    );
  }

  return (
    <main className="col chat dm-sohbet" aria-label={t(`${baslik} ile mesajlaşma`)}>
      <div className="head">
        {onGeri && <button type="button" className="sq dm-geri" onClick={onGeri} aria-label={t("Mesaj listesine dön")}><Ikon ad="geri" /></button>}
        {kanal?.tur === "ikili" && karsiUyesi && <span className="dm-avatar"><Avatar uye={karsiUyesi} className="dm-ust-avatar" /></span>}
        <h2 className="dm-ad-baslik">{baslik}</h2>
        <span className="dm-durum-metni">
          {kanal?.tur === "ikili" && karsiUyesi && [durumMetni(karsiUyesi, cevrimici.has(karsiUyesi.id)), karsiUyesi.durum_metin].filter(Boolean).join(" · ")}
          {kanal?.tur === "grup" && `${grupUyeleri.length} kişi`}
        </span>
        {kanal?.tur === "grup" && <button type="button" className="head-dugme" onClick={() => void ayril()}>{t("Gruptan ayrıl")}</button>}
      </div>

      {kanal?.tur === "grup" && (
        <div className="dm-grup-bar">
          <span className="hint">Üyeler: {grupUyeleri.map((g) => harita.get(g.uye_id)?.takma_ad ?? "Silinmiş üye").join(", ")}</span>
          {benKurucu && grupUyeleri.length < 10 && eklenebilir.length > 0 && (
            <span className="dm-ekle">
              <label htmlFor="dm-ekle-sec" className="sr">{t("Gruba kişi ekle")}</label>
              <select id="dm-ekle-sec" value={eklenecek} onChange={(e) => setEklenecek(e.target.value)}>
                <option value="">{t("Kişi ekle…")}</option>
                {eklenebilir.map((u) => <option key={u.id} value={u.id}>{u.takma_ad}</option>)}
              </select>
              <button type="button" className="pk-btn" onClick={() => void ekle()} disabled={!eklenecek}>{t("Ekle")}</button>
            </span>
          )}
        </div>
      )}

      <div className="msgs" ref={akisRef} role="log" aria-live="polite" aria-label={t("Özel mesajlar")}>
        {dahaVar && <button className="more" onClick={() => void eskileriYukle()}>{t("Eski mesajları yükle")}</button>}
        {!dahaVar && (
          <div className="dm-giris">
            {kanal?.tur === "ikili" && karsiUyesi ? <Avatar uye={karsiUyesi} className="dm-giris-avatar" /> : <span className="dm-ikon dm-giris-avatar dm-grup-ikon">{grupUyeleri.length}+</span>}
            <div className="dm-giris-ad">{baslik}</div>
            <div className="dm-giris-metin">{kanal?.tur === "grup" ? `${baslik} grubunun başlangıcı.` : `${baslik} ile özel mesajlaşmanın başlangıcı.`}</div>
          </div>
        )}
        {!mesajlar.length && <div className="empty">{t("Henüz mesaj yok. İlk mesajı sen yaz.")}</div>}
        {satirlar}
      </div>

      {iliski === "engelli" ? (
        <div className="dm-engelli" role="status">
          {t("Bu kişiyi engelledin, mesaj gönderemezsin.")}
          {karsi && <button type="button" className="pk-btn" onClick={() => void dm.engelKaldir(karsi)}>{t("Engeli kaldır")}</button>}
        </div>
      ) : (
        <div className="composer-wrap" style={{ position: "relative" }}>
          {gifAcik && (
            <GifSecici
              onSec={(url) => { setGifAcik(false); void dmMesajGonder(url); }}
              onKapat={() => setGifAcik(false)}
            />
          )}
          {ek && (
            <div className="ek-onizleme" role="region" aria-label={t("Seçilen resim önizlemesi")}>
              <img src={ek.onizleme} alt={ek.ad} />
              <div className="ek-bilgi"><b>{ek.ad}</b><span className="hint">{ek.genislik}×{ek.yukseklik} · {boyutMetni(ek.boyut)}</span></div>
              <button type="button" className="ib" onClick={() => { URL.revokeObjectURL(ek.onizleme); setEk(null); }}>{t("Kaldır")}</button>
            </div>
          )}
          <div className="composer">
            <input ref={dosyaRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void ekSec(f); }} />
            <button type="button" className="sq ek-sec" onClick={() => dosyaRef.current?.click()} disabled={gonderiliyor} aria-label={t("Resim ekle")} title={t("Resim ekle")}>
              <Ikon ad="arti" />
            </button>
            <button type="button" className="sq ek-sec" onClick={() => setGifAcik((x) => !x)} disabled={gonderiliyor} aria-label={t("GIF seç")} title="GIF">
              GIF
            </button>
            <SesKayitDugmesi odaId={me.oda_id} uyeId={me.id} disabled={gonderiliyor} onGonder={async (m) => { await dmMesajGonder(m); }} onHata={onHata} />
            <textarea ref={girdiRef} rows={1} value={metin} maxLength={4000} aria-label={t("Mesaj yaz")} placeholder={t(`${baslik} kişisine mesaj yaz`)}
              onChange={(e) => setMetin(e.target.value)}
              onPaste={(e) => { const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); void ekSec(f, "Ekran görüntüsü"); } }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void gonder(); } }} />
            <button className="sq send" onClick={() => void gonder()} aria-label={t("Gönder")} disabled={(!metin.trim() && !ek) || gonderiliyor}><Ikon ad="gonder" /></button>
          </div>
        </div>
      )}
    </main>
  );
}
