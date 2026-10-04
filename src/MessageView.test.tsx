import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MessageView from "./MessageView";
import type { Mesaj, Uye } from "./types";

const uye: Uye = { id: "u1", oda_id: "o", user_id: "x", takma_ad: "Ayşe", renk: "#E8A33D", rol: "uye", son_gorulme: "" };
const mesaj = (metin: string): Mesaj => ({ id: "m1", kanal_id: "k", uye_id: "u1", metin, olusturma: new Date().toISOString(), duzenleme: null, silindi: false });

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
});
