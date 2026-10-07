import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import type { Uye } from "../types";
import { IZIN_SATIRLARI, IZIN_TUMU, izinAc, izinVar, VARSAYILAN_HERKES, VARSAYILAN_MODERATOR } from "../sunucu/izin";
import { BildirimSatiri, RENK_PALETI, rpcCagir, SayfaBasligi, useBildirim } from "./ortak";
import { t } from "../i18n";

export type Rol = { id: string; ad: string; renk: string; izinler: number; sira: number };
type Secim = { tur: "sahip" | "moderator" | "herkes" } | { tur: "ozel"; id: string };
type UyeRolu = { uye_id: string; rol_id: string };

type Props = { odaId: string; uyeler: Uye[]; sahipMi: boolean };

/** İzin anahtarı (tasarımdaki .sw): düğme olarak erişilebilir. */
function IzinSatiri({ ad, aciklama, acik, kilitli, onDegis }: { ad: string; aciklama: string; acik: boolean; kilitli: boolean; onDegis: (v: boolean) => void }) {
  return (
    <div className="izin">
      <div>{ad}<small>{aciklama}</small></div>
      <button type="button" role="switch" aria-checked={acik} aria-label={ad} disabled={kilitli} className={"sw" + (acik ? " on" : "")} onClick={() => onDegis(!acik)} />
    </div>
  );
}

export default function RollerIzinler({ odaId, uyeler, sahipMi }: Props) {
  const [roller, setRoller] = useState<Rol[]>([]);
  const [atamalar, setAtamalar] = useState<UyeRolu[]>([]);
  const [herkesIzin, setHerkesIzin] = useState(VARSAYILAN_HERKES);
  const [moderatorIzin, setModeratorIzin] = useState(VARSAYILAN_MODERATOR);
  const [secim, setSecim] = useState<Secim>({ tur: "herkes" });
  const [ad, setAd] = useState("");
  const [renk, setRenk] = useState("#9aa3b5");
  const [izin, setIzin] = useState(VARSAYILAN_HERKES);
  const { bildirim, mesgul, calistir } = useBildirim();
  const aktifUyeler = useMemo(() => uyeler.filter((u) => !u.silindi && !u.bot), [uyeler]);

  const yukle = useCallback(async () => {
    const [r, a, o] = await Promise.all([
      supabase.from("roller").select("*").eq("oda_id", odaId).order("sira"),
      supabase.from("uye_rolleri").select("uye_id, rol_id"),
      supabase.from("odalar").select("herkes_izin, moderator_izin").eq("id", odaId).maybeSingle(),
    ]);
    if (r.data) setRoller(r.data as Rol[]);
    if (a.data) setAtamalar(a.data as UyeRolu[]);
    if (o.data) { const d = o.data as { herkes_izin: number; moderator_izin: number }; setHerkesIzin(d.herkes_izin); setModeratorIzin(d.moderator_izin); }
  }, [odaId]);
  useEffect(() => { void yukle(); }, [yukle]);

  const ozel = secim.tur === "ozel" ? roller.find((r) => r.id === secim.id) : undefined;
  // Seçim değişince editör alanları doldurulur
  useEffect(() => {
    if (secim.tur === "sahip") { setAd("Sahip"); setIzin(IZIN_TUMU); }
    else if (secim.tur === "moderator") { setAd("Moderatör"); setIzin(moderatorIzin); }
    else if (secim.tur === "herkes") { setAd("Herkes"); setIzin(herkesIzin); }
    else if (ozel) { setAd(ozel.ad); setRenk(ozel.renk); setIzin(ozel.izinler); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secim.tur, ozel?.id, ozel?.ad, ozel?.renk, ozel?.izinler, herkesIzin, moderatorIzin]);

  const sayi = (s: Secim): number => {
    if (s.tur === "sahip") return aktifUyeler.filter((u) => u.rol === "sahip").length;
    if (s.tur === "moderator") return aktifUyeler.filter((u) => u.rol === "moderator").length;
    if (s.tur === "herkes") return aktifUyeler.length;
    return "id" in s ? atamalar.filter((a) => a.rol_id === s.id).length : 0;
  };

  const sistem = secim.tur !== "ozel";
  const kilitli = !sahipMi || secim.tur === "sahip";
  const orijinalIzin = secim.tur === "herkes" ? herkesIzin : secim.tur === "moderator" ? moderatorIzin : ozel?.izinler ?? 0;
  const degisti = secim.tur !== "sahip" && (izin !== orijinalIzin || (secim.tur === "ozel" && (ad.trim() !== ozel?.ad || renk !== ozel?.renk)));

  async function olustur() {
    let yeni = "";
    const ok = await calistir("Rol oluşturuldu.", async () => {
      const r = await rpcCagir("rol_olustur", { p_oda: odaId, p_ad: "Yeni rol", p_renk: RENK_PALETI[roller.length % RENK_PALETI.length], p_izinler: VARSAYILAN_HERKES });
      if (!r.hata) yeni = String(r.veri);
      return r.hata;
    });
    if (ok) { await yukle(); if (yeni) setSecim({ tur: "ozel", id: yeni }); }
  }
  async function kaydet() {
    const ok = await calistir("Kaydedildi.", async () => {
      if (secim.tur === "ozel" && ozel) return (await rpcCagir("rol_guncelle", { p_rol: ozel.id, p_ad: ad.trim(), p_renk: renk, p_izinler: izin })).hata;
      if (secim.tur === "herkes" || secim.tur === "moderator") return (await rpcCagir("temel_izin_ayarla", { p_oda: odaId, p_tur: secim.tur, p_izinler: izin })).hata;
      return null;
    });
    if (ok) await yukle();
  }
  async function sil() {
    if (!ozel || !confirm(`"${ozel.ad}" rolü silinsin mi? Bu role sahip üyeler rolü kaybeder.`)) return;
    const ok = await calistir("Rol silindi.", async () => (await rpcCagir("rol_sil", { p_rol: ozel.id })).hata);
    if (ok) { setSecim({ tur: "herkes" }); await yukle(); }
  }
  async function ata(u: Uye, ver: boolean) {
    await calistir(ver ? `${u.takma_ad} kişisine rol verildi.` : `${u.takma_ad} kişisinden rol alındı.`, async () => {
      const r = secim.tur === "ozel"
        ? await rpcCagir("rol_ata", { p_uye: u.id, p_rol: secim.id, p_ver: ver })
        : await rpcCagir("yonet_rol", { p_uye: u.id, p_moderator: ver });
      if (!r.hata) await yukle();
      return r.hata;
    });
  }

  const liste: { s: Secim; ad: string; renk: string }[] = [
    { s: { tur: "sahip" }, ad: "Sahip", renk: "var(--bahsetme)" },
    { s: { tur: "moderator" }, ad: "Moderatör", renk: "var(--mavi)" },
    ...roller.map((r) => ({ s: { tur: "ozel", id: r.id } as Secim, ad: r.ad, renk: r.renk })),
    { s: { tur: "herkes" }, ad: "Herkes", renk: "var(--soluk)" },
  ];
  const secili = (s: Secim) => s.tur === secim.tur && (s.tur !== "ozel" || (secim.tur === "ozel" && s.id === secim.id));

  return (
    <div className="ayar-form roller-sayfa">
      <SayfaBasligi baslik="Roller ve izinler" aciklama="Her role renk ver, ne yapabileceğini seç. Etkin izin: Herkes + (moderatörse) Moderatör + atanmış rollerin toplamıdır." />
      <div className="roller-govde">
        <div className="roller-liste">
          {sahipMi && <button type="button" className="cta" onClick={() => void olustur()} disabled={mesgul}>{t("+ Rol oluştur")}</button>}
          {liste.map((r) => (
            <button key={r.s.tur + ("id" in r.s ? r.s.id : "")} type="button" aria-pressed={secili(r.s)} className={"rol-satir" + (secili(r.s) ? " acik" : "")} onClick={() => setSecim(r.s)}>
              <span className="rol-nokta" style={{ background: r.renk }} aria-hidden="true" />{r.ad}<small>{sayi(r.s)}</small>
            </button>
          ))}
        </div>
        <div className="kart roller-editor">
          <div className="roller-ust">
            <div className="field">
              <label htmlFor="rol-ad">{t("Rol adı")}</label>
              <input id="rol-ad" type="text" value={ad} maxLength={30} disabled={kilitli || sistem} onChange={(e) => setAd(e.target.value)} />
            </div>
            {secim.tur === "ozel" && (
              <div className="field">
                <span className="alan-etiket" id="rol-renk-et">{t("Renk")}</span>
                <div className="renk-secici" role="radiogroup" aria-labelledby="rol-renk-et">
                  {RENK_PALETI.slice(0, 8).map((r) => <button key={r} type="button" role="radio" aria-checked={renk === r} aria-label={`Renk ${r}`} className="renk-nokta" style={{ background: r }} disabled={kilitli} onClick={() => setRenk(r)} />)}
                </div>
              </div>
            )}
          </div>
          {IZIN_SATIRLARI.map((s) => (
            <IzinSatiri key={s.bit} ad={s.ad} aciklama={s.aciklama} acik={izinVar(izin, s.bit)} kilitli={kilitli} onDegis={(v) => setIzin((m) => izinAc(m, s.bit, v))} />
          ))}
          <BildirimSatiri b={bildirim} />
          {sahipMi && secim.tur !== "sahip" && (
            <div className="roller-alt">
              <button type="button" className="cta" disabled={mesgul || !degisti || (secim.tur === "ozel" && ad.trim().length < 1)} onClick={() => void kaydet()}>{t("Kaydet")}</button>
              {secim.tur === "ozel" && <button type="button" className="ib tehlike" disabled={mesgul} onClick={() => void sil()}>{t("Rolü sil")}</button>}
            </div>
          )}
          {sahipMi && (secim.tur === "ozel" || secim.tur === "moderator") && (
            <div className="roller-uyeler">
              <h2 className="yon-baslik">{t("Bu role sahip olanlar")}</h2>
              <ul className="yon-liste">
                {aktifUyeler.filter((u) => u.rol !== "sahip").map((u) => {
                  const var_ = secim.tur === "ozel" ? atamalar.some((a) => a.uye_id === u.id && a.rol_id === secim.id) : u.rol === "moderator";
                  return (
                    <li key={u.id} className="yon-uye">
                      <label className="onay-satir"><input type="checkbox" checked={var_} disabled={mesgul} onChange={(e) => void ata(u, e.target.checked)} /> {u.takma_ad}</label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
