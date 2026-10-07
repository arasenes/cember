import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MessageView from "./MessageView";

vi.mock("./supabase", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: async (yol: string) => ({ data: { signedUrl: `https://ornek.test/${yol}?token=t` }, error: null }) }) } },
}));
import type { Mesaj, Uye } from "./types";

const uye: Uye = { id: "u1", oda_id: "o", user_id: "x", takma_ad: "Ayşe", renk: "#E8A33D", rol: "uye", son_gorulme: "" };
const mesaj = (metin: string): Mesaj => ({ id: "m1", kanal_id: "k", uye_id: "u1", metin, olusturma: new Date().toISOString(), duzenleme: null, silindi: false, ek_yol: null, ek_tur: null, ek_boyut: null, ek_genislik: null, ek_yukseklik: null, sabit: false, sabit_zaman: null, ust_mesaj_id: null });

describe("MessageView", () => {
  it("<script> metnini düz metin olarak gösterir, DOM'a script eklemez", () => {
    const { container } = render(
      <MessageView mesaj={mesaj('<script>window.__xss=1</script><img src=x onerror="window.__xss=1">')} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".txt")!.textContent).toContain("<script>");
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it("sabitle düğmesi yalnızca yöneticide çıkar ve sabitli mesajı işaretler", () => {
    const onSabitle = vi.fn();
    const { rerender } = render(<MessageView mesaj={mesaj("selam")} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} onSabitle={onSabitle} />);
    expect(screen.queryByRole("button", { name: "Mesajı sabitle" })).toBeNull();
    const mod: Uye = { ...uye, id: "u2", rol: "moderator" };
    rerender(<MessageView mesaj={mesaj("selam")} yazar={uye} benim={mod} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} onSabitle={onSabitle} />);
    fireEvent.click(screen.getByRole("button", { name: "Mesajı sabitle" }));
    expect(onSabitle).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }), true);
    rerender(<MessageView mesaj={{ ...mesaj("selam"), sabit: true }} yazar={uye} benim={mod} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} onSabitle={onSabitle} />);
    expect(screen.getByTitle("Sabitlenmiş mesaj")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sabitlemeyi kaldır" })).toBeTruthy();
  });

  it("silinmiş mesajın metnini göstermez", () => {
    render(<MessageView mesaj={{ ...mesaj("gizli metin"), silindi: true }} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} />);
    expect(screen.queryByText("gizli metin")).toBeNull();
    expect(screen.getByText("Bu mesaj silindi.")).toBeTruthy();
  });

  it("sadece kendi mesajında ya da oda sahibiyken Sil düğmesi çıkar", () => {
    const baskasi: Uye = { ...uye, id: "u2" };
    const { rerender } = render(<MessageView mesaj={mesaj("a")} yazar={uye} benim={baskasi} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} />);
    expect(screen.queryByLabelText("Mesajı sil")).toBeNull();
    rerender(<MessageView mesaj={mesaj("a")} yazar={uye} benim={{ ...baskasi, rol: "sahip" }} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} />);
    expect(screen.getByLabelText("Mesajı sil")).toBeTruthy();
  });

  const resimli = (extra: Partial<Mesaj> = {}): Mesaj => ({
    ...mesaj(""), ek_yol: "o/k/r.webp", ek_tur: "image/webp", ek_boyut: 1000, ek_genislik: 800, ek_yukseklik: 400, ...extra,
  });

  it("resimli mesajda imzalı bağlantıyla resmi gösterir, metin boşsa metin kutusu çıkmaz", async () => {
    const { container } = render(<MessageView mesaj={resimli()} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} />);
    const img = await screen.findByAltText("Ayşe tarafından gönderilen resim");
    expect(img.getAttribute("src")).toBe("https://ornek.test/o/k/r.webp?token=t");
    expect(img.getAttribute("width")).toBe("360");
    expect(img.getAttribute("height")).toBe("180");
    expect(container.querySelector(".txt")).toBeNull();
  });

  it("resme tıklayınca büyütür, Escape ile kapatır", async () => {
    render(<MessageView mesaj={resimli()} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /büyütmek için tıkla/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("silinmiş mesajın resmini göstermez", () => {
    const { container } = render(<MessageView mesaj={resimli({ silindi: true })} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Bu mesaj silindi.")).toBeTruthy();
  });
});

describe("konu düğmesi", () => {
  it("yanıt sayısını gösterir ve tıklanınca konuyu açar", () => {
    const onKonu = vi.fn();
    render(<MessageView mesaj={mesaj("selam")} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} onKonu={onKonu} yanitSayisi={3} />);
    const b = screen.getByRole("button", { name: /Konuyu aç, 3 yanıt/ });
    b.click();
    expect(onKonu).toHaveBeenCalled();
  });
  it("kendi mesajını düzenler; başkasının mesajında düzenle düğmesi çıkmaz", async () => {
    const onDuzenle = vi.fn(async () => true);
    const baskasi: Uye = { ...uye, id: "u9", takma_ad: "Mehmet" };
    const { rerender } = render(<MessageView mesaj={mesaj("eski")} yazar={uye} benim={baskasi} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} onDuzenle={onDuzenle} />);
    expect(screen.queryByRole("button", { name: "Mesajı düzenle" })).toBeNull();
    rerender(<MessageView mesaj={mesaj("eski")} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} onDuzenle={onDuzenle} />);
    fireEvent.click(screen.getByRole("button", { name: "Mesajı düzenle" }));
    const kutu = screen.getByRole("textbox", { name: "Mesajı düzenle" }) as HTMLTextAreaElement;
    expect(kutu.value).toBe("eski");
    fireEvent.change(kutu, { target: { value: "  yeni  " } });
    fireEvent.keyDown(kutu, { key: "Enter" });
    await vi.waitFor(() => expect(onDuzenle).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }), "yeni"));
    await vi.waitFor(() => expect(screen.queryByRole("textbox", { name: "Mesajı düzenle" })).toBeNull());
  });

  it("düzenleme Esc ile iptal edilir ve kaydetme çağrılmaz", () => {
    const onDuzenle = vi.fn(async () => true);
    render(<MessageView mesaj={mesaj("eski")} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} onDuzenle={onDuzenle} />);
    fireEvent.click(screen.getByRole("button", { name: "Mesajı düzenle" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Mesajı düzenle" }), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Mesajı düzenle" })).toBeNull();
    expect(onDuzenle).not.toHaveBeenCalled();
  });

  it("alıntılı yanıt: alıntı satırı yazar ve metni gösterir, tıklayınca mesaja gider; Yanıtla/İlet düğmeleri çalışır", () => {
    const onAlintiGit = vi.fn(); const onYanitla = vi.fn(); const onIlet = vi.fn();
    const baskasi: Uye = { ...uye, id: "u9", takma_ad: "Mehmet" };
    const alinan = { ...mesaj("ilk mesaj"), id: "m0", uye_id: "u9" };
    render(<MessageView mesaj={{ ...mesaj("cevap"), yanit_id: "m0" }} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()}
      zengin={{ alinti: { mesaj: alinan, yazar: baskasi }, onAlintiGit, onYanitla, onIlet }} />);
    const satir = screen.getByRole("button", { name: /Mehmet kişisinin mesajına git/ });
    expect(satir.textContent).toContain("ilk mesaj");
    fireEvent.click(satir);
    expect(onAlintiGit).toHaveBeenCalledWith("m0");
    fireEvent.click(screen.getByRole("button", { name: "Yanıtla" }));
    expect(onYanitla).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }));
    fireEvent.click(screen.getByRole("button", { name: "İlet" }));
    expect(onIlet).toHaveBeenCalled();
  });

  it("silinmiş alıntı için 'Bu mesaj silindi.' gösterir; iletilen mesajda etiket çıkar", () => {
    render(<MessageView mesaj={{ ...mesaj("x"), yanit_id: "m0", iletilen_ad: "Can" }} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()}
      zengin={{ alinti: { mesaj: { ...mesaj("gizli"), id: "m0", silindi: true } } }} />);
    expect(screen.getByText("Bu mesaj silindi.")).toBeTruthy();
    expect(screen.queryByText("gizli")).toBeNull();
    expect(screen.getByText(/Can'ten iletildi/)).toBeTruthy();
  });

  it("resimli mesajda İlet düğmesi yoktur; GIF bağlantısı resim olarak gösterilir; bağlantı kartı güvenli açılır", () => {
    const { container, rerender } = render(<MessageView mesaj={{ ...mesaj("yazı"), ek_yol: "a/b/c.webp" }} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} zengin={{ onIlet: vi.fn() }} />);
    expect(screen.queryByRole("button", { name: "İlet" })).toBeNull();
    rerender(<MessageView mesaj={mesaj("https://media.giphy.com/media/abc/giphy.gif")} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} />);
    expect(container.querySelector("img.gif-mesaj")!.getAttribute("src")).toBe("https://media.giphy.com/media/abc/giphy.gif");
    rerender(<MessageView mesaj={{ ...mesaj("bak https://ornek.com"), onizleme: { url: "https://ornek.com", baslik: "Ornek", aciklama: null, resim: "javascript:x", site: "ornek.com" } }} yazar={uye} benim={uye} tepkiler={[]} onTepki={vi.fn()} onSil={vi.fn()} />);
    const kart = container.querySelector("a.onizleme")!;
    expect(kart.getAttribute("rel")).toContain("noopener");
    expect(kart.querySelector("img")).toBeNull();
  });
});
