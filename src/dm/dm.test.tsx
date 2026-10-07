import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Uye } from "../types";

const durum = vi.hoisted(() => ({
  eklenen: [] as Record<string, unknown>[],
  mesajlar: [] as Record<string, unknown>[],
  eklemeHatasi: false,
}));

vi.mock("../supabase", () => {
  const zincir = (veri: unknown) => {
    const o: Record<string, unknown> = {};
    for (const ad of ["select", "eq", "order", "limit", "lt", "in", "is", "not", "gt", "neq", "update", "delete"]) o[ad] = () => o;
    o.single = async () => ({ data: veri, error: null });
    o.then = (res: (v: unknown) => unknown) => res({ data: veri, error: null });
    return o;
  };
  const kanal = { on() { return kanal; }, subscribe() { return kanal; } };
  return {
    supabase: {
      from: (tablo: string) => {
        if (tablo === "dm_mesajlari") {
          const o = zincir(durum.mesajlar) as Record<string, unknown>;
          o.insert = (v: Record<string, unknown>) => {
            durum.eklenen.push(v);
            const z: Record<string, unknown> = { select: () => z, single: async () => (durum.eklemeHatasi ? { data: null, error: { message: "new row violates row-level security policy" } } : { data: { id: "yeni", olusturma: new Date().toISOString(), duzenleme: null, silindi: false, ...v }, error: null }) };
            return z;
          };
          return o;
        }
        return zincir([]);
      },
      channel: () => kanal, removeChannel: () => {}, rpc: async () => ({ data: null, error: null }),
    },
  };
});

import ArkadaslarSayfasi from "./ArkadaslarSayfasi";
import DmAlani from "./DmAlani";
import DmSohbet from "./DmSohbet";
import ProfilKarti from "./ProfilKarti";
import YeniGrupDialog from "./YeniGrupDialog";
import { dmBasligi, iliskiBul, karsiUye, mesajaCevir, type Arkadaslik, type DmKanal, type DmUyesi } from "./tipler";
import type { DmDurumu } from "./useDm";

const uye = (id: string, ad: string, ekstra: Partial<Uye> = {}): Uye => ({ id, oda_id: "o", user_id: id, takma_ad: ad, renk: "#E8A33D", rol: "uye", son_gorulme: "", ...ekstra });
const ben = uye("ben", "Aras");
const ayse = uye("ayse", "Ayşe"), can = uye("can", "Can"), efe = uye("efe", "Efe"), eski = uye("eski", "x", { silindi: true });
const uyeler = [ben, ayse, can, efe, eski];
const ark = (id: string, a: string, b: string, d: Arkadaslik["durum"]): Arkadaslik => ({ id, a, b, durum: d, olusturma: "" });

function sahteDm(ek: Partial<DmDurumu> = {}): DmDurumu {
  const arkadasliklar: Arkadaslik[] = (ek.arkadasliklar as Arkadaslik[] | undefined) ?? [];
  return {
    kanallar: [], uyeleri: [], arkadasliklar, okunmamis: {}, toplamOkunmamis: 0, gelenIstekler: arkadasliklar.filter((r) => r.durum === "bekliyor" && r.b === "ben"), hazir: true,
    iliski: (id: string) => iliskiBul(arkadasliklar, "ben", id), okundu: vi.fn(async () => {}), yenile: vi.fn(async () => {}),
    dmAc: vi.fn(async () => ({ id: "dm1", hata: null })), grupOlustur: vi.fn(async () => ({ id: "g1", hata: null })),
    grupUyeEkle: vi.fn(async () => null), grupAyril: vi.fn(async () => null),
    arkadasIstek: vi.fn(async () => ({ sonuc: "bekliyor", hata: null })), arkadasYanit: vi.fn(async () => null), arkadasSil: vi.fn(async () => null),
    engelle: vi.fn(async () => null), engelKaldir: vi.fn(async () => null),
    ...ek,
  } as unknown as DmDurumu;
}

beforeEach(() => { durum.eklenen = []; durum.mesajlar = []; durum.eklemeHatasi = false; });

describe("tipler", () => {
  it("iliskiBul: arkadaş, gelen/giden istek, engel ve hiçbiri", () => {
    const l = [ark("1", "ben", "ayse", "kabul"), ark("2", "can", "ben", "bekliyor"), ark("3", "ben", "efe", "bekliyor"), ark("4", "ben", "eski", "engelli")];
    expect(iliskiBul(l, "ben", "ayse")).toBe("arkadas");
    expect(iliskiBul(l, "ben", "can")).toBe("gelen");
    expect(iliskiBul(l, "ben", "efe")).toBe("giden");
    expect(iliskiBul(l, "ben", "eski")).toBe("engelli");
    expect(iliskiBul(l, "ben", "yok")).toBe("yok");
    expect(iliskiBul([ark("5", "ayse", "ben", "engelli")], "ben", "ayse")).toBe("yok"); // beni engelleyen görünmez
  });

  it("dmBasligi ve karsiUye", () => {
    const k: DmKanal = { id: "d1", tur: "ikili", ad: null, olusturan: "ben", olusturma: "", son_mesaj: "" };
    const g: DmKanal = { id: "d2", tur: "grup", ad: null, olusturan: "ben", olusturma: "", son_mesaj: "" };
    const u: DmUyesi[] = [{ dm_id: "d1", uye_id: "ben", son_okuma: "" }, { dm_id: "d1", uye_id: "ayse", son_okuma: "" }, ...["ben", "ayse", "can", "efe"].map((x) => ({ dm_id: "d2", uye_id: x, son_okuma: "" }))];
    const h = new Map(uyeler.map((x) => [x.id, x]));
    expect(dmBasligi(k, u, h, "ben")).toBe("Ayşe");
    expect(karsiUye(k, u, "ben")).toBe("ayse");
    expect(dmBasligi(g, u, h, "ben")).toBe("Ayşe, Can, Efe");
    expect(dmBasligi({ ...g, ad: "Ekip" }, u, h, "ben")).toBe("Ekip");
    expect(karsiUye(g, u, "ben")).toBeNull();
  });

  it("mesajaCevir kanal_id yerine dm_id kullanır, ek alanlarını boş bırakır", () => {
    const m = mesajaCevir({ id: "m", dm_id: "d1", uye_id: "ben", metin: "x", olusturma: "t", duzenleme: null, silindi: false });
    expect(m.kanal_id).toBe("d1");
    expect(m.ek_yol).toBeNull();
    expect(m.sabit).toBe(false);
  });
});

describe("YeniGrupDialog", () => {
  const iliski = (id: string) => (id === "efe" ? "engelli" : "yok") as ReturnType<DmDurumu["iliski"]>;

  it("en az 2 kişi seçilmeden kapalıdır; kendin, silinmiş ve engelli kişiler listelenmez", async () => {
    const onOlustur = vi.fn(async () => null);
    render(<YeniGrupDialog uyeler={uyeler} benId="ben" iliski={iliski} onOlustur={onOlustur} onKapat={vi.fn()} />);
    expect(screen.queryByLabelText(/Aras/)).toBeNull();
    expect(screen.queryByLabelText(/Efe/)).toBeNull();
    const kur = screen.getByRole("button", { name: "Grubu kur" }) as HTMLButtonElement;
    expect(kur.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Ayşe/ }));
    expect(kur.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Can/ }));
    expect(kur.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText(/Grup adı/), { target: { value: "Cuma" } });
    fireEvent.click(kur);
    await waitFor(() => expect(onOlustur).toHaveBeenCalledWith("Cuma", ["ayse", "can"]));
  });

  it("sunucu hatasını gösterir", async () => {
    render(<YeniGrupDialog uyeler={uyeler} benId="ben" iliski={() => "yok"} onOlustur={async () => "Engelli bir kişiyi gruba ekleyemezsin"} onKapat={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Ayşe/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Can/ }));
    fireEvent.click(screen.getByRole("button", { name: "Grubu kur" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Engelli/);
  });
});

describe("ArkadaslarSayfasi", () => {
  it("bekleyen sekmesinde gelen isteği kabul eder ve reddedebilir", async () => {
    const dm = sahteDm({ arkadasliklar: [ark("r1", "can", "ben", "bekliyor")] });
    render(<ArkadaslarSayfasi dm={dm} benId="ben" uyeler={uyeler} cevrimici={new Set()} onMesaj={vi.fn()} onHata={vi.fn()} onBilgi={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /Bekleyen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Kabul et" }));
    await waitFor(() => expect(dm.arkadasYanit).toHaveBeenCalledWith("r1", true));
    fireEvent.click(screen.getByRole("button", { name: "Reddet" }));
    await waitFor(() => expect(dm.arkadasYanit).toHaveBeenCalledWith("r1", false));
  });

  it("arkadaş arar ve istek gönderir; mevcut arkadaş ve kendin aday çıkmaz", async () => {
    const dm = sahteDm({ arkadasliklar: [ark("r1", "ben", "ayse", "kabul")] });
    const onBilgi = vi.fn();
    render(<ArkadaslarSayfasi dm={dm} benId="ben" uyeler={uyeler} cevrimici={new Set(["ayse"])} onMesaj={vi.fn()} onHata={vi.fn()} onBilgi={onBilgi} />);
    expect(screen.getByText("Çevrimiçi")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Arkadaş ekle"), { target: { value: "a" } });
    expect(screen.queryByRole("button", { name: "İstek gönder" })).toBeTruthy(); // Can ("a" içerir)
    expect(screen.getAllByRole("button", { name: "İstek gönder" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "İstek gönder" }));
    await waitFor(() => expect(dm.arkadasIstek).toHaveBeenCalledWith("can"));
    await waitFor(() => expect(onBilgi).toHaveBeenCalled());
  });

  it("engellenenler sekmesinde engeli kaldırır", async () => {
    const dm = sahteDm({ arkadasliklar: [ark("r9", "ben", "efe", "engelli")] });
    render(<ArkadaslarSayfasi dm={dm} benId="ben" uyeler={uyeler} cevrimici={new Set()} onMesaj={vi.fn()} onHata={vi.fn()} onBilgi={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /Engellenen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Engeli kaldır" }));
    await waitFor(() => expect(dm.engelKaldir).toHaveBeenCalledWith("efe"));
  });
});

describe("ProfilKarti", () => {
  const props = { benimMi: false, cevrimici: true, onMesaj: vi.fn(), onArkadasEkle: vi.fn(), onArkadasSil: vi.fn(), onEngelle: vi.fn(), onEngelKaldir: vi.fn() };

  it("ilişkiye göre doğru düğmeleri gösterir", () => {
    const { rerender } = render(<ProfilKarti uye={ayse} iliski="yok" {...props} />);
    expect(screen.getByRole("button", { name: "Arkadaş ekle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Engelle" })).toBeTruthy();
    rerender(<ProfilKarti uye={ayse} iliski="arkadas" {...props} />);
    expect(screen.getByRole("button", { name: "Arkadaşlıktan çıkar" })).toBeTruthy();
    rerender(<ProfilKarti uye={ayse} iliski="gelen" {...props} />);
    expect(screen.getByRole("button", { name: "İsteği kabul et" })).toBeTruthy();
    rerender(<ProfilKarti uye={ayse} iliski="engelli" {...props} />);
    expect(screen.getByRole("button", { name: "Engeli kaldır" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mesaj gönder" })).toBeNull();
  });

  it("kendi kartında eylem yok; durum metni, rozet ve hakkında görünür", () => {
    render(<ProfilKarti uye={{ ...ayse, hakkinda: "Gitar çalarım", durum_metin: "Oyundayım", misafir: true }} iliski="yok" {...props} benimMi />);
    expect(screen.queryByRole("button", { name: "Arkadaş ekle" })).toBeNull();
    expect(screen.getByText("Gitar çalarım")).toBeTruthy();
    expect(screen.getByText(/Oyundayım/)).toBeTruthy();
    expect(screen.getByText("Misafir")).toBeTruthy();
  });
});

describe("DmAlani", () => {
  const kanallar: DmKanal[] = [
    { id: "d1", tur: "ikili", ad: null, olusturan: "ben", olusturma: "", son_mesaj: new Date().toISOString() },
    { id: "d2", tur: "grup", ad: "Ekip", olusturan: "ben", olusturma: "", son_mesaj: new Date().toISOString() },
  ];
  const uyeleri: DmUyesi[] = [{ dm_id: "d1", uye_id: "ben", son_okuma: "" }, { dm_id: "d1", uye_id: "ayse", son_okuma: "" }, { dm_id: "d2", uye_id: "ben", son_okuma: "" }, { dm_id: "d2", uye_id: "can", son_okuma: "" }, { dm_id: "d2", uye_id: "efe", son_okuma: "" }];
  const hazir = (ek: Partial<DmDurumu> = {}) => sahteDm({ kanallar, uyeleri, okunmamis: { d1: 3 }, toplamOkunmamis: 3, ...ek });
  const ortak = { me: ben, uyeler, cevrimici: new Set(["ayse"]), bosta: new Set<string>(), onProfil: vi.fn(), onHata: vi.fn(), onBilgi: vi.fn(), onArkadaslar: vi.fn(), onSunucuya: vi.fn(), mobil: "liste" as const, onMobil: vi.fn() };

  it("DM listesini, okunmamış rozetini ve bekleyen istek sayısını gösterir; seçince onSec çağrılır", () => {
    const onSec = vi.fn();
    const dm = hazir({ arkadasliklar: [ark("r1", "can", "ben", "bekliyor")], gelenIstekler: [ark("r1", "can", "ben", "bekliyor")] });
    render(<DmAlani dm={dm} aktifDm={null} sayfa="arkadaslar" onSec={onSec} {...ortak} />);
    expect(screen.getByRole("button", { name: /Ayşe, 3 okunmamış mesaj/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ekip" })).toBeTruthy();
    expect(screen.getByLabelText("1 bekleyen istek")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ekip" }));
    expect(onSec).toHaveBeenCalledWith("d2");
  });

  it("arama kutusu DM'leri süzer", () => {
    render(<DmAlani dm={hazir()} aktifDm={null} sayfa="arkadaslar" onSec={vi.fn()} {...ortak} />);
    fireEvent.change(screen.getByLabelText("Mesajlarda kişi ara"), { target: { value: "ek" } });
    expect(screen.queryByRole("button", { name: /Ayşe/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Ekip" })).toBeTruthy();
  });

  it("sunucuya dön ve yeni grup düğmeleri çalışır", () => {
    render(<DmAlani dm={hazir()} aktifDm={null} sayfa="arkadaslar" onSec={vi.fn()} {...ortak} />);
    fireEvent.click(screen.getByRole("button", { name: "Yeni grup mesajı" }));
    expect(screen.getByRole("dialog", { name: /Grup mesajı oluştur/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
    fireEvent.click(screen.getByRole("button", { name: /Çember/ }));
    expect(ortak.onSunucuya).toHaveBeenCalled();
  });
});

describe("DmSohbet", () => {
  const kanallar: DmKanal[] = [{ id: "d1", tur: "ikili", ad: null, olusturan: "ben", olusturma: "", son_mesaj: "" }];
  const uyeleri: DmUyesi[] = [{ dm_id: "d1", uye_id: "ben", son_okuma: "" }, { dm_id: "d1", uye_id: "ayse", son_okuma: "" }];
  const baglam = (dm: DmDurumu) => <DmSohbet dmId="d1" dm={dm} me={ben} uyeler={uyeler} cevrimici={new Set()} onProfil={vi.fn()} onHata={onHata} />;
  const onHata = vi.fn();

  it("mesajları gösterir, yazılanı gönderir ve kendi mesajında düzenle düğmesi vardır", async () => {
    durum.mesajlar = [{ id: "m1", dm_id: "d1", uye_id: "ayse", metin: "selam", olusturma: new Date().toISOString(), duzenleme: null, silindi: false }];
    const dm = sahteDm({ kanallar, uyeleri });
    render(baglam(dm));
    expect(await screen.findByText("selam")).toBeTruthy();
    const kutu = screen.getByLabelText("Mesaj yaz");
    fireEvent.change(kutu, { target: { value: "  merhaba  " } });
    fireEvent.keyDown(kutu, { key: "Enter" });
    await waitFor(() => expect(durum.eklenen).toEqual([{ dm_id: "d1", uye_id: "ben", metin: "merhaba" }]));
    expect(await screen.findByText("merhaba")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Mesajı düzenle" }).length).toBe(1);
    expect(screen.queryByRole("button", { name: "Tepki ekle" })).toBeNull();
  });

  it("engellediğin kişiye yazma kutusu yerine uyarı ve 'Engeli kaldır' çıkar", async () => {
    const dm = sahteDm({ kanallar, uyeleri, arkadasliklar: [ark("e", "ben", "ayse", "engelli")] });
    render(baglam(dm));
    expect(await screen.findByText(/Bu kişiyi engelledin/)).toBeTruthy();
    expect(screen.queryByLabelText("Mesaj yaz")).toBeNull();
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Engeli kaldır" }));
    await waitFor(() => expect(dm.engelKaldir).toHaveBeenCalledWith("ayse"));
  });

  it("sunucu mesajı reddederse anlaşılır hata verir", async () => {
    durum.eklemeHatasi = true;
    onHata.mockClear();
    render(baglam(sahteDm({ kanallar, uyeleri })));
    const kutu = screen.getByLabelText("Mesaj yaz");
    fireEvent.change(kutu, { target: { value: "x" } });
    fireEvent.keyDown(kutu, { key: "Enter" });
    await waitFor(() => expect(onHata).toHaveBeenCalledWith("Bu kişiyle şu an mesajlaşamazsın."));
  });
});
