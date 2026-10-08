import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const onizle = vi.fn();
vi.mock("./sesler", async (orijinal) => {
  const m = await orijinal<typeof import("./sesler")>();
  return { ...m, sesOnizle: (...a: unknown[]) => onizle(...a) };
});

import SeslerAyari from "./SeslerAyari";
import { sesAyarOku } from "./sesler";

beforeEach(() => { onizle.mockClear(); try { localStorage.clear(); } catch { /* yoksay */ } });

describe("Ayarlar > Sesler", () => {
  it("anahtar sesleri açıp kapatır ve haber verir", () => {
    const onDegisti = vi.fn();
    render(<SeslerAyari onDegisti={onDegisti} />);
    const sw = screen.getByRole("switch", { name: "Uygulama seslerini aç veya kapat" });
    const once = sesAyarOku().acik;
    fireEvent.click(sw);
    expect(sesAyarOku().acik).toBe(!once);
    expect(onDegisti).toHaveBeenCalledWith(expect.objectContaining({ acik: !once }));
  });

  it("takım seçimi kaydeder ve önizler", () => {
    render(<SeslerAyari />);
    fireEvent.click(screen.getByRole("radio", { name: /Pop/ }));
    expect(sesAyarOku().takim).toBe("pop");
    expect(onizle).toHaveBeenCalledWith("mesaj", "pop");
  });

  it("her olay için Dinle düğmesi var", () => {
    render(<SeslerAyari />);
    expect(screen.getAllByRole("button", { name: /sesini dinle/ })).toHaveLength(11);
    fireEvent.click(screen.getByRole("button", { name: "Mikrofon açıldı sesini dinle" }));
    expect(onizle).toHaveBeenCalledWith("mikAc");
  });

  it("kaydırıcı seviyeyi günceller", () => {
    render(<SeslerAyari />);
    const r = screen.getByLabelText(/Ses düzeyi/, { selector: "input" });
    fireEvent.change(r, { target: { value: "40" } });
    expect(sesAyarOku().seviye).toBe(40);
  });
});
