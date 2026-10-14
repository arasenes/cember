"""Çember simgesini ve açılış ekranını üretir (kulaklıklı gülen yüz, turuncu/lacivert). Çıktı: android-ayar/res/..."""
from pathlib import Path
from PIL import Image, ImageDraw

LACIVERT = (14, 23, 48, 255)
TURUNCU = (232, 163, 61, 255)
CIKTI = Path(__file__).parent / "res"
YOGUNLUK = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def bezier(p0, p1, p2, n=14):
    """p0->p1->p2 kontrol noktalarından düzgün bir kuadratik eğri örnekler (PIL yay çizmiyor)."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        pts.append((x, y))
    return pts


def yuvarlak_cizgi(d, pts, genislik):
    """d.line uç noktalarını köşeli bırakır; uçlara küçük daire ekleyip yuvarlatır (SVG'deki round-cap gibi)."""
    d.line(pts, fill=TURUNCU, width=genislik, joint="curve")
    r = genislik / 2
    for cx, cy in (pts[0], pts[-1]):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=TURUNCU)


def cember_yuz(boyut, oran, zemin=None, daire=False):
    """boyut x boyut tuval; oran: yüzün (kulaklıklar dahil) dış genişliğinin tuval boyuna oranı.
    4x büyük çizip küçültür (pürüzsüz kenar). Uygulama içindeki Logo bileşeni ve public/ikon.svg ile
    aynı motif (yerel 0-100 birim, merkezi tasarım): turuncu halka + gözler + gülümseme + kulaklık +
    halkanın dışından geçen mikrofon kolu."""
    k = 4
    b = boyut * k
    im = Image.new("RGBA", (b, b), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if zemin:
        if daire: d.ellipse([0, 0, b - 1, b - 1], fill=zemin)
        else: d.rectangle([0, 0, b, b], fill=zemin)

    s = (b * oran) / 81.0  # yerel tasarımda yüz (kulaklıklar dahil) ~81 birim genişliğinde
    ox = oy = b / 2 - 50 * s  # tasarım 50,50 merkezli (b/2'ye göre ortalanır)

    def P(x, y): return (ox + x * s, oy + y * s)

    d.ellipse([*P(23.3, 23.3), *P(76.7, 76.7)], outline=TURUNCU, width=max(1, int(8 * s)))
    goz_r = 3.1 * s
    for gx in (39.3, 60.7):
        cx, cy = P(gx, 45.6)
        d.ellipse([cx - goz_r, cy - goz_r, cx + goz_r, cy + goz_r], fill=TURUNCU)
    yuvarlak_cizgi(d, bezier(P(38.4, 58.9), P(50, 64.2), P(61.6, 58.9)), max(1, int(4.4 * s)))
    for ex in (14, 73.1):
        d.rounded_rectangle([*P(ex, 37.1), *P(ex + 12.9, 60.7)], radius=6.4 * s, fill=TURUNCU)
    yuvarlak_cizgi(d, bezier(P(80.2, 62.4), P(76.7, 74.9), P(66, 77.6)), max(1, int(3.8 * s)))
    mik_r = 2.8 * s
    cx, cy = P(64.7, 78.4)
    d.ellipse([cx - mik_r, cy - mik_r, cx + mik_r, cy + mik_r], fill=TURUNCU)
    return im.resize((boyut, boyut), Image.LANCZOS)


for ad, k in YOGUNLUK.items():
    klasor = CIKTI / f"mipmap-{ad}"
    klasor.mkdir(parents=True, exist_ok=True)
    onplan = int(108 * k)
    cember_yuz(onplan, 0.42).save(klasor / "ic_launcher_foreground.png")      # uyarlanabilir simge: güvenli alan içinde
    eski = int(48 * k)
    cember_yuz(eski, 0.66, LACIVERT).save(klasor / "ic_launcher.png")
    cember_yuz(eski, 0.66, LACIVERT, daire=True).save(klasor / "ic_launcher_round.png")

# Açılış ekranı: düz lacivert zemin + ortada yüz (mevcut dosyaların boyutları korunur)
import sys
kaynak = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if kaynak:
    for p in kaynak.glob("drawable*/splash.png"):
        w, h = Image.open(p).size
        im = Image.new("RGBA", (w, h), LACIVERT)
        s = int(min(w, h) * 0.30)
        r = cember_yuz(s, 0.94)
        im.alpha_composite(r, ((w - s) // 2, (h - s) // 2))
        hedef = CIKTI / p.parent.name
        hedef.mkdir(parents=True, exist_ok=True)
        im.save(hedef / "splash.png")
(CIKTI / "values").mkdir(parents=True, exist_ok=True)
(CIKTI / "values" / "ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0E1730</color>\n</resources>\n')
