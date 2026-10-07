import { useCallback, useEffect, useState } from "react";
import { SUPABASE_KEY, SUPABASE_URL, supabase } from "./supabase";
import Avatar from "./Avatar";
import type { Kanal, Uye } from "./types";
import { rolEtiketi } from "./util";
import { IZIN, izinVar } from "./sunucu/izin";

type Yasak = { id: string; takma_ad: string; sebep: string | null; olusturma: string };
type Onay = { uyeId: string; islem: "at" | "ban" | "mesaj" };
type SesKonum = Map<string, { kanal: string }>;

export const SUSTURMA_SECENEKLERI: { dk: number; etiket: string }[] = [
  { dk: 10, etiket: "10 dakika" }, { dk: 60, etiket: "1 saat" }, { dk: 1440, etiket: "1 gün" }, { dk: 10080, etiket: "1 hafta" },
];

export function susturulmus(u: Pick<Uye, "susturma_bitis">, simdi = Date.now()): boolean {
  return !!u.susturma_bitis && new Date(u.susturma_bitis).getTime() > simdi;
}

/** Yönetici bu üyeye işlem yapabilir mi? (sahip herkese; diğerleri yalnızca sıradan üyeye, sahibe hiç) */
export function islemYapabilir(ben: Pick<Uye, "id" | "rol">, hedef: Pick<Uye, "id" | "rol">): boolean {
  if (hedef.id === ben.id || hedef.rol === "sahip") return false;
  return ben.rol === "sahip" || hedef.rol === "uye";
}

export async function yonetCagir(govde: Record<string, unknown>): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/yonet`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify(govde),
    });
    if (r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return j.hata ?? "İşlem yapılamadı.";
  } catch {
    return "Bağlantı hatası. İnternetini kontrol edip tekrar dene.";
  }
}

type Props = { ben: Uye; uyeler: Uye[]; kanallar: Kanal[]; sesKonum: SesKonum; cevrimici: Set<string>; izin: number };

/** Üye moderasyonu: susturma (zaman aşımı), mesajları silme, sesten atma/taşıma, atma, yasaklama ve yasak listesi. Butonlar izne göre görünür. */
export default function YonetimPaneli({ ben, uyeler, kanallar, sesKonum, cevrimici, izin }: Props) {
  const sahip = ben.rol === "sahip";
  const susturabilir = izinVar(izin, IZIN.SUSTUR);
  const yasaklayabilir = izinVar(izin, IZIN.YASAKLA);
  const mesajYonetebilir = izinVar(izin, IZIN.MESAJ_YONET);
  const [bildirim, setBildirim] = useState<{ metin: string; hata: boolean } | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [onay, setOnay] = useState<Onay | null>(null);
  const [yasaklar, setYasaklar] = useState<Yasak[]>([]);
  const sesKanallari = kanallar.filter((k) => k.tur === "sesli");

  const yasaklariYukle = useCallback(async () => {
    if (!yasaklayabilir) return;
    const { data } = await supabase.from("yasaklar").select("id, takma_ad, sebep, olusturma").eq("oda_id", ben.oda_id).order("olusturma", { ascending: false });
    if (data) setYasaklar(data as Yasak[]);
  }, [yasaklayabilir, ben.oda_id]);
  useEffect(() => { void yasaklariYukle(); }, [yasaklariYukle]);

  async function calistir(basari: string, is: () => Promise<string | null>) {
    setMesgul(true); setBildirim(null); setOnay(null);
    try {
      const hata = await is();
      setBildirim(hata ? { metin: hata, hata: true } : { metin: basari, hata: false });
    } finally {
      setMesgul(false);
    }
  }
  const rpc = async (ad: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(ad, args);
    return error ? (error.message || "İşlem yapılamadı.") : null;
  };

  const sustur = (u: Uye, dk: number) => calistir(dk > 0 ? `${u.takma_ad} susturuldu.` : `${u.takma_ad} artık yazabilir.`, () => rpc("yonet_sustur", { p_uye: u.id, p_dakika: dk }));
  const mesajlariSil = (u: Uye) => calistir(`${u.takma_ad} kişisinin mesajları silindi.`, () => rpc("yonet_mesajlari_sil", { p_uye: u.id }));
  const rolVer = (u: Uye, mod: boolean) => calistir(mod ? `${u.takma_ad} artık moderatör.` : `${u.takma_ad} moderatörlükten alındı.`, () => rpc("yonet_rol", { p_uye: u.id, p_moderator: mod }));
  const at = (u: Uye, yasakla: boolean) => calistir(yasakla ? `${u.takma_ad} yasaklandı.` : `${u.takma_ad} sunucudan atıldı.`, async () => {
    const h = await yonetCagir({ islem: "at", uye_id: u.id, yasakla });
    if (!h) await yasaklariYukle();
    return h;
  });
  const sesIslem = (u: Uye, tur: "at" | "tasi", kanal?: Kanal) => calistir(tur === "at" ? `${u.takma_ad} sesli odadan çıkarıldı.` : `${u.takma_ad} "${kanal?.ad}" odasına taşındı.`,
    () => yonetCagir({ islem: "ses", uye_id: u.id, tur, kanal_id: kanal?.id }));
  const yasagiKaldir = (y: Yasak) => calistir(`${y.takma_ad} için yasak kaldırıldı.`, async () => {
    const h = await yonetCagir({ islem: "yasak-kaldir", yasak_id: y.id });
    if (!h) setYasaklar((x) => x.filter((z) => z.id !== y.id));
    return h;
  });

  const liste = uyeler.filter((u) => u.id !== ben.id && !u.silindi && !u.bot).sort((a, b) => a.takma_ad.localeCompare(b.takma_ad, "tr"));
  const onayMetni: Record<Onay["islem"], string> = {
    at: "Sunucudan atılsın mı? Mesajları da silinir; Google ya da misafir olarak tekrar girebilir.",
    ban: "Yasaklansın mı? Mesajları silinir; aynı takma ad veya aynı internet bağlantısıyla bu sunucuya giremez.",
    mesaj: "Tüm mesajları silinsin mi?",
  };

  return (
    <div className="ayar-sayfa-ic">
      <div className={"yon-bildirim" + (bildirim?.hata ? " hata" : "")} role="status" aria-live="polite">{bildirim?.metin ?? ""}</div>
      <h3 className="yon-baslik">Üyeler — {liste.length}</h3>
      {liste.length === 0 && <div className="hint">Sunucuda başka kimse yok.</div>}
      <ul className="yon-liste">
        {liste.map((u) => {
          const yapabilir = islemYapabilir(ben, u);
          const sesKanal = sesKonum.get(u.id)?.kanal;
          const sesAd = sesKanal ? kanallar.find((k) => k.id === sesKanal)?.ad : undefined;
          const sus = susturulmus(u);
          const buOnay = onay?.uyeId === u.id ? onay.islem : null;
          return (
            <li key={u.id} className="yon-uye">
              <div className="yon-kimlik">
                <Avatar uye={u}>{cevrimici.has(u.id) && <span className="on-dot" />}</Avatar>
                <div className="mem-ad">
                  <b>{u.takma_ad}</b>
                  <small>
                    {rolEtiketi(u.rol)}
                    {sesAd && ` · sesli: ${sesAd}`}
                    {sus && ` · ${new Date(u.susturma_bitis!).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}'e kadar susturulmuş`}
                  </small>
                </div>
              </div>
              {yapabilir && !buOnay && (
                <div className="yon-eylemler">
                  {susturabilir && (
                    <select aria-label={`${u.takma_ad} kişisini sustur`} value="" disabled={mesgul}
                      onChange={(e) => { const dk = Number(e.target.value); if (!Number.isNaN(dk)) void sustur(u, dk); }}>
                      <option value="" disabled>Sustur…</option>
                      {SUSTURMA_SECENEKLERI.map((s) => <option key={s.dk} value={s.dk}>{s.etiket}</option>)}
                      {sus && <option value={0}>Susturmayı kaldır</option>}
                    </select>
                  )}
                  {mesajYonetebilir && <button className="ib" disabled={mesgul} onClick={() => setOnay({ uyeId: u.id, islem: "mesaj" })}>Mesajlarını sil</button>}
                  {susturabilir && sesKanal && (
                    <>
                      <button className="ib" disabled={mesgul} onClick={() => void sesIslem(u, "at")}>Sesten at</button>
                      {sesKanallari.length > 1 && (
                        <select aria-label={`${u.takma_ad} kişisini başka sesli odaya taşı`} value="" disabled={mesgul}
                          onChange={(e) => { const k = sesKanallari.find((x) => x.id === e.target.value); if (k) void sesIslem(u, "tasi", k); }}>
                          <option value="" disabled>Taşı…</option>
                          {sesKanallari.filter((k) => k.id !== sesKanal).map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
                        </select>
                      )}
                    </>
                  )}
                  {sahip && (
                    <button className="ib" disabled={mesgul} onClick={() => void rolVer(u, u.rol !== "moderator")}>
                      {u.rol === "moderator" ? "Moderatörlüğü al" : "Moderatör yap"}
                    </button>
                  )}
                  {susturabilir && <button className="ib tehlike" disabled={mesgul} onClick={() => setOnay({ uyeId: u.id, islem: "at" })}>At</button>}
                  {yasaklayabilir && <button className="ib tehlike" disabled={mesgul} onClick={() => setOnay({ uyeId: u.id, islem: "ban" })}>Yasakla</button>}
                </div>
              )}
              {yapabilir && buOnay && (
                <div className="yon-onay" role="alertdialog" aria-label="Onay">
                  <span>{onayMetni[buOnay]}</span>
                  <div className="yon-eylemler">
                    <button className="ib tehlike" disabled={mesgul}
                      onClick={() => void (buOnay === "mesaj" ? mesajlariSil(u) : at(u, buOnay === "ban"))}>Evet</button>
                    <button className="ib" disabled={mesgul} onClick={() => setOnay(null)}>Vazgeç</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {yasaklayabilir && (
        <>
          <h3 className="yon-baslik">Yasaklananlar — {yasaklar.length}</h3>
          {yasaklar.length === 0 && <div className="hint">Kimse yasaklı değil.</div>}
          <ul className="yon-liste">
            {yasaklar.map((y) => (
              <li key={y.id} className="yon-uye yon-yasak">
                <div className="mem-ad"><b>{y.takma_ad}</b><small>{new Date(y.olusturma).toLocaleDateString("tr-TR")}{y.sebep ? ` · ${y.sebep}` : ""}</small></div>
                <button className="ib" disabled={mesgul} onClick={() => void yasagiKaldir(y)} aria-label={`${y.takma_ad} yasağını kaldır`}>Yasağı kaldır</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
