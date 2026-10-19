package org.triliumnotes.trilium;

import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.Bridge;
import com.getcapacitor.WebViewListener;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Answers the page's local API requests ({@code /api/}, {@code /bootstrap}, …) from the in-page
 * SQLite worker, in place of a service worker.
 *
 * <p>{@link #handle} runs on a WebView IO thread: it hands the request to the page through
 * {@code window.__triliumNativeRequest()} and blocks until the head of the reply arrives. The
 * body then streams into the WebView through a {@link ChunkStream}. The page replies over the
 * {@code window.triliumRequestBridge} message channel; the protocol is described in
 * {@code apps/standalone/src/android-request-bridge.ts}.
 *
 * <p>Requests intercepted before the page announces {@code ready} are queued, and a new page
 * fails whatever the previous one left unanswered.
 */
public final class TriliumRequestBridge {

    private static final String TAG = "TriliumRequestBridge";
    private static final String JS_OBJECT_NAME = "triliumRequestBridge";

    /** Must match {@code isLocalApiRequest()} in {@code apps/standalone/src/local-bridge.ts}. */
    private static final String[] LOCAL_PREFIXES = { "/bootstrap", "/api/", "/sync/", "/search/", "/custom/" };

    /**
     * Matches the service worker's limit in {@code sw.ts}: the worker can be inside a long
     * synchronous stretch (a VACUUM of a large database) before it answers.
     */
    private static final long HEAD_TIMEOUT_MS = 270_000;

    private static final int FRAME_HEADER_SIZE = 4;

    private final Bridge bridge;
    private final boolean binaryChunks;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final AtomicInteger nextId = new AtomicInteger();
    private final Map<Integer, PendingRequest> pending = new ConcurrentHashMap<>();

    /** Guards {@link #pageReady} and {@link #queuedIds}. */
    private final Object readyLock = new Object();
    private boolean pageReady;
    private final List<Integer> queuedIds = new ArrayList<>();

    private TriliumRequestBridge(Bridge bridge, boolean binaryChunks) {
        this.bridge = bridge;
        this.binaryChunks = binaryChunks;
    }

    /**
     * Injects {@code window.triliumRequestBridge} into pages of the app origin. Returns null when
     * the WebView has no message listeners; the object is then never injected, and the page
     * registers its service worker instead.
     */
    public static TriliumRequestBridge install(Bridge bridge) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            Log.i(TAG, "WebMessage listeners are unavailable; local requests stay on the service worker");
            return null;
        }

        TriliumRequestBridge requestBridge = new TriliumRequestBridge(
            bridge, WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER));
        WebViewCompat.addWebMessageListener(
            bridge.getWebView(),
            JS_OBJECT_NAME,
            bridge.getAllowedOriginRules(),
            (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                if (isMainFrame) {
                    requestBridge.onMessage(message);
                }
            }
        );
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
                requestBridge.onPageStarted();
            }
        });
        return requestBridge;
    }

    /** Whether the request is for a local API path on the app's own origin. */
    public boolean handles(Uri uri) {
        String path = uri.getPath();
        if (path == null
                || !bridge.getScheme().equals(uri.getScheme())
                || !bridge.getHost().equals(uri.getHost())) {
            return false;
        }
        if (path.equals("/share") || (path.startsWith("/share/") && !path.startsWith("/share/assets/"))) {
            return true;
        }
        for (String prefix : LOCAL_PREFIXES) {
            if (path.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    /** Answers a request {@link #handles} accepted. Blocks the calling WebView IO thread. */
    public WebResourceResponse handle(WebResourceRequest request) {
        String method = request.getMethod() == null ? "GET" : request.getMethod().toUpperCase(Locale.ROOT);
        if (!"GET".equals(method) && !"HEAD".equals(method)) {
            // shouldInterceptRequest exposes no request body; the page sends these through
            // standaloneApi.localFetch instead.
            return errorResponse(405, "Method Not Allowed",
                    method + " cannot be answered natively: the request body is not available");
        }

        int id = nextId.incrementAndGet();
        PendingRequest pendingRequest = new PendingRequest();
        try {
            JSONObject payload = new JSONObject()
                .put("id", id)
                .put("method", method)
                .put("url", request.getUrl().toString())
                .put("headers", new JSONObject(request.getRequestHeaders()))
                .put("binary", binaryChunks);
            // U+2028 and U+2029 are valid in JSON strings but end a line in JavaScript source.
            String json = payload.toString().replace("\u2028", "\\u2028").replace("\u2029", "\\u2029");
            pendingRequest.script =
                "window.__triliumNativeRequest ? (window.__triliumNativeRequest(" + json + "), true) : false";
        } catch (JSONException e) {
            return errorResponse(500, "Internal Error", "Cannot encode the request: " + e.getMessage());
        }

        pending.put(id, pendingRequest);
        synchronized (readyLock) {
            if (pageReady) {
                mainHandler.post(() -> dispatch(id, pendingRequest));
            } else {
                queuedIds.add(id);
            }
        }

        try {
            if (!pendingRequest.headReceived.await(HEAD_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
                pending.remove(id);
                return errorResponse(504, "Gateway Timeout", "The local worker did not answer in time");
            }
        } catch (InterruptedException e) {
            pending.remove(id);
            Thread.currentThread().interrupt();
            return errorResponse(503, "Service Unavailable", "Interrupted while waiting for the local worker");
        }

        if (pendingRequest.headError != null) {
            return errorResponse(502, "Bad Gateway", pendingRequest.headError);
        }
        return buildResponse(pendingRequest);
    }

    private void onPageStarted() {
        synchronized (readyLock) {
            pageReady = false;
            queuedIds.clear();
        }
        Iterator<PendingRequest> iterator = pending.values().iterator();
        while (iterator.hasNext()) {
            iterator.next().fail("The page reloaded before answering");
            iterator.remove();
        }
    }

    private void onMessage(WebMessageCompat message) {
        if (message.getType() == WebMessageCompat.TYPE_ARRAY_BUFFER) {
            byte[] frame = message.getArrayBuffer();
            if (frame.length < FRAME_HEADER_SIZE) {
                return;
            }
            PendingRequest pendingRequest = pending.get(ByteBuffer.wrap(frame).getInt());
            if (pendingRequest != null) {
                pendingRequest.body.append(Arrays.copyOfRange(frame, FRAME_HEADER_SIZE, frame.length));
            }
            return;
        }

        try {
            JSONObject parsed = new JSONObject(message.getData());
            String type = parsed.getString("type");
            if ("ready".equals(type)) {
                onPageReady();
                return;
            }

            int id = parsed.getInt("id");
            PendingRequest pendingRequest = pending.get(id);
            if (pendingRequest == null) {
                return;
            }
            switch (type) {
                case "head":
                    pendingRequest.receiveHead(parsed.getInt("status"), toHeaderMap(parsed.optJSONObject("headers")));
                    break;
                case "chunk":
                    pendingRequest.body.append(Base64.decode(parsed.getString("data"), Base64.DEFAULT));
                    break;
                case "end":
                    pending.remove(id);
                    pendingRequest.body.finish();
                    break;
                case "error":
                    pending.remove(id);
                    pendingRequest.fail(parsed.optString("message", "The local request failed"));
                    break;
                default:
                    Log.w(TAG, "Unknown message type: " + type);
            }
        } catch (JSONException e) {
            Log.w(TAG, "Malformed message from the page", e);
        }
    }

    private void onPageReady() {
        List<Integer> ids;
        synchronized (readyLock) {
            pageReady = true;
            ids = new ArrayList<>(queuedIds);
            queuedIds.clear();
        }
        for (int id : ids) {
            PendingRequest pendingRequest = pending.get(id);
            if (pendingRequest != null) {
                dispatch(id, pendingRequest);
            }
        }
    }

    /** Hands a request to the page. Runs on the UI thread, which evaluateJavascript requires. */
    private void dispatch(int id, PendingRequest pendingRequest) {
        bridge.getWebView().evaluateJavascript(pendingRequest.script, result -> {
            if (!"true".equals(result)) {
                failRequest(id, "The page has no request handler");
            }
        });
    }

    private void failRequest(int id, String message) {
        PendingRequest pendingRequest = pending.remove(id);
        if (pendingRequest != null) {
            pendingRequest.fail(message);
        }
    }

    private static WebResourceResponse buildResponse(PendingRequest request) {
        Map<String, String> headers = new HashMap<>();
        String mimeType = "application/octet-stream";
        String encoding = null;
        for (Map.Entry<String, String> header : request.headers.entrySet()) {
            String name = header.getKey().toLowerCase(Locale.ROOT);
            if ("content-length".equals(name) || "content-encoding".equals(name)) {
                // The stream carries exactly the decoded bytes the page sent.
                continue;
            }
            if ("content-type".equals(name)) {
                String[] parts = header.getValue().split(";");
                mimeType = parts[0].trim();
                for (int i = 1; i < parts.length; i++) {
                    String part = parts[i].trim();
                    if (part.toLowerCase(Locale.ROOT).startsWith("charset=")) {
                        encoding = part.substring("charset=".length()).trim();
                    }
                }
            }
            headers.put(header.getKey(), header.getValue());
        }

        int status = request.status;
        if (status < 100 || status > 599 || (status >= 300 && status < 400)) {
            // WebResourceResponse rejects these; the page turns redirects into a 200 already.
            return errorResponse(502, "Bad Gateway", "The local worker answered with status " + status);
        }
        return new WebResourceResponse(mimeType, encoding, status, reasonPhrase(status), headers, request.body);
    }

    /** WebResourceResponse requires a non-empty reason phrase. */
    private static String reasonPhrase(int status) {
        switch (status) {
            case 200: return "OK";
            case 201: return "Created";
            case 204: return "No Content";
            case 206: return "Partial Content";
            case 400: return "Bad Request";
            case 401: return "Unauthorized";
            case 403: return "Forbidden";
            case 404: return "Not Found";
            case 500: return "Internal Server Error";
            case 503: return "Service Unavailable";
            default: return "Status " + status;
        }
    }

    private static WebResourceResponse errorResponse(int status, String reason, String message) {
        Log.w(TAG, message);
        Map<String, String> headers = new HashMap<>();
        headers.put("x-trilium-bridge-error", message.replaceAll("[^\\x20-\\x7e]", " "));
        return new WebResourceResponse("text/plain", "utf-8", status, reason, headers,
                new ByteArrayInputStream(message.getBytes(StandardCharsets.UTF_8)));
    }

    private static Map<String, String> toHeaderMap(JSONObject json) {
        Map<String, String> headers = new HashMap<>();
        if (json == null) {
            return headers;
        }
        Iterator<String> names = json.keys();
        while (names.hasNext()) {
            String name = names.next();
            headers.put(name, json.optString(name));
        }
        return headers;
    }

    /** One intercepted request, from dispatch until the page sends {@code end} or {@code error}. */
    private static final class PendingRequest {
        final CountDownLatch headReceived = new CountDownLatch(1);
        final ChunkStream body = new ChunkStream();
        String script;
        volatile int status;
        volatile Map<String, String> headers;
        volatile String headError;

        void receiveHead(int status, Map<String, String> headers) {
            this.status = status;
            this.headers = headers;
            headReceived.countDown();
        }

        void fail(String message) {
            if (headReceived.getCount() > 0) {
                headError = message;
                headReceived.countDown();
            }
            body.fail(message);
        }
    }

    /** The response body as the page sends it: a queue of chunks the WebView drains. */
    private static final class ChunkStream extends InputStream {
        private static final byte[] END = new byte[0];

        private final LinkedBlockingQueue<byte[]> chunks = new LinkedBlockingQueue<>();
        private volatile String error;
        private byte[] current;
        private int position;
        private boolean finished;

        void append(byte[] chunk) {
            if (chunk.length > 0) {
                chunks.add(chunk);
            }
        }

        void finish() {
            chunks.add(END);
        }

        void fail(String message) {
            error = message;
            chunks.add(END);
        }

        @Override
        public int read() throws IOException {
            byte[] single = new byte[1];
            int read = read(single, 0, 1);
            return read == -1 ? -1 : single[0] & 0xff;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            if (length == 0) {
                return 0;
            }
            while (current == null || position >= current.length) {
                if (finished) {
                    return -1;
                }
                try {
                    current = chunks.take();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IOException("Interrupted while reading the local response", e);
                }
                position = 0;
                if (current == END) {
                    finished = true;
                    if (error != null) {
                        throw new IOException(error);
                    }
                    return -1;
                }
            }
            int count = Math.min(length, current.length - position);
            System.arraycopy(current, position, buffer, offset, count);
            position += count;
            return count;
        }

        @Override
        public void close() {
            chunks.clear();
            finished = true;
        }
    }
}
