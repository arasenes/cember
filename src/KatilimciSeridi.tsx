import Avatar from "./Avatar";
import type { Uye } from "./types";
import { t } from "./i18n";

type Props = {
  katilimcilar: Uye[];
  konusanlar: Set<string>;
  sorunlu: Set<string>;
  paylasanlar: Set<string>;
  benimId: string;
  buradayim: boolean;
  baglaniyor: boolean;
  onKatil: () => void;
  onProfil: (id: string) => void;
};

// Sesli odanın üstündeki katılımcı şeridi: büyük avatarlar, konuşanın etrafında halka, paylaşanda 🖥️.
export default function KatilimciSeridi({ katilimcilar, konusanlar, sorunlu, paylasanlar, benimId, buradayim, baglaniyor, onKatil, onProfil }: Props) {
  return (
    <div className="serit" role="group" aria-label={t("Sesli odadaki katılımcılar")}>
      {katilimcilar.length === 0 && <div className="serit-bos">{t("Odada kimse yok")}</div>}
      {katilimcilar.map((u) => {
        const konusuyor = konusanlar.has(u.id);
        return (
          <button key={u.id} className={"karo" + (konusuyor ? " konusuyor" : "") + (paylasanlar.has(u.id) ? " paylasiyor" : "")}
            onClick={() => onProfil(u.id)} aria-label={t(`${u.takma_ad}${u.id === benimId ? " (sen)" : ""}${konusuyor ? ", konuşuyor" : ""}${paylasanlar.has(u.id) ? ", ekran paylaşıyor" : ""}${sorunlu.has(u.id) ? ", bağlantı sorunu" : ""}`)}>
            <Avatar uye={u} className="karo-av" />
            <span className="karo-ad">{u.id === benimId ? "Sen" : u.takma_ad}</span>
            {paylasanlar.has(u.id) && <span className="karo-rozet" aria-hidden="true">🖥️</span>}
            {sorunlu.has(u.id) && <span className="karo-rozet sorun" aria-hidden="true">⚠️</span>}
          </button>
        );
      })}
      {!buradayim && <button className="cta serit-katil" onClick={onKatil} disabled={baglaniyor}>{baglaniyor ? "Bağlanılıyor…" : "Katıl"}</button>}
    </div>
  );
}
