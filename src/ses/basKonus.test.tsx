import { act, fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ayarOku, ayarYaz, tusAdi, tusAtanabilir, useBasKonus, yazmaAlaniMi } from "./basKonus";

describe("bas-konuş ayarı", () => {
  beforeEach(() => localStorage.clear());

  it("varsayılan kapalı ve V; kaydedilen okunur, bozuk veri varsayılana döner", () => {
    expect(ayarOku()).toEqual({ acik: false, tus: "KeyV" });
    ayarYaz({ acik: true, tus: "Space" });
    expect(ayarOku()).toEqual({ acik: true, tus: "Space" });
    localStorage.setItem("cember-bas-konus", "{bozuk");
    expect(ayarOku()).toEqual({ acik: false, tus: "KeyV" });
  });

  it("tuş adları ve atanamayan tuşlar", () => {
    expect(tusAdi("KeyV")).toBe("V");
    expect(tusAdi("Digit5")).toBe("5");
    expect(tusAdi("Space")).toBe("Boşluk");
    expect(tusAtanabilir("KeyV")).toBe(true);
    expect(tusAtanabilir("Enter")).toBe(false);
    expect(tusAtanabilir("Escape")).toBe(false);
    expect(tusAtanabilir("MetaLeft")).toBe(false);
  });

  it("yazı alanlarını tanır", () => {
    const olustur = (etiket: string, tur?: string) => { const e = document.createElement(etiket); if (tur) (e as HTMLInputElement).type = tur; return e; };
    expect(yazmaAlaniMi(olustur("textarea"))).toBe(true);
    expect(yazmaAlaniMi(olustur("input", "text"))).toBe(true);
    expect(yazmaAlaniMi(olustur("input", "checkbox"))).toBe(false);
    expect(yazmaAlaniMi(olustur("button"))).toBe(false);
    expect(yazmaAlaniMi(null)).toBe(false);
  });
});

describe("useBasKonus", () => {
  it("modu açınca mikrofon kapanır; tuşa basılı tutarken açılır, bırakınca kapanır", () => {
    const mikAyarla = vi.fn();
    const { result } = renderHook(() => useBasKonus({ acik: true, tus: "KeyV" }, { kanalId: "k1", mikAyarla }));
    expect(mikAyarla).toHaveBeenLastCalledWith(false);
    act(() => { fireEvent.keyDown(window, { code: "KeyV" }); });
    expect(mikAyarla).toHaveBeenLastCalledWith(true);
    expect(result.current.basili).toBe(true);
    act(() => { fireEvent.keyDown(window, { code: "KeyV", repeat: true }); });
    expect(mikAyarla.mock.calls.filter((c) => c[0] === true)).toHaveLength(1); // tekrar eden olay yok sayılır
    act(() => { fireEvent.keyUp(window, { code: "KeyV" }); });
    expect(mikAyarla).toHaveBeenLastCalledWith(false);
    expect(result.current.basili).toBe(false);
  });

  it("yazı alanındayken tuş mikrofonu açmaz; pencere odağı kaybedilince bırakılır", () => {
    const mikAyarla = vi.fn();
    renderHook(() => useBasKonus({ acik: true, tus: "KeyV" }, { kanalId: "k1", mikAyarla }));
    mikAyarla.mockClear();
    const kutu = document.createElement("textarea");
    document.body.appendChild(kutu);
    act(() => { fireEvent.keyDown(kutu, { code: "KeyV" }); });
    expect(mikAyarla).not.toHaveBeenCalled();
    act(() => { fireEvent.keyDown(window, { code: "KeyV" }); });
    expect(mikAyarla).toHaveBeenLastCalledWith(true);
    act(() => { fireEvent.blur(window); });
    expect(mikAyarla).toHaveBeenLastCalledWith(false);
    kutu.remove();
  });

  it("sesli odada değilsek ya da mod kapalıysa dokunmaz; mod kapanınca mikrofon geri açılır", () => {
    const mikAyarla = vi.fn();
    const { rerender, unmount } = renderHook(({ ayar, kanal }) => useBasKonus(ayar, { kanalId: kanal, mikAyarla }), { initialProps: { ayar: { acik: true, tus: "KeyV" }, kanal: null as string | null } });
    act(() => { fireEvent.keyDown(window, { code: "KeyV" }); });
    expect(mikAyarla).not.toHaveBeenCalled();
    rerender({ ayar: { acik: true, tus: "KeyV" }, kanal: "k1" });
    expect(mikAyarla).toHaveBeenLastCalledWith(false);
    rerender({ ayar: { acik: false, tus: "KeyV" }, kanal: "k1" });
    expect(mikAyarla).toHaveBeenLastCalledWith(true);
    mikAyarla.mockClear();
    act(() => { fireEvent.keyDown(window, { code: "KeyV" }); });
    expect(mikAyarla).not.toHaveBeenCalled();
    unmount();
  });
});
