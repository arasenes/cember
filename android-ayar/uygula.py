"""`npx cap add android` ile üretilen Android projesine Çember'e özel ayarları uygular (GitHub Actions'ta çalışır).
Yapılanlar: mikrofon izinleri, simge/açılış ekranı, sabit imza anahtarı (güncellemeler üstüne kurulabilsin), sürüm numarası."""
import os
import re
import shutil
import sys
from pathlib import Path

kok = Path(__file__).resolve().parent.parent
android = kok / "android"
ayar = kok / "android-ayar"
surum_no = int(os.environ.get("SURUM_NO", "1"))

# 1) İzinler: sesli odalar için mikrofon ve ses yönlendirme
manifest = android / "app/src/main/AndroidManifest.xml"
m = manifest.read_text(encoding="utf-8")
eklenecek = """    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
"""
if "RECORD_AUDIO" not in m:
    m, n = re.subn(r'(\s*<uses-permission android:name="android.permission.INTERNET" />)', r"\1\n" + eklenecek.rstrip("\n"), m)
    if n != 1:
        sys.exit("AndroidManifest.xml içinde INTERNET izni satırı bulunamadı")
    manifest.write_text(m, encoding="utf-8")

# 2) Simge, açılış ekranı ve renkler
shutil.copytree(ayar / "res", android / "app/src/main/res", dirs_exist_ok=True)

# 3) Sabit imza anahtarı + sürüm numarası
gradle = android / "app/build.gradle"
g = gradle.read_text(encoding="utf-8")
if "signingConfigs" not in g:
    imza = f'''    signingConfigs {{
        debug {{
            storeFile file("{(ayar / "debug.keystore").as_posix()}")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }}
    }}
    buildTypes {{'''
    g, n = re.subn(r"    buildTypes \{", imza, g, count=1)
    if n != 1:
        sys.exit("build.gradle içinde buildTypes bloğu bulunamadı")
g, n1 = re.subn(r"versionCode \d+", f"versionCode {surum_no}", g, count=1)
g, n2 = re.subn(r'versionName "[^"]*"', f'versionName "1.0.{surum_no}"', g, count=1)
if n1 != 1 or n2 != 1:
    sys.exit("build.gradle içinde sürüm satırları bulunamadı")
gradle.write_text(g, encoding="utf-8")
print(f"Çember Android ayarları uygulandı (sürüm 1.0.{surum_no})")
