import { useCallback, useEffect, useState } from "react";
import { supabase, SUPABASE_URL } from "./supabase";
import Gate from "./Gate";
import Chat from "./Chat";
import KayitAdi from "./KayitAdi";
import { googleKullanicisi } from "./google";
import UygulamayaDon from "./UygulamayaDon";
import { adrestenDavetAl, bekleyenDavet, davetiUnut, seciliSunucuOku, seciliSunucuYaz, sunuculariGetir, sunucuSec, type Sunucu } from "./sunucu/sunucular";
import { t } from "./i18n";

export default function App() {
  const [durum, setDurum] = useState<"yukleniyor" | "giris" | "kayit" | "sohbet">("yukleniyor");
  const [sunucular, setSunucular] = useState<Sunucu[]>([]);
  const [secili, setSecili] = useState<string | null>(seciliSunucuOku);
  const [adOnerisi, setAdOnerisi] = useState("");
  const [davetNotu, setDavetNotu] = useState("");
  // Davet takma ad çakışması yüzünden tamamlanamadıysa kullanıcıdan başka ad istenir
  const [adGerekli, setAdGerekli] = useState<{ kod: string; mesaj: string } | null>(null);
  const [yeniAd, setYeniAd] = useState("");

  const yukle = useCallback(async (hedefOda?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSunucular([]); return setDurum("giris"); }
    let liste = await sunuculariGetir(session.user.id);
    if (!liste.length) {
      // Google ile gelen ama henüz hiçbir sunucuda kaydı olmayan kişi takma ad seçer; diğerleri girişe döner
      if (googleKullanicisi(session.user)) { setSunucular([]); setAdOnerisi(String(session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? "").split(" ")[0]); return setDurum("kayit"); }
      await supabase.auth.signOut({ scope: "local" }); setSunucular([]); return setDurum("giris");
    }
    let git = hedefOda ?? null;
    // Bekleyen davet (adres çubuğundan geldi, giriş sonrası işlenir)
    const kod = bekleyenDavet();
    if (kod) {
      if (liste.some((s) => s.ben.misafir)) {
        davetiUnut();
        setDavetNotu("Misafir hesaplar davetle katılamaz. Çıkış yapıp Google ile giriş yaparsan davete katılabilirsin.");
      } else {
        const { data, error } = await supabase.rpc("davet_katil", { p_kod: kod, p_takma_ad: null });
        if (error) {
          if (/takma ad/i.test(error.message)) { setYeniAd(""); setAdGerekli({ kod, mesaj: error.message }); }
          else { davetiUnut(); setDavetNotu(error.message); }
        } else {
          davetiUnut();
          liste = await sunuculariGetir(session.user.id);
          git = data as string;
          setDavetNotu(`"${liste.find((s) => s.oda_id === git)?.ad ?? "Sunucu"}" sunucusuna katıldın.`);
        }
      }
    }
    setSunucular(liste);
    const s = sunucuSec(liste, git ?? secili);
    if (s) { setSecili(s.oda_id); seciliSunucuYaz(s.oda_id); }
    setDurum("sohbet");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { adrestenDavetAl(); void yukle(); }, [yukle]);

  async function adlaKatil(e: React.FormEvent) {
    e.preventDefault();
    if (!adGerekli) return;
    const { data, error } = await supabase.rpc("davet_katil", { p_kod: adGerekli.kod, p_takma_ad: yeniAd.trim() });
    if (error) return setAdGerekli({ kod: adGerekli.kod, mesaj: error.message });
    davetiUnut(); setAdGerekli(null);
    await yukle(data as string);
  }

  if (!SUPABASE_URL) return <main className="gate-wrap"><p className="empty">{t("VITE_SUPABASE_URL tanımlı değil. .env.example dosyasına bak.")}</p></main>;
  if (durum === "yukleniyor") return <main className="gate-wrap"><p className="empty">{t("Yükleniyor…")}</p></main>;
  const don = <UygulamayaDon />;
  if (durum === "kayit") return <>{don}<KayitAdi onBitti={() => void yukle()} varsayilan={adOnerisi} /></>;
  const aktif = sunucular.find((s) => s.oda_id === secili) ?? sunucular[0];
  if (durum === "giris" || !aktif) return <>{don}<Gate onJoined={() => void yukle()} /></>;
  return (
    <>
      {don}
      {davetNotu && <div className="davet-notu" role="status">{davetNotu} <button type="button" className="linkbtn" onClick={() => setDavetNotu("")}>{t("Kapat")}</button></div>}
      {adGerekli && (
        <div className="modal-arka">
          <form className="modal" role="dialog" aria-modal="true" aria-labelledby="davet-ad-baslik" onSubmit={adlaKatil}>
            <h2 id="davet-ad-baslik">{t("Takma adını seç")}</h2>
            <p className="hint">{adGerekli.mesaj}</p>
            <div className="field">
              <label htmlFor="davet-yeni-ad">{t("Bu sunucudaki takma adın")}</label>
              <input id="davet-yeni-ad" type="text" value={yeniAd} maxLength={24} autoFocus onChange={(e) => setYeniAd(e.target.value)} />
            </div>
            <div className="modal-alt">
              <button type="button" className="linkbtn" onClick={() => { davetiUnut(); setAdGerekli(null); }}>{t("Vazgeç")}</button>
              <button type="submit" className="cta" disabled={yeniAd.trim().length < 2}>{t("Katıl")}</button>
            </div>
          </form>
        </div>
      )}
      <Chat key={aktif.oda_id} me={aktif.ben} sunucular={sunucular}
        onSunucuSec={(id) => { setSecili(id); seciliSunucuYaz(id); }}
        onSunucularYenile={(git) => void yukle(git)}
        onExit={() => { setSunucular([]); setDurum("giris"); }} />
    </>
  );
}
