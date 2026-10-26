import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BirlikteIzle, { hesaplananKonum, youtubeIdCikar } from "./ses/BirlikteIzle";
import { efektCal, gecerliEfektMi, SES_EFEKTLERI } from "./ses/efektler";
import { dmResimCoz, SesliMesajOynatici, sesliMesajCoz } from "./mesaj/SesliMesaj";
import { duzMetin, kodRenklendir, metinOge } from "./mesaj/markdown";
import { MiniOyunKart, miniOyunCoz, miniOyunKodla, tkmKazanan, xoxBotHamlesi, xoxKazanan } from "./mesaj/MiniOyun";
import { kaydedilenleriOku, mesajKaydetDegistir } from "./mesaj/kaydedilenler";
import KaydedilenlerPaneli from "./mesaj/KaydedilenlerPaneli";
import BeyazTahta, { gecerliCizimOlayiMi } from "./ses/BeyazTahta";
import SesSahnesi from "./ses/SesSahnesi";
import { gecerliSesModuMu, SES_MODLARI } from "./ses/sesDegistirici";
import { seviyeIcinGerekenXp, xpToSeviye, xpKaydet, liderlikTablosuGetir } from "./gamification/seviye";
import { cekilisCoz, cekilisKodla, yeniCekilisOlustur, CekilisKart } from "./mesaj/Cekilis";
import { HAZIR_RADYOLAR } from "./ses/MuzikCalar";
import Gate from "./Gate";

describe("1. Birlikte İzle (Watch Party)", () => {
  it("farklı YouTube bağlantı biçimlerinden video kimliğini çıkarır", () => {
    expect(youtubeIdCikar("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdCikar("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdCikar("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdCikar("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdCikar("https://ornek.com/video")).toBeNull();
  });

  it("oynayan ve duraklatılmış videonun senkronize saniyesini doğru hesaplar", () => {
    const t0 = 1_000_000;
    expect(hesaplananKonum({ videoId: "dQw4w9WgXcQ", baslatanId: "u1", baslangicSn: 30, oynuyor: true, guncelleme: t0 }, t0 + 12_500)).toBe(42);
    expect(hesaplananKonum({ videoId: "dQw4w9WgXcQ", baslatanId: "u1", baslangicSn: 30, oynuyor: false, guncelleme: t0 }, t0 + 12_500)).toBe(30);
  });

  it("YouTube bağlantısı girilip başlatıldığında durumu günceller", () => {
    const onDegistir = vi.fn();
    render(<BirlikteIzle durum={null} baslatanAd="" benId="u1" onDegistir={onDegistir} />);
    fireEvent.change(screen.getByLabelText("YouTube bağlantısı"), { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
    fireEvent.click(screen.getByText("Başlat"));
    expect(onDegistir).toHaveBeenCalledWith(expect.objectContaining({
      videoId: "dQw4w9WgXcQ",
      baslatanId: "u1",
      baslangicSn: 0,
      oynuyor: true,
    }));
  });

  it("bilgisayar/USB sekmesine geçip yerel video dosyasını senkronize başlatabilir", () => {
    const onDegistir = vi.fn();
    const { container } = render(<BirlikteIzle durum={null} baslatanAd="" benId="u1" onDegistir={onDegistir} />);
    fireEvent.click(screen.getByText("📁 Bilgisayar / USB Dosyası"));
    expect(screen.getByText("📂 Bilgisayardan veya USB'den Video Seç")).toBeTruthy();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    const sahteDosya = new File(["video-verisi"], "film.mp4", { type: "video/mp4" });
    fireEvent.change(input, { target: { files: [sahteDosya] } });

    expect(onDegistir).toHaveBeenCalledWith(expect.objectContaining({
      tur: "dosya",
      videoId: "film.mp4",
      baslatanId: "u1",
      baslangicSn: 0,
      oynuyor: true,
    }));
  });
});

describe("2. Sesli Oda Efekt Paneli (Soundboard)", () => {
  it("6 ses efektini tanımlar ve doğrular", () => {
    expect(SES_EFEKTLERI).toHaveLength(6);
    for (const e of SES_EFEKTLERI) {
      expect(gecerliEfektMi(e.kod)).toBe(true);
    }
    expect(gecerliEfektMi("bilinmeyen")).toBe(false);
    expect(() => efektCal("zafer", true)).not.toThrow();
  });
});

describe("3 & 4. Sesli Mesaj ve DM Resim Çözümleme", () => {
  const ornekYol = "680ea57c-8b3e-4a57-b21c-ea7bcfd14659/11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.webp";

  it("sesli mesaj etiketini çözer ve oynatıcıyı gösterir", () => {
    const m = `[sesli:${ornekYol}|14]`;
    expect(sesliMesajCoz(m)).toEqual({ yol: ornekYol, sureSn: 14 });
    expect(duzMetin(m)).toBe("🎤 Sesli mesaj");
    render(<SesliMesajOynatici yol={ornekYol} sureSn={14} />);
    expect(screen.getByText(/0:14/)).toBeTruthy();
  });

  it("DM resim etiketini ve açıklamasını çözer", () => {
    const m = `[dmresim:${ornekYol}|800x600]\nMerhaba dünya`;
    expect(dmResimCoz(m)).toEqual({ yol: ornekYol, genislik: 800, yukseklik: 600, yazi: "Merhaba dünya" });
    expect(duzMetin(m)).toBe("🖼️ Merhaba dünya");
  });
});

describe("5. Gate Davet Karşılama Kartı", () => {
  it("bekleyen davet kodu varsa giriş ekranında davet kartını gösterir ve kaldırabilir", () => {
    sessionStorage.setItem("cember-davet", "ARKADAS1");
    render(<Gate onJoined={vi.fn()} />);
    expect(screen.getByText("Bir sunucuya davet edildin")).toBeTruthy();
    expect(screen.getByText("(ARKADAS1)")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Daveti kaldır"));
    expect(screen.queryByText("Bir sunucuya davet edildin")).toBeNull();
  });
});

describe("6. Ortak Beyaz Tahta & Lazer İşaretçi", () => {
  it("çizim olaylarını doğrular ve BeyazTahta bileşenini render eder", () => {
    expect(gecerliCizimOlayiMi({ uyeId: "u1", renk: "#ff4d4f", mod: "lazer", x0: 0.1, y0: 0.2, x1: 0.3, y1: 0.4, zaman: 1 })).toBe(true);
    expect(gecerliCizimOlayiMi({ uyeId: "u1", mod: "gecersiz" })).toBe(false);
    const onGonder = vi.fn();
    render(<BeyazTahta benId="u1" yapanAd={() => "Aras"} onGonder={onGonder} onKapat={vi.fn()} />);
    expect(screen.getByText("Ortak Beyaz Tahta")).toBeTruthy();
    fireEvent.click(screen.getByText(/Temizle/));
    expect(onGonder).toHaveBeenCalledWith(expect.objectContaining({ mod: "temizle", uyeId: "u1" }));
  });
});

describe("7. Sohbet İçi Etkileşimli Mini Oyunlar (XOX & Taş-Kağıt-Makas)", () => {
  it("XOX oyun durumunu çözer, kazananı ve bot hamlesini hesaplar", () => {
    const kod = miniOyunKodla({ tur: "xox", xId: "u1", oId: "bot", tahta: "XX-------", sira: "O" });
    expect(miniOyunCoz(kod)).toEqual({ tur: "xox", xId: "u1", oId: "bot", tahta: "XX-------", sira: "O" });
    expect(duzMetin(kod)).toBe("🎮 Mini oyun");
    // Bot rakibin 3'lemesini engellemeli (2. indeks)
    expect(xoxBotHamlesi("XX-------")).toBe(2);
    expect(xoxKazanan("XXXOO----")).toBe("X");
    expect(xoxKazanan("XOXOXOOXO")).toBe("berabere");
  });

  it("XOX kartında tıklayınca hamle yapar ve bot karşılık verir", () => {
    const onHamle = vi.fn();
    const baslangic = miniOyunKodla({ tur: "xox", xId: "u1", oId: "bot", tahta: "---------", sira: "X" });
    render(<MiniOyunKart mesajId="m1" metin={baslangic} benId="u1" uyeAd={() => "Aras"} onHamle={onHamle} />);
    fireEvent.click(screen.getByLabelText("Kare 1: boş"));
    expect(onHamle).toHaveBeenCalledTimes(1);
    const yeniKod = onHamle.mock.calls[0][0] as string;
    const cozulmus = miniOyunCoz(yeniKod);
    expect(cozulmus?.tur).toBe("xox");
    if (cozulmus?.tur === "xox") {
      expect(cozulmus.tahta[0]).toBe("X");
      expect(cozulmus.tahta.includes("O")).toBe(true);
    }
  });

  it("Taş-Kağıt-Makas kazananını doğru belirler", () => {
    expect(tkmKazanan("T", "M")).toBe(1);
    expect(tkmKazanan("M", "K")).toBe(1);
    expect(tkmKazanan("K", "T")).toBe(1);
    expect(tkmKazanan("T", "K")).toBe(2);
    expect(tkmKazanan("T", "T")).toBe(0);
  });
});

describe("8. Canlı Ses Değiştirici Modları", () => {
  it("5 ses değiştirici modunu doğrular", () => {
    expect(SES_MODLARI.map((m) => m.kod)).toEqual(["normal", "telsiz", "magara", "robot", "megafon"]);
    expect(gecerliSesModuMu("robot")).toBe(true);
    expect(gecerliSesModuMu("uzayli")).toBe(false);
  });
});

describe("9. Mesaj Kaydetme (Yer İmleri) & Kod Bloğu Kopyalama/Renklendirme", () => {
  it("mesajı kaydedilenlere ekler, listeler ve çıkarır", () => {
    localStorage.clear();
    const eklendi = mesajKaydetDegistir("u1", {
      id: "msg-1",
      kanalId: "k-1",
      kanalAdi: "genel",
      yazarAd: "Aras",
      metin: "Önemli bağlantı https://cember.onrender.com",
      olusturma: "2026-10-26T10:00:00Z",
    });
    expect(eklendi).toBe(true);
    expect(kaydedilenleriOku("u1")).toHaveLength(1);

    const onKaldir = vi.fn();
    render(<KaydedilenlerPaneli liste={kaydedilenleriOku("u1")} onKaldir={onKaldir} onKapat={vi.fn()} />);
    expect(screen.getByText(/Önemli bağlantı/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Kaydı kaldır"));
    expect(onKaldir).toHaveBeenCalledWith("msg-1");
  });

  it("kod bloğunu sözdizimi renklendirmesi ve Kopyala düğmesiyle render eder", () => {
    const parcalar = kodRenklendir('const x = 42; // yorum\nreturn "merhaba";');
    expect(parcalar.length).toBeGreaterThan(3);
    const { container } = render(<div>{metinOge("```ts\nconst x = 42;\n```", "Aras")}</div>);
    expect(container.querySelector(".md-kopyala")).toBeTruthy();
    expect(container.querySelector(".kod-anahtar")?.textContent).toBe("const");
    expect(container.querySelector(".kod-sayi")?.textContent).toBe("42");
  });

  it("sesli odada yazılı sohbet açılır/kapanır düğmesini ve yeni mesaj rozetini gösterir", () => {
    const onSohbet = vi.fn();
    const sahteSes: any = {
      motor: "p2p",
      durum: "bagli",
      kanalId: "k-ses",
      konusanlar: new Set(),
      sorunlu: new Set(),
      kameralar: new Map(),
      sessiz: false,
      sagir: false,
      kameraAcik: false,
      paylasiyorum: false,
      ekranDestegi: true,
      izlenen: null,
    };
    const sahteKanal: any = { id: "k-ses", ad: "Sohbet Odası", tur: "sesli" };

    const { rerender } = render(
      <SesSahnesi
        ses={sahteSes}
        kanal={sahteKanal}
        katilimcilar={[]}
        benId="u1"
        sagirlar={new Set()}
        paylasanlar={new Set()}
        baglaniyor={false}
        buradayim={true}
        basKonus={{ ayar: { acik: false, tus: "Space" }, basili: false, bas: vi.fn(), birak: vi.fn() }}
        baskasiPaylasiyor={null}
        yapanAd={() => "Biri"}
        onKatil={vi.fn()}
        onProfil={vi.fn()}
        onSohbet={onSohbet}
        sohbetAcik={false}
        yeniMesajSayisi={3}
      />
    );

    const butonlar = screen.getAllByTitle("Yazılı sohbeti aç");
    expect(butonlar.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    fireEvent.click(butonlar[0]);
    expect(onSohbet).toHaveBeenCalledTimes(1);

    rerender(
      <SesSahnesi
        ses={sahteSes}
        kanal={sahteKanal}
        katilimcilar={[]}
        benId="u1"
        sagirlar={new Set()}
        paylasanlar={new Set()}
        baglaniyor={false}
        buradayim={true}
        basKonus={{ ayar: { acik: false, tus: "Space" }, basili: false, bas: vi.fn(), birak: vi.fn() }}
        baskasiPaylasiyor={null}
        yapanAd={() => "Biri"}
        onKatil={vi.fn()}
        onProfil={vi.fn()}
        onSohbet={onSohbet}
        sohbetAcik={true}
        yeniMesajSayisi={0}
      />
    );

    expect(screen.getAllByText("Sohbeti Gizle").length).toBeGreaterThan(0);
  });

  it("14. XP ve Seviye sistemi doğru seviye, unvan ve liderlik tablosu üretir", () => {
    localStorage.clear();
    expect(seviyeIcinGerekenXp(1)).toBe(0);
    expect(seviyeIcinGerekenXp(2)).toBe(100);

    const b1 = xpToSeviye(0);
    expect(b1.seviye).toBe(1);
    expect(b1.unvan).toBe("Çırak");

    const b2 = xpKaydet("u-test-1", "Ahmet", 150);
    expect(b2.seviye).toBe(2);
    expect(b2.xp).toBe(150);

    xpKaydet("u-test-2", "Mehmet", 350);
    const liderler = liderlikTablosuGetir();
    expect(liderler.length).toBe(2);
    expect(liderler[0].ad).toBe("Mehmet");
    expect(liderler[1].ad).toBe("Ahmet");
  });

  it("15. Çekiliş kartı doğru kodlanır, çözülür ve katılımı günceller", () => {
    const c = yeniCekilisOlustur("Discord Nitro", 10, "u1", "Aras");
    const kod = cekilisKodla(c);
    const cozulmus = cekilisCoz(kod);
    expect(cozulmus).not.toBeNull();
    expect(cozulmus?.odul).toBe("Discord Nitro");

    const onGuncelle = vi.fn();
    render(<CekilisKart durum={c} benId="u2" benAd="Can" onGuncelle={onGuncelle} uyeAdGetir={() => "Can"} />);
    expect(screen.getByText("Discord Nitro")).toBeTruthy();
    fireEvent.click(screen.getByText("🎉 Çekilişe Katıl"));
    expect(onGuncelle).toHaveBeenCalledWith(expect.objectContaining({
      katilimcilar: expect.arrayContaining(["u1", "u2"]),
    }));
  });

  it("16. Hazır radyo ve müzik istasyonlarını tanımlar", () => {
    expect(HAZIR_RADYOLAR.length).toBeGreaterThanOrEqual(4);
    for (const r of HAZIR_RADYOLAR) {
      expect(r.url).toMatch(/^https?:\/\//);
      expect(r.baslik.length).toBeGreaterThan(3);
    }
  });
});
