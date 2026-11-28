package org.askkim.pedigree.wrapper

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Android reminder notifications (`ReminderNotifications.kt`).
 *
 * Only the delivery end of reminders lives here: the schedule itself is computed in the PWA
 * (`@features/reminders`) and handed over as `SCHEDULE_REMINDERS` envelopes, so no domain rule is
 * duplicated in Kotlin.
 *
 * - The channel is created lazily, on the first notification, never at boot.
 * - `POST_NOTIFICATIONS` (API 33+) is checked before every post; a denied permission is a silent
 *   no-op, matching the web scheduler's behaviour.
 */
object ReminderNotifications {

    const val CHANNEL_ID = "pedigree_reminders"
    private const val CHANNEL_NAME = "Reminders"
    private const val CHANNEL_DESCRIPTION = "Chores, checks and milestone reminders"
    private const val PENDING_INTENT_REQUEST_BASE = 4_100

    /** Creates the reminder channel once per process; a no-op before API 26 or when it exists. */
    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = CHANNEL_DESCRIPTION
            setShowBadge(true)
        }
        manager.createNotificationChannel(channel)
    }

    /** True when the app may post notifications on this device. */
    fun hasPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Posts one reminder, tagged with its stable key so a later reminder replaces the earlier one
     * instead of stacking duplicates. Returns false when nothing was posted.
     */
    fun show(context: Context, key: String, title: String, detail: String): Boolean {
        if (!hasPermission(context)) return false
        ensureChannel(context)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return false
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val contentIntent = launchIntent?.let {
            PendingIntent.getActivity(
                context,
                PENDING_INTENT_REQUEST_BASE + (key.hashCode() and 0x0FFF),
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(detail)
            .setStyle(NotificationCompat.BigTextStyle().bigText(detail))
            .setAutoCancel(true)
            .setTag(key)
            .apply { contentIntent?.let { setContentIntent(it) } }
            .build()
        return try {
            manager.notify(key, 0, notification)
            true
        } catch (_: SecurityException) {
            false
        }
    }
}
