package org.askkim.pedigree.wrapper

import android.content.Intent
import android.net.Uri
import android.util.Base64
import org.json.JSONObject

/**
 * Forwards files the shell was launched with (`IncomingFileBridge.kt`).
 *
 * Another app can hand Pedigree a file two ways: a tapped link (`ACTION_VIEW` with a `content://`
 * or `file://` URI) or the share sheet (`ACTION_SEND` with `EXTRA_STREAM`). Both end up as a single
 * `OPEN_EXTERNAL_FILE` envelope the PWA listens for on the incoming-file port.
 *
 * Cold launches race the WebView: the intent arrives in `onCreate` long before the page has posted
 * its first message. The envelope is therefore parked and flushed on the first control message,
 * when a reply proxy is known to exist. Nothing is read from disk here beyond the URI the user
 * actually chose, and oversized payloads are forwarded as metadata only.
 */
class IncomingFileBridge(
    private val diagnostics: DiagnosticRingBuffer,
    /** Returns true when the envelope reached the page; false keeps it parked. */
    private val deliver: (String) -> Boolean
) {

    private var pendingEnvelope: String? = null

    /** Reads an intent and parks its file envelope; a no-op for intents that carry no file. */
    fun handleIntent(intent: Intent?) {
        if (intent == null) return
        val action = intent.action ?: return
        if (action != Intent.ACTION_VIEW && action != Intent.ACTION_SEND) return

        val uri: Uri? = when (action) {
            Intent.ACTION_VIEW -> intent.data
            else -> @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
        } ?: return

        // Only the shared item itself: never a clip of unrelated text or a directory tree.
        val source = if (action == Intent.ACTION_VIEW) "view" else "share"
        val envelope = buildEnvelope(uri, intent, source)
        if (envelope == null) {
            diagnostics.record(
                DiagnosticRingBuffer.LEVEL_WARN,
                "INCOMING_FILE_UNREADABLE",
                "Ignored an incoming file the shell could not read"
            )
            return
        }
        pendingEnvelope = envelope.toString()
        diagnostics.record(
            DiagnosticRingBuffer.LEVEL_INFO,
            "INCOMING_FILE_QUEUED",
            "Queued incoming file from $source"
        )
        flushPending()
    }

    /** Releases the parked envelope once the page can receive it; otherwise it stays parked. */
    fun flushPending() {
        val envelope = pendingEnvelope ?: return
        if (deliver(envelope)) {
            pendingEnvelope = null
        }
    }

    private fun buildEnvelope(uri: Uri, intent: Intent, source: String): JSONObject? {
        return try {
            val payload = JSONObject()
            payload.put("filename", resolveFilename(uri, intent))
            payload.put("mimeType", intent.type ?: "application/octet-stream")
            payload.put("source", source)

            if (uri.scheme == "file") {
                // Bundled asset (`assets/www/...`) or a plain path: metadata only, no scheme escalation.
                diagnostics.record(
                    DiagnosticRingBuffer.LEVEL_WARN,
                    "INCOMING_FILE_SCHEME_REJECTED",
                    "Rejected a non-content URI from another app"
                )
                return null
            }

            val bytes = readBytes(uri) ?: return null
            payload.put("sizeBytes", bytes.size)
            if (bytes.size <= MAX_PAYLOAD_BYTES) {
                payload.put("base64Data", Base64.encodeToString(bytes, Base64.NO_WRAP))
            } else {
                diagnostics.record(
                    DiagnosticRingBuffer.LEVEL_WARN,
                    "INCOMING_FILE_TOO_LARGE",
                    "Incoming file exceeded $MAX_PAYLOAD_BYTES bytes; forwarded metadata only"
                )
            }

            JSONObject().apply {
                put("type", "OPEN_EXTERNAL_FILE")
                put("payload", payload)
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun readBytes(uri: Uri): ByteArray? {
        return try {
            streamOpener?.invoke(uri)?.use { stream -> stream.readBytes() }
        } catch (_: Exception) {
            null
        }
    }

    private fun resolveFilename(uri: Uri, intent: Intent): String {
        val fromIntent = @Suppress("DEPRECATION") intent.getStringExtra(Intent.EXTRA_TITLE)
        if (!fromIntent.isNullOrBlank()) return sanitize(fromIntent)
        val discovered = queryDisplayName(uri)
        if (!discovered.isNullOrBlank()) return sanitize(discovered)
        return sanitize(uri.lastPathSegment ?: "shared-file")
    }

    private fun queryDisplayName(uri: Uri): String? {
        return try {
            displayNameResolver?.invoke(uri)
        } catch (_: Exception) {
            null
        }
    }

    private fun sanitize(name: String): String {
        val trimmed = name.substringAfterLast('/').trim()
        if (trimmed.isEmpty()) return "shared-file"
        return trimmed.replace(Regex("[\\u0000-\\u001f]"), "").take(MAX_FILENAME_LENGTH)
    }

    /** Injected by the Activity so this class never holds a `Context` of its own. */
    var streamOpener: ((Uri) -> java.io.InputStream?)? = null
    var displayNameResolver: ((Uri) -> String?)? = null

    companion object {
        const val MAX_PAYLOAD_BYTES = 4 * 1024 * 1024
        private const val MAX_FILENAME_LENGTH = 120
    }
}
