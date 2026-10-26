import { useState, useRef, useEffect } from "react";
import { t } from "../i18n";
import Ikon from "../mesaj/Ikon";

export type CekilisDurumu = {
  id: string;
  odul: string;
  baslatanId: string;
  baslatanAd: string;
  bitisZamani: number;
  katilimcilar: string[]; // uyeId listesi
  kazananId?: string | null;
  kazananAd?: string | null;
  bitti: boolean;
};

// [cekilis:{"id":"c1","odul":"Steam Kodu","baslatanId":"u1","baslatanAd":"Aras","bitisZamani":1700000000,"katilimcilar":["u1"],"kazananId":null,"kazananAd":null,"bitti":false}]
const CEKILIS_DESEN = /^\[cekilis:(.+)\]$/;

export function cekilisCoz(metin: string): CekilisDurumu | null {
  const m = metin.trim().match(CEKILIS_DESEN);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1]);
    if (obj && typeof obj.id === "string" && typeof obj.odul === "string") {
      return obj as CekilisDurumu;
    }
  } catch { /* yoksay */ }
  return null;
}

export function cekilisKodla(c: CekilisDurumu): string {
  return `[cekilis:${JSON.stringify(c)}]`;
}

type Props = {
  durum: CekilisDurumu;
  benId: string;
  benAd: string;
  onGuncelle: (yeni: CekilisDurumu) => void;
  uyeAdGetir: (uyeId: string) => string;
};

export function CekilisKart({ durum, benId, benAd, onGuncelle, uyeAdGetir }: Props) {
  const [kalanSn, setKalanSn] = useState(() => Math.max(0, Math.floor((durum.bitisZamani - Date.now()) / 1000)));
  const katildi = durum.katilimcilar.includes(benId);

  useEffect(() => {
    if (durum.bitti) return;
    const interval = setInterval(() => {
      const fark = Math.max(0, Math.floor((durum.bitisZamani - Date.now()) / 1000));
      setKalanSn(fark);
      if (fark <= 0 && !durum.bitti) {
        clearInterval(interval);
        // Kazananı belirle
        let secilenId: string | null = null;
        let secilenAd: string | null = null;
        if (durum.katilimcilar.length > 0) {
          const rastgeleIdx = Math.floor(Math.random() * durum.katilimcilar.length);
          secilenId = durum.katilimcilar[rastgeleIdx];
          secilenAd = uyeAdGetir(secilenId) || "Bir Katılımcı";
        }
        onGuncelle({
          ...durum,
          bitti: true,
          kazananId: secilenId,
          kazananAd: secilenAd,
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [durum, onGuncelle, uyeAdGetir]);

  function katilCik() {
    if (durum.bitti) return;
    const yeniKatilimcilar = katildi
      ? durum.katilimcilar.filter((id) => id !== benId)
      : [...durum.katilimcilar, benId];
    onGuncelle({
      ...durum,
      katilimcilar: yeniKatilimcilar,
    });
  }

  const dakika = Math.floor(kalanSn / 60);
  const saniye = kalanSn % 60;
  const zamanMetni = `${dakika}:${saniye < 10 ? "0" : ""}${saniye}`;

  return (
    <div
      className="cekilis-kart"
      style={{
        margin: "8px 0",
        maxWidth: 420,
        borderRadius: 14,
        background: "var(--card)",
        border: durum.bitti ? "1.5px solid var(--line)" : "1.5px solid #f59e0b",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: durum.bitti ? "none" : "0 4px 16px rgba(245, 158, 11, 0.15)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 24 }}>🎉</span>
          <b style={{ fontSize: 16 }}>{durum.odul}</b>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 8,
            background: durum.bitti ? "var(--girdi)" : "rgba(245, 158, 11, 0.2)",
            color: durum.bitti ? "var(--muted)" : "#f59e0b",
          }}
        >
          {durum.bitti ? t("SONA ERDİ") : `⏳ ${zamanMetni}`}
        </span>
      </div>

      <div style={{ fontSize: 13, color: "var(--muted)" }}>
        {t("Düzenleyen:")} <b>{durum.baslatanAd}</b> · {durum.katilimcilar.length} {t("katılımcı")}
      </div>

      {durum.bitti ? (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--secili-zemin)",
            border: "1px solid var(--acc)",
            textAlign: "center",
          }}
        >
          {durum.kazananAd ? (
            <div>
              🏆 {t("Kazanan:")} <b style={{ fontSize: 15, color: "var(--acc)" }}>{durum.kazananAd}</b> 🎉
            </div>
          ) : (
            <div style={{ color: "var(--muted)" }}>
              {t("Yeterli katılımcı olmadığı için kazanan belirlenemedi.")}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={"pk-btn" + (katildi ? " tehlike" : "")}
          onClick={katilCik}
          style={{ height: 40, fontWeight: 700, fontSize: 14 }}
        >
          {katildi ? `✓ ${t("Katıldın (Ayrıl)")}` : `🎉 ${t("Çekilişe Katıl")}`}
        </button>
      )}
    </div>
  );
}

export function yeniCekilisOlustur(odul: string, sureDk: number, baslatanId: string, baslatanAd: string): CekilisDurumu {
  return {
    id: `cekilis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    odul: odul.trim(),
    baslatanId,
    baslatanAd,
    bitisZamani: Date.now() + Math.max(1, sureDk) * 60 * 1000,
    katilimcilar: [baslatanId],
    bitti: false,
  };
}
