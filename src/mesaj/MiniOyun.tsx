import { useEffect, useState } from "react";
import { t } from "../i18n";

export type XoxDurum = {
  tur: "xox";
  xId: string;
  oId: string; // "*" | "bot" | uyeId
  tahta: string; // 9 karakter: "-", "X", "O"
  sira: "X" | "O";
};

export type TkmSecim = "-" | "T" | "K" | "M";

export type TkmDurum = {
  tur: "tkm";
  p1Id: string;
  p2Id: string; // "*" | "bot" | uyeId
  p1Secim: TkmSecim;
  p2Secim: TkmSecim;
};

export type MiniOyunDurum = XoxDurum | TkmDurum;

const XOX_RE = /^\[oyun:xox\|([a-zA-Z0-9_-]+)\|([a-zA-Z0-9_*-]+)\|([-XO]{9})\|([XO])\]$/;
const TKM_RE = /^\[oyun:tkm\|([a-zA-Z0-9_-]+)\|([a-zA-Z0-9_*-]+)\|([-TKM])\|([-TKM])\]$/;

export function miniOyunCoz(metin: string): MiniOyunDurum | null {
  const s = metin.trim();
  const mx = XOX_RE.exec(s);
  if (mx) {
    return { tur: "xox", xId: mx[1], oId: mx[2], tahta: mx[3], sira: mx[4] as "X" | "O" };
  }
  const mt = TKM_RE.exec(s);
  if (mt) {
    return {
      tur: "tkm",
      p1Id: mt[1],
      p2Id: mt[2],
      p1Secim: mt[3] as TkmSecim,
      p2Secim: mt[4] as TkmSecim,
    };
  }
  return null;
}

export function miniOyunKodla(d: MiniOyunDurum): string {
  if (d.tur === "xox") {
    return `[oyun:xox|${d.xId}|${d.oId}|${d.tahta}|${d.sira}]`;
  }
  return `[oyun:tkm|${d.p1Id}|${d.p2Id}|${d.p1Secim}|${d.p2Secim}]`;
}

const CIZGILER = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function xoxKazanan(tahta: string): "X" | "O" | "berabere" | null {
  for (const [a, b, c] of CIZGILER) {
    if (tahta[a] !== "-" && tahta[a] === tahta[b] && tahta[b] === tahta[c]) {
      return tahta[a] as "X" | "O";
    }
  }
  if (!tahta.includes("-")) return "berabere";
  return null;
}

export function xoxBotHamlesi(tahta: string): number {
  const boslar = [...tahta].map((h, i) => (h === "-" ? i : -1)).filter((i) => i >= 0);
  if (boslar.length === 0) return -1;
  // 1. Bot ("O") kazanabiliyorsa kazan
  for (const i of boslar) {
    const deneme = tahta.slice(0, i) + "O" + tahta.slice(i + 1);
    if (xoxKazanan(deneme) === "O") return i;
  }
  // 2. Rakip ("X") kazanacaksa engelle
  for (const i of boslar) {
    const deneme = tahta.slice(0, i) + "X" + tahta.slice(i + 1);
    if (xoxKazanan(deneme) === "X") return i;
  }
  // 3. Merkez boşsa al
  if (tahta[4] === "-") return 4;
  // 4. Köşeler
  const koseler = [0, 2, 6, 8].filter((i) => tahta[i] === "-");
  if (koseler.length > 0) return koseler[0];
  return boslar[0];
}

export function tkmKazanan(s1: TkmSecim, s2: TkmSecim): 1 | 2 | 0 | null {
  if (s1 === "-" || s2 === "-") return null;
  if (s1 === s2) return 0;
  if ((s1 === "T" && s2 === "M") || (s1 === "K" && s2 === "T") || (s1 === "M" && s2 === "K")) return 1;
  return 2;
}

const TKM_BILGI: Record<Exclude<TkmSecim, "-">, { simge: string; ad: string }> = {
  T: { simge: "✊", ad: "Taş" },
  K: { simge: "✋", ad: "Kağıt" },
  M: { simge: "✌️", ad: "Makas" },
};

export function MiniOyunKart({
  mesajId,
  metin,
  benId,
  uyeAd,
  onHamle,
}: {
  mesajId: string;
  metin: string;
  benId: string;
  uyeAd: (id: string) => string;
  onHamle?: (yeniMetin: string) => void;
}) {
  const [yerelMetin, setYerelMetin] = useState(metin);

  useEffect(() => {
    setYerelMetin(metin);
  }, [metin]);

  useEffect(() => {
    const dinle = (e: Event) => {
      const d = (e as CustomEvent<{ mesajId: string; yeniMetin: string }>).detail;
      if (d?.mesajId === mesajId && miniOyunCoz(d.yeniMetin)) {
        setYerelMetin(d.yeniMetin);
      }
    };
    window.addEventListener("cember-oyun-hamle", dinle);
    return () => window.removeEventListener("cember-oyun-hamle", dinle);
  }, [mesajId]);

  const oyun = miniOyunCoz(yerelMetin);
  if (!oyun) return null;

  const uygula = (yeniDurum: MiniOyunDurum) => {
    const kod = miniOyunKodla(yeniDurum);
    setYerelMetin(kod);
    window.dispatchEvent(new CustomEvent("cember-oyun-hamle", { detail: { mesajId, yeniMetin: kod } }));
    onHamle?.(kod);
  };

  const adGoster = (id: string) => {
    if (id === "bot") return "🤖 Çember Bot";
    if (id === "*") return t("Açık davet (tıkla katıl)");
    if (id === benId) return t("Sen");
    return uyeAd(id);
  };

  if (oyun.tur === "xox") {
    const sonuc = xoxKazanan(oyun.tahta);
    const kareTikla = (indeks: number) => {
      if ( sonuc || oyun.tahta[indeks] !== "-") return;
      if (oyun.sira === "X") {
        if (benId !== oyun.xId) return;
        let yeniTahta = oyun.tahta.slice(0, indeks) + "X" + oyun.tahta.slice(indeks + 1);
        let yeniSira: "X" | "O" = "O";
        if (oyun.oId === "bot" && !xoxKazanan(yeniTahta)) {
          const botIdx = xoxBotHamlesi(yeniTahta);
          if (botIdx >= 0) {
            yeniTahta = yeniTahta.slice(0, botIdx) + "O" + yeniTahta.slice(botIdx + 1);
            yeniSira = "X";
          }
        }
        uygula({ ...oyun, tahta: yeniTahta, sira: yeniSira });
      } else {
        // Sıra O'da
        if (oyun.oId === "bot") return;
        if (oyun.oId !== "*" && benId !== oyun.oId) return;
        // Eğer aynı kişi kendi kendine test etmek isterse veya başka üye tıklarsa
        const yeniOId = oyun.oId === "*" ? benId : oyun.oId;
        const yeniTahta = oyun.tahta.slice(0, indeks) + "O" + oyun.tahta.slice(indeks + 1);
        uygula({ ...oyun, oId: yeniOId, tahta: yeniTahta, sira: "X" });
      }
    };

    return (
      <div className="mini-oyun-kart" data-testid="mini-oyun-xox" style={{
        display: "inline-flex", flexDirection: "column", gap: 8, padding: "10px 12px",
        borderRadius: 10, background: "var(--surface-2, rgba(255,255,255,0.06))",
        border: "1px solid var(--border, rgba(255,255,255,0.12))", marginTop: 4, minWidth: 210,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, gap: 8 }}>
          <b>❌⭕ XOX</b>
          <span className="hint">
            {sonuc === "berabere"
              ? `🤝 ${t("Berabere!")}`
              : sonuc === "X"
                ? `🏆 ${adGoster(oyun.xId)} ${t("kazandı!")}`
                : sonuc === "O"
                  ? `🏆 ${adGoster(oyun.oId)} ${t("kazandı!")}`
                  : `${t("Sıra")}: ${oyun.sira === "X" ? `❌ ${adGoster(oyun.xId)}` : `⭕ ${adGoster(oyun.oId)}`}`}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 52px)", gap: 6, justifyContent: "center" }}>
          {[...oyun.tahta].map((hucre, i) => (
            <button
              key={i}
              type="button"
              onClick={() => kareTikla(i)}
              disabled={!!sonuc || hucre !== "-"}
              aria-label={`Kare ${i + 1}: ${hucre === "-" ? "boş" : hucre}`}
              style={{
                width: 52, height: 52, borderRadius: 8, fontSize: 20, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: !sonuc && hucre === "-" ? "pointer" : "default",
                background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.14)",
                color: hucre === "X" ? "#ff6b6b" : "#4dabf7",
              }}
            >
              {hucre === "X" ? "❌" : hucre === "O" ? "⭕" : ""}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }} className="hint">
          <span>❌ {adGoster(oyun.xId)} vs ⭕ {adGoster(oyun.oId)}</span>
          {sonuc && (
            <button type="button" className="linkbtn" onClick={() => uygula({ ...oyun, tahta: "---------", sira: "X" })} style={{ fontSize: 11 }}>
              🔄 {t("Sıfırla")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Taş-Kağıt-Makas
  const bitti = oyun.p1Secim !== "-" && oyun.p2Secim !== "-";
  const kazanan = tkmKazanan(oyun.p1Secim, oyun.p2Secim);

  const tkmSec = (secim: Exclude<TkmSecim, "-">) => {
    if (bitti) return;
    if (benId === oyun.p1Id && oyun.p1Secim === "-") {
      let p2Secim = oyun.p2Secim;
      if (oyun.p2Id === "bot") {
        const secenekler: Exclude<TkmSecim, "-">[] = ["T", "K", "M"];
        p2Secim = secenekler[Math.floor(Math.random() * 3)];
      }
      uygula({ ...oyun, p1Secim: secim, p2Secim });
    } else if (oyun.p2Id !== "bot" && (oyun.p2Id === "*" || benId === oyun.p2Id) && oyun.p2Secim === "-") {
      uygula({ ...oyun, p2Id: oyun.p2Id === "*" ? benId : oyun.p2Id, p2Secim: secim });
    }
  };

  return (
    <div className="mini-oyun-kart" data-testid="mini-oyun-tkm" style={{
      display: "inline-flex", flexDirection: "column", gap: 8, padding: "10px 12px",
      borderRadius: 10, background: "var(--surface-2, rgba(255,255,255,0.06))",
      border: "1px solid var(--border, rgba(255,255,255,0.12))", marginTop: 4, minWidth: 230,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, gap: 8 }}>
        <b>✊✋✌️ {t("Taş-Kağıt-Makas")}</b>
        {bitti && (
          <button type="button" className="linkbtn" onClick={() => uygula({ ...oyun, p1Secim: "-", p2Secim: "-" })} style={{ fontSize: 11 }}>
            🔄 {t("Tekrar")}
          </button>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", gap: 10, padding: "4px 0", fontSize: 13 }}>
        <div style={{ textAlign: "center" }}>
          <div className="hint" style={{ fontSize: 11 }}>{adGoster(oyun.p1Id)}</div>
          <div style={{ fontSize: 22, marginTop: 2 }}>
            {bitti ? TKM_BILGI[oyun.p1Secim as Exclude<TkmSecim, "-">].simge : oyun.p1Secim !== "-" ? "✅" : "⏳"}
          </div>
        </div>
        <b className="hint">VS</b>
        <div style={{ textAlign: "center" }}>
          <div className="hint" style={{ fontSize: 11 }}>{adGoster(oyun.p2Id)}</div>
          <div style={{ fontSize: 22, marginTop: 2 }}>
            {bitti ? TKM_BILGI[oyun.p2Secim as Exclude<TkmSecim, "-">].simge : oyun.p2Secim !== "-" ? "✅" : "⏳"}
          </div>
        </div>
      </div>
      {bitti ? (
        <div style={{ textAlign: "center", fontWeight: 600, fontSize: 13 }}>
          {kazanan === 0
            ? `🤝 ${t("Berabere!")}`
            : kazanan === 1
              ? `🏆 ${adGoster(oyun.p1Id)} ${t("kazandı!")}`
              : `🏆 ${adGoster(oyun.p2Id)} ${t("kazandı!")}`}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          {(["T", "K", "M"] as const).map((k) => (
            <button key={k} type="button" className="kontrol" onClick={() => tkmSec(k)} style={{ padding: "4px 10px", fontSize: 12 }}>
              {TKM_BILGI[k].simge} {t(TKM_BILGI[k].ad)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function OyunBaslatMenusu({
  benId,
  onBaslat,
  onKapat,
}: {
  benId: string;
  onBaslat: (kod: string) => void;
  onKapat: () => void;
}) {
  return (
    <div
      className="oyun-menu"
      role="dialog"
      aria-label={t("Mini oyun başlat")}
      style={{
        position: "absolute", bottom: "100%", left: 8, marginBottom: 8, zIndex: 40,
        background: "var(--bg-2, #181b22)", border: "1px solid var(--border, rgba(255,255,255,0.14))",
        borderRadius: 10, padding: 8, display: "flex", flexDirection: "column", gap: 4, minWidth: 230,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px", fontSize: 12 }}>
        <b>🎮 {t("Mini Oyun Başlat")}</b>
        <button type="button" className="linkbtn" onClick={onKapat} aria-label={t("Kapat")}>✕</button>
      </div>
      <button type="button" className="kontrol" style={{ justifyContent: "flex-start" }}
        onClick={() => { onBaslat(miniOyunKodla({ tur: "xox", xId: benId, oId: "*", tahta: "---------", sira: "X" })); onKapat(); }}>
        ❌⭕ {t("XOX (Arkadaşla Düello)")}
      </button>
      <button type="button" className="kontrol" style={{ justifyContent: "flex-start" }}
        onClick={() => { onBaslat(miniOyunKodla({ tur: "xox", xId: benId, oId: "bot", tahta: "---------", sira: "X" })); onKapat(); }}>
        🤖 {t("XOX (Bot'a Karşı)")}
      </button>
      <button type="button" className="kontrol" style={{ justifyContent: "flex-start" }}
        onClick={() => { onBaslat(miniOyunKodla({ tur: "tkm", p1Id: benId, p2Id: "*", p1Secim: "-", p2Secim: "-" })); onKapat(); }}>
        ✊✋✌️ {t("Taş-Kağıt-Makas (Arkadaşla)")}
      </button>
      <button type="button" className="kontrol" style={{ justifyContent: "flex-start" }}
        onClick={() => { onBaslat(miniOyunKodla({ tur: "tkm", p1Id: benId, p2Id: "bot", p1Secim: "-", p2Secim: "-" })); onKapat(); }}>
        🤖 {t("Taş-Kağıt-Makas (Bot'a Karşı)")}
      </button>
    </div>
  );
}
