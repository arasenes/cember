package com.cember.chat

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.projection.MediaProjectionManager
import android.os.Build
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import io.livekit.android.room.track.screencapture.ScreenCaptureParams
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Telefonun ekranını LiveKit odasına ayrı bir katılımcı olarak yayınlar (Android MediaProjection). */
@CapacitorPlugin(name = "EkranYakala")
class EkranYakalaPlugin : Plugin() {
    private val kapsam = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var oda: Room? = null

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
                    call.resolve()
                }
            } catch (e: Throwable) {
                kapat()
                call.reject(e.message ?: "Ekran yakalama başlatılamadı")
            }
        }
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
