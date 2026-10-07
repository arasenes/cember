import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { Kanal, Mesaj, Uye } from "../types";
import { gunEtiketi, saat } from "../util";
import Ikon from "./Ikon";

export type AramaSuzgec = { q: string; kanal: string; uye: string; bas: string; son: string; ekli: boolean };
export const BOS_SUZGEC: AramaSuzgec = { q: "", kanal: "", uye: "", bas: "", son: "", ekli: false };

/** Süzgeçleri sunucu işlevi parametrelerine çevirir. Gün sonu dahildir (ertesi günün başına kadar). */
export function aramaParametreleri(odaId: string, s: AramaSuzgec) {
  const gunSonu = s.son ? new Date(new Date(s.son + "T00:00:00").getTime() + 86400000).toISOString() : null;
  return {
    p_oda: odaId, p_sorgu: s.q.trim(), p_kanal: s.kanal || null, p_uye: s.uye || null,
    p_bas: s.bas ? new Date(s.bas + "T00:00:00").toISOString() : null, p_son: gunSonu,
    p_ekli: s.ekli ? true : null, p_limit: 30,
  };
}
export const suzgecBosMu = (s: AramaSuzgec) => !s.q.trim() && !s.kanal && !s.uye && !s.bas && !s.son && !s.ekli;

type Props = { odaId: string; kanallar: Kanal[]; uyeler: Uye[]; onGit: (m: Mesaj) => void; onKapat: () => void };

/** Mesaj arama paneli: kutu + süzgeçler (kişi, kanal, tarih, ekli mi). Sonuca tıklayınca mesaja gider. */
export default function AramaPaneli({ odaId, kanallar, uyeler, onGit, onKapat }: Props) {
  const [s, setS] = useState<AramaSuzgec>(BOS_SUZGEC);
  const [sonuclar, setSonuclar] = useState<Mesaj[]>([]);
  const [durum, setDurum] = useState<"bos" | "araniyor" | "tamam" | "hata">("bos");
  const girdiRef = useRef<HTMLInputElement>(null);
  const uyeAdi = new Map(uyeler.map((u) => [u.id, u.takma_ad]));
  const kanalAdi = new Map(kanallar.map((k) => [k.id, k.ad]));

  useEffect(() => { girdiRef.current?.focus(); }, []);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  useEffect(() => {
    if (suzgecBosMu(s)) { setSonuclar([]); setDurum("bos"); return; }
    let iptal = false;
    setDurum("araniyor");
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("mesaj_ara", aramaParametreleri(odaId, s));
      if (iptal) return;
      if (error) return setDurum("hata");
      setSonuclar((data ?? []) as Mesaj[]);
      setDurum("tamam");
    }, 300);
    return () => { iptal = true; clearTimeout(t); };
  }, [s, odaId]);

  const guncelle = (k: Partial<AramaSuzgec>) => setS((x) => ({ ...x, ...k }));

  return (
    <aside className="arama" role="search" aria-label="Mesaj ara">
      <div className="arama-ust">
        <h2><Ikon ad="ara" /> Ara</h2>
        <button type="button" className="sq" aria-label="Aramayı kapat" onClick={onKapat}><Ikon ad="kapat" /></button>
      </div>
      <div className="field">
        <label htmlFor="arama-q">Aranacak kelime</label>
        <input ref={girdiRef} id="arama-q" type="text" value={s.q} maxLength={100} onChange={(e) => guncelle({ q: e.target.value })} placeholder="Mesajlarda ara…" />
      </div>
      <div className="arama-suzgec">
        <div className="field">
          <label htmlFor="arama-kisi">Kişi</label>
          <select id="arama-kisi" value={s.uye} onChange={(e) => guncelle({ uye: e.target.value })}>
            <option value="">Herkes</option>
            {uyeler.filter((u) => !u.silindi).map((u) => <option key={u.id} value={u.id}>{u.takma_ad}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="arama-kanal">Kanal</label>
          <select id="arama-kanal" value={s.kanal} onChange={(e) => guncelle({ kanal: e.target.value })}>
            <option value="">Tüm kanallar</option>
            {kanallar.filter((k) => k.tur === "yazili").map((k) => <option key={k.id} value={k.id}>#{k.ad}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="arama-bas">Başlangıç</label>
          <input id="arama-bas" type="date" value={s.bas} onChange={(e) => guncelle({ bas: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="arama-son">Bitiş</label>
          <input id="arama-son" type="date" value={s.son} onChange={(e) => guncelle({ son: e.target.value })} />
        </div>
      </div>
      <label className="onay-satir"><input type="checkbox" checked={s.ekli} onChange={(e) => guncelle({ ekli: e.target.checked })} /> Yalnızca resimli mesajlar</label>
      <div className="arama-sonuc" aria-live="polite">
        {durum === "bos" && <p className="hint">Bir kelime yaz ya da süzgeç seç.</p>}
        {durum === "araniyor" && <p className="hint">Aranıyor…</p>}
        {durum === "hata" && <p className="hint">Arama yapılamadı, tekrar dene.</p>}
        {durum === "tamam" && !sonuclar.length && <p className="hint">Sonuç bulunamadı.</p>}
        {durum === "tamam" && sonuclar.length > 0 && (
          <ul>
            {sonuclar.map((m) => (
              <li key={m.id}>
                <button type="button" className="arama-oge" onClick={() => onGit(m)}>
                  <span className="arama-meta"><b>{uyeAdi.get(m.uye_id) ?? "Eski üye"}</b> · #{kanalAdi.get(m.kanal_id) ?? "kanal"} · {gunEtiketi(m.olusturma)} {saat(m.olusturma)}</span>
                  <span className="arama-metin">{m.metin || (m.ek_yol ? "Resim" : "")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
