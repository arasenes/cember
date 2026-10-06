import { avatarHazirla, ekHazirla, EkHatasi } from "../src/ekler";

function tuval(g: number, y: number, ciz: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const t = document.createElement("canvas"); t.width = g; t.height = y;
  ciz(t.getContext("2d")!); return t;
}
const blobAl = (t: HTMLCanvasElement, tur: string) => new Promise<Blob>((c) => t.toBlob((b) => c(b!), tur, 0.95));

// EXIF yönelim=6 (90° saat yönü) içeren JPEG üretir
async function exifliJpeg(g: number, y: number): Promise<Blob> {
  const t = tuval(g, y, (c) => { c.fillStyle = "#c33"; c.fillRect(0, 0, g, y); c.fillStyle = "#fff"; c.fillRect(0, 0, 20, 20); });
  const b = new Uint8Array(await (await blobAl(t, "image/jpeg")).arrayBuffer());
  const app1 = new Uint8Array([0xff,0xe1,0x00,0x22, 0x45,0x78,0x69,0x66,0,0, 0x49,0x49,0x2a,0,8,0,0,0, 1,0, 0x12,1,3,0,1,0,0,0,6,0,0,0, 0,0,0,0]);
  const out = new Uint8Array(b.length + app1.length);
  out.set(b.subarray(0, 2), 0); out.set(app1, 2); out.set(b.subarray(2), 2 + app1.length);
  return new Blob([out], { type: "image/jpeg" });
}

(window as any).testEk = async () => {
  const sonuc: Record<string, unknown> = {};
  const olc = async (ad: string, f: () => Promise<Blob | File>) => {
    try {
      const h = await ekHazirla(await f(), ad);
      const bmp = await createImageBitmap(h.blob);
      sonuc[ad] = { ok: true, tur: h.tur, g: h.genislik, y: h.yukseklik, gercekG: bmp.width, gercekY: bmp.height, boyut: h.boyut };
    } catch (e) { sonuc[ad] = { ok: false, hata: e instanceof EkHatasi ? e.message : String(e) }; }
  };
  await olc("buyuk_ekran_goruntusu", async () => blobAl(tuval(3840, 2160, (c) => {
    for (let i = 0; i < 400; i++) { c.fillStyle = `hsl(${i * 7 % 360} 70% 50%)`; c.fillRect((i * 97) % 3800, (i * 53) % 2100, 200, 40); c.fillStyle = "#000"; c.font = "28px sans-serif"; c.fillText("Satır " + i, (i * 97) % 3800, (i * 53) % 2100 + 30); }
  }), "image/png"));
  await olc("kucuk_png", async () => blobAl(tuval(300, 200, (c) => { c.fillStyle = "#39f"; c.fillRect(0, 0, 300, 200); }), "image/png"));
  await olc("seffaf_png", async () => blobAl(tuval(500, 500, (c) => { c.clearRect(0, 0, 500, 500); c.fillStyle = "#f00"; c.beginPath(); c.arc(250, 250, 100, 0, 7); c.fill(); }), "image/png"));
  await olc("exif_dondurulmus_jpeg", () => exifliJpeg(400, 200));
  await olc("dik_uzun", async () => blobAl(tuval(1000, 6000, (c) => { c.fillStyle = "#3a3"; c.fillRect(0, 0, 1000, 6000); }), "image/png"));
  await olc("bozuk_png", async () => new File([new Uint8Array([1, 2, 3, 4])], "x.png", { type: "image/png" }));
  await olc("svg", async () => new File(["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"], "x.svg", { type: "image/svg+xml" }));
  await olc("gif", async () => new Blob([Uint8Array.from(atob("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="), (c) => c.charCodeAt(0))], { type: "image/gif" }));
  return sonuc;
};
(window as any).hazir = true;

(window as any).testAvatar = async () => {
  const sonuc: Record<string, unknown> = {};
  // Sol yarı kırmızı, sağ yarı mavi, 1200x600 yatay resim: ortadan kare kesilince 600x600 olur, iki renk yarı yarıya kalmalı
  const yatay = await blobAl(tuval(1200, 600, (c) => { c.fillStyle = "#f00"; c.fillRect(0, 0, 600, 600); c.fillStyle = "#00f"; c.fillRect(600, 0, 600, 600); c.fillStyle = "#0f0"; c.fillRect(0, 0, 200, 600); c.fillRect(1000, 0, 200, 600); }), "image/png");
  const h = await avatarHazirla(yatay, "yatay");
  const bmp = await createImageBitmap(h.blob);
  const t = document.createElement("canvas"); t.width = bmp.width; t.height = bmp.height;
  const c = t.getContext("2d")!; c.drawImage(bmp, 0, 0);
  const px = (x: number, y: number) => Array.from(c.getImageData(x, y, 1, 1).data.slice(0, 3));
  sonuc.yatay = { tur: h.tur, g: bmp.width, y: bmp.height, boyut: h.boyut, sol: px(20, 128), sag: px(235, 128) };
  const dikey = await blobAl(tuval(300, 900, (c) => { c.fillStyle = "#00f"; c.fillRect(0, 0, 300, 300); c.fillStyle = "#f00"; c.fillRect(0, 300, 300, 300); c.fillStyle = "#00f"; c.fillRect(0, 600, 300, 300); }), "image/png");
  const d = await avatarHazirla(dikey, "dikey");
  const b2 = await createImageBitmap(d.blob);
  const t2 = document.createElement("canvas"); t2.width = b2.width; t2.height = b2.height;
  const c2 = t2.getContext("2d")!; c2.drawImage(b2, 0, 0);
  sonuc.dikey = { g: b2.width, y: b2.height, orta: Array.from(c2.getImageData(128, 128, 1, 1).data.slice(0, 3)) };
  try { await avatarHazirla(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })); sonuc.svg = "KABUL EDILDI"; } catch (e) { sonuc.svg = e instanceof EkHatasi ? e.message : String(e); }
  try { await avatarHazirla(new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" })); sonuc.bozuk = "KABUL EDILDI"; } catch (e) { sonuc.bozuk = e instanceof EkHatasi ? e.message : String(e); }
  // Büyük bir fotoğraf-benzeri gürültü resmi 1 MB sınırını aşmadan 256x256'ya inmeli
  const gurultu = await blobAl(tuval(4000, 3000, (c) => { for (let i = 0; i < 3000; i++) { c.fillStyle = `rgb(${(i*37)%256},${(i*91)%256},${(i*13)%256})`; c.fillRect((i*131)%4000, (i*71)%3000, 90, 90); } }), "image/png");
  const g = await avatarHazirla(gurultu, "gurultu");
  sonuc.buyuk = { g: g.genislik, y: g.yukseklik, boyut: g.boyut, kucuk1MB: g.boyut <= 1048576 };
  return sonuc;
};
