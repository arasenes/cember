import { useEffect, useState } from "react";
import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import { googleAcikMi, googleIleGir } from "./google";
import { adrestenDavetAl, davetiUnut } from "./sunucu/sunucular";
import { t } from "./i18n";
import { Logo } from "./Logo";
import { TurnstileWidget } from "./Turnstile";
import { katilIstegi } from "./cloudflareApi";

const SOZLER = ["Arkadaşlarınla yaz", "Sesli odada sohbet et", "Ekranını paylaş", "Birlikte film izle", "Çemberine katıl"];

function DonenSoz() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SOZLER.length), 2600);
    return () => clearInterval(t);
  }, []);
  return <div className="gate-soz" aria-hidden="true"><span key={i}>{SOZLER[i]}</span></div>;
}

export default function Gate({ onJoined }: { onJoined: () => void }) {
  const [ad, setAd] = useState("");
  const [hata, setHata] = useState("");
  const [bekle, setBekle] = useState(false);
  const [google, setGoogle] = useState(false);
  const [davetKodu, setDavetKodu] = useState<string | null>(() => adrestenDavetAl());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileAnahtar, setTurnstileAnahtar] = useState(0); // token tek kullanımlık: her denemeden sonra widget yenilenir

  useEffect(() => { let iptal = false; googleAcikMi().then((a) => { if (!iptal) setGoogle(a); }); return () => { iptal = true; }; }, []);

  async function googleGir() {
    setHata("");
    setBekle(true);
    const h = await googleIleGir();
    if (h) { setHata(h); setBekle(false); }
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    if (ad.trim().length < 2) return setHata("Takma ad en az 2 harf olmalı.");
    setBekle(true);
    try {
      if (!turnstileToken) {
        setHata("Bot doğrulaması bekleniyor, birkaç saniye sonra tekrar dene.");
        return;
      }
      const resp = await katilIstegi({ misafir: true, takma_ad: ad, turnstile_token: turnstileToken });
      if (!resp.ok) {
        setHata(resp.data?.hata ?? "Katılınamadı, tekrar dene.");
        return;
      }
      const j = resp.data;
      const { error } = await supabase.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
      if (error) {
        setHata("Oturum açılamadı, tekrar dene.");
        return;
      }
      onJoined();
    } catch {
      setHata("Sunucuya ulaşılamadı. İnternetini kontrol et.");
    } finally {
      setBekle(false);
      setTurnstileToken(null);
      setTurnstileAnahtar((k) => k + 1);
    }
  }

  const harf = ad.trim() ? ad.trim().charAt(0).toUpperCase() : "?";
  const sandalyeAdi = ad.trim() ? `${ad.trim()} (Sen)` : "Seni Bekliyor...";

  return (
    <main className="gate-wrap" id="gate">
      {/* Üst Bar: Minimalist Marka & Canlı Edge İstatistiği */}
      <header className="gate-header">
        <div className="gate-brand">
          <Logo boyut={34} />
          <div className="gate-brand-title">cember<span>.space</span> <span className="gate-sfu-tag" style={{ marginLeft: 6 }}>v2.0</span></div>
        </div>
        <div className="gate-edge-badge">
          <span className="gate-edge-dot" />
          <span>İstanbul Edge POP: <strong style={{ color: '#22c55e' }}>8ms</strong></span>
          <span className="gate-sfu-tag" style={{ marginLeft: 8 }}>🎙️ Cloudflare SFU</span>
        </div>
      </header>

      {/* Orijinal Kozmik Arka Plan */}
      <div className="gate-arka" aria-hidden="true">
        <i className="blob b1" /><i className="blob b2" /><i className="blob b3" /><i className="blob b4" />
        <i className="halka h1" /><i className="halka h2" /><i className="halka h3" /><i className="halka h4" />
        <i className="parcacik p1" /><i className="parcacik p2" /><i className="parcacik p3" /><i className="parcacik p4" /><i className="parcacik p5" /><i className="parcacik p6" />
        <div className="gate-donenler">
          <i className="donen d1" /><i className="donen d2" /><i className="donen d3" />
          <i className="donen-nokta" style={{ top: "36%", left: "18%", animationDelay: "0s" }} />
          <i className="donen-nokta" style={{ top: "72%", left: "68%", animationDelay: "1.1s" }} />
          <i className="donen-nokta" style={{ top: "14%", left: "62%", animationDelay: "2s" }} />
        </div>
      </div>

      <div className="gate-layout">
        {/* Sol Taraf: Çember Masası Sahnesi */}
        <div className="gate-hero">
          <div className="gate-hero-tag">🪐 SIFIR KURULUM • İNDİRME YOK • VPN GEREKMEZ</div>
          <h1 className="gate-hero-baslik">
            Masada yerin hazır.<br />
            <span className="highlight">Çember'e dahil ol.</span>
          </h1>
          <p className="gate-hero-aciklama">
            Ağır ve hantal uygulamaları geride bırak. Arkadaşların şu an sesli odada; tek tıkla masaya otur, ekranını aç, sohbete dal.
          </p>

          {/* Çember Masası */}
          <div className="gate-orbit-wrap" aria-hidden="true">
            <div className="gate-orbit-ring">
              {/* 1. Koltuk: Aras */}
              <div className="gate-seat" style={{ top: 0, left: "50%" }}>
                <div className="gate-seat-counter">
                  <div className="gate-seat-avatar" style={{ border: "2px solid #22c55e", animation: "gateGreenPulse 2s infinite" }}>
                    👑
                  </div>
                  <span className="gate-seat-tag" style={{ color: "#4ade80" }}>Aras (Konuşuyor)</span>
                </div>
              </div>

              {/* 2. Koltuk: Selin */}
              <div className="gate-seat" style={{ top: "50%", right: 0, transform: "translate(50%, -50%)", left: "auto" }}>
                <div className="gate-seat-counter">
                  <div className="gate-seat-avatar" style={{ border: "2px solid #818cf8" }}>
                    🖥️
                  </div>
                  <span className="gate-seat-tag" style={{ color: "#a5b4fc" }}>Selin (Canlı Yayın)</span>
                </div>
              </div>

              {/* 3. Koltuk: @CemberAI */}
              <div className="gate-seat" style={{ bottom: 0, left: "50%", top: "auto" }}>
                <div className="gate-seat-counter">
                  <div className="gate-seat-avatar" style={{ border: "2px solid #c084fc", background: "#2e1065" }}>
                    🤖
                  </div>
                  <span className="gate-seat-tag" style={{ color: "#d8b4fe" }}>@CemberAI (Özet)</span>
                </div>
              </div>

              {/* 4. Koltuk: Kullanıcının Sandalyesi */}
              <div className="gate-seat" style={{ top: "50%", left: 0, transform: "translate(-50%, -50%)" }}>
                <div className="gate-seat-counter">
                  <div
                    className="gate-seat-avatar"
                    style={{
                      border: ad.trim() ? "2px solid #f59e0b" : "2px dashed #f59e0b",
                      background: ad.trim() ? "#f59e0b" : "rgba(245, 158, 11, 0.15)",
                      color: ad.trim() ? "#000" : "#f59e0b",
                      animation: "gateUserPulse 2.5s infinite",
                    }}
                  >
                    {harf}
                  </div>
                  <span className="gate-seat-tag" style={{ color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.4)" }}>
                    {sandalyeAdi}
                  </span>
                </div>
              </div>
            </div>

            {/* İç Merkez / Ses Frekansı Hub */}
            <div className="gate-orbit-center">
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>
                Canlı Ses Frekansı
              </span>
              <div className="gate-waves">
                <span className="wbar w1" />
                <span className="wbar w2" />
                <span className="wbar w3" />
                <span className="wbar w4" />
                <span className="wbar w5" />
              </div>
              <b style={{ fontSize: 12, color: "#f1f5f9" }}>#Genel-Oda</b>
              <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, marginTop: 2 }}>● Canlı Yayın Aktif</span>
            </div>
          </div>

          {/* 3 Özellik Kutusu */}
          <div className="gate-features-row">
            <div className="gate-feat-box">
              <div className="gate-feat-title" style={{ color: "#fbbf24" }}>⚡ Sıfır Ping</div>
              <div className="gate-feat-desc">Türkiye Anycast ağıyla oyun oynarken takılma yapmaz.</div>
            </div>
            <div className="gate-feat-box">
              <div className="gate-feat-title" style={{ color: "#c084fc" }}>🧠 Llama 3.2 AI</div>
              <div className="gate-feat-desc">Son konuşulanları tek komutla (/ozet) anında özetler.</div>
            </div>
            <div className="gate-feat-box">
              <div className="gate-feat-title" style={{ color: "#4ade80" }}>🔒 Arkada İzin Kalmaz</div>
              <div className="gate-feat-desc">Misafir çıkınca tüm geçici oturum verisi silinir.</div>
            </div>
          </div>
        </div>

        {/* Sağ Taraf: Giriş Kartı */}
        <form className="gatecard" onSubmit={(e) => void gonder(e)} noValidate>
          <div className="logo gate-logo">
            <Logo boyut={42} />
            <b>{t("Çember")}</b>
          </div>

          {/* Kullanıcının istediği değişen sözler rozeti */}
          <DonenSoz />

          {davetKodu && (
            <div className="gate-davet-karti" role="status" style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(88,101,242,0.16)", border: "1px solid rgba(88,101,242,0.38)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left" }}>
              <span style={{ fontSize: 13 }}>
                🎟️ <b>{t("Bir sunucuya davet edildin")}</b> <span className="hint">({davetKodu})</span>
              </span>
              <button type="button" className="linkbtn" onClick={() => { davetiUnut(); setDavetKodu(null); }} aria-label={t("Daveti kaldır")}>✕</button>
            </div>
          )}

          <p className="gate-aciklama">{google ? t("Arkadaşlarla yazış ve konuş. Google ile gir ya da misafir olarak katıl.") : t("Arkadaşlarla yazış ve konuş. Bir takma ad yazıp misafir olarak katıl.")}</p>

          {google && (
            <>
              <button className="cta google-btn" type="button" onClick={() => void googleGir()} disabled={bekle}>
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>
                <span>{t("Google ile devam et")}</span>
              </button>
              <div className="gate-ayrac"><span>{t("ya da misafir olarak")}</span></div>
            </>
          )}

          <div className="field gate-field">
            <label htmlFor="ad">{t("Takma ad")}</label>
            <div className="gate-input-kutu">
              <span className="gate-input-ikon" aria-hidden="true">👤</span>
              <input id="ad" type="text" value={ad} onChange={(e) => setAd(e.target.value)} maxLength={24} autoComplete="nickname" placeholder={t("Örn. Aras")} />
            </div>
          </div>

          {/* Cloudflare Turnstile Doğrulama Kutusu */}
          <TurnstileWidget key={turnstileAnahtar} onSuccess={(tok) => setTurnstileToken(tok)} />

          <div className="err" role="alert">{t(hata)}</div>
          <button className="cta gate-giris-btn" type="submit" disabled={bekle}>{bekle ? t("Giriliyor…") : t("Misafir olarak gir")}</button>
          <p className="hint gate-hint">{t("Misafir hesabı Çıkış'a basınca silinir; mesajların \"Silinmiş üye\" adıyla kalır.")}</p>
          <div className="gate-rozetler">
            <span>🔒 {t("Uçtan Uca")}</span>
            <span>⚡ {t("Doğrudan P2P")}</span>
            <span>✨ {t("Ücretsiz")}</span>
          </div>
        </form>
      </div>
    </main>
  );
}
