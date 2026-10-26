export type SesEfektModu = "normal" | "telsiz" | "magara" | "robot" | "megafon";

export type SesModBilgisi = {
  kod: SesEfektModu;
  simge: string;
  etiket: string;
};

export const SES_MODLARI: SesModBilgisi[] = [
  { kod: "normal", simge: "🎙️", etiket: "Normal" },
  { kod: "telsiz", simge: "📻", etiket: "Telsiz" },
  { kod: "magara", simge: "🏔️", etiket: "Mağara Yankı" },
  { kod: "robot", simge: "🤖", etiket: "Robot" },
  { kod: "megafon", simge: "📢", etiket: "Megafon" },
];

export function gecerliSesModuMu(kod: unknown): kod is SesEfektModu {
  return typeof kod === "string" && SES_MODLARI.some((m) => m.kod === kod);
}

function distorsiyonEgrisi(miktar: number): Float32Array<ArrayBuffer> {
  const n = 44100;
  const buf = new ArrayBuffer(n * 4);
  const egri = new Float32Array(buf);
  const k = Math.max(1, miktar);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    egri[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return egri;
}

/**
 * Ham mikrofon akışını Web Audio düğümlerinden geçirerek seçilen ses değiştirici modunu uygular.
 * Normal modda veya Web Audio desteklenmiyorsa doğrudan ham akışı döner.
 */
export function sesFiltresiKur(
  ctx: AudioContext,
  hamAkis: MediaStream,
  mod: SesEfektModu,
): { akis: MediaStream; kapat: () => void } {
  if (mod === "normal" || hamAkis.getAudioTracks().length === 0 || typeof ctx.createMediaStreamDestination !== "function") {
    return { akis: hamAkis, kapat: () => {} };
  }

  try {
    const kaynak = ctx.createMediaStreamSource(hamAkis);
    const hedef = ctx.createMediaStreamDestination();
    const dugumler: AudioNode[] = [kaynak];
    let osc: OscillatorNode | null = null;

    if (mod === "telsiz") {
      const altGecis = ctx.createBiquadFilter();
      altGecis.type = "highpass";
      altGecis.frequency.value = 480;
      const ustGecis = ctx.createBiquadFilter();
      ustGecis.type = "lowpass";
      ustGecis.frequency.value = 2600;
      const sekil = ctx.createWaveShaper();
      sekil.curve = distorsiyonEgrisi(60);
      const kazanc = ctx.createGain();
      kazanc.gain.value = 0.85;
      kaynak.connect(altGecis);
      altGecis.connect(ustGecis);
      ustGecis.connect(sekil);
      sekil.connect(kazanc);
      kazanc.connect(hedef);
      dugumler.push(altGecis, ustGecis, sekil, kazanc);
    } else if (mod === "magara") {
      const kuru = ctx.createGain();
      kuru.gain.value = 0.9;
      const gecikme = ctx.createDelay(1.0);
      gecikme.delayTime.value = 0.22;
      const geriBesleme = ctx.createGain();
      geriBesleme.gain.value = 0.42;
      const islak = ctx.createGain();
      islak.gain.value = 0.55;
      kaynak.connect(kuru);
      kuru.connect(hedef);
      kaynak.connect(gecikme);
      gecikme.connect(geriBesleme);
      geriBesleme.connect(gecikme);
      gecikme.connect(islak);
      islak.connect(hedef);
      dugumler.push(kuru, gecikme, geriBesleme, islak);
    } else if (mod === "robot") {
      // Ring modülatör: 55 Hz taşıyıcı dalga ile sesi çarpar
      const tasiyiciKazanc = ctx.createGain();
      tasiyiciKazanc.gain.value = 0;
      osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 55;
      osc.connect(tasiyiciKazanc.gain);
      osc.start();
      const cikisKazanc = ctx.createGain();
      cikisKazanc.gain.value = 1.1;
      kaynak.connect(tasiyiciKazanc);
      tasiyiciKazanc.connect(cikisKazanc);
      cikisKazanc.connect(hedef);
      dugumler.push(tasiyiciKazanc, cikisKazanc);
    } else if (mod === "megafon") {
      const filtre = ctx.createBiquadFilter();
      filtre.type = "peaking";
      filtre.frequency.value = 1600;
      filtre.Q.value = 2.2;
      filtre.gain.value = 12;
      const sekil = ctx.createWaveShaper();
      sekil.curve = distorsiyonEgrisi(35);
      const kazanc = ctx.createGain();
      kazanc.gain.value = 0.9;
      kaynak.connect(filtre);
      filtre.connect(sekil);
      sekil.connect(kazanc);
      kazanc.connect(hedef);
      dugumler.push(filtre, sekil, kazanc);
    }

    // Ham mikrofon kapatıldığında/sessize alındığında hedef akış da güncellensin
    const hamIz = hamAkis.getAudioTracks()[0];
    const yeniIz = hedef.stream.getAudioTracks()[0];
    if (hamIz && yeniIz) {
      yeniIz.enabled = hamIz.enabled;
    }

    return {
      akis: hedef.stream,
      kapat: () => {
        try { osc?.stop(); } catch { /* yoksay */ }
        for (const d of dugumler) {
          try { d.disconnect(); } catch { /* yoksay */ }
        }
      },
    };
  } catch {
    return { akis: hamAkis, kapat: () => {} };
  }
}
