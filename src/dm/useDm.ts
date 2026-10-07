import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { iliskiBul, type Arkadaslik, type DmKanal, type DmMesaj, type DmUyesi, type Iliski } from "./tipler";

type Secenek = { onYeniMesaj?: (m: DmMesaj) => void; odaId?: string };

/** DM listesi, arkadaşlıklar ve okunmamış sayıları; Realtime ile canlı. Chat'te sunucu görünümünde de çalışır (rozet için). */
export function useDm(benId: string, aktifDm: string | null, secenek: Secenek = {}) {
  const [kanallar, setKanallar] = useState<DmKanal[]>([]);
  const [uyeleri, setUyeleri] = useState<DmUyesi[]>([]);
  const [arkadasliklar, setArkadasliklar] = useState<Arkadaslik[]>([]);
  const [okunmamis, setOkunmamis] = useState<Record<string, number>>({});
  const [hazir, setHazir] = useState(false);
  const aktifRef = useRef(aktifDm);
  aktifRef.current = aktifDm;
  const secenekRef = useRef(secenek);
  secenekRef.current = secenek;

  const yukle = useCallback(async () => {
    const [k, u, a, o] = await Promise.all([
      supabase.from("dm_kanallari").select("*").order("son_mesaj", { ascending: false }),
      supabase.from("dm_uyeleri").select("dm_id, uye_id, son_okuma"),
      supabase.from("arkadasliklar").select("*"),
      supabase.rpc("dm_okunmamis"),
    ]);
    // Çoklu sunucu: yalnızca bu sunucunun konuşmaları (oda_id boş eski kayıtlar da gösterilir)
    if (k.data) setKanallar((k.data as DmKanal[]).filter((d) => !secenekRef.current.odaId || !d.oda_id || d.oda_id === secenekRef.current.odaId));
    if (u.data) setUyeleri(u.data as DmUyesi[]);
    if (a.data) setArkadasliklar(a.data as Arkadaslik[]);
    const sayilar: Record<string, number> = {};
    for (const r of ((o.data ?? []) as { dm_id: string; n: number }[])) sayilar[r.dm_id] = r.n;
    setOkunmamis(sayilar);
    setHazir(true);
  }, []);

  useEffect(() => { void yukle(); }, [yukle, benId]);

  // Canlı: yapı değişince (yeni DM, üye, arkadaşlık) yeniden yükle; yeni mesajda sayaç ve sıralama güncellenir
  useEffect(() => {
    let zamanlayici: ReturnType<typeof setTimeout> | null = null;
    const yenile = () => { if (zamanlayici) clearTimeout(zamanlayici); zamanlayici = setTimeout(() => void yukle(), 250); };
    const k = supabase.channel(`dm-${benId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_mesajlari" }, (p) => {
        const m = p.new as DmMesaj;
        setKanallar((x) => {
          const i = x.findIndex((d) => d.id === m.dm_id);
          if (i < 0) { yenile(); return x; }
          const d = { ...x[i], son_mesaj: m.olusturma };
          return [d, ...x.filter((_, j) => j !== i)];
        });
        if (m.uye_id !== benId) {
          if (aktifRef.current !== m.dm_id || document.visibilityState !== "visible") setOkunmamis((x) => ({ ...x, [m.dm_id]: (x[m.dm_id] ?? 0) + 1 }));
          secenekRef.current.onYeniMesaj?.(m);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_uyeleri" }, yenile)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_kanallari" }, yenile)
      .on("postgres_changes", { event: "*", schema: "public", table: "arkadasliklar" }, yenile)
      .subscribe();
    return () => { if (zamanlayici) clearTimeout(zamanlayici); void supabase.removeChannel(k); };
  }, [benId, yukle]);

  const okundu = useCallback(async (dmId: string) => {
    setOkunmamis((x) => { if (!x[dmId]) return x; const y = { ...x }; delete y[dmId]; return y; });
    await supabase.rpc("dm_okundu", { p_dm: dmId });
  }, []);

  // Açık DM'e okunmamış sayaç yazılmasın
  useEffect(() => { if (aktifDm) void okundu(aktifDm); }, [aktifDm, okundu]);

  const hata = (e: { message: string } | null): string | null => (e ? e.message : null);

  const eylemler = useMemo(() => ({
    /** İkili DM açar (varsa mevcut olanı döndürür). */
    async dmAc(hedefUyeId: string): Promise<{ id: string | null; hata: string | null }> {
      const { data, error } = await supabase.rpc("dm_ac", { p_hedef: hedefUyeId });
      if (error) return { id: null, hata: error.message };
      await yukle();
      return { id: data as string, hata: null };
    },
    async grupOlustur(ad: string, uyeIdleri: string[]): Promise<{ id: string | null; hata: string | null }> {
      const { data, error } = await supabase.rpc("dm_grup_olustur", { p_ad: ad, p_uyeler: uyeIdleri });
      if (error) return { id: null, hata: error.message };
      await yukle();
      return { id: data as string, hata: null };
    },
    async grupUyeEkle(dmId: string, uyeId: string) { const r = hata((await supabase.rpc("dm_grup_uye_ekle", { p_dm: dmId, p_uye: uyeId })).error); await yukle(); return r; },
    /** Gruptan kendi üyeliğini siler (RLS yalnızca grup DM'de izin verir). */
    async grupAyril(dmId: string) {
      const { error } = await supabase.from("dm_uyeleri").delete().eq("dm_id", dmId).eq("uye_id", benId);
      await yukle();
      return hata(error);
    },
    async arkadasIstek(hedefId: string) { const { data, error } = await supabase.rpc("arkadas_istek", { p_hedef: hedefId }); await yukle(); return { sonuc: data as string | null, hata: hata(error) }; },
    async arkadasYanit(id: string, kabul: boolean) { const r = hata((await supabase.rpc("arkadas_yanit", { p_id: id, p_kabul: kabul })).error); await yukle(); return r; },
    async arkadasSil(hedefId: string) { const r = hata((await supabase.rpc("arkadas_sil", { p_hedef: hedefId })).error); await yukle(); return r; },
    async engelle(hedefId: string) { const r = hata((await supabase.rpc("engelle", { p_hedef: hedefId })).error); await yukle(); return r; },
    async engelKaldir(hedefId: string) { const r = hata((await supabase.rpc("engel_kaldir", { p_hedef: hedefId })).error); await yukle(); return r; },
  }), [benId, yukle]);

  const iliski = useCallback((hedefId: string): Iliski => iliskiBul(arkadasliklar, benId, hedefId), [arkadasliklar, benId]);
  const toplamOkunmamis = useMemo(() => {
    const bu = new Set(kanallar.map((d) => d.id));
    return Object.entries(okunmamis).reduce((a, [id, n]) => a + (bu.has(id) ? n : 0), 0);
  }, [okunmamis, kanallar]);
  const gelenIstekler = useMemo(() => arkadasliklar.filter((r) => r.durum === "bekliyor" && r.b === benId), [arkadasliklar, benId]);

  return { kanallar, uyeleri, arkadasliklar, okunmamis, toplamOkunmamis, gelenIstekler, hazir, iliski, okundu, yenile: yukle, ...eylemler };
}

export type DmDurumu = ReturnType<typeof useDm>;
