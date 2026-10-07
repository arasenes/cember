import Avatar from "../Avatar";
import type { Uye } from "../types";
import { DURUM_BILGI, rolEtiketi } from "../util";
import type { Iliski } from "./tipler";
import { t } from "../i18n";

type Props = {
  uye?: Uye;
  benimMi: boolean;
  cevrimici: boolean;
  bosta?: boolean;
  iliski: Iliski;
  /** Kartta gösterilecek "Mesaj gönder" düğmesi (zaten o DM'deysek verilmez). */
  onMesaj?: () => void;
  onArkadasEkle: () => void;
  onArkadasSil: () => void;
  onEngelle: () => void;
  onEngelKaldir: () => void;
  onProfil?: () => void;
};

export function durumMetni(uye: Uye, cevrimici: boolean, bosta?: boolean): string {
  if (!cevrimici) return "Çevrimdışı";
  if (uye.durum && uye.durum !== "cevrimici") return DURUM_BILGI[uye.durum].ad;
  return bosta ? "Boşta" : "Çevrimiçi";
}

/** DM yanındaki profil kartı: banner, rozetler, hakkında, ortak sunucu ve arkadaşlık/engel işlemleri. */
export default function ProfilKarti({ uye, benimMi, cevrimici, bosta, iliski, onMesaj, onArkadasEkle, onArkadasSil, onEngelle, onEngelKaldir, onProfil }: Props) {
  if (!uye) return <aside className="profil-karti" aria-label={t("Profil")}><p className="hint">{t("Kişi bilgisi yok.")}</p></aside>;
  const silindi = !!uye.silindi;
  return (
    <aside className="profil-karti" aria-label={`${uye.takma_ad} profili`}>
      <div className="pk-banner" style={{ background: `linear-gradient(135deg, ${uye.renk}, color-mix(in srgb, ${uye.renk} 40%, #0f1116))` }} aria-hidden="true" />
      <div className="pk-avatar"><Avatar uye={uye} className="pk-dot" /></div>
      <div className="pk-govde">
        <h2 className="pk-ad" style={{ color: "inherit" }}>{silindi ? "Silinmiş üye" : uye.takma_ad}</h2>
        {!silindi && (
          <p className="pk-durum"><span className="durum-nokta" data-durum={!cevrimici ? "cevrimdisi" : bosta ? "bosta" : (uye.durum ?? "cevrimici")} aria-hidden="true" /> {durumMetni(uye, cevrimici, bosta)}</p>
        )}
        {uye.durum_metin && !silindi && <p className="pk-metin">“{uye.durum_metin}”</p>}
        {!silindi && (
          <ul className="pk-rozetler" aria-label={t("Rozetler")}>
            <li className={"pk-rozet rol-" + uye.rol}>{rolEtiketi(uye.rol)}</li>
            {uye.misafir && <li className="pk-misafir">{t("Misafir")}</li>}
          </ul>
        )}
        {uye.hakkinda && !silindi && (<><h3 className="pk-baslik">{t("Hakkında")}</h3><p className="pk-hakkinda">{uye.hakkinda}</p></>)}
        {!silindi && (<><h3 className="pk-baslik">{t("Ortak sunucular")}</h3><ul className="pk-sunucular" aria-label={t("Ortak sunucular")}><li title={t("Çember")} className="pk-sunucu">Ç</li></ul></>)}
        {!benimMi && !silindi && (
          <div className="pk-eylemler">
            {onMesaj && iliski !== "engelli" && <button type="button" className="cta" onClick={onMesaj}>{t("Mesaj gönder")}</button>}
            {iliski === "yok" && <button type="button" className="pk-btn" onClick={onArkadasEkle}>{t("Arkadaş ekle")}</button>}
            {iliski === "giden" && <button type="button" className="pk-btn" onClick={onArkadasSil}>{t("İsteği geri al")}</button>}
            {iliski === "gelen" && <button type="button" className="pk-btn" onClick={onArkadasEkle}>{t("İsteği kabul et")}</button>}
            {iliski === "arkadas" && <button type="button" className="pk-btn" onClick={onArkadasSil}>{t("Arkadaşlıktan çıkar")}</button>}
            {iliski === "engelli"
              ? <button type="button" className="pk-btn" onClick={onEngelKaldir}>{t("Engeli kaldır")}</button>
              : <button type="button" className="pk-btn tehlike" onClick={onEngelle}>{t("Engelle")}</button>}
            {onProfil && <button type="button" className="linkbtn" onClick={onProfil}>{t("Tam profili aç")}</button>}
          </div>
        )}
      </div>
    </aside>
  );
}
