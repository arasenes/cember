/**
 * Cloudflare Calls WebRTC SFU Entegrasyonu
 *
 * Cloudflare Calls, her kullanıcının en yakın Cloudflare Anycast sunucusuna
 * (İstanbul, Ankara, Frankfurt vb.) tek bir ses akışı yüklemesini ve diğer
 * tüm kullanıcıların sesini merkezi SFU üzerinden almasını sağlar.
 * 
 * 1 TB/ay ücretsiz bant genişliği sunar ve Discord mimarisi ile çalışır.
 */

const CF_AYAR_ANAHTARI = "cember:cf_calls_config";
const VARSAYILAN_CF_APP_ID = "f56971bc644bea8a231358fa32bde748";
const VARSAYILAN_CF_APP_TOKEN = "eaf2df467ec039845c82049796f2604c0bd9650362bf5c17443316f06dc1266a";

export type CloudflareCallsAyar = {
  appId: string;
  appToken: string;
};

/** Cloudflare Calls kimlik bilgilerini yerel depolamadan, ortam değişkenlerinden veya varsayılan ayarlardan okur */
export function cfCallsAyarAl(): CloudflareCallsAyar {
  try {
    const yerel = localStorage.getItem(CF_AYAR_ANAHTARI);
    if (yerel) {
      const parsed = JSON.parse(yerel) as CloudflareCallsAyar;
      if (parsed.appId && parsed.appToken) return parsed;
    }
  } catch { /* yoksay */ }

  const envAppId = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_CLOUDFLARE_CALLS_APP_ID;
  const envAppToken = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_CLOUDFLARE_CALLS_APP_TOKEN;

  if (envAppId && envAppToken) {
    return { appId: envAppId, appToken: envAppToken };
  }

  return { appId: VARSAYILAN_CF_APP_ID, appToken: VARSAYILAN_CF_APP_TOKEN };
}

/** Ayarlar ekranından Cloudflare Calls yapılandırmasını kaydeder */
export function cfCallsAyarKaydet(appId: string, appToken: string): void {
  if (!appId || !appToken) {
    localStorage.removeItem(CF_AYAR_ANAHTARI);
  } else {
    localStorage.setItem(CF_AYAR_ANAHTARI, JSON.stringify({ appId: appId.trim(), appToken: appToken.trim() }));
  }
}

/** Cloudflare Calls etkin mi? */
export function cfCallsAktifMi(): boolean {
  return true;
}

const CF_API_TABAN = "https://rtc.live.cloudflare.com/v1/apps";

/** Cloudflare Calls üzerinde yeni bir WebRTC oturumu açar */
export async function olusturCallsOturum(appId: string, appToken: string): Promise<string> {
  const resp = await fetch(`${CF_API_TABAN}/${appId}/sessions/new`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${appToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const hata = await resp.text();
    throw new Error(`Cloudflare Calls oturumu açılamadı: ${resp.status} - ${hata}`);
  }

  const veri = await resp.json() as { sessionId: string };
  return veri.sessionId;
}

/**
 * Yerel ses izini (mikrofon) Cloudflare Calls SFU sunucusuna yükler
 */
export async function yayinlaCallsIzi(
  appId: string,
  appToken: string,
  sessionId: string,
  offerSdp: string,
  trackName = "audio",
  mid = "0"
): Promise<{ answerSdp: string }> {
  const resp = await fetch(`${CF_API_TABAN}/${appId}/sessions/${sessionId}/tracks/new`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${appToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionDescription: {
        type: "offer",
        sdp: offerSdp,
      },
      tracks: [
        {
          location: "local",
          mid,
          trackName,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const hata = await resp.text();
    throw new Error(`Cloudflare Calls ses izi yayınlanamadı: ${resp.status} - ${hata}`);
  }

  const veri = await resp.json() as {
    sessionDescription?: { type: string; sdp: string };
  };

  if (!veri.sessionDescription?.sdp) {
    throw new Error("Cloudflare Calls SDP cevabı döndürmedi.");
  }

  return { answerSdp: veri.sessionDescription.sdp };
}

/**
 * Başka bir kullanıcının ses izini Cloudflare Calls SFU sunucusundan çeker (Pull)
 */
export async function dinleCallsIzi(
  appId: string,
  appToken: string,
  mySessionId: string,
  remoteSessionId: string,
  trackName = "audio"
): Promise<{ offerSdp: string }> {
  const resp = await fetch(`${CF_API_TABAN}/${appId}/sessions/${mySessionId}/tracks/new`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${appToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tracks: [
        {
          location: "remote",
          sessionId: remoteSessionId,
          trackName,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const hata = await resp.text();
    throw new Error(`Cloudflare Calls uzak iz çekilemedi: ${resp.status} - ${hata}`);
  }

  const veri = await resp.json() as {
    sessionDescription?: { type: string; sdp: string };
  };

  if (!veri.sessionDescription?.sdp) {
    throw new Error("Cloudflare Calls SDP teklifi döndürmedi.");
  }

  return { offerSdp: veri.sessionDescription.sdp };
}

/**
 * Uzak iz için SDP cevabını Cloudflare Calls'a iletir
 */
export async function cevaplaCallsIzi(
  appId: string,
  appToken: string,
  mySessionId: string,
  answerSdp: string
): Promise<void> {
  const resp = await fetch(`${CF_API_TABAN}/${appId}/sessions/${mySessionId}/renegotiate`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${appToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionDescription: {
        type: "answer",
        sdp: answerSdp,
      },
    }),
  });

  if (!resp.ok) {
    const hata = await resp.text();
    throw new Error(`Cloudflare Calls yeniden uzlaşma hatası: ${resp.status} - ${hata}`);
  }
}

/**
 * Cloudflare Calls oturumunu kapatır
 */
export async function kapatCallsOturum(appId: string, appToken: string, sessionId: string): Promise<void> {
  try {
    await fetch(`${CF_API_TABAN}/${appId}/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${appToken}`,
      },
    });
  } catch { /* yoksay */ }
}
