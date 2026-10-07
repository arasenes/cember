import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

export type AnketSecenek = { id: string; metin: string; sira: number };
export type AnketOy = { uye_id: string; secenek_id: string };
export type Anket = { id: string; mesaj_id: string; soru: string; bitis: string | null; coklu: boolean; secenekler: AnketSecenek[]; oylar: AnketOy[] };

export type AnketGorunum = {
  anket: Anket;
  toplamOy: number;
  secenekler: { id: string; metin: string; sayi: number; yuzde: number; benim: boolean }[];
  bitti: boolean;
};

/** Oy sayılarını ve yüzdeleri hesaplar (yüzde = o seçeneğe oy veren kişi / toplam oy kullanan kişi). */
export function anketGorunumu(anket: Anket, benUyeId: string, simdi = Date.now()): AnketGorunum {
  const oyuKullananlar = new Set(anket.oylar.map((o) => o.uye_id));
  const toplam = oyuKullananlar.size;
  const secenekler = [...anket.secenekler].sort((a, b) => a.sira - b.sira).map((s) => {
    const sayi = anket.oylar.filter((o) => o.secenek_id === s.id).length;
    return {
      id: s.id, metin: s.metin, sayi,
      yuzde: toplam ? Math.round((sayi / toplam) * 100) : 0,
      benim: anket.oylar.some((o) => o.secenek_id === s.id && o.uye_id === benUyeId),
    };
  });
  return { anket, toplamOy: toplam, secenekler, bitti: !!anket.bitis && new Date(anket.bitis).getTime() <= simdi };
}

/** Oy ekler/çıkarır (tek seçimli ankette önceki oyu değiştirir). Sunucu kuralıyla aynı. */
export function oyUygula(anket: Anket, uyeId: string, secenekId: string, oy: boolean): Anket {
  let oylar = anket.oylar.filter((o) => !(o.uye_id === uyeId && o.secenek_id === secenekId));
  if (oy) {
    if (!anket.coklu) oylar = oylar.filter((o) => o.uye_id !== uyeId);
    oylar = [...oylar, { uye_id: uyeId, secenek_id: secenekId }];
  }
  return { ...anket, oylar };
}

/** Yüklü mesajların anketlerini getirir ve oyları canlı izler. */
export function useAnketler(mesajIdleri: string[], benUyeId: string) {
  const [anketler, setAnketler] = useState<Map<string, Anket>>(new Map());
  const sorulan = useRef(new Set<string>());
  const anahtar = mesajIdleri.join(",");

  useEffect(() => {
    const yeni = mesajIdleri.filter((id) => !sorulan.current.has(id));
    if (!yeni.length) return;
    yeni.forEach((id) => sorulan.current.add(id));
    let iptal = false;
    (async () => {
      const { data: a } = await supabase.from("anketler").select("id, mesaj_id, soru, bitis, coklu").in("mesaj_id", yeni);
      if (iptal || !a?.length) return;
      const idler = a.map((x) => x.id as string);
      const [s, o] = await Promise.all([
        supabase.from("anket_secenekleri").select("id, anket_id, metin, sira").in("anket_id", idler).order("sira"),
        supabase.from("anket_oylari").select("anket_id, uye_id, secenek_id").in("anket_id", idler),
      ]);
      if (iptal) return;
      setAnketler((x) => {
        const y = new Map(x);
        for (const r of a as { id: string; mesaj_id: string; soru: string; bitis: string | null; coklu: boolean }[]) {
          y.set(r.mesaj_id, {
            ...r,
            secenekler: ((s.data ?? []) as (AnketSecenek & { anket_id: string })[]).filter((q) => q.anket_id === r.id).map(({ id, metin, sira }) => ({ id, metin, sira })),
            oylar: ((o.data ?? []) as (AnketOy & { anket_id: string })[]).filter((q) => q.anket_id === r.id).map(({ uye_id, secenek_id }) => ({ uye_id, secenek_id })),
          });
        }
        return y;
      });
    })();
    return () => { iptal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar]);

  // Oylar canlı: RLS yalnızca görebildiğimiz anketlerin olaylarını iletir
  useEffect(() => {
    const k = supabase.channel("anket-oylari")
      .on("postgres_changes", { event: "*", schema: "public", table: "anket_oylari" }, (p) => {
        const r = (p.eventType === "DELETE" ? p.old : p.new) as { anket_id?: string; uye_id?: string; secenek_id?: string };
        if (!r.anket_id || !r.uye_id || !r.secenek_id) return;
        const { anket_id, uye_id, secenek_id } = r as Required<typeof r>;
        setAnketler((x) => {
          const mesajId = [...x.values()].find((a) => a.id === anket_id)?.mesaj_id;
          if (!mesajId) return x;
          const a = x.get(mesajId)!;
          const varMi = a.oylar.some((o) => o.uye_id === uye_id && o.secenek_id === secenek_id);
          if (p.eventType === "DELETE") return varMi ? new Map(x).set(mesajId, oyUygula(a, uye_id, secenek_id, false)) : x;
          return varMi ? x : new Map(x).set(mesajId, oyUygula(a, uye_id, secenek_id, true));
        });
      })
      .subscribe();
    return () => { void supabase.removeChannel(k); };
  }, []);

  const oyla = useCallback(async (mesajId: string, secenekId: string, oy: boolean): Promise<string | null> => {
    const eski = anketler.get(mesajId);
    if (!eski) return "Anket bulunamadı.";
    setAnketler((x) => new Map(x).set(mesajId, oyUygula(eski, benUyeId, secenekId, oy)));
    const { error } = await supabase.rpc("anket_oyla", { p_secenek: secenekId, p_oy: oy });
    if (error) {
      setAnketler((x) => new Map(x).set(mesajId, eski));
      return error.message.includes("sona erdi") ? "Bu anket sona erdi." : "Oy verilemedi.";
    }
    return null;
  }, [anketler, benUyeId]);

  return { anketler, oyla };
}
