import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Kanal } from "./types";

const rpc = vi.fn();
vi.mock("./supabase", () => ({ SUPABASE_URL: "http://x", SUPABASE_KEY: "k", supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import KanalSifre from "./KanalSifre";

const kanal = { id: "k1", oda_id: "o1", ad: "Gizli", tur: "yazili", sira: 1, sifreli: true } as Kanal;

describe("şifreli kanal", () => {
  it("yanlış şifrede hata gösterir, doğruysa kanalı açar", async () => {
    const acildi = vi.fn();
    rpc.mockResolvedValueOnce({ data: false, error: null }).mockResolvedValueOnce({ data: true, error: null });
    render(<KanalSifre kanal={kanal} onAcildi={acildi} onKapat={() => {}} />);
    const girdi = screen.getByLabelText(/şifreli/i);
    fireEvent.change(girdi, { target: { value: "yanlis" } });
    fireEvent.click(screen.getByRole("button", { name: "Gir" }));
    expect(await screen.findByText("Şifre yanlış.")).toBeTruthy();
    expect(acildi).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/şifreli/i), { target: { value: "dogru" } });
    fireEvent.click(screen.getByRole("button", { name: "Gir" }));
    await waitFor(() => expect(acildi).toHaveBeenCalled());
    expect(rpc).toHaveBeenLastCalledWith("kanal_ac", { p_kanal: "k1", p_sifre: "dogru" });
  });
});
