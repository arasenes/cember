import { describe, expect, it } from "vitest";
import type { Kanal, Kategori } from "../types";
import { duzenle, gruplariKur, yavasModMetni } from "./siralama";

const k = (id: string, sira: number, kategori_id: string | null = null): Kanal => ({ id, oda_id: "o", ad: id, tur: "yazili", sira, sifreli: false, aciklama: null, kategori_id });
const c = (id: string, sira: number): Kategori => ({ id, oda_id: "o", ad: id, sira });

const kanallar = [k("a", 1), k("b", 2, "K1"), k("c", 3, "K1"), k("d", 4, "K2"), k("e", 5)];
const kategoriler = [c("K2", 2), c("K1", 1)];
const kimlikler = (r: { id: string }[]) => r.map((x) => x.id);

describe("gruplariKur", () => {
  it("kategorisiz kanallar önce, sonra kategoriler sıra numarasına göre", () => {
    const g = gruplariKur(kanallar, kategoriler);
    expect(g.map((x) => x.kategori?.id ?? null)).toEqual([null, "K1", "K2"]);
    expect(g.map((x) => kimlikler(x.kanallar))).toEqual([["a", "e"], ["b", "c"], ["d"]]);
  });
  it("silinmiş kategoriye bağlı kanal kategorisize düşer", () => {
    const g = gruplariKur([k("x", 1, "YOK")], []);
    expect(kimlikler(g[0].kanallar)).toEqual(["x"]);
  });
});

describe("duzenle", () => {
  it("kanal yukarı/aşağı: yalnızca kendi grubunda yer değiştirir; sıra ardışık", () => {
    const r = duzenle(kanallar, kategoriler, { tur: "kanal-asagi", id: "b" });
    expect(kimlikler(r.kanallar)).toEqual(["a", "e", "c", "b", "d"]);
    expect(r.kanallar.map((x) => x.sira)).toEqual([1, 2, 3, 4, 5]);
    const son = duzenle(kanallar, kategoriler, { tur: "kanal-asagi", id: "e" });
    expect(kimlikler(son.kanallar)).toEqual(["a", "e", "b", "c", "d"]); // sonuncuda değişmez
  });
  it("kanal başka kategoriye taşınır ve sona eklenir; kategorisize de alınabilir", () => {
    const r = duzenle(kanallar, kategoriler, { tur: "kanal-kategori", id: "a", kategori_id: "K2" });
    expect(r.kanallar.find((x) => x.id === "a")).toMatchObject({ kategori_id: "K2" });
    expect(kimlikler(r.kanallar)).toEqual(["e", "b", "c", "d", "a"]);
    const geri = duzenle(kanallar, kategoriler, { tur: "kanal-kategori", id: "d", kategori_id: null });
    expect(geri.kanallar.find((x) => x.id === "d")!.kategori_id).toBeNull();
    const gecersiz = duzenle(kanallar, kategoriler, { tur: "kanal-kategori", id: "a", kategori_id: "YOK" });
    expect(kimlikler(gecersiz.kanallar)).toEqual(kimlikler(duzenle(kanallar, kategoriler, { tur: "kanal-yukari", id: "a" }).kanallar));
  });
  it("kanal başka bir kanalın önüne sürüklenir (kategorisi de onunki olur)", () => {
    const r = duzenle(kanallar, kategoriler, { tur: "kanal-onune", id: "e", hedef: "c" });
    expect(r.kanallar.map((x) => [x.id, x.kategori_id])).toEqual([["a", null], ["b", "K1"], ["e", "K1"], ["c", "K1"], ["d", "K2"]]);
  });
  it("kategori sırası yukarı/aşağı ve önüne taşınır; kanalların sırası kategoriyi izler", () => {
    const r = duzenle(kanallar, kategoriler, { tur: "kategori-asagi", id: "K1" });
    expect(r.kategoriler).toEqual([{ id: "K2", sira: 1 }, { id: "K1", sira: 2 }]);
    expect(kimlikler(r.kanallar)).toEqual(["a", "e", "d", "b", "c"]);
    const o = duzenle(kanallar, kategoriler, { tur: "kategori-onune", id: "K2", hedef: "K1" });
    expect(o.kategoriler.map((x) => x.id)).toEqual(["K2", "K1"]);
  });
  it("aynı kanalı kendi önüne taşımak değişiklik yapmaz", () => {
    const r = duzenle(kanallar, kategoriler, { tur: "kanal-onune", id: "a", hedef: "a" });
    expect(kimlikler(r.kanallar)).toEqual(["a", "e", "b", "c", "d"]);
  });
});

describe("yavasModMetni", () => {
  it("bilinen değerler okunur, bilinmeyen saniye olarak yazılır", () => {
    expect(yavasModMetni(0)).toBe("Kapalı");
    expect(yavasModMetni(300)).toBe("5 dk");
    expect(yavasModMetni(7)).toBe("7 sn");
  });
});
