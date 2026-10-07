package com.cember.chat

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import io.livekit.android.LiveKit
import io.livekit.android.audio.ScreenAudioCapturer
import io.livekit.android.room.Room
import io.livekit.android.room.track.LocalAudioTrack
import io.livekit.android.room.track.LocalVideoTrack
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.screencapture.ScreenCaptureParams
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Telefonun ekranını LiveKit odasına ayrı bir katılımcı olarak yayınlar (Android MediaProjection). */
@CapacitorPlugin(
    name = "EkranYakala",
    permissions = [Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "mikrofon")],
)
class EkranYakalaPlugin : Plugin() {
    private val kapsam = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var oda: Room? = null
    private var sesYakalayici: ScreenAudioCapturer? = null

    /** Kurulu uygulamanın sürümü (güncelleme uyarısı için). */
    @PluginMethod
    fun surum(call: PluginCall) {
        val sonuc = JSObject()
        try {
            val bilgi = context.packageManager.getPackageInfo(context.packageName, 0)
            @Suppress("DEPRECATION")
            val kod = if (Build.VERSION.SDK_INT >= 28) bilgi.longVersionCode else bilgi.versionCode.toLong()
            sonuc.put("kod", kod)
            sonuc.put("ad", bilgi.versionName ?: "")
        } catch (e: Exception) {
            call.reject("surum okunamadi")
            return
        }
        call.resolve(sonuc)
    }

    @PluginMethod
    fun baslat(call: PluginCall) {
        if (call.getString("url").isNullOrEmpty() || call.getString("token").isNullOrEmpty()) {
            call.reject("url ve token gerekli")
            return
        }
        // Telefonun sesini de yayınlamak için mikrofon izni (arka plan servisi için de gerekli)
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("mikrofon", call, "mikSonucu")
            return
        }
        ekranIzniIste(call)
    }

    @PermissionCallback
    private fun mikSonucu(call: PluginCall) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Telefonun sesini paylaşmak için mikrofon izni ver (Ayarlar > Uygulamalar > Çember > İzinler).")
            return
        }
        ekranIzniIste(call)
    }

    private fun ekranIzniIste(call: PluginCall) {
        val yonetici = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(call, yonetici.createScreenCaptureIntent(), "izinSonucu")
    }

    @ActivityCallback
    private fun izinSonucu(call: PluginCall?, sonuc: ActivityResult) {
        if (call == null) return
        val veri = sonuc.data
        if (sonuc.resultCode != Activity.RESULT_OK || veri == null) {
            call.reject("iptal")
            return
        }
        val url = call.getString("url")!!
        val token = call.getString("token")!!
        kapsam.launch {
            try {
                kapat()
                val r = LiveKit.create(context.applicationContext)
                oda = r
                r.connect(url, token)
                val basladi = r.localParticipant.setScreenShareEnabled(
                    true,
                    ScreenCaptureParams(
                        mediaProjectionPermissionResultData = veri,
                        notificationId = 4711,
                        notification = bildirim(),
                        onStop = { durdu() },
                    ),
                )
                if (!basladi) {
                    kapat()
                    call.reject("Ekran yakalama başlatılamadı")
                } else {
                    sesiYayinla(r)
                    call.resolve()
                }
            } catch (e: Throwable) {
                kapat()
                call.reject(e.message ?: "Ekran yakalama başlatılamadı")
            }
        }
    }

    /** Telefonun çaldığı sesi (film, müzik...) ekran katılımcısının ses kanalına karıştırır (Android 10+). */
    @SuppressLint("MissingPermission", "NewApi")
    private suspend fun sesiYayinla(r: Room) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        try {
            // Mikrofon zaten ana sesli odada açık; bu katılımcıdan yalnızca telefonun sesi gitsin
            try {
                val modul = r.lkObjects.audioDeviceModule
                modul.javaClass.getMethod("setAudioRecordEnabled", java.lang.Boolean.TYPE).invoke(modul, false)
            } catch (_: Throwable) { }
            r.localParticipant.setMicrophoneEnabled(true)
            val video = r.localParticipant.getTrackPublication(Track.Source.SCREEN_SHARE)?.track as? LocalVideoTrack
            val ses = r.localParticipant.getTrackPublication(Track.Source.MICROPHONE)?.track as? LocalAudioTrack
            val yakalayici = ScreenAudioCapturer.createFromScreenShareTrack(video)
            if (yakalayici != null && ses != null) {
                sesYakalayici = yakalayici
                ses.setAudioBufferCallback(yakalayici)
            }
        } catch (_: Throwable) { }
    }

    @PluginMethod
    fun durdur(call: PluginCall) {
        kapsam.launch {
            kapat()
            call.resolve()
        }
    }

    private fun durdu() {
        kapsam.launch {
            kapat()
            notifyListeners("durdu", JSObject())
        }
    }

    private suspend fun kapat() {
        val r = oda ?: return
        oda = null
        try { sesYakalayici?.releaseAudioResources() } catch (_: Throwable) { }
        sesYakalayici = null
        try { r.localParticipant.setMicrophoneEnabled(false) } catch (_: Throwable) { }
        try { r.localParticipant.setScreenShareEnabled(false) } catch (_: Throwable) { }
        try { r.disconnect() } catch (_: Throwable) { }
        try { r.release() } catch (_: Throwable) { }
    }

    private fun bildirim(): Notification {
        val kanalId = "ekran_paylasimi"
        val yonetici = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            yonetici.createNotificationChannel(
                NotificationChannel(kanalId, "Ekran paylaşımı", NotificationManager.IMPORTANCE_LOW),
            )
        }
        val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, kanalId) else Notification.Builder(context)
        return b.setContentTitle("Çember")
            .setContentText("Ekranın odadakilerle paylaşılıyor")
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setOngoing(true)
            .build()
    }

    override fun handleOnDestroy() {
        kapsam.launch { kapat() }
        super.handleOnDestroy()
    }
}
