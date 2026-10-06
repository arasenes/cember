// Resim eki yardımcıları: doğrulama, küçültme, yol üretimi. Sunucu tarafı kurallar migration 005'te de vardır.
export const EK_MAX_BAYT = 5 * 1024 * 1024; // depolama kovasının sınırıyla aynı
export const EK_GIRIS_MAX = 25 * 1024 * 1024; // seçilen dosya için üst sınır (küçültülmeden önce)
export const EK_MAX_KENAR = 1600; // uzun kenar bu değere küçültülür
export const EK_MAX_PIKSEL = 10000; // veritabanı kısıtıyla aynı
export const IZINLI_TURLER = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export type HazirEk = {
  blob: Blob; tur: string; uzanti: string; boyut: number; genislik: number; yukseklik: number; onizleme: string; ad: string;
};

export class EkHatasi extends Error {}

export function uzantiOf(tur: string): string {
  return tur === "image/jpeg" ? "jpg" : tur === "image/png" ? "png" : tur === "image/gif" ? "gif" : "webp";
}

/** Oranı koruyarak en uzun kenarı `max` değerine indirir; zaten küçükse değiştirmez. */
export function olcekle(g: number, y: number, max: number): { g: number; y: number } {
  const oran = Math.min(1, max / Math.max(g, y));
  return { g: Math.max(1, Math.round(g * oran)), y: Math.max(1, Math.round(y * oran)) };
}

/** Mesajda gösterilecek boyut (düzen kaymasın diye önceden hesaplanır). */
export function gosterimBoyutu(g: number, y: number, enG = 360, enY = 320): { g: number; y: number } {
  const oran = Math.min(1, enG / g, enY / y);
  return { g: Math.max(1, Math.round(g * oran)), y: Math.max(1, Math.round(y * oran)) };
}

export function ekYolu(odaId: string, kanalId: string, rastgele: string, tur: string): string {
  return `${odaId}/${kanalId}/${rastgele}.${uzantiOf(tur)}`;
}

export function boyutMetni(bayt: number): string {
  return bayt < 1024 * 1024 ? `${Math.max(1, Math.round(bayt / 1024))} KB` : `${(bayt / 1024 / 1024).toFixed(1)} MB`;
}

export function turKontrol(dosya: { type: string; size: number }): void {
  if (!(IZINLI_TURLER as readonly string[]).includes(dosya.type)) {
    throw new EkHatasi("Yalnızca PNG, JPEG, WebP ve GIF resimleri gönderilebilir.");
  }
  if (dosya.size > EK_GIRIS_MAX) throw new EkHatasi("Resim çok büyük (en fazla 25 MB).");
  if (dosya.size === 0) throw new EkHatasi("Resim boş görünüyor.");
}

function blobYap(tuval: HTMLCanvasElement, tur: string, kalite: number): Promise<Blob | null> {
  return new Promise((coz) => tuval.toBlob(coz, tur, kalite));
}

/**
 * Seçilen resmi gönderilecek hale getirir. GIF olduğu gibi gider (animasyon bozulmasın).
 * Diğerleri küçültülüp yeniden kodlanır; bu işlem fotoğraflardaki konum gibi EXIF bilgilerini de siler.
 */
export async function ekHazirla(dosya: File | Blob, ad = "resim"): Promise<HazirEk> {
  turKontrol(dosya);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(dosya, { imageOrientation: "from-image" });
  } catch {
    throw new EkHatasi("Resim okunamadı. Dosya bozuk olabilir.");
  }
  const { width: g0, height: y0 } = bitmap;
  try {
    if (g0 > EK_MAX_PIKSEL || y0 > EK_MAX_PIKSEL) throw new EkHatasi("Resmin boyutları çok büyük.");

    if (dosya.type === "image/gif") {
      if (dosya.size > EK_MAX_BAYT) throw new EkHatasi("GIF en fazla 5 MB olabilir.");
      return { blob: dosya, tur: "image/gif", uzanti: "gif", boyut: dosya.size, genislik: g0, yukseklik: y0, onizleme: URL.createObjectURL(dosya), ad };
    }

    let olcek = EK_MAX_KENAR;
    for (let deneme = 0; deneme < 4; deneme++) {
      const { g, y } = olcekle(g0, y0, olcek);
      const tuval = document.createElement("canvas");
      tuval.width = g; tuval.height = y;
      const cz = tuval.getContext("2d");
      if (!cz) throw new EkHatasi("Resim işlenemedi.");
      cz.drawImage(bitmap, 0, 0, g, y);
      let blob = await blobYap(tuval, "image/webp", deneme === 0 ? 0.9 : 0.75);
      if (!blob || blob.type !== "image/webp") {
        // WebP kodlayamayan tarayıcı: şeffaflığı beyazla doldurup JPEG'e düş
        cz.globalCompositeOperation = "destination-over";
        cz.fillStyle = "#fff"; cz.fillRect(0, 0, g, y);
        blob = await blobYap(tuval, "image/jpeg", deneme === 0 ? 0.88 : 0.7);
      }
      if (!blob) throw new EkHatasi("Resim işlenemedi.");
      if (blob.size <= EK_MAX_BAYT) {
        return { blob, tur: blob.type, uzanti: uzantiOf(blob.type), boyut: blob.size, genislik: g, yukseklik: y, onizleme: URL.createObjectURL(blob), ad };
      }
      olcek = Math.round(olcek * 0.75);
    }
    throw new EkHatasi("Resim küçültülemedi, daha küçük bir resim dene.");
  } finally {
    bitmap.close();
  }
}
