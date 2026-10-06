import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useSesMotoru, type Motor } from "./sesMotoru";
import SesCubugu from "./SesCubugu";
import type { Kanal, Mesaj, Tepki, Uye } from "./types";
import MessageView from "./MessageView";
import { bas, EMOJILER, gunEtiketi } from "./util";

const SAYFA = 50;
type Pane = "side" | "chat" | "mem";
const SES_LIMIT = Number(import.meta.env.VITE_SES_AYLIK_DAKIKA ?? 5000);

function birlestir(eski: Mesaj[], yeni: Mesaj[]): Mesaj[] {
  const m = new Map<string, Mesaj>();
  for (const x of [...eski, ...yeni]) m.set(x.id, x);
  return [...m.values()].sort((a, b) => a.olusturma.localeCompare(b.olusturma));
}

export default function Chat({ me, onExit }: { me: Uye; onExit: () => void }) {
  const [odaAdi, setOdaAdi] = useState("Çember");
  const [kanallar, setKanallar] = useState<Kanal[]>([]);
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const [cevrimici, setCevrimici] = useState<Set<string>>(new Set());
  const [aktif, setAktif] = useState<string | null>(null);
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [tepkiler, setTepkiler] = useState<Tepki[]>([]);
  const [dahaVar, setDahaVar] = useState(false);
  const [metin, setMetin] = useState("");
  const [emojiAcik, setEmojiAcik] = useState(false);
  const [pane, setPane] = useState<Pane>("chat");
  const [hata, setHata] = useState("");
  const aktifRef = useRef<string | null>(null);
  const akisRef = useRef<HTMLDivElement>(null);
  const altaKaydir = useRef(true);
  const metinRef = useRef<HTMLTextAreaElement>(null);
  const kanalRef = useRef<RealtimeChannel | null>(null);
  const [sesKonum, setSesKonum] = useState<Map<string, { kanal: string; motor: Motor | null }>>(new Map());
  const sesKonumRef = useRef(sesKonum);
  sesKonumRef.current = sesKonum;
  const [kullanimDk, setKullanimDk] = useState<number | null>(null);

  aktifRef.current = aktif;
  const kanalDuyur = useCallback((k: string | null, motor: Motor | null) => { void kanalRef.current?.track({ t: Date.now(), ses: k, motor }); }, []);
  const motorSor = useCallback((kanalId: string): Motor | null => {
    for (const [uid, v] of sesKonumRef.current) if (uid !== me.id && v.kanal === kanalId && v.motor) return v.motor;
    return null;
  }, [me.id]);
  const ses = useSesMotoru(me.id, kanalDuyur, motorSor);
  const uyeHaritasi = useMemo(() => new Map(uyeler.map((u) => [u.id, u])), [uyeler]);
  const aktifKanal = kanallar.find((k) => k.id === aktif);

  // İlk yükleme: oda, kanallar, üyeler
  useEffect(() => {
    (async () => {
      const [o, k, u] = await Promise.all([
        supabase.from("odalar").select("ad").eq("id", me.oda_id).maybeSingle(),
        supabase.from("kanallar").select("*").eq("oda_id", me.oda_id).order("sira"),
        supabase.from("uyeler").select("*").eq("oda_id", me.oda_id),
      ]);
      if (o.data) setOdaAdi(o.data.ad);
      if (k.data) {
        setKanallar(k.data as Kanal[]);
        const ilk = (k.data as Kanal[]).find((x) => x.tur === "yazili");
        if (ilk) setAktif(ilk.id);
      }
      if (u.data) setUyeler(u.data as Uye[]);
    })();
  }, [me.oda_id]);

  // Kanal değişince son 50 mesajı yükle
  useEffect(() => {
    if (!aktif) return;
    let iptal = false;
    setMesajlar([]); setTepkiler([]); setDahaVar(false);
    (async () => {
      const { data, error } = await supabase.from("mesajlar").select("*").eq("kanal_id", aktif)
        .order("olusturma", { ascending: false }).limit(SAYFA);
      if (iptal) return;
      if (error) return setHata("Mesajlar yüklenemedi.");
      const liste = ((data ?? []) as Mesaj[]).reverse();
      altaKaydir.current = true;
      setMesajlar(liste);
      setDahaVar((data ?? []).length === SAYFA);
      if (liste.length) {
        const { data: t } = await supabase.from("tepkiler").select("*").in("mesaj_id", liste.map((m) => m.id));
        if (!iptal && t) setTepkiler(t as Tepki[]);
      }
    })();
    return () => { iptal = true; };
  }, [aktif]);

  const eskileriYukle = useCallback(async () => {
    if (!aktif || !mesajlar.length) return;
    const { data } = await supabase.from("mesajlar").select("*").eq("kanal_id", aktif)
      .lt("olusturma", mesajlar[0].olusturma).order("olusturma", { ascending: false }).limit(SAYFA);
    const liste = ((data ?? []) as Mesaj[]).reverse();
    altaKaydir.current = false;
    const el = akisRef.current, eskiYuk = el?.scrollHeight ?? 0;
    setMesajlar((m) => birlestir(m, liste));
    setDahaVar((data ?? []).length === SAYFA);
    if (liste.length) {
      const { data: t } = await supabase.from("tepkiler").select("*").in("mesaj_id", liste.map((m) => m.id));
      if (t) setTepkiler((x) => [...x, ...(t as Tepki[]).filter((n) => !x.some((y) => y.id === n.id))]);
    }
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - eskiYuk; });
  }, [aktif, mesajlar]);

  // Realtime + presence
  useEffect(() => {
    const kanal = supabase.channel(`oda-${me.oda_id}`, { config: { presence: { key: me.id } } });
    kanalRef.current = kanal;
    kanal
      .on("postgres_changes", { event: "*", schema: "public", table: "mesajlar" }, (p) => {
        const m = (p.eventType === "DELETE" ? p.old : p.new) as Mesaj;
        if (m.kanal_id !== aktifRef.current) return;
        if (p.eventType === "DELETE") return setMesajlar((x) => x.filter((y) => y.id !== m.id));
        setMesajlar((x) => birlestir(x, [m]));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tepkiler" }, (p) => {
        if (p.eventType === "DELETE") {
          const t = p.old as Tepki;
          setTepkiler((x) => x.filter((y) => y.id !== t.id));
        } else {
          const t = p.new as Tepki;
          setTepkiler((x) => (x.some((y) => y.id === t.id) ? x : [...x, t]));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "uyeler" }, (p) => {
        if (p.eventType === "DELETE") {
          const u = p.old as Uye;
          if (u.id === me.id) { supabase.auth.signOut().then(onExit); return; }
          setUyeler((x) => x.filter((y) => y.id !== u.id));
        } else {
          const u = p.new as Uye;
          setUyeler((x) => (x.some((y) => y.id === u.id) ? x.map((y) => (y.id === u.id ? u : y)) : [...x, u]));
        }
      })
      .on("presence", { event: "sync" }, () => {
        const durum = kanal.presenceState<{ ses?: string | null; motor?: Motor | null }>();
        setCevrimici(new Set(Object.keys(durum)));
        const konum = new Map<string, { kanal: string; motor: Motor | null }>();
        for (const [uyeId, metalar] of Object.entries(durum)) {
          const son = metalar[metalar.length - 1];
          if (son?.ses) konum.set(uyeId, { kanal: son.ses, motor: son.motor ?? null });
        }
        setSesKonum(konum);
      })
      .subscribe(async (durum) => { if (durum === "SUBSCRIBED") await kanal.track({ t: Date.now(), ses: null, motor: null }); });

    const nabiz = setInterval(() => {
      supabase.from("uyeler").update({ son_gorulme: new Date().toISOString() }).eq("id", me.id).then(() => {});
    }, 60000);
    return () => { clearInterval(nabiz); kanalRef.current = null; supabase.removeChannel(kanal); };
  }, [me.id, me.oda_id, onExit]);

  useEffect(() => {
    const el = akisRef.current;
    if (el && altaKaydir.current) el.scrollTop = el.scrollHeight;
  }, [mesajlar]);

  // Oda sahibi için aylık ses kullanımı (bağlantı durumu değişince yenilenir)
  useEffect(() => {
    if (me.rol !== "sahip") return;
    supabase.rpc("ses_kullanim", { p_oda: me.oda_id }).then(({ data }) => { if (typeof data === "number") setKullanimDk(data); });
  }, [me.rol, me.oda_id, ses.durum]);

  async function gonder() {
    const t = metin.trim();
    if (!t || !aktif) return;
    setHata("");
    setMetin(""); setEmojiAcik(false);
    const { data, error } = await supabase.from("mesajlar").insert({ kanal_id: aktif, uye_id: me.id, metin: t }).select().single();
    if (error) { setMetin(t); return setHata("Mesaj gönderilemedi."); }
    altaKaydir.current = true;
    setMesajlar((x) => birlestir(x, [data as Mesaj]));
    metinRef.current?.focus();
  }

  async function sil(m: Mesaj) {
    if (!confirm("Bu mesaj silinsin mi?")) return;
    const { error } = await supabase.from("mesajlar").update({ silindi: true }).eq("id", m.id);
    if (error) return setHata("Mesaj silinemedi.");
    setMesajlar((x) => x.map((y) => (y.id === m.id ? { ...y, silindi: true } : y)));
  }

  async function tepkiDegistir(mesajId: string, emoji: string) {
    const var_ = tepkiler.find((t) => t.mesaj_id === mesajId && t.uye_id === me.id && t.emoji === emoji);
    if (var_) {
      setTepkiler((x) => x.filter((t) => t.id !== var_.id));
      const { error } = await supabase.from("tepkiler").delete().eq("id", var_.id);
      if (error) setTepkiler((x) => [...x, var_]);
    } else {
      const { data, error } = await supabase.from("tepkiler").insert({ mesaj_id: mesajId, uye_id: me.id, emoji }).select().single();
      if (!error && data) setTepkiler((x) => (x.some((y) => y.id === data.id) ? x : [...x, data as Tepki]));
    }
  }

  async function cikis() {
    if (!confirm("Çıkış yapılsın mı? Bu takma adla bu tarayıcıdan tekrar giremezsin; oda sahibi seni silerse yeniden katılabilirsin.")) return;
    await supabase.auth.signOut();
    onExit();
  }

  const yaziKanallari = kanallar.filter((k) => k.tur === "yazili");
  const sesKanallari = kanallar.filter((k) => k.tur === "sesli");
  const cevrimiciUyeler = uyeler.filter((u) => cevrimici.has(u.id) || u.id === me.id);
  const cevrimdisiUyeler = uyeler.filter((u) => !cevrimiciUyeler.includes(u));

  let sonGun = "";
  const satirlar: React.ReactNode[] = [];
  for (const m of mesajlar) {
    const g = gunEtiketi(m.olusturma);
    if (g !== sonGun) { sonGun = g; satirlar.push(<div className="day" key={"g" + m.id}>{g}</div>); }
    satirlar.push(
      <MessageView key={m.id} mesaj={m} yazar={uyeHaritasi.get(m.uye_id)} benim={me}
        tepkiler={tepkiler.filter((t) => t.mesaj_id === m.id)} onTepki={tepkiDegistir} onSil={sil} />,
    );
  }

  const UyeSatiri = ({ u, acik }: { u: Uye; acik: boolean }) => (
    <div className={"mem" + (acik ? "" : " off")}>
      <div className="dot" style={{ background: u.renk }} aria-hidden="true">{bas(u.takma_ad)}{acik && <span className="on-dot" />}</div>
      <div>{u.takma_ad}{u.rol === "sahip" && <small>Oda sahibi</small>}</div>
    </div>
  );

  return (
    <div id="app" className="on" data-pane={pane}>
      <section className="col side" aria-label="Kanallar">
        <div className="head"><h1>{odaAdi}</h1></div>
        <nav className="scroll" aria-label="Kanal listesi">
          <div className="sec">Yazılı kanallar</div>
          {yaziKanallari.map((k) => (
            <button key={k.id} className="ch" aria-current={k.id === aktif} onClick={() => { setAktif(k.id); setPane("chat"); }}>
              <span className="hash" aria-hidden="true">#</span>{k.ad}
            </button>
          ))}
          <div className="sec">Sesli odalar</div>
          {sesKanallari.map((k) => {
            const icindekiler = uyeler.filter((u) => sesKonum.get(u.id)?.kanal === k.id);
            const buradayim = ses.kanalId === k.id && ses.durum !== "kapali";
            return (
              <div key={k.id}>
                <button className="ch" aria-pressed={buradayim} disabled={ses.durum === "baglaniyor"}
                  onClick={() => (buradayim ? ses.ayril() : ses.baglan(k.id))}
                  aria-label={`${k.ad} sesli odası, ${buradayim ? "ayrılmak için tıkla" : "katılmak için tıkla"}`}>
                  <span className="hash" aria-hidden="true">🔊</span>{k.ad}
                  {buradayim && <span className="soon">bağlı</span>}
                </button>
                {icindekiler.length > 0 && (
                  <ul className="vlist" aria-label={`${k.ad} katılımcıları`}>
                    {icindekiler.map((u) => (
                      <li key={u.id} className="vp">
                        <span className={"dot" + (ses.konusanlar.has(u.id) ? " speak" : "")} style={{ background: u.renk }} aria-hidden="true">{bas(u.takma_ad)}</span>
                        {u.takma_ad}{ses.konusanlar.has(u.id) && <span className="sr"> konuşuyor</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
        <SesCubugu className="vbar-side" ses={ses} kanalAdi={kanallar.find((k) => k.id === ses.kanalId)?.ad ?? ""} />
        <div className="me">
          <div className="dot" style={{ background: me.renk }} aria-hidden="true">{bas(me.takma_ad)}</div>
          <div><b>{me.takma_ad}</b><span>{me.rol === "sahip" ? "Oda sahibi" : "Üye"}</span></div>
          <button className="linkbtn" style={{ marginLeft: "auto" }} onClick={cikis}>Çıkış</button>
        </div>
      </section>

      <section className="col chat" aria-label="Sohbet">
        <div className="head"><h2># {aktifKanal?.ad ?? "…"}</h2></div>
        <SesCubugu className="vbar-chat" ses={ses} kanalAdi={kanallar.find((k) => k.id === ses.kanalId)?.ad ?? ""} />
        {hata && <div className="banner" role="alert">{hata}</div>}
        {ses.hata && <div className="banner" role="alert">{ses.hata} <button className="linkbtn" onClick={ses.hataTemizle}>Kapat</button></div>}
        {ses.bilgi && !ses.hata && <div className="banner info" role="status">{ses.bilgi} <button className="linkbtn" onClick={ses.hataTemizle}>Tamam</button></div>}
        {me.rol === "sahip" && kullanimDk !== null && kullanimDk >= SES_LIMIT * 0.8 && (
          <div className="banner" role="status">Bu ay sesli odada {kullanimDk} / {SES_LIMIT} dakika kullanıldı{kullanimDk >= SES_LIMIT ? "; limit doldu, ses kapandı" : "; limite yaklaşıyorsunuz"}. Yazılı sohbet çalışmaya devam eder.</div>
        )}
        <div className="msgs" ref={akisRef} role="log" aria-live="polite" aria-label="Mesajlar">
          {dahaVar && <button className="more" onClick={eskileriYukle}>Eski mesajları yükle</button>}
          {!mesajlar.length && <div className="empty">Henüz mesaj yok. İlk mesajı sen yaz.</div>}
          {satirlar}
        </div>
        <div className="composer">
          {emojiAcik && (
            <div className="picker on" role="group" aria-label="Emoji seç">
              {EMOJILER.map((e) => (
                <button key={e} aria-label={e} onClick={() => { setMetin((m) => m + e); metinRef.current?.focus(); }}>{e}</button>
              ))}
            </div>
          )}
          <button className="sq" onClick={() => setEmojiAcik(!emojiAcik)} aria-label="Emoji seçici" aria-expanded={emojiAcik}>🙂</button>
          <textarea ref={metinRef} rows={1} value={metin} maxLength={4000} aria-label="Mesaj yaz"
            placeholder={`#${aktifKanal?.ad ?? ""} kanalına yaz`}
            onChange={(e) => setMetin(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); gonder(); } }} />
          <button className="sq send" onClick={gonder} aria-label="Gönder" disabled={!metin.trim()}>➤</button>
        </div>
      </section>

      <aside className="col members" aria-label="Üyeler">
        <div className="head"><h2>Üyeler — {uyeler.length}</h2></div>
        <div className="scroll">
          <div className="sec">Çevrimiçi — {cevrimiciUyeler.length}</div>
          {cevrimiciUyeler.map((u) => <UyeSatiri key={u.id} u={u} acik />)}
          {cevrimdisiUyeler.length > 0 && <div className="sec">Çevrimdışı — {cevrimdisiUyeler.length}</div>}
          {cevrimdisiUyeler.map((u) => <UyeSatiri key={u.id} u={u} acik={false} />)}
        </div>
      </aside>

      {ses.kabiRefleri.map((r, i) => <div key={i} ref={r} className="sr" aria-hidden="true" />)}
      <nav className="nav" aria-label="Bölme seçimi">
        <button aria-current={pane === "side"} onClick={() => setPane("side")}>Kanallar</button>
        <button aria-current={pane === "chat"} onClick={() => setPane("chat")}>Sohbet</button>
        <button aria-current={pane === "mem"} onClick={() => setPane("mem")}>Üyeler</button>
      </nav>
    </div>
  );
}
