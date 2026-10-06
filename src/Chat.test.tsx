import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Uye } from "./types";

const durum = vi.hoisted(() => ({
  eklenen: [] as Record<string, unknown>[],
  yuklenen: [] as { yol: string; tur: string }[],
  silinen: [] as string[][],
  yuklemeHatasi: false,
  eklemeHatasi: false,
  guncellenen: [] as Record<string, unknown>[],
  profilHatasi: null as null | { code: string },
}));

vi.mock("./supabase", () => {
  const sonucOlustur = (veri: unknown) => {
    const o: Record<string, unknown> = {};
    for (const ad of ["select", "eq", "order", "limit", "lt", "in", "update", "delete"]) o[ad] = () => o;
    o.maybeSingle = async () => ({ data: veri, error: null });
    o.then = (res: (v: unknown) => unknown) => res({ data: veri, error: null });
    return o;
  };
  const from = (tablo: string) => {
    if (tablo === "odalar") return sonucOlustur({ ad: "Test Odası" });
    if (tablo === "kanallar") return sonucOlustur([{ id: "k1", oda_id: "o1", ad: "genel", tur: "yazili", sira: 0 }]);
    if (tablo === "uyeler") {
      const satirlar = [
        { id: "u1", oda_id: "o1", user_id: "x", takma_ad: "Ayşe", renk: "#E8A33D", rol: "uye", son_gorulme: "", avatar_yol: "o1/u1/eski.webp", hakkinda: null },
        { id: "u2", oda_id: "o1", user_id: "y", takma_ad: "Mehmet", renk: "#1F7A4D", rol: "sahip", son_gorulme: "", avatar_yol: null, hakkinda: "Gitar çalarım" },
      ];
      const o = sonucOlustur(satirlar);
      o.update = (v: Record<string, unknown>) => {
        durum.guncellenen.push(v);
        const z: Record<string, unknown> = { eq: () => z, select: () => z,
          single: async () => (durum.profilHatasi ? { data: null, error: durum.profilHatasi } : { data: { ...satirlar[0], ...v }, error: null }),
          then: (r: (x: unknown) => unknown) => r({ data: null, error: null }) };
        return z;
      };
      return o;
    }
    if (tablo === "mesajlar") {
      const o = sonucOlustur([]);
      o.insert = (v: Record<string, unknown>) => {
        durum.eklenen.push(v);
        const sonuc = durum.eklemeHatasi
          ? { data: null, error: { message: "red" } }
          : { data: { id: "m1", olusturma: new Date().toISOString(), duzenleme: null, silindi: false, ek_yol: null, ek_tur: null, ek_boyut: null, ek_genislik: null, ek_yukseklik: null, ...v }, error: null };
        const z: Record<string, unknown> = { select: () => z, single: async () => sonuc };
        return z;
      };
      return o;
    }
    return sonucOlustur([]);
  };
  const kanal = { on() { return kanal; }, subscribe(cb: (d: string) => void) { cb("SUBSCRIBED"); return kanal; }, track: async () => {}, presenceState: () => ({}) };
  return {
    SUPABASE_URL: "http://x", SUPABASE_KEY: "k",
    supabase: {
      from, channel: () => kanal, removeChannel: () => {}, rpc: () => ({ then: (r: (v: unknown) => unknown) => r({ data: null }) }),
      auth: { signOut: async () => {}, getSession: async () => ({ data: { session: null } }) },
      storage: {
        from: () => ({
          upload: async (yol: string, _b: unknown, o: { contentType: string }) => {
            if (durum.yuklemeHatasi) return { data: null, error: { message: "hata" } };
            durum.yuklenen.push({ yol, tur: o.contentType });
            return { data: { path: yol }, error: null };
          },
          remove: async (yollar: string[]) => { durum.silinen.push(yollar); return { data: [], error: null }; },
          createSignedUrl: async (yol: string) => ({ data: { signedUrl: "https://ornek.test/" + yol }, error: null }),
        }),
      },
    },
  };
});

vi.mock("./sesMotoru", () => ({
  useSesMotoru: () => ({
    durum: "kapali", kanalId: null, sessiz: false, konusanlar: new Set(), sorunlu: new Set(), turnVar: null, kullanilan: null, motor: null, hata: "", bilgi: "",
    kabiRefleri: [], izlenen: null, paylasiyorum: false, ekranDestegi: true, ekranPaylas: vi.fn(), ekranDurdur: vi.fn(), baglan: vi.fn(), ayril: vi.fn(), sessizDegistir: vi.fn(), hataTemizle: vi.fn(),
  }),
}));

// jsdom'da createImageBitmap/canvas yok; küçültme gerçek tarayıcıda ayrıca sınanır
vi.mock("./ekler", async (orijinal) => {
  const gercek = await orijinal<typeof import("./ekler")>();
  return {
    ...gercek,
    avatarHazirla: vi.fn(async (d: File | Blob, ad?: string) => {
      gercek.turKontrol(d);
      return { blob: d, tur: "image/webp", uzanti: "webp", boyut: 900, genislik: 256, yukseklik: 256, onizleme: "blob:avatar", ad: ad ?? "profil" };
    }),
    ekHazirla: vi.fn(async (d: File | Blob, ad?: string) => {
      gercek.turKontrol(d);
      return { blob: d, tur: "image/webp", uzanti: "webp", boyut: 1234, genislik: 800, yukseklik: 400, onizleme: "blob:onizleme", ad: ad ?? "resim" };
    }),
  };
});

import Chat from "./Chat";

const ben: Uye = { id: "u1", oda_id: "o1", user_id: "x", takma_ad: "Ayşe", renk: "#E8A33D", rol: "uye", son_gorulme: "", avatar_yol: "o1/u1/eski.webp", hakkinda: null };
const resim = () => new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" });

async function hazirla() {
  URL.revokeObjectURL = vi.fn();
  render(<Chat me={ben} onExit={vi.fn()} />);
  return await screen.findByLabelText("Mesaj yaz");
}

describe("Chat resim gönderme", () => {
  beforeEach(() => { durum.guncellenen.length = 0; durum.profilHatasi = null; durum.eklenen.length = 0; durum.yuklenen.length = 0; durum.silinen.length = 0; durum.yuklemeHatasi = false; durum.eklemeHatasi = false; });

  it("yapıştırılan ekran görüntüsünü önizler, yükler, sonra ek bilgileriyle mesajı ekler", async () => {
    const kutu = await hazirla();
    fireEvent.paste(kutu, { clipboardData: { files: [resim()] } });
    expect(await screen.findByAltText("Eklenecek resmin önizlemesi")).toBeTruthy();
    expect(screen.getByText("800×400 · 1 KB")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Gönder"));
    await waitFor(() => expect(durum.eklenen.length).toBe(1));
    expect(durum.yuklenen).toHaveLength(1);
    expect(durum.yuklenen[0].yol).toMatch(/^o1\/k1\/[0-9a-f-]{36}\.webp$/);
    expect(durum.eklenen[0]).toMatchObject({ kanal_id: "k1", uye_id: "u1", metin: "", ek_yol: durum.yuklenen[0].yol, ek_tur: "image/webp", ek_boyut: 1234, ek_genislik: 800, ek_yukseklik: 400 });
    await waitFor(() => expect(screen.queryByAltText("Eklenecek resmin önizlemesi")).toBeNull());
  });

  it("resim ve yazı birlikte gider; yazısız ve resimsiz Gönder kapalıdır", async () => {
    const kutu = await hazirla();
    expect((screen.getByLabelText("Gönder") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.paste(kutu, { clipboardData: { files: [resim()] } });
    await screen.findByAltText("Eklenecek resmin önizlemesi");
    expect((screen.getByLabelText("Gönder") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(kutu, { target: { value: "bak bu ne" } });
    fireEvent.click(screen.getByLabelText("Gönder"));
    await waitFor(() => expect(durum.eklenen.length).toBe(1));
    expect(durum.eklenen[0].metin).toBe("bak bu ne");
  });

  it("yükleme başarısız olursa mesaj eklenmez ve resim önizlemede kalır", async () => {
    durum.yuklemeHatasi = true;
    const kutu = await hazirla();
    fireEvent.paste(kutu, { clipboardData: { files: [resim()] } });
    await screen.findByAltText("Eklenecek resmin önizlemesi");
    fireEvent.click(screen.getByLabelText("Gönder"));
    expect(await screen.findByText(/Resim yüklenemedi/)).toBeTruthy();
    expect(durum.eklenen).toHaveLength(0);
    expect(screen.getByAltText("Eklenecek resmin önizlemesi")).toBeTruthy();
  });

  it("mesaj eklenemezse yüklenen resim depolamadan geri silinir", async () => {
    durum.eklemeHatasi = true;
    const kutu = await hazirla();
    fireEvent.paste(kutu, { clipboardData: { files: [resim()] } });
    await screen.findByAltText("Eklenecek resmin önizlemesi");
    fireEvent.click(screen.getByLabelText("Gönder"));
    expect(await screen.findByText("Mesaj gönderilemedi.")).toBeTruthy();
    await waitFor(() => expect(durum.silinen).toHaveLength(1));
    expect(durum.silinen[0][0]).toBe(durum.yuklenen[0].yol);
  });

  it("resim olmayan dosyayı sürükleyince hata gösterir", async () => {
    await hazirla();
    const bolum = screen.getByLabelText("Sohbet");
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    fireEvent.drop(bolum, { dataTransfer: { files: [pdf], types: ["Files"] } });
    expect(await screen.findByText("Yalnızca resim dosyaları gönderilebilir.")).toBeTruthy();
  });

  it("'Kaldır' resmi önizlemeden çıkarır", async () => {
    const kutu = await hazirla();
    fireEvent.paste(kutu, { clipboardData: { files: [resim()] } });
    await screen.findByAltText("Eklenecek resmin önizlemesi");
    fireEvent.click(screen.getByLabelText("Resmi kaldır"));
    expect(screen.queryByAltText("Eklenecek resmin önizlemesi")).toBeNull();
  });
});

describe("Chat profil", () => {
  beforeEach(() => { durum.guncellenen.length = 0; durum.profilHatasi = null; durum.yuklenen.length = 0; durum.silinen.length = 0; });

  async function profilimiAc() {
    await hazirla();
    fireEvent.click(screen.getByLabelText("Profilimi aç ve düzenle"));
    return await screen.findByRole("dialog");
  }

  it("üye listesinden başka üyenin profilini salt okunur açar (hakkında görünür, form yok)", async () => {
    await hazirla();
    fireEvent.click(await screen.findByLabelText(/Mehmet profilini aç/));
    const d = await screen.findByRole("dialog");
    expect(within(d).getByText("Gitar çalarım")).toBeTruthy();
    expect(within(d).queryByLabelText("Takma ad")).toBeNull();
    expect(within(d).queryByText("Fotoğraf seç")).toBeNull();
  });

  it("kendi profilinde yalnızca değişen alanları kaydeder ve pencere kapanır", async () => {
    const d = await profilimiAc();
    expect((within(d).getByText("Kaydet") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(d).getByLabelText("Takma ad"), { target: { value: "  Ayşe K  " } });
    fireEvent.change(within(d).getByLabelText("Hakkımda"), { target: { value: "Kahve sever" } });
    fireEvent.click(within(d).getByLabelText("Renk #0B7A91"));
    fireEvent.click(within(d).getByText("Kaydet"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(durum.guncellenen).toEqual([{ takma_ad: "Ayşe K", renk: "#0B7A91", hakkinda: "Kahve sever" }]);
    expect(durum.yuklenen).toHaveLength(0);
    expect(await screen.findAllByText("Ayşe K")).not.toHaveLength(0);
  });

  it("yeni fotoğrafı avatarlar kovasına yükler, kaydı günceller ve eskisini siler", async () => {
    const d = await profilimiAc();
    const girdi = within(d).getByLabelText("Profil fotoğrafı dosyası");
    fireEvent.change(girdi, { target: { files: [resim()] } });
    await waitFor(() => expect((within(d).getByText("Kaydet") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(d).getByText("Kaydet"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(durum.yuklenen[0].yol).toMatch(/^o1\/u1\/[0-9a-f-]{36}\.webp$/);
    expect(durum.guncellenen[0]).toEqual({ avatar_yol: durum.yuklenen[0].yol });
    expect(durum.silinen).toContainEqual(["o1/u1/eski.webp"]);
  });

  it("'Fotoğrafı kaldır' avatar_yol alanını boşaltır ve eski dosyayı siler", async () => {
    const d = await profilimiAc();
    fireEvent.click(within(d).getByText("Fotoğrafı kaldır"));
    fireEvent.click(within(d).getByText("Kaydet"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(durum.guncellenen).toEqual([{ avatar_yol: null }]);
    expect(durum.silinen).toContainEqual(["o1/u1/eski.webp"]);
  });

  it("takma ad başkasında kullanılıyorsa anlaşılır hata verir ve yüklenen fotoğrafı geri siler", async () => {
    durum.profilHatasi = { code: "23505" };
    const d = await profilimiAc();
    fireEvent.change(within(d).getByLabelText("Profil fotoğrafı dosyası"), { target: { files: [resim()] } });
    fireEvent.change(within(d).getByLabelText("Takma ad"), { target: { value: "Mehmet" } });
    await waitFor(() => expect((within(d).getByText("Kaydet") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(d).getByText("Kaydet"));
    expect(await within(d).findByText("Bu takma ad bu odada kullanılıyor.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    await waitFor(() => expect(durum.silinen).toContainEqual([durum.yuklenen[0].yol]));
    expect(durum.silinen).not.toContainEqual(["o1/u1/eski.webp"]);
  });

  it("çok kısa takma adı göndermeden reddeder", async () => {
    const d = await profilimiAc();
    fireEvent.change(within(d).getByLabelText("Takma ad"), { target: { value: "A" } });
    fireEvent.click(within(d).getByText("Kaydet"));
    expect(await within(d).findByText(/2-24 karakter/)).toBeTruthy();
    expect(durum.guncellenen).toHaveLength(0);
  });

  it("Esc pencereyi kapatır", async () => {
    await profilimiAc();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
