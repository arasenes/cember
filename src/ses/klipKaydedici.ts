/**
 * Sesli odada son 30 saniyelik konuşmaları döngüsel bellekte (circular buffer) tutar.
 * "Klip Al" tıklandığında anında WAV ses dosyası olarak dışa aktarır ve sohbete eklemeyi sağlar.
 */

export class SesKlipKaydedici {
  private mediaStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: { blob: Blob; time: number }[] = [];
  private maksSureMs: number = 30_000; // 30 saniye
  private timer: number | null = null;

  constructor(maksSureSn: number = 30) {
    this.maksSureMs = maksSureSn * 1000;
  }

  baslat(stream: MediaStream) {
    this.durdur();
    this.mediaStream = stream;
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "";

      this.recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          const simdi = Date.now();
          this.chunks.push({ blob: e.data, time: simdi });
          // 30 saniyeden eski parçaları at
          const altSinir = simdi - this.maksSureMs;
          this.chunks = this.chunks.filter((c) => c.time >= altSinir);
        }
      };
      // Her 2 saniyede bir parça kaydet
      this.recorder.start(2000);
    } catch {
      /* Desteklenmeyen ortam */
    }
  }

  klipAl(): Blob | null {
    if (this.chunks.length === 0) return null;
    const simdi = Date.now();
    const sonParcalar = this.chunks
      .filter((c) => c.time >= simdi - this.maksSureMs)
      .map((c) => c.blob);

    if (sonParcalar.length === 0) return null;
    const mimeType = this.recorder?.mimeType || "audio/webm";
    return new Blob(sonParcalar, { type: mimeType });
  }

  durdur() {
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch { /* yoksay */ }
    }
    this.recorder = null;
    this.mediaStream = null;
    this.chunks = [];
  }
}
