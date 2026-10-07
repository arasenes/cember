import { useState } from "react";
import { BildirimSatiri, rpcCagir, SayfaBasligi, useBildirim } from "./ortak";
import { t } from "../i18n";

type Props = { odaId: string; ad: string; varsayilan: boolean; onSilindi: () => void };

/** Sunucuyu sil: sahibe özel, adı yazarak onaylanır. İlk (varsayılan) sunucu silinemez. */
export default function SunucuSil({ odaId, ad, varsayilan, onSilindi }: Props) {
  const [yazi, setYazi] = useState("");
  const { bildirim, mesgul, calistir } = useBildirim();
  async function sil(e: React.FormEvent) {
    e.preventDefault();
    const ok = await calistir("Sunucu silindi.", async () => (await rpcCagir("sunucu_sil", { p_oda: odaId })).hata);
    if (ok) onSilindi();
  }
  return (
    <form className="ayar-form" onSubmit={sil}>
      <SayfaBasligi baslik="Sunucuyu sil" aciklama="Sunucu herkesten gizlenir; kanallar ve mesajlar erişilemez olur." />
      {varsayilan ? (
        <p className="hint">{t("Bu, varsayılan sunucu olduğu için silinemez.")}</p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="sunucu-sil-ad">{t("Onaylamak için sunucu adını yaz:")}{" "}<b>{ad}</b></label>
            <input id="sunucu-sil-ad" type="text" value={yazi} onChange={(e) => setYazi(e.target.value)} autoComplete="off" />
          </div>
          <button className="ib tehlike" type="submit" disabled={mesgul || yazi.trim() !== ad}>{t("Sunucuyu kalıcı olarak sil")}</button>
        </>
      )}
      <BildirimSatiri b={bildirim} />
    </form>
  );
}
