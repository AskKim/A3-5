package org.askkim.pedigree.wrapper

import android.content.Context
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.concurrent.TimeUnit

/**
 * Schedules native reminder wake-ups (`ReminderScheduleBridge.kt`).
 *
 * Accepts one `SCHEDULE_REMINDERS` control envelope from the origin-locked bridge:
 *
 * ```
 * { "type": "SCHEDULE_REMINDERS", "requestId": "...",
 *   "payload": { "entries": [ { "key", "title", "detail", "fireAtIso" } ] } }
 * ```
 *
 * Every entry becomes a unique WorkManager job named after its key, so re-sending the schedule
 * replaces rather than duplicates work. Entries whose fire time already passed are skipped: the web
 * layer owns catch-up delivery, and firing a stale pile of notifications on open is worse than
 * missing one.
 */
class ReminderScheduleBridge(
    private val context: Context,
    private val diagnostics: DiagnosticRingBuffer
) {

    fun handleScheduleRequest(requestId: String, payload: JSONObject?, replyProxy: JavaScriptReplyProxy?) {
        val entries = payload?.optJSONArray("entries") ?: JSONArray()
        var scheduled = 0
        var skipped = 0
        var failed = 0

        ReminderNotifications.ensureChannel(context)
        val workManager = WorkManager.getInstance(context)
        val nowMs = System.currentTimeMillis()

        // Drop work for reminders that are no longer in the schedule before adding the new set.
        workManager.cancelAllWorkByTag(WORK_TAG)

        for (index in 0 until entries.length()) {
            val entry = entries.optJSONObject(index) ?: continue
            val parsed = parseEntry(entry)
            if (parsed == null) {
                failed += 1
                continue
            }
            if (parsed.fireAtMs <= nowMs) {
                skipped += 1
                continue
            }
            val delayMs = parsed.fireAtMs - nowMs
            val data = workDataOf(
                ReminderWorker.KEY_REMINDER_KEY to parsed.key,
                ReminderWorker.KEY_TITLE to parsed.title,
                ReminderWorker.KEY_DETAIL to parsed.detail
            )
            val request = OneTimeWorkRequestBuilder<ReminderWorker>()
                .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
                .setInputData(data)
                .addTag(WORK_TAG)
                .build()
            workManager.enqueueUniqueWork(
                "${WORK_UNIQUE_PREFIX}${parsed.key}",
                ExistingWorkPolicy.REPLACE,
                request
            )
            scheduled += 1
        }

        diagnostics.record(
            DiagnosticRingBuffer.LEVEL_INFO,
            "REMINDERS_SCHEDULED",
            "Reminders: $scheduled scheduled, $skipped past, $failed rejected"
        )

        replyProxy?.postMessage(
            JSONObject().apply {
                put("type", "SCHEDULE_REMINDERS_RESULT")
                put("requestId", requestId)
                put(
                    "payload",
                    JSONObject().apply {
                        put("scheduled", scheduled)
                        put("skipped", skipped)
                        put("rejected", failed)
                        put("permission", if (ReminderNotifications.hasPermission(context)) "granted" else "denied")
                    }
                )
            }.toString()
        )
    }

    private class ParsedEntry(
        val key: String,
        val title: String,
        val detail: String,
        val fireAtMs: Long
    )

    private fun parseEntry(entry: JSONObject): ParsedEntry? {
        val key = entry.optString("key", "").trim()
        val title = entry.optString("title", "").trim()
        val fireAtIso = entry.optString("fireAtIso", "").trim()
        if (key.isEmpty() || title.isEmpty() || fireAtIso.isEmpty()) return null
        val fireAtMs = try {
            Instant.parse(fireAtIso).toEpochMilli()
        } catch (_: Exception) {
            return null
        }
        return ParsedEntry(key, title, entry.optString("detail", ""), fireAtMs)
    }

    companion object {
        const val WORK_TAG = "pedigree-reminders"
        private const val WORK_UNIQUE_PREFIX = "reminder-"
    }
}
