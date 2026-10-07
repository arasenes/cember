import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UygulamayaDon from "./UygulamayaDon";
import { uygulamaBaglantisi } from "./girisDonus";

describe("UygulamayaDon", () => {
  it("giriş bilgisi yoksa görünmez", () => {
    const { container } = render(<UygulamayaDon hash="" />);
    expect(container.firstChild).toBeNull();
  });
  it("Android tarayıcıda, giriş bilgisiyle uygulamayı açan bağlantıyı gösterir", () => {
    const eski = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (Linux; Android 14) Chrome/120", configurable: true });
    render(<UygulamayaDon hash="access_token=a&refresh_token=b" />);
    const a = screen.getByRole("link", { name: "Uygulamada aç" });
    expect(a.getAttribute("href")).toBe(uygulamaBaglantisi("access_token=a&refresh_token=b"));
    expect(a.getAttribute("href")).toContain("package=com.cember.chat");
    Object.defineProperty(navigator, "userAgent", { value: eski, configurable: true });
  });
});
