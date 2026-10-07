import { useCallback, useEffect, useRef, useState } from "react";
import { SUPABASE_KEY, SUPABASE_URL, supabase } from "./supabase";
import Avatar from "./Avatar";
import type { Kanal, Uye } from "./types";
import { rolEtiketi } from "./util";

type Yasak = { id: string; takma_ad: string; sebep: string | null; olusturma: string };
type Onay = { uyeId: string; islem: "at" | "ban" | "mesaj" };
type SesKonum = Map<string, { kanal: string }>;

export const SUSTURMA_SECENEKLERI: { dk: number; etiket: string }[] = [
  { dk: 10, etiket: "10 dakika" }, { dk: 60, etiket: "1 saat" }, { dk: 1440, etiket: "1 gün" }, { dk: 10080, etiket: "1 hafta" },
];

export function susturulmus(u: Pick<Uye, "susturma_bitis">, simdi = Date.now()): boolean {
  return !!u.susturma_bitis && new Date(u.susturma_bitis).getTime() > simdi;
}

/** Yönetici bu üyeye işlem yapabilir mi? (sahip herkese; moderatör yalnızca sıradan üyeye) */
export function islemYapabilir(ben: Pick<Uye, "id" | "rol">, hedef: Pick<Uye, "id" | "rol">): boolean {
  if (hedef.id === ben.id || hedef.rol === "sahip") return false;
  return ben.rol === "sahip" || (ben.rol === "moderator" && hedef.rol === "uye");
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

type Props = { ben: Uye; uyeler: Uye[]; kanallar: Kanal[]; sesKonum: SesKonum; cevrimici: Set<string>; onKapat: () => void };

export default function YonetimPaneli({ ben, uyeler, kanallar, sesKonum, cevrimici, onKapat }: Props) {
  const sahip = ben.rol === "sahip";
  const [bildirim, setBildirim] = useState<{ metin: string; hata: boolean } | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [onay, setOnay] = useState<Onay | null>(null);
  const [yasaklar, setYasaklar] = useState<Yasak[]>([]);
  const kutuRef = useRef<HTMLDivElement>(null);
  const [yeniAd, setYeniAd] = useState("");
  const [yeniTur, setYeniTur] = useState<"yazili" | "sesli">("yazili");
  const [yeniSifre, setYeniSifre] = useState("");
  const [sifreKanal, setSifreKanal] = useState<string | null>(null);
  const [duzenSifre, setDuzenSifre] = useState("");
  const [silKanal, setSilKanal] = useState<string | null>(null);
  const sesKanallari = kanallar.filter((k) => k.tur === "sesli");

  const yasaklariYukle = useCallback(async () => {
    if (!sahip) return;
    const { data } = await supabase.from("yasaklar").select("id, takma_ad, sebep, olusturma").eq("oda_id", ben.oda_id).order("olusturma", { ascending: false });
    if (data) setYasaklar(data as Yasak[]);
  }, [sahip, ben.oda_id]);
  useEffect(() => { void yasaklariYukle(); }, [yasaklariYukle]);

  useEffect(() => {
    const onceki = document.activeElement as HTMLElement | null;
    kutuRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { onceki?.focus?.(); };
  }, []);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape" && !mesgul) onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat, mesgul]);

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
  const at = (u: Uye, yasakla: boolean) => calistir(yasakla ? `${u.takma_ad} banlandı.` : `${u.takma_ad} odadan atıldı.`, async () => {
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
  const kanalAc = (e: React.FormEvent) => {
    e.preventDefault();
    const ad = yeniAd.trim();
    if (!ad) return;
    void calistir(`"${ad}" ${yeniTur === "sesli" ? "sesli odası" : "kanalı"} açıldı${yeniSifre ? " (şifreli)" : ""}.`, async () => {
      const h = await rpc("kanal_olustur", { p_ad: ad, p_tur: yeniTur, p_sifre: yeniSifre || null });
      if (!h) { setYeniAd(""); setYeniSifre(""); }
      return h;
    });
  };
  const sifreKaydet = (k: Kanal, sifre: string) => calistir(sifre ? `"${k.ad}" için şifre ayarlandı; herkes yeniden girmeli.` : `"${k.ad}" artık şifresiz.`, async () => {
    const h = await rpc("kanal_sifre_ayarla", { p_kanal: k.id, p_sifre: sifre });
    if (!h) { setSifreKanal(null); setDuzenSifre(""); }
    return h;
  });
  const kanalSil = (k: Kanal) => calistir(`"${k.ad}" silindi.`, () => rpc("kanal_sil", { p_kanal: k.id }));

  const liste = uyeler.filter((u) => u.id !== ben.id).sort((a, b) => a.takma_ad.localeCompare(b.takma_ad, "tr"));
  const onayMetni: Record<Onay["islem"], string> = {
    at: "Odadan atılsın mı? Mesajları da silinir; Google ya da misafir olarak tekrar girebilir.",
    ban: "Banlansın mı? Mesajları silinir; aynı takma ad veya aynı internet bağlantısıyla bu odaya giremez.",
    mesaj: "Tüm mesajları silinsin mi?",
  };

  return (
    <div className="modal-arka" onMouseDown={(e) => { if (e.target === e.currentTarget && !mesgul) onKapat(); }}>
      <div className="modal yonetim" role="dialog" aria-modal="true" aria-labelledby="yonetim-baslik" ref={kutuRef}>
        <div className="modal-ust">
          <h2 id="yonetim-baslik">🛡️ Yönetim</h2>
          <button className="lb-kapat modal-x" onClick={onKapat} aria-label="Kapat" disabled={mesgul}>✕</button>
        </div>
        <div className="hint">{sahip ? "Oda sahibi olarak üyeleri yönetebilirsin." : "Moderatör olarak kanal açabilir, şifre koyabilir; üyeleri atabilir, susturabilir, sesten çıkarabilir ve taşıyabilirsin."}</div>
        <div className={"yon-bildirim" + (bildirim?.hata ? " hata" : "")} role="status" aria-live="polite">{bildirim?.metin ?? ""}</div>

        <h3 className="yon-baslik">Kanallar ve odalar — {kanallar.length}</h3>
        <form className="kanal-form" onSubmit={kanalAc}>
          <input type="text" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} maxLength={40} placeholder="Yeni kanal adı" aria-label="Yeni kanal adı" disabled={mesgul} />
          <select value={yeniTur} onChange={(e) => setYeniTur(e.target.value as "yazili" | "sesli")} aria-label="Kanal türü" disabled={mesgul}>
            <option value="yazili"># Yazılı</option>
            <option value="sesli">🔊 Sesli</option>
          </select>
          <input type="password" value={yeniSifre} onChange={(e) => setYeniSifre(e.target.value)} maxLength={40} placeholder="Şifre (isteğe bağlı)" aria-label="Kanal şifresi (isteğe bağlı)" autoComplete="new-password" disabled={mesgul} />
          <button className="ib" type="submit" disabled={mesgul || !yeniAd.trim()}>Aç</button>
        </form>
        <ul className="yon-liste">
          {kanallar.map((k) => (
            <li key={k.id} className="yon-kanal">
              <span className="kanal-ad">{k.tur === "sesli" ? "🔊" : "#"} {k.ad}{k.sifreli && " 🔒"}</span>
              {sifreKanal === k.id ? (
                <form className="yon-eylemler" onSubmit={(e) => { e.preventDefault(); void sifreKaydet(k, duzenSifre); }}>
                  <input type="password" value={duzenSifre} onChange={(e) => setDuzenSifre(e.target.value)} maxLength={40} placeholder="Yeni şifre" aria-label={`${k.ad} için yeni şifre`} autoComplete="new-password" />
                  <button className="ib" type="submit" disabled={mesgul || duzenSifre.length < 3}>Kaydet</button>
                  <button className="ib" type="button" onClick={() => { setSifreKanal(null); setDuzenSifre(""); }}>Vazgeç</button>
                </form>
              ) : silKanal === k.id ? (
                <div className="yon-onay" role="alertdialog" aria-label="Onay">
                  <span>Kanal ve içindeki mesajlar silinsin mi?</span>
                  <div className="yon-eylemler">
                    <button className="ib tehlike" disabled={mesgul} onClick={() => void kanalSil(k)}>Evet, sil</button>
                    <button className="ib" onClick={() => setSilKanal(null)}>Vazgeç</button>
                  </div>
                </div>
              ) : (
                <div className="yon-eylemler">
                  <button className="ib" disabled={mesgul} onClick={() => { setSifreKanal(k.id); setDuzenSifre(""); }}>{k.sifreli ? "Şifreyi değiştir" : "Şifre koy"}</button>
                  {k.sifreli && <button className="ib" disabled={mesgul} onClick={() => void sifreKaydet(k, "")}>Şifreyi kaldır</button>}
                  {sahip && <button className="ib tehlike" disabled={mesgul} onClick={() => setSilKanal(k.id)}>Sil</button>}
                </div>
              )}
            </li>
          ))}
        </ul>

        <h3 className="yon-baslik">Üyeler — {liste.length}</h3>
        {liste.length === 0 && <div className="hint">Odada başka kimse yok.</div>}
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
                      {sesAd && ` · 🔊 ${sesAd}`}
                      {sus && ` · 🔇 ${new Date(u.susturma_bitis!).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}'e kadar susturulmuş`}
                    </small>
                  </div>
                </div>
                {yapabilir && !buOnay && (
                  <div className="yon-eylemler">
                    <select aria-label={`${u.takma_ad} kişisini sustur`} value="" disabled={mesgul}
                      onChange={(e) => { const dk = Number(e.target.value); if (!Number.isNaN(dk)) void sustur(u, dk); }}>
                      <option value="" disabled>Sustur…</option>
                      {SUSTURMA_SECENEKLERI.map((s) => <option key={s.dk} value={s.dk}>{s.etiket}</option>)}
                      {sus && <option value={0}>Susturmayı kaldır</option>}
                    </select>
                    <button className="ib" disabled={mesgul} onClick={() => setOnay({ uyeId: u.id, islem: "mesaj" })}>Mesajlarını sil</button>
                    {sesKanal && (
                      <>
                        <button className="ib" disabled={mesgul} onClick={() => void sesIslem(u, "at")}>Sesten at</button>
                        {sesKanallari.length > 1 && (
                          <select aria-label={`${u.takma_ad} kişisini başka sesli odaya taşı`} value="" disabled={mesgul}
                            onChange={(e) => { const k = sesKanallari.find((x) => x.id === e.target.value); if (k) void sesIslem(u, "tasi", k); }}>
                            <option value="" disabled>Taşı…</option>
                            {sesKanallari.filter((k) => k.id !== sesKanal).map((k) => <option key={k.id} value={k.id}>🔊 {k.ad}</option>)}
                          </select>
                        )}
                      </>
                    )}
                    {sahip && (
                      <button className="ib" disabled={mesgul} onClick={() => void rolVer(u, u.rol !== "moderator")}>
                        {u.rol === "moderator" ? "Moderatörlüğü al" : "Moderatör yap"}
                      </button>
                    )}
                    <button className="ib tehlike" disabled={mesgul} onClick={() => setOnay({ uyeId: u.id, islem: "at" })}>At</button>
                    {sahip && <button className="ib tehlike" disabled={mesgul} onClick={() => setOnay({ uyeId: u.id, islem: "ban" })}>Banla</button>}
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

        {sahip && (
          <>
            <h3 className="yon-baslik">Banlananlar — {yasaklar.length}</h3>
            {yasaklar.length === 0 && <div className="hint">Kimse banlı değil.</div>}
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
    </div>
  );
}
