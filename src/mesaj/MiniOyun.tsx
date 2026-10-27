import { useEffect, useState } from "react";
import { t } from "../i18n";
import { xpKaydet } from "../gamification/seviye";

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

export type KelimeDurum = {
  tur: "kelime";
  baslatanId: string;
  kelime: string;
  tahminler: string;
  kalanHak: number;
  ipucu: string;
};

export type MiniOyunDurum = XoxDurum | TkmDurum | KelimeDurum;

const XOX_RE = /^\[oyun:xox\|([a-zA-Z0-9_-]+)\|([a-zA-Z0-9_*-]+)\|([-XO]{9})\|([XO])\]$/;
const TKM_RE = /^\[oyun:tkm\|([a-zA-Z0-9_-]+)\|([a-zA-Z0-9_*-]+)\|([-TKM])\|([-TKM])\]$/;
const KELIME_RE = /^\[oyun:kelime\|([a-zA-Z0-9_-]+)\|([A-ZÇĞİÖŞÜ]+)\|([A-ZÇĞİÖŞÜ,-]+)\|([0-6])\|([^\]]+)\]$/i;

export const KELIME_HAVUZU = [
  { k: "KEDİ", i: "Evcil Hayvan 🐾" },
  { k: "KÖPEK", i: "Sadık Dost 🐶" },
  { k: "PİZZA", i: "İtalyan Lezzeti 🍕" },
  { k: "GİTAR", i: "Telli Müzik Aleti 🎸" },
  { k: "KAHVE", i: "Sıcak İçecek ☕" },
  { k: "ROKET", i: "Uzay Aracı 🚀" },
  { k: "DENİZ", i: "Mavi Doğa Harikası 🌊" },
  { k: "GÜNEŞ", i: "Isı ve Işık Kaynağı ☀️" },
  { k: "FUTBOL", i: "Popüler Spor ⚽" },
  { k: "ELMA", i: "Kırmızı Meyve 🍎" },
  { k: "KİTAP", i: "Bilgi Kaynağı 📚" },
  { k: "BİLGİSAYAR", i: "Elektronik Cihaz 💻" },
  { k: "DONDURMA", i: "Yaz Tatlısı 🍦" },
  { k: "TAVŞAN", i: "Hızlı Hayvan 🐰" },
  { k: "SİNEMA", i: "Yedinci Sanat 🎬" },
  { k: "KALE", i: "Tarihi Yapı 🏰" },
  { k: "UÇAK", i: "Hava Taşıtı ✈️" },
  { k: "PİYANO", i: "Tuşlu Müzik Aleti 🎹" },
  { k: "ÇİKOLATA", i: "Tatlı Atıştırmalık 🍫" },
  { k: "ÇİÇEK", i: "Renkli Bitki 🌸" },
];

export function yeniKelimeOyunu(baslatanId: string): string {
  const oge = KELIME_HAVUZU[Math.floor(Math.random() * KELIME_HAVUZU.length)];
  return miniOyunKodla({
    tur: "kelime",
    baslatanId,
    kelime: oge.k,
    tahminler: "-",
    kalanHak: 6,
    ipucu: oge.i,
  });
}

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
  const mk = KELIME_RE.exec(s);
  if (mk) {
    return {
      tur: "kelime",
      baslatanId: mk[1],
      kelime: mk[2].toLocaleUpperCase("tr-TR"),
      tahminler: mk[3],
      kalanHak: Number(mk[4]),
      ipucu: mk[5],
    };
  }
  return null;
}

export function miniOyunKodla(d: MiniOyunDurum): string {
  if (d.tur === "xox") {
    return `[oyun:xox|${d.xId}|${d.oId}|${d.tahta}|${d.sira}]`;
  }
  if (d.tur === "tkm") {
    return `[oyun:tkm|${d.p1Id}|${d.p2Id}|${d.p1Secim}|${d.p2Secim}]`;
  }
  return `[oyun:kelime|${d.baslatanId}|${d.kelime}|${d.tahminler}|${d.kalanHak}|${d.ipucu}]`;
}

const CIZGILER = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function xoxKazanan(tahta: string): "X" | "O" | "berabere" | null {
  for (const [a, b, c] of CIZGILER) {
    const k = tahta[a];
    if (k !== "-" && k === tahta[b] && k === tahta[c]) return k as "X" | "O";
  }
  if (!tahta.includes("-")) return "berabere";
  return null;
}

export function xoxBotHamlesi(tahta: string): number {
  for (const [a, b, c] of CIZGILER) {
    const uc = [tahta[a], tahta[b], tahta[c]];
    if (uc.filter((x) => x === "X").length === 2 && uc.includes("-")) {
      return [a, b, c][uc.indexOf("-")];
    }
  }
  const boslar: number[] = [];
  for (let i = 0; i < 9; i++) if (tahta[i] === "-") boslar.push(i);
  return boslar[0] ?? -1;
}

export function MiniOyunKart({
  metin,
  benId,
  uyeAd,
  onHamle,
}: {
  mesajId?: string;
  metin: string;
  benId: string;
  uyeAd?: (id: string) => string;
  onHamle: (yeniMetin: string) => void;
}) {
  const oyun = miniOyunCoz(metin);
  if (!oyun) return null;

  if (oyun.tur === "xox") {
    return <XoxKart oyun={oyun} benId={benId} uyeAd={uyeAd} uygula={(y) => onHamle(miniOyunKodla(y))} />;
  }
  if (oyun.tur === "tkm") {
    return <TkmKart oyun={oyun} benId={benId} uyeAd={uyeAd} uygula={(y) => onHamle(miniOyunKodla(y))} />;
  }
  return <KelimeOyunuKart oyun={oyun} benId={benId} uygula={(y) => onHamle(miniOyunKodla(y))} />;
}

const HARFLER = [
  "A", "B", "C", "Ç", "D", "E", "F", "G", "Ğ", "H", "I", "İ", "J",
  "K", "L", "M", "N", "O", "Ö", "P", "R", "S", "Ş", "T", "U", "Ü", "V", "Y", "Z"
];

function KelimeOyunuKart({
  oyun,
  benId,
  uygula,
}: {
  oyun: KelimeDurum;
  benId: string;
  uygula: (y: KelimeDurum) => void;
}) {
  const tahminDizisi = oyun.tahminler === "-" ? [] : oyun.tahminler.split(",");
  const harfler = oyun.kelime.split("");
  const tumuBulundu = harfler.every((h) => tahminDizisi.includes(h));
  const bitti = tumuBulundu || oyun.kalanHak <= 0;

  function harfTahminEt(harf: string) {
    if (bitti || tahminDizisi.includes(harf)) return;
    const yeniTahminler = [...tahminDizisi, harf];
    const dogruMu = harfler.includes(harf);
    const yeniHak = dogruMu ? oyun.kalanHak : Math.max(0, oyun.kalanHak - 1);
    const yeniTumuBulundu = harfler.every((h) => yeniTahminler.includes(h));

    if (yeniTumuBulundu) {
      xpKaydet(benId, "", 50);
    }

    uygula({
      ...oyun,
      tahminler: yeniTahminler.join(","),
      kalanHak: yeniHak,
    });
  }

  return (
    <div
      className="mini-oyun-kart"
      data-testid="mini-oyun-kelime"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 14px",
        borderRadius: 14,
        background: "var(--card)",
        border: "1.5px solid var(--line)",
        marginTop: 4,
        minWidth: 260,
        maxWidth: 320,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <b>🔤 {t("Kelime Tahmini")}</b>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{oyun.ipucu}</span>
      </div>

      <div style={{ display: "flex", gap: 3, fontSize: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} style={{ opacity: i < oyun.kalanHak ? 1 : 0.2 }}>
            ❤️
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "8px 0" }}>
        {harfler.map((h, i) => {
          const acik = tahminDizisi.includes(h) || bitti;
          return (
            <span
              key={i}
              style={{
                width: 24,
                height: 32,
                borderBottom: "2.5px solid var(--vurgu)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 800,
                color: acik ? (tahminDizisi.includes(h) ? "var(--fg)" : "var(--danger, #ef4444)") : "transparent",
              }}
            >
              {acik ? h : "_"}
            </span>
          );
        })}
      </div>

      {bitti ? (
        <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700 }}>
          {tumuBulundu ? (
            <span style={{ color: "var(--live, #10b981)" }}>
              🎉 {t("Tebrikler, kelime bulundu!")} (+50 XP)
            </span>
          ) : (
            <span style={{ color: "var(--danger, #ef4444)" }}>
              💀 {t("Haklar bitti! Doğru kelime: {k}", { k: oyun.kelime })}
            </span>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", marginTop: 4 }}>
          {HARFLER.map((h) => {
            const basildi = tahminDizisi.includes(h);
            return (
              <button
                key={h}
                type="button"
                disabled={basildi}
                onClick={() => harfTahminEt(h)}
                style={{
                  width: 22,
                  height: 26,
                  padding: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 4,
                  border: "1px solid var(--line)",
                  background: basildi ? "transparent" : "var(--bg)",
                  opacity: basildi ? 0.3 : 1,
                  cursor: basildi ? "default" : "pointer",
                }}
              >
                {h}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function XoxKart({
  oyun,
  benId,
  uyeAd,
  uygula,
}: {
  oyun: XoxDurum;
  benId: string;
  uyeAd?: (id: string) => string;
  uygula: (y: XoxDurum) => void;
}) {
  const kazanan = xoxKazanan(oyun.tahta);
  const siraBenim =
    (oyun.sira === "X" && benId === oyun.xId) ||
    (oyun.sira === "O" && (benId === oyun.oId || (oyun.oId === "*" && benId !== oyun.xId)));

  useEffect(() => {
    if (oyun.oId === "bot" && oyun.sira === "O" && !kazanan) {
      const boslar: number[] = [];
      for (let i = 0; i < 9; i++) if (oyun.tahta[i] === "-") boslar.push(i);
      if (boslar.length > 0) {
        const secilen = boslar[Math.floor(Math.random() * boslar.length)];
        const yeniTahta = oyun.tahta.slice(0, secilen) + "O" + oyun.tahta.slice(secilen + 1);
        const t = setTimeout(() => {
          uygula({ ...oyun, tahta: yeniTahta, sira: "X" });
        }, 500);
        return () => clearTimeout(t);
      }
    }
  }, [oyun, kazanan, uygula]);

  const hamleYap = (i: number) => {
    if (kazanan || oyun.tahta[i] !== "-" || !siraBenim) return;
    const sembol = oyun.sira;
    let oId = oyun.oId;
    if (sembol === "O" && oId === "*") oId = benId;
    let yeniTahta = oyun.tahta.slice(0, i) + sembol + oyun.tahta.slice(i + 1);
    let yeniSira = sembol === "X" ? "O" : "X";

    if (oyun.oId === "bot" && sembol === "X" && !xoxKazanan(yeniTahta)) {
      const botKare = xoxBotHamlesi(yeniTahta);
      if (botKare >= 0) {
        yeniTahta = yeniTahta.slice(0, botKare) + "O" + yeniTahta.slice(botKare + 1);
        yeniSira = "X";
      }
    }

    uygula({ ...oyun, oId, tahta: yeniTahta, sira: yeniSira });
  };

  const adGoster = (id: string) => {
    if (id === "*") return t("Herhangi biri");
    if (id === "bot") return "🤖 Çember Bot";
    return uyeAd?.(id) ?? id;
  };

  return (
    <div className="mini-oyun-kart" data-testid="mini-oyun-xox" style={{
      display: "inline-flex", flexDirection: "column", gap: 8, padding: "10px 12px",
      borderRadius: 10, background: "var(--surface-2, rgba(255,255,255,0.06))",
      border: "1px solid var(--border, rgba(255,255,255,0.12))", marginTop: 4, minWidth: 210,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <b>❌⭕ XOX</b>
        <span className="hint" style={{ fontSize: 11 }}>
          {kazanan
            ? kazanan === "berabere" ? t("Berabere!") : `Kazanan: ${kazanan === "X" ? adGoster(oyun.xId) : adGoster(oyun.oId)}`
            : t("Sıra: {ad}", { ad: oyun.sira === "X" ? adGoster(oyun.xId) : adGoster(oyun.oId) })}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 38px)", gap: 4, margin: "2px auto" }}>
        {oyun.tahta.split("").map((k, i) => (
          <button
            key={i}
            type="button"
            className="kontrol"
            style={{ width: 38, height: 38, padding: 0, fontSize: 16, fontWeight: 800, cursor: k === "-" && siraBenim && !kazanan ? "pointer" : "default" }}
            onClick={() => hamleYap(i)}
            disabled={k !== "-" || !siraBenim || !!kazanan}
            aria-label={k === "-" ? t("Kare {n}: boş", { n: i + 1 }) : t("Kare {n}: {k}", { n: i + 1, k })}
          >
            {k === "-" ? "" : k}
          </button>
        ))}
      </div>
    </div>
  );
}

const TKM_BILGI = {
  T: { ad: "Taş", simge: "✊" },
  K: { ad: "Kağıt", simge: "✋" },
  M: { ad: "Makas", simge: "✌️" },
};

export function tkmKazanan(p1: TkmSecim, p2: TkmSecim): 0 | 1 | 2 | null {
  if (p1 === "-" || p2 === "-") return null;
  if (p1 === p2) return 0;
  if (
    (p1 === "T" && p2 === "M") ||
    (p1 === "K" && p2 === "T") ||
    (p1 === "M" && p2 === "K")
  ) return 1;
  return 2;
}

function TkmKart({
  oyun,
  benId,
  uyeAd,
  uygula,
}: {
  oyun: TkmDurum;
  benId: string;
  uyeAd?: (id: string) => string;
  uygula: (y: TkmDurum) => void;
}) {
  const bitti = oyun.p1Secim !== "-" && oyun.p2Secim !== "-";
  const kazanan = bitti ? tkmKazanan(oyun.p1Secim, oyun.p2Secim) : null;

  const adGoster = (id: string) => {
    if (id === "*") return t("Herhangi biri");
    if (id === "bot") return "🤖 Çember Bot";
    return uyeAd?.(id) ?? id;
  };

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
        background: "var(--card)", border: "1.5px solid var(--line)",
        borderRadius: 14, padding: 10, display: "flex", flexDirection: "column", gap: 6, minWidth: 240,
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px", fontSize: 12 }}>
        <b>🎮 {t("Mini Oyun Başlat")}</b>
        <button type="button" className="linkbtn" onClick={onKapat} aria-label={t("Kapat")}>✕</button>
      </div>
      <button type="button" className="kontrol" style={{ justifyContent: "flex-start", padding: "8px 10px" }}
        onClick={() => { onBaslat(miniOyunKodla({ tur: "xox", xId: benId, oId: "*", tahta: "---------", sira: "X" })); onKapat(); }}>
        ❌⭕ {t("XOX (Arkadaşla Düello)")}
      </button>
      <button type="button" className="kontrol" style={{ justifyContent: "flex-start", padding: "8px 10px" }}
        onClick={() => { onBaslat(miniOyunKodla({ tur: "xox", xId: benId, oId: "bot", tahta: "---------", sira: "X" })); onKapat(); }}>
        🤖 {t("XOX (Bot'a Karşı)")}
      </button>
      <button type="button" className="kontrol" style={{ justifyContent: "flex-start", padding: "8px 10px" }}
        onClick={() => { onBaslat(miniOyunKodla({ tur: "tkm", p1Id: benId, p2Id: "*", p1Secim: "-", p2Secim: "-" })); onKapat(); }}>
        ✊✋✌️ {t("Taş-Kağıt-Makas (Arkadaşla)")}
      </button>
      <button type="button" className="kontrol" style={{ justifyContent: "flex-start", padding: "8px 10px" }}
        onClick={() => { onBaslat(miniOyunKodla({ tur: "tkm", p1Id: benId, p2Id: "bot", p1Secim: "-", p2Secim: "-" })); onKapat(); }}>
        🤖 {t("Taş-Kağıt-Makas (Bot'a Karşı)")}
      </button>
      <button type="button" className="kontrol" style={{ justifyContent: "flex-start", padding: "8px 10px", borderTop: "1px solid var(--line)" }}
        onClick={() => { onBaslat(yeniKelimeOyunu(benId)); onKapat(); }}>
        🔤 {t("Kelime Tahmini (Grup Oyunu)")}
      </button>
    </div>
  );
}
