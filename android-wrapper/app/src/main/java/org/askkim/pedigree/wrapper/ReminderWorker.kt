package org.askkim.pedigree.wrapper

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * One-shot WorkManager job that posts a single scheduled reminder (`ReminderWorker.kt`).
 *
 * WorkManager already persists the job across process death and reboots, so nothing here keeps a
 * timer or a wake lock. The payload is the already-computed reminder; this class only displays it.
 */
class ReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val key = inputData.getString(KEY_REMINDER_KEY)
        val title = inputData.getString(KEY_TITLE)
        if (key.isNullOrBlank() || title.isNullOrBlank()) {
            return Result.success()
        }
        ReminderNotifications.show(
            applicationContext,
            key,
            title,
            inputData.getString(KEY_DETAIL) ?: ""
        )
        // A denied permission or a thrown SecurityException must not retry forever: the next
        // schedule envelope re-creates the job as soon as the user opts in again.
        return Result.success()
    }

    companion object {
        const val KEY_REMINDER_KEY = "reminderKey"
        const val KEY_TITLE = "reminderTitle"
        const val KEY_DETAIL = "reminderDetail"
    }
}
