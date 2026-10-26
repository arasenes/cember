import { useEffect, useRef } from "react";
import { liderlikTablosuGetir } from "./seviye";
import { t } from "../i18n";
import Ikon from "../mesaj/Ikon";

type Props = {
  benId: string;
  onKapat: () => void;
  onProfil?: (uyeId: string) => void;
};

export default function LiderlikTablosuDialog({ benId, onKapat, onProfil }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const liste = liderlikTablosuGetir();

  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKapat();
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  return (
    <div className="perde" onClick={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <div
        ref={dialogRef}
        className="dialog liderlik-dialog"
        role="dialog"
        aria-label={t("Sunucu Liderlik Tablosu")}
        style={{ maxWidth: 540, width: "95%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
      >
        <div className="dialog-ust" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🏆</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t("Liderlik Tablosu")}</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("Mesaj yazarak ve sesli odada kalarak XP kazan")}</span>
            </div>
          </div>
          <button type="button" className="cb-ibtn" onClick={onKapat} aria-label={t("Kapat")}>
            <Ikon ad="kapat" />
          </button>
        </div>

        <div className="scroll" style={{ padding: "14px 20px", flex: 1, minHeight: 0, overflowY: "auto" }}>
          {liste.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 12px", color: "var(--muted)" }}>
              🌱 {t("Henüz XP kazanan kimse yok. İlk mesajı sen yaz ve zirveye yerleş!")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {liste.map((oge) => {
                const benMi = oge.uyeId === benId;
                const madalya = oge.sira === 1 ? "🥇" : oge.sira === 2 ? "🥈" : oge.sira === 3 ? "🥉" : `#${oge.sira}`;
                return (
                  <div
                    key={oge.uyeId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: benMi ? "var(--secili-zemin)" : "var(--card)",
                      border: benMi ? "1px solid var(--acc)" : "1px solid var(--line)",
                    }}
                  >
                    <span style={{ width: 32, textAlign: "center", fontSize: oge.sira <= 3 ? 20 : 14, fontWeight: 700, color: "var(--muted)" }}>
                      {madalya}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14 }}>
                        <span
                          style={{ cursor: onProfil ? "pointer" : "default" }}
                          onClick={() => onProfil?.(oge.uyeId)}
                        >
                          {oge.ad}
                        </span>
                        {benMi && <span className="rozet" style={{ fontSize: 10 }}>{t("Sen")}</span>}
                        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
                          · {oge.bilgi.rozet} {oge.bilgi.unvan}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, height: 6, background: "var(--girdi)", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${oge.bilgi.yuzde}%`,
                            height: "100%",
                            background: "var(--acc)",
                            borderRadius: 3,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--acc)" }}>
                        {t("Sv. {s}", { s: oge.bilgi.seviye })}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {oge.bilgi.xp} XP
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
