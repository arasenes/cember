import { useEffect, useRef } from "react";
import { liderlikTablosuGetir } from "./seviye";
import { t } from "../i18n";

type Props = {
  benId: string;
  onKapat: () => void;
  onProfil?: (uyeId: string) => void;
};

export default function LiderlikTablosuDialog({ benId, onKapat, onProfil }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const liste = liderlikTablosuGetir();

  useEffect(() => {
    const onceki = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { onceki?.focus?.(); };
  }, []);

  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKapat();
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  return (
    <div className="modal-arka" onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
      <div
        ref={dialogRef}
        className="modal liderlik-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="liderlik-baslik"
      >
        <div className="modal-ust">
          <div>
            <h2 id="liderlik-baslik">🏆 {t("Liderlik Tablosu")}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
              {t("Mesaj yazarak ve sesli odada kalarak XP kazan")}
            </p>
          </div>
          <button className="lb-kapat modal-x" onClick={onKapat} aria-label={t("Kapat")}>
            ✕
          </button>
        </div>

        <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4, marginTop: 8 }}>
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
                      borderRadius: 14,
                      background: benMi ? "color-mix(in srgb, var(--vurgu) 15%, var(--card))" : "var(--card)",
                      border: benMi ? "1.5px solid var(--vurgu)" : "1px solid var(--line)",
                    }}
                  >
                    <span style={{ width: 32, textAlign: "center", fontSize: oge.sira <= 3 ? 20 : 13, fontWeight: 800, color: "var(--muted)", flex: "none" }}>
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
                        {benMi && (
                          <span style={{ fontSize: 10, background: "var(--vurgu)", color: "var(--vurgu-yazi)", padding: "1px 6px", borderRadius: 999, fontWeight: 800 }}>
                            {t("Sen")}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
                          · {oge.bilgi.rozet} {oge.bilgi.unvan}
                        </span>
                      </div>
                      <div style={{ marginTop: 5, height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, oge.bilgi.yuzde))}%`,
                            height: "100%",
                            background: "var(--vurgu)",
                            borderRadius: 3,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--vurgu)" }}>
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
