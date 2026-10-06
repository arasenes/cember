import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { kareKirp } from "./ekler";
import { yaziRengi } from "./Avatar";
import Avatar from "./Avatar";
import { adGecerli, PROFIL_RENKLERI } from "./ProfilDialog";

describe("kareKirp", () => {
  it("yatay resmi ortadan keser", () => expect(kareKirp(1000, 600)).toEqual({ sx: 200, sy: 0, s: 600 }));
  it("dikey resmi ortadan keser", () => expect(kareKirp(400, 1000)).toEqual({ sx: 0, sy: 300, s: 400 }));
  it("kare resme dokunmaz", () => expect(kareKirp(256, 256)).toEqual({ sx: 0, sy: 0, s: 256 }));
});

describe("yaziRengi", () => {
  it("koyu zeminde beyaz, açık zeminde lacivert yazı seçer", () => {
    expect(yaziRengi("#B3261E")).toBe("#FFFFFF");
    expect(yaziRengi("#E8A33D")).toBe("#14213D");
    expect(yaziRengi("bozuk")).toBe("#14213D");
  });
  it("palette her renk için okunur kontrast sağlar (>= 4.5)", () => {
    const parlaklik = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((t, c, i) => t + c * [0.2126, 0.7152, 0.0722][i], 0);
    for (const r of PROFIL_RENKLERI) {
      const a = parlaklik(r), b = parlaklik(yaziRengi(r));
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("adGecerli", () => {
  it("2-24 karakter ister, kontrol karakterlerini reddeder", () => {
    expect(adGecerli("A")).not.toBeNull();
    expect(adGecerli("x".repeat(25))).not.toBeNull();
    expect(adGecerli("Ayşe")).toBeNull();
    expect(adGecerli("  Ay  ")).toBeNull();
    expect(adGecerli("Ay\u0007şe")).not.toBeNull();
  });
});

describe("Avatar", () => {
  it("fotoğraf yoksa baş harfi gösterir", () => {
    const { container } = render(<Avatar uye={{ takma_ad: "ışık", renk: "#1F7A4D", avatar_yol: null }} />);
    expect(container.textContent).toBe("I");
    expect(container.querySelector("img")).toBeNull();
  });
  it("önizleme verilince resim gösterir", () => {
    const { container } = render(<Avatar uye={{ takma_ad: "Ali", renk: "#1F7A4D", avatar_yol: null }} onizleme="blob:x" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:x");
  });
});
