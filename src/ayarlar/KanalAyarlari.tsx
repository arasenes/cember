import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import Ikon from "../mesaj/Ikon";
import type { Kanal, Kategori } from "../types";
import { duzenle, gruplariKur, YAVAS_MOD_SECENEKLERI, type Tasima } from "../sunucu/siralama";
import { IZIN } from "../sunucu/izin";
import { BildirimSatiri, rpcCagir, SayfaBasligi, useBildirim } from "./ortak";
import { t, onayla } from "../i18n";

type Props = {
  odaId: string;
  kanallar: Kanal[];
  kategoriler: Kategori[];
  /** Kanal/kategori verisi değişti: üst bileşen yeniden yüklesin. */
  onDegisti: () => void;
};


type IzinSatir = { hedef: "herkes" | "moderator" | "rol"; rol_id: string | null; ver: number; yasak: number };
type RolKisa = { id: string; ad: string };
const KANAL_IZINLERI: { bit: number; ad: string }[] = [
  { bit: IZIN.MESAJ_YAZ, ad: t("Mesaj yaz") }, { bit: IZIN.DOSYA, ad: t("Dosya ekle") }, { bit: IZIN.SES_KONUS, ad: t("Sesli konuş") }, { bit: IZIN.EKRAN_KAMERA, ad: t("Ekran/kamera") },
];

/** Bir kanalın izinlerini Herkes / Moderatör / özel rol için "varsayılan · izin ver · yasakla" olarak ayarlar. */
function KanalIzinleri({ kanal, onBildir }: { kanal: Kanal; onBildir: (b: { ok: boolean; metin: string }) => void }) {
  const [satirlar, setSatirlar] = useState<IzinSatir[]>([]);
  const [roller, setRoller] = useState<RolKisa[]>([]);
  const yukle = useCallback(async () => {
    const [a, r] = await Promise.all([
      supabase.from("kanal_izinleri").select("hedef, rol_id, ver, yasak").eq("kanal_id", kanal.id),
      supabase.from("roller").select("id, ad").eq("oda_id", kanal.oda_id).order("sira"),
    ]);
    if (a.data) setSatirlar(a.data as IzinSatir[]);
    if (r.data) setRoller(r.data as RolKisa[]);
  }, [kanal.id, kanal.oda_id]);
  useEffect(() => { void yukle(); }, [yukle]);

  const durum = (hedef: IzinSatir["hedef"], rolId: string | null, bit: number): "varsayilan" | "ver" | "yasak" => {
    const x = satirlar.find((s) => s.hedef === hedef && s.rol_id === rolId);
    return x && (x.ver & bit) ? "ver" : x && (x.yasak & bit) ? "yasak" : "varsayilan";
  };
  async function degistir(hedef: IzinSatir["hedef"], rolId: string | null, bit: number, yeni: "varsayilan" | "ver" | "yasak") {
    const x = satirlar.find((s) => s.hedef === hedef && s.rol_id === rolId);
    let ver = (x?.ver ?? 0) & ~bit, yasak = (x?.yasak ?? 0) & ~bit;
    if (yeni === "ver") ver |= bit; else if (yeni === "yasak") yasak |= bit;
    const r = await rpcCagir("kanal_izin_ayarla", { p_kanal: kanal.id, p_hedef: hedef, p_rol: rolId, p_ver: ver, p_yasak: yasak });
    onBildir(r.hata ? { ok: false, metin: r.hata } : { ok: true, metin: "Kanal izni kaydedildi." });
    if (!r.hata) await yukle();
  }
  const hedefler: { hedef: IzinSatir["hedef"]; rolId: string | null; ad: string }[] = [
    { hedef: "herkes", rolId: null, ad: "Herkes" }, { hedef: "moderator", rolId: null, ad: "Moderatör" },
    ...roller.map((r) => ({ hedef: "rol" as const, rolId: r.id, ad: r.ad })),
  ];
  const bitler = KANAL_IZINLERI.filter((b) => ((b.bit === IZIN.MESAJ_YAZ || b.bit === IZIN.DOSYA) ? kanal.tur === "yazili" : kanal.tur === "sesli"));
  return (
    <div className="kanal-izin kart" role="group" aria-label={t(`${kanal.ad} kanal izinleri`)}>
      <p className="hint">{t("“Varsayılan”: sunucu izni geçerli. Sahip her zaman her şeyi yapabilir.")}</p>
      {hedefler.map((h) => (
        <div key={h.hedef + (h.rolId ?? "")} className="izin">
          <div>{h.ad}</div>
          <div className="yon-eylemler">
            {bitler.map((b) => (
              <label key={b.bit} className="kanal-izin-alan">{b.ad}
                <select value={durum(h.hedef, h.rolId, b.bit)} aria-label={t(`${h.ad}: ${b.ad}`)} onChange={(e) => void degistir(h.hedef, h.rolId, b.bit, e.target.value as "varsayilan" | "ver" | "yasak")}>
                  <option value="varsayilan">{t("Varsayılan")}</option><option value="ver">{t("İzin ver")}</option><option value="yasak">{t("Yasakla")}</option>
                </select>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type Surukleme = { tur: "kanal" | "kategori"; id: string } | null;

/** Kanallar ve kategoriler: ekle, adlandır, sırala (sürükle-bırak ya da ▲▼), taşı, yavaş mod, şifre, sil. */
export default function KanalAyarlari({ odaId, kanallar, kategoriler, onDegisti }: Props) {
  const { bildirim, mesgul, calistir } = useBildirim();
  const [yeniKanal, setYeniKanal] = useState("");
  const [yeniTur, setYeniTur] = useState<"yazili" | "sesli">("yazili");
  const [yeniKategori, setYeniKategori] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");
  const [yeniKatAd, setYeniKatAd] = useState("");
  const [duzenKat, setDuzenKat] = useState<{ id: string; ad: string } | null>(null);
  const [sifreKanal, setSifreKanal] = useState<string | null>(null);
  const [sifre, setSifre] = useState("");
  const [surukle, setSurukle] = useState<Surukleme>(null);
  const [izinKanal, setIzinKanal] = useState<string | null>(null);
  const gruplar = gruplariKur(kanallar, kategoriler);

  const calistirVeYenile = async (basari: string, is: () => Promise<string | null>) => {
    const ok = await calistir(basari, is);
    if (ok) onDegisti();
    return ok;
  };

  async function sirala(t: Tasima) {
    const yeni = duzenle(kanallar, kategoriler, t);
    await calistirVeYenile("Sıralama kaydedildi.", async () => (await rpcCagir("kanallari_duzenle", { p_oda: odaId, p_kanallar: yeni.kanallar, p_kategoriler: yeni.kategoriler })).hata);
  }

  const kanalAc = (e: React.FormEvent) => {
    e.preventDefault();
    const ad = yeniKanal.trim();
    if (!ad) return;
    void calistirVeYenile(`"${ad}" ${yeniTur === "sesli" ? "sesli odası" : "kanalı"} açıldı${yeniSifre ? " (şifreli)" : ""}.`, async () => {
      const r = await rpcCagir("kanal_olustur", { p_ad: ad, p_tur: yeniTur, p_sifre: yeniSifre || null, p_oda: odaId });
      if (r.hata) return r.hata;
      if (yeniKategori) await rpcCagir("kanallari_duzenle", {
        p_oda: odaId,
        p_kanallar: [{ id: String(r.veri), kategori_id: yeniKategori, sira: kanallar.length + 1 }],
        p_kategoriler: [],
      });
      setYeniKanal(""); setYeniSifre("");
      return null;
    });
  };
  const kategoriAc = (e: React.FormEvent) => {
    e.preventDefault();
    const ad = yeniKatAd.trim();
    if (!ad) return;
    void calistirVeYenile(`"${ad}" kategorisi açıldı.`, async () => {
      const r = await rpcCagir("kategori_olustur", { p_oda: odaId, p_ad: ad });
      if (!r.hata) setYeniKatAd("");
      return r.hata;
    });
  };
  const kategoriAdiKaydet = () => {
    if (!duzenKat) return;
    void calistirVeYenile("Kategori adı kaydedildi.", async () => {
      const r = await rpcCagir("kategori_guncelle", { p_id: duzenKat.id, p_ad: duzenKat.ad });
      if (!r.hata) setDuzenKat(null);
      return r.hata;
    });
  };
  const kategoriSil = (c: Kategori) => {
    if (!onayla(`"${c.ad}" kategorisi silinsin mi? İçindeki kanallar silinmez, kategorisiz kalır.`)) return;
    void calistirVeYenile("Kategori silindi.", async () => (await rpcCagir("kategori_sil", { p_id: c.id })).hata);
  };
  const kanalSil = (k: Kanal) => {
    if (!onayla(`"${k.ad}" ve içindeki mesajlar silinsin mi?`)) return;
    void calistirVeYenile(`"${k.ad}" silindi.`, async () => (await rpcCagir("kanal_sil", { p_kanal: k.id })).hata);
  };
  const yavasModAyarla = (k: Kanal, sn: number) =>
    void calistirVeYenile(sn > 0 ? `"${k.ad}" için yavaş mod ${sn} sn.` : `"${k.ad}" için yavaş mod kapandı.`, async () => (await rpcCagir("kanal_yavas_mod_ayarla", { p_kanal: k.id, p_sn: sn })).hata);
  const kategoriDegistir = (k: Kanal, kategori: string) => void sirala({ tur: "kanal-kategori", id: k.id, kategori_id: kategori || null });
  const sifreKaydet = (k: Kanal, s: string) =>
    void calistirVeYenile(s ? `"${k.ad}" için şifre ayarlandı; herkes yeniden girmeli.` : `"${k.ad}" artık şifresiz.`, async () => {
      const r = await rpcCagir("kanal_sifre_ayarla", { p_kanal: k.id, p_sifre: s });
      if (!r.hata) { setSifreKanal(null); setSifre(""); }
      return r.hata;
    });

  // Sürükle-bırak: kanal satırına bırakılan kanal onun önüne, kategori başlığına bırakılan kanal sona girer
  const kanalSurukleProps = (k: Kanal) => ({
    draggable: true,
    onDragStart: () => setSurukle({ tur: "kanal", id: k.id }),
    onDragEnd: () => setSurukle(null),
    onDragOver: (e: React.DragEvent) => { if (surukle?.tur === "kanal" && surukle.id !== k.id) e.preventDefault(); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); if (surukle?.tur === "kanal") void sirala({ tur: "kanal-onune", id: surukle.id, hedef: k.id }); setSurukle(null); },
  });
  const baslikSurukleProps = (kategoriId: string | null) => ({
    onDragOver: (e: React.DragEvent) => { if (surukle) e.preventDefault(); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (surukle?.tur === "kanal") void sirala({ tur: "kanal-kategori", id: surukle.id, kategori_id: kategoriId });
      else if (surukle?.tur === "kategori" && kategoriId) void sirala({ tur: "kategori-onune", id: surukle.id, hedef: kategoriId });
      setSurukle(null);
    },
  });

  return (
    <div className="ayar-form">
      <SayfaBasligi baslik="Kanallar ve kategoriler" aciklama="Kanalları kategorilere topla, sürükleyerek ya da ▲▼ düğmeleriyle sırala. Yazılı kanallarda yavaş mod açabilirsin." />
      <BildirimSatiri b={bildirim} />

      <form className="kanal-form" onSubmit={kanalAc}>
        <input type="text" value={yeniKanal} onChange={(e) => setYeniKanal(e.target.value)} maxLength={40} placeholder={t("Yeni kanal adı")} aria-label={t("Yeni kanal adı")} disabled={mesgul} />
        <select value={yeniTur} onChange={(e) => setYeniTur(e.target.value as "yazili" | "sesli")} aria-label={t("Kanal türü")} disabled={mesgul}>
          <option value="yazili">{t("# Yazılı")}</option><option value="sesli">{t("Sesli")}</option>
        </select>
        <select value={yeniKategori} onChange={(e) => setYeniKategori(e.target.value)} aria-label={t("Kategori")} disabled={mesgul}>
          <option value="">{t("Kategorisiz")}</option>
          {kategoriler.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}
        </select>
        <input type="password" value={yeniSifre} onChange={(e) => setYeniSifre(e.target.value)} maxLength={40} placeholder={t("Şifre (isteğe bağlı)")} aria-label={t("Kanal şifresi (isteğe bağlı)")} autoComplete="new-password" disabled={mesgul} />
        <button className="cta" type="submit" disabled={mesgul || !yeniKanal.trim()}>{t("Kanal aç")}</button>
      </form>
      <form className="kanal-form" onSubmit={kategoriAc}>
        <input type="text" value={yeniKatAd} onChange={(e) => setYeniKatAd(e.target.value)} maxLength={30} placeholder={t("Yeni kategori adı")} aria-label={t("Yeni kategori adı")} disabled={mesgul} />
        <button className="pk-btn" type="submit" disabled={mesgul || !yeniKatAd.trim()}>{t("Kategori ekle")}</button>
      </form>

      {gruplar.map((g) => (
        <section key={g.kategori?.id ?? "kategorisiz"} className="kanal-grup" aria-label={g.kategori?.ad ?? t("Kategorisiz kanallar")}>
          <div className="kanal-grup-ust" {...baslikSurukleProps(g.kategori?.id ?? null)}
            {...(g.kategori ? { draggable: true, onDragStart: () => setSurukle({ tur: "kategori", id: g.kategori!.id }), onDragEnd: () => setSurukle(null) } : {})}>
            {g.kategori && duzenKat?.id === g.kategori.id ? (
              <form className="yon-eylemler" onSubmit={(e) => { e.preventDefault(); kategoriAdiKaydet(); }}>
                <input type="text" value={duzenKat.ad} maxLength={30} aria-label={t("Kategori adı")} autoFocus onChange={(e) => setDuzenKat({ id: duzenKat.id, ad: e.target.value })} />
                <button className="pk-btn" type="submit" disabled={mesgul || !duzenKat.ad.trim()}>{t("Kaydet")}</button>
                <button className="pk-btn" type="button" onClick={() => setDuzenKat(null)}>{t("Vazgeç")}</button>
              </form>
            ) : (
              <>
                <h2>{g.kategori?.ad ?? "Kategorisiz"}</h2>
                {g.kategori && (
                  <div className="yon-eylemler">
                    <button className="cb-ibtn" aria-label={t(`${g.kategori.ad} kategorisini yukarı taşı`)} disabled={mesgul} onClick={() => void sirala({ tur: "kategori-yukari", id: g.kategori!.id })}>▲</button>
                    <button className="cb-ibtn" aria-label={t(`${g.kategori.ad} kategorisini aşağı taşı`)} disabled={mesgul} onClick={() => void sirala({ tur: "kategori-asagi", id: g.kategori!.id })}>▼</button>
                    <button className="pk-btn" disabled={mesgul} onClick={() => setDuzenKat({ id: g.kategori!.id, ad: g.kategori!.ad })}>{t("Adı değiştir")}</button>
                    <button className="pk-btn tehlike" disabled={mesgul} onClick={() => kategoriSil(g.kategori!)}>{t("Sil")}</button>
                  </div>
                )}
              </>
            )}
          </div>
          <ul className="yon-liste">
            {g.kanallar.map((k) => (
              <li key={k.id} className={"yon-kanal" + (surukle?.id === k.id ? " surukleniyor" : "")} {...kanalSurukleProps(k)}>
                <span className="kanal-ad"><Ikon ad={k.tur === "sesli" ? "ses" : "hash"} boyut={16} /> {k.ad}{k.sifreli && <Ikon ad="kilit" boyut={14} />}</span>
                <div className="yon-eylemler">
                  <button className="cb-ibtn" aria-label={t(`${k.ad} kanalını yukarı taşı`)} disabled={mesgul} onClick={() => void sirala({ tur: "kanal-yukari", id: k.id })}>▲</button>
                  <button className="cb-ibtn" aria-label={t(`${k.ad} kanalını aşağı taşı`)} disabled={mesgul} onClick={() => void sirala({ tur: "kanal-asagi", id: k.id })}>▼</button>
                  <select aria-label={t(`${k.ad} kategorisi`)} value={k.kategori_id ?? ""} disabled={mesgul} onChange={(e) => kategoriDegistir(k, e.target.value)}>
                    <option value="">{t("Kategorisiz")}</option>
                    {kategoriler.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}
                  </select>
                  {k.tur === "yazili" && (
                    <select aria-label={t(`${k.ad} yavaş modu`)} value={k.yavas_mod ?? 0} disabled={mesgul} onChange={(e) => yavasModAyarla(k, Number(e.target.value))}>
                      {YAVAS_MOD_SECENEKLERI.map((s) => <option key={s.sn} value={s.sn}>{t("Yavaş mod")}: {s.etiket}</option>)}
                    </select>
                  )}
                  {sifreKanal === k.id ? (
                    <form className="yon-eylemler" onSubmit={(e) => { e.preventDefault(); sifreKaydet(k, sifre); }}>
                      <input type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} maxLength={40} placeholder={t("Yeni şifre")} aria-label={t(`${k.ad} için yeni şifre`)} autoComplete="new-password" />
                      <button className="pk-btn" type="submit" disabled={mesgul || sifre.length < 3}>{t("Kaydet")}</button>
                      <button className="pk-btn" type="button" onClick={() => { setSifreKanal(null); setSifre(""); }}>{t("Vazgeç")}</button>
                    </form>
                  ) : (
                    <>
                      <button className="pk-btn" disabled={mesgul} onClick={() => { setSifreKanal(k.id); setSifre(""); }}>{k.sifreli ? "Şifreyi değiştir" : "Şifre koy"}</button>
                      {k.sifreli && <button className="pk-btn" disabled={mesgul} onClick={() => sifreKaydet(k, "")}>{t("Şifreyi kaldır")}</button>}
                    </>
                  )}
                  <button className="pk-btn" aria-expanded={izinKanal === k.id} disabled={mesgul} onClick={() => setIzinKanal(izinKanal === k.id ? null : k.id)}>{t("İzinler")}</button>
                  <button className="pk-btn tehlike" disabled={mesgul} onClick={() => kanalSil(k)}>{t("Sil")}</button>
                </div>
                {izinKanal === k.id && <KanalIzinleri kanal={k} onBildir={(b) => void calistir(b.metin, async () => (b.ok ? null : b.metin))} />}
              </li>
            ))}
            {!g.kanallar.length && <li className="hint">{t("Bu grupta kanal yok.")}</li>}
          </ul>
        </section>
      ))}
    </div>
  );
}
