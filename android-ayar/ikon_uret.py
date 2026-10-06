"""Çember simgesini ve açılış ekranını üretir (turuncu halka, lacivert zemin). Çıktı: android-ayar/res/..."""
from pathlib import Path
from PIL import Image, ImageDraw

LACIVERT = (14, 23, 48, 255)
TURUNCU = (232, 163, 61, 255)
CIKTI = Path(__file__).parent / "res"
YOGUNLUK = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}

def halka(boyut, oran, zemin=None, daire=False):
    """boyut x boyut tuval; oran: halka dış çapının tuval boyuna oranı. 4x büyük çizip küçültür (pürüzsüz kenar)."""
    k = 4
    b = boyut * k
    im = Image.new("RGBA", (b, b), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if zemin:
        if daire: d.ellipse([0, 0, b - 1, b - 1], fill=zemin)
        else: d.rectangle([0, 0, b, b], fill=zemin)
    r = b * oran / 2
    kalin = r * 0.40
    c = b / 2
    d.ellipse([c - r, c - r, c + r, c + r], outline=TURUNCU, width=int(kalin))
    return im.resize((boyut, boyut), Image.LANCZOS)

for ad, k in YOGUNLUK.items():
    klasor = CIKTI / f"mipmap-{ad}"
    klasor.mkdir(parents=True, exist_ok=True)
    onplan = int(108 * k)
    halka(onplan, 0.42).save(klasor / "ic_launcher_foreground.png")      # uyarlanabilir simge: güvenli alan içinde
    eski = int(48 * k)
    halka(eski, 0.66, LACIVERT).save(klasor / "ic_launcher.png")
    halka(eski, 0.66, LACIVERT, daire=True).save(klasor / "ic_launcher_round.png")

# Açılış ekranı: düz lacivert zemin + ortada halka (mevcut dosyaların boyutları korunur)
import sys
kaynak = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if kaynak:
    for p in kaynak.glob("drawable*/splash.png"):
        w, h = Image.open(p).size
        im = Image.new("RGBA", (w, h), LACIVERT)
        s = int(min(w, h) * 0.30)
        r = halka(s, 0.94)
        im.alpha_composite(r, ((w - s) // 2, (h - s) // 2))
        hedef = CIKTI / p.parent.name
        hedef.mkdir(parents=True, exist_ok=True)
        im.save(hedef / "splash.png")
(CIKTI / "values").mkdir(parents=True, exist_ok=True)
(CIKTI / "values" / "ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0E1730</color>\n</resources>\n')
