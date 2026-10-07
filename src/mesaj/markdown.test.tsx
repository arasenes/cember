import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { kodBolumleri, metinOge } from "./markdown";

const goster = (metin: string, ad = "Aras") => render(<div data-testid="k">{metinOge(metin, ad)}</div>);

describe("markdown", () => {
  it("kalın, italik ve satır içi kodu biçimlendirir", () => {
    const { container } = goster("**kalın** ve *italik* ve `kod`");
    expect(container.querySelector("strong")!.textContent).toBe("kalın");
    expect(container.querySelector("em")!.textContent).toBe("italik");
    expect(container.querySelector("code.md-kod")!.textContent).toBe("kod");
  });

  it("kod bloğu içindeki biçimlendirme işaretlerini olduğu gibi bırakır", () => {
    const { container } = goster("önce\n```js\nconst a = **x**;\n```\nsonra");
    const blok = container.querySelector("pre.md-blok code")!;
    expect(blok.textContent).toBe("const a = **x**;");
    expect(container.querySelector("strong")).toBeNull();
  });

  it("kapanmayan ``` düz metin kalır", () => {
    expect(kodBolumleri("```açık kalan")).toEqual([{ tur: "metin", icerik: "```açık kalan" }]);
    const { container } = goster("```açık kalan");
    expect(container.querySelector("pre")).toBeNull();
  });

  it("> ile başlayan satırları alıntı yapar", () => {
    const { container } = goster("> alıntı satırı\nnormal");
    expect(container.querySelector("blockquote.md-alinti")!.textContent).toBe("alıntı satırı");
    expect(container.textContent).toContain("normal");
  });

  it("spoiler tıklanınca açılır", () => {
    goster("gizli ||sır|| var");
    const d = screen.getByRole("button", { name: /Gizli metin/ });
    expect(d.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(d);
    expect(d.getAttribute("aria-pressed")).toBe("true");
  });

  it("yalnızca http(s) bağlantı üretir ve sondaki noktalamayı dışarıda bırakır", () => {
    const { container } = goster("bak https://ornek.com/a?b=1, ve javascript:alert(1) ve data:text/html,x");
    const a = container.querySelectorAll("a");
    expect(a).toHaveLength(1);
    expect(a[0].getAttribute("href")).toBe("https://ornek.com/a?b=1");
    expect(a[0].getAttribute("rel")).toContain("noopener");
    expect(container.textContent).toContain("javascript:alert(1)");
  });

  it("HTML'i çalıştırmaz, düz metin gösterir", () => {
    const { container } = goster('<script>window.__x=1</script><img src=x onerror="window.__x=1"> **<b>kalın</b>**');
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<script>");
  });

  it("@bahsetmeyi işaretler (kalın içinde de)", () => {
    const { container } = goster("selam @Aras nasılsın, **@Aras** burada mı");
    expect(container.querySelectorAll("mark.etiket-ben").length).toBe(2);
  });

  it("iç içe işaretlerde sonsuz döngüye girmez", () => {
    const { container } = goster("||**||*a*||**||");
    expect(container.textContent).toBeTruthy();
  });
});
