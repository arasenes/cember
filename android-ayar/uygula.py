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

# 1b) Telefondan ekran paylaşımı: izinler ve ekran yakalama servisi (LiveKit Android SDK'nın hazır servisi)
m = manifest.read_text(encoding="utf-8")
if "FOREGROUND_SERVICE_MEDIA_PROJECTION" not in m:
    ek = """    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
"""
    m, n = re.subn(r'(\s*<uses-permission android:name="android.permission.INTERNET" />)', r"\1\n" + ek.rstrip("\n"), m)
    if n != 1:
        sys.exit("AndroidManifest.xml içinde INTERNET izni satırı bulunamadı (ekran izinleri)")
    servis = '        <service android:name="io.livekit.android.room.track.screencapture.ScreenCaptureService" android:exported="false" android:foregroundServiceType="mediaProjection" />\n'
    m, n = re.subn(r"(\s*)</application>", "\n" + servis.rstrip("\n") + r"\1</application>", m, count=1)
    if n != 1:
        sys.exit("AndroidManifest.xml içinde </application> bulunamadı")
    manifest.write_text(m, encoding="utf-8")

# Yerel eklenti (Kotlin) ve MainActivity kaydı
paket = android / "app/src/main/java/com/cember/chat"
paket.mkdir(parents=True, exist_ok=True)
shutil.copy(ayar / "yerel/EkranYakalaPlugin.kt", paket / "EkranYakalaPlugin.kt")
(paket / "MainActivity.java").write_text("""package com.cember.chat;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EkranYakalaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
""", encoding="utf-8")

# Kotlin eklentisi + LiveKit Android SDK
kok_gradle = android / "build.gradle"
kg = kok_gradle.read_text(encoding="utf-8")
if "kotlin-gradle-plugin" not in kg:
    kg, n = re.subn(r"(classpath ['\"]com\.android\.tools\.build:gradle:[^'\"]+['\"])", r"\1\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.20'", kg, count=1)
    if n != 1:
        sys.exit("android/build.gradle içinde AGP classpath satırı bulunamadı")
    # LiveKit'in ses yönlendirme kütüphanesi (audioswitch) JitPack'te yayınlanıyor
    kg += "\nallprojects {\n    repositories {\n        maven { url 'https://jitpack.io' }\n    }\n}\n"
    kok_gradle.write_text(kg, encoding="utf-8")
uyg = android / "app/build.gradle"
ug = uyg.read_text(encoding="utf-8")
if "kotlin-android" not in ug:
    ug, n = re.subn(r"(apply plugin: ['\"]com\.android\.application['\"])", r"\1\napply plugin: 'kotlin-android'", ug, count=1)
    if n != 1:
        sys.exit("app/build.gradle içinde application eklentisi satırı bulunamadı")
    ug, n = re.subn(r"\ndependencies \{", '\ndependencies {\n    implementation "io.livekit:livekit-android:2.29.0"', ug, count=1)
    if n != 1:
        sys.exit("app/build.gradle içinde dependencies bloğu bulunamadı")
    uyg.write_text(ug, encoding="utf-8")

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
