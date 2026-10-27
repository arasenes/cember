import { useState, type ReactNode } from "react";
import { etiketParcala } from "../uyari";
import { t } from "../i18n";

// Mesaj metni Markdown benzeri biçimlendirilir ama HTML'e ÇEVRİLMEZ: her şey React öğesi olarak üretilir
// (dangerouslySetInnerHTML yok). Bağlantılar yalnızca http/https olabilir.
// Desteklenen: **kalın**, *italik*, `kod`, ``` kod bloğu ```, > alıntı, ||spoiler||, https://bağlantı, @bahsetme.

const SATIR_ICI = /`([^`\n]+)`|\|\|([^\n]+?)\|\||\*\*([^\n]+?)\*\*|\*([^\s*][^\n]*?)\*(?!\*)|(https?:\/\/[^\s<]+)/g;
const URL_SONU = /[.,;:!?)\]'"]+$/;

const KOD_TOKEN = /(\/\/[^\n]*|#[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\b(function|const|let|var|return|if|else|for|while|import|export|from|default|async|await|class|interface|type|true|false|null|undefined|new|try|catch|throw|select|where|insert|into|update|delete|create|table|def|elif|None|True|False)\b|\b(\d+(?:\.\d+)?)\b/gi;

export function kodRenklendir(kod: string): ReactNode[] {
  const cikti: ReactNode[] = [];
  let son = 0;
  let i = 0;
  for (const m of kod.matchAll(KOD_TOKEN)) {
    const bas = m.index ?? 0;
    if (bas > son) cikti.push(kod.slice(son, bas));
    const parca = m[0];
    const k = `kt-${i++}`;
    if (m[1] !== undefined) cikti.push(<span key={k} className="kod-yorum" style={{ color: "#7f8c98", fontStyle: "italic" }}>{parca}</span>);
    else if (m[2] !== undefined) cikti.push(<span key={k} className="kod-dizgi" style={{ color: "#98c379" }}>{parca}</span>);
    else if (m[3] !== undefined) cikti.push(<span key={k} className="kod-anahtar" style={{ color: "#c678dd", fontWeight: 600 }}>{parca}</span>);
    else if (m[4] !== undefined) cikti.push(<span key={k} className="kod-sayi" style={{ color: "#d19a66" }}>{parca}</span>);
    son = bas + parca.length;
  }
  if (son < kod.length) cikti.push(kod.slice(son));
  return cikti;
}

export function KodBloku({ icerik, dil }: { icerik: string; dil?: string }) {
  const [kopyalandi, setKopyalandi] = useState(false);

  async function kopyala() {
    try {
      await navigator.clipboard?.writeText(icerik);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 1800);
    } catch {
      /* pano izni yoksa yoksay */
    }
  }

  return (
    <div className="md-blok-kutu" style={{ position: "relative", margin: "4px 0" }}>
      <div className="md-blok-ust" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 8px", fontSize: 11, background: "rgba(0,0,0,0.28)", borderTopLeftRadius: 6, borderTopRightRadius: 6, color: "var(--muted, #9aa4b2)" }}>
        <span>{dil || "kod"}</span>
        <button
          type="button"
          className="md-kopyala linkbtn"
          onClick={() => void kopyala()}
          aria-label={kopyalandi ? t("Kopyalandı") : t("Kodu kopyala")}
          style={{ fontSize: 11, padding: "1px 6px", cursor: "pointer" }}
        >
          {kopyalandi ? `✓ ${t("Kopyalandı")}` : `📋 ${t("Kopyala")}`}
        </button>
      </div>
      <pre className="md-blok" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        <code>{kodRenklendir(icerik)}</code>
      </pre>
    </div>
  );
}

export function Spoiler({ children }: { children: ReactNode }) {
  const [acik, setAcik] = useState(false);
  return (
    <button type="button" className={"spoiler" + (acik ? " acik" : "")} aria-pressed={acik}
      aria-label={acik ? t("Gizli metin açıldı") : t("Gizli metin, açmak için tıkla")} onClick={() => setAcik((x) => !x)}>
      <span aria-hidden={!acik}>{children}</span>
    </button>
  );
}

function duz(metin: string, benAd: string, anahtar: string): ReactNode[] {
  return etiketParcala(metin, benAd).map((p, i) => (p.etiket ? <mark key={anahtar + i} className="etiket-ben">{p.m}</mark> : p.m));
}

export function satirIci(metin: string, benAd: string, anahtar = "s", derin = 0): ReactNode[] {
  const cikti: ReactNode[] = [];
  let son = 0;
  let n = 0;
  for (const x of metin.matchAll(SATIR_ICI)) {
    const bas = x.index ?? 0;
    if (bas > son) cikti.push(...duz(metin.slice(son, bas), benAd, `${anahtar}d${n}`));
    const k = `${anahtar}-${n++}`;
    if (x[1] !== undefined) cikti.push(<code key={k} className="md-kod">{x[1]}</code>);
    else if (x[2] !== undefined) cikti.push(<Spoiler key={k}>{derin < 3 ? satirIci(x[2], benAd, k, derin + 1) : x[2]}</Spoiler>);
    else if (x[3] !== undefined) cikti.push(<strong key={k}>{derin < 3 ? satirIci(x[3], benAd, k, derin + 1) : x[3]}</strong>);
    else if (x[4] !== undefined) cikti.push(<em key={k}>{derin < 3 ? satirIci(x[4], benAd, k, derin + 1) : x[4]}</em>);
    else if (x[5] !== undefined) {
      const sonek = URL_SONU.exec(x[5])?.[0] ?? "";
      const url = sonek ? x[5].slice(0, -sonek.length) : x[5];
      cikti.push(<a key={k} href={url} target="_blank" rel="noopener noreferrer nofollow" className="md-link">{url}</a>);
      if (sonek) cikti.push(sonek);
    }
    son = bas + x[0].length;
  }
  if (son < metin.length) cikti.push(...duz(metin.slice(son), benAd, `${anahtar}z`));
  return cikti;
}

type Parca = { tur: "metin" | "kod"; icerik: string; dil?: string };

/** ``` ile çevrili bölümleri ayırır; kapanmayan ``` düz metin sayılır. */
export function kodBolumleri(metin: string): Parca[] {
  const out: Parca[] = [];
  const re = /```(?:([A-Za-z0-9_+-]*)\n)?([\s\S]*?)```/g;
  let son = 0;
  for (const x of metin.matchAll(re)) {
    const bas = x.index ?? 0;
    if (bas > son) out.push({ tur: "metin", icerik: metin.slice(son, bas) });
    const dil = x[1]?.trim();
    out.push(dil ? { tur: "kod", icerik: x[2].replace(/\n$/, ""), dil } : { tur: "kod", icerik: x[2].replace(/\n$/, "") });
    son = bas + x[0].length;
  }
  if (son < metin.length) out.push({ tur: "metin", icerik: metin.slice(son) });
  return out;
}

function metinBolumu(icerik: string, benAd: string, anahtar: string): ReactNode[] {
  const satirlar = icerik.split("\n");
  const cikti: ReactNode[] = [];
  let duzSatirlar: string[] = [];
  let alinti: string[] = [];
  const bosalt = () => {
    if (duzSatirlar.length) { cikti.push(<span key={`${anahtar}p${cikti.length}`}>{satirIci(duzSatirlar.join("\n"), benAd, `${anahtar}p${cikti.length}`)}</span>); duzSatirlar = []; }
    if (alinti.length) { cikti.push(<blockquote key={`${anahtar}q${cikti.length}`} className="md-alinti">{satirIci(alinti.join("\n"), benAd, `${anahtar}q${cikti.length}`)}</blockquote>); alinti = []; }
  };
  for (const s of satirlar) {
    const a = /^>\s?(.*)$/.exec(s);
    if (a) { if (duzSatirlar.length) bosalt(); alinti.push(a[1]); }
    else { if (alinti.length) bosalt(); duzSatirlar.push(s); }
  }
  bosalt();
  return cikti;
}

/** Biçimlendirme işaretlerini atar (alıntı satırı, bildirim gibi tek satırlık özetler için). */
export function duzMetin(metin: string): string {
  if (/^\[sesli:[^\]]+\]$/.test(metin.trim())) return "🎤 Sesli mesaj";
  if (/^\[cikartma:[^\]]+\]$/.test(metin.trim())) return "🏷️ Çıkartma";
  if (/^\[oyun:[^\]]+\]$/.test(metin.trim())) return "🎮 Mini oyun";
  if (/^\[dmresim:[^\]]+\]/.test(metin.trim())) {
    const kalan = metin.trim().split("\n").slice(1).join(" ").trim();
    return kalan ? `🖼️ ${kalan}` : "🖼️ Resim";
  }
  return metin
    .replace(/```(?:[A-Za-z0-9_+-]*\n)?([\s\S]*?)```/g, "$1")
    .replace(/\|\|([^\n]+?)\|\|/g, "$1")
    .replace(/\*\*([^\n]+?)\*\*/g, "$1")
    .replace(/\*([^\s*][^\n]*?)\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mesaj metnini React öğelerine çevirir. */
export function metinOge(metin: string, benAd: string): ReactNode {
  const bolumler = kodBolumleri(metin);
  return bolumler.map((b, i) => {
    if (b.tur === "kod") return <KodBloku key={"k" + i} icerik={b.icerik} dil={b.dil} />;
    // Kod bloğunun hemen önündeki/sonundaki satır sonu fazladan boş satır üretmesin
    let ic = b.icerik;
    if (bolumler[i - 1]?.tur === "kod") ic = ic.replace(/^\n/, "");
    if (bolumler[i + 1]?.tur === "kod") ic = ic.replace(/\n$/, "");
    return ic ? <span key={"m" + i}>{metinBolumu(ic, benAd, "m" + i)}</span> : null;
  });
}
