import Capacitor
import Foundation
import WebKit

/// Must match `isLocalApiRequest()` in apps/standalone/src/local-bridge.ts.
private let localApiPrefixes = ["/bootstrap", "/api/", "/sync/", "/search/", "/custom/"]

func isLocalApiPath(_ path: String) -> Bool {
    if path == "/share" || (path.hasPrefix("/share/") && !path.hasPrefix("/share/assets/")) {
        return true
    }
    return localApiPrefixes.contains { path.hasPrefix($0) }
}

/// Capacitor's `WebViewAssetHandler` for `capacitor://`, re-typed by
/// `ViewController.webView(with:configuration:)`. It sees every request on the scheme, whichever
/// part of the engine issued it (fetch, XHR, images, fonts, media, iframes), hands local API
/// paths to `TriliumRequestBridge`, and leaves the rest to Capacitor's asset serving.
///
/// It must not declare stored properties: the instance it takes over was allocated as a
/// `WebViewAssetHandler`, so the subclass's storage would be uninitialized.
final class TriliumAssetHandler: WebViewAssetHandler {
    override func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let request = urlSchemeTask.request
        if let url = request.url, url == request.mainDocumentURL {
            TriliumRequestBridge.shared.pageStarted()
        }
        if let path = request.url?.path, isLocalApiPath(path) {
            TriliumRequestBridge.shared.start(urlSchemeTask, in: webView)
            return
        }
        super.webView(webView, start: urlSchemeTask)
    }

    override func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        if TriliumRequestBridge.shared.stop(urlSchemeTask) {
            return
        }
        super.webView(webView, stop: urlSchemeTask)
    }
}

/// Answers local API requests from the page's SQLite worker, in place of a service worker.
///
/// A request goes to the page through `window.__triliumNativeRequest()`, and the page replies
/// over the `triliumRequestBridge` script message handler; the protocol is described in
/// apps/standalone/src/native-request-bridge.ts. Bodies arrive as base64 chunks, since script
/// messages cannot carry ArrayBuffers. Requests that arrive before the page sends `ready` are
/// queued, and a new main document fails whatever the previous page left unanswered.
///
/// WebKit calls the scheme handler, the message handler and `evaluateJavaScript` completions on
/// the main thread, so all state stays there.
final class TriliumRequestBridge: NSObject, WKScriptMessageHandler {
    static let shared = TriliumRequestBridge()
    static let messageHandlerName = "triliumRequestBridge"

    /// Matches the service worker's limit in sw.ts: the worker can be inside a long synchronous
    /// stretch (a VACUUM of a large database) before it answers.
    private static let headTimeout: TimeInterval = 270
    private static let errorHeader = "x-trilium-bridge-error"

    private final class PendingRequest {
        let task: WKURLSchemeTask
        let script: String
        var headSent = false

        init(task: WKURLSchemeTask, script: String) {
            self.task = task
            self.script = script
        }
    }

    private var pending: [Int: PendingRequest] = [:]
    private var taskIds: [ObjectIdentifier: Int] = [:]
    private var queuedIds: [Int] = []
    private var pageReady = false
    private var nextId = 0
    private weak var webView: WKWebView?

    func start(_ task: WKURLSchemeTask, in webView: WKWebView) {
        self.webView = webView
        let request = task.request
        let method = (request.httpMethod ?? "GET").uppercased()
        guard method == "GET" || method == "HEAD" else {
            // Android's bridge cannot see request bodies, so neither platform forwards them; the
            // page sends these through standaloneApi.localFetch instead.
            respondWithError(task, status: 405,
                             message: "\(method) cannot be answered natively: the request body is not available")
            return
        }

        nextId += 1
        let id = nextId
        let payload: [String: Any] = [
            "id": id,
            "method": method,
            "url": request.url?.absoluteString ?? "",
            "headers": request.allHTTPHeaderFields ?? [:],
            "binary": false
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else {
            respondWithError(task, status: 500, message: "Cannot encode the request")
            return
        }
        // U+2028 and U+2029 are valid in JSON strings but end a line in JavaScript source.
        let literal = json
            .replacingOccurrences(of: "\u{2028}", with: "\\u2028")
            .replacingOccurrences(of: "\u{2029}", with: "\\u2029")

        pending[id] = PendingRequest(
            task: task,
            script: "window.__triliumNativeRequest ? (window.__triliumNativeRequest(\(literal)), true) : false")
        taskIds[ObjectIdentifier(task)] = id
        if pageReady {
            dispatch(id)
        } else {
            queuedIds.append(id)
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + Self.headTimeout) { [weak self] in
            guard let self = self, let request = self.pending[id], !request.headSent else { return }
            self.fail(id, status: 504, message: "The local worker did not answer in time")
        }
    }

    /// Returns true when the task was one of ours. A stopped task must not be completed, so it
    /// leaves the pending map before WebKit returns from `stop`.
    func stop(_ task: WKURLSchemeTask) -> Bool {
        guard let id = taskIds.removeValue(forKey: ObjectIdentifier(task)) else {
            return false
        }
        pending.removeValue(forKey: id)
        return true
    }

    func pageStarted() {
        pageReady = false
        queuedIds.removeAll()
        for id in Array(pending.keys) {
            fail(id, message: "The page reloaded before answering")
        }
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let text = message.body as? String,
              let data = text.data(using: .utf8),
              let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let type = body["type"] as? String else {
            return
        }
        if type == "ready" {
            onPageReady()
            return
        }

        guard let id = body["id"] as? Int, let request = pending[id] else { return }
        switch type {
        case "head":
            receiveHead(id, request, status: body["status"] as? Int ?? 200,
                        headers: body["headers"] as? [String: String] ?? [:])
        case "chunk":
            if request.headSent, let encoded = body["data"] as? String,
               let bytes = Data(base64Encoded: encoded) {
                request.task.didReceive(bytes)
            }
        case "end":
            if take(id) != nil, request.headSent {
                request.task.didFinish()
            }
        case "error":
            fail(id, message: body["message"] as? String ?? "The local request failed")
        default:
            break
        }
    }

    private func onPageReady() {
        pageReady = true
        let ids = queuedIds
        queuedIds.removeAll()
        for id in ids {
            dispatch(id)
        }
    }

    private func dispatch(_ id: Int) {
        guard let request = pending[id], let webView = webView else { return }
        webView.evaluateJavaScript(request.script) { [weak self] result, error in
            if error != nil || (result as? Bool) != true {
                self?.fail(id, message: "The page has no request handler")
            }
        }
    }

    private func receiveHead(_ id: Int, _ request: PendingRequest, status: Int, headers: [String: String]) {
        // WebKit does not follow a redirect from a scheme task; the page turns redirects into a
        // 200 already.
        guard (100...599).contains(status), !(300...399).contains(status),
              let url = request.task.request.url,
              let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1",
                                             headerFields: headers) else {
            fail(id, message: "The local worker answered with status \(status)")
            return
        }
        request.task.didReceive(response)
        request.headSent = true
    }

    /// Before the head, answers with an error response the page can read; after it, fails the
    /// load.
    private func fail(_ id: Int, status: Int = 502, message: String) {
        guard let request = take(id) else { return }
        NSLog("[TriliumRequestBridge] %@", message)
        if request.headSent {
            request.task.didFailWithError(NSError(
                domain: "TriliumRequestBridge", code: status,
                userInfo: [NSLocalizedDescriptionKey: message]))
        } else {
            respondWithError(request.task, status: status, message: message)
        }
    }

    private func take(_ id: Int) -> PendingRequest? {
        guard let request = pending.removeValue(forKey: id) else { return nil }
        taskIds.removeValue(forKey: ObjectIdentifier(request.task))
        return request
    }

    private func respondWithError(_ task: WKURLSchemeTask, status: Int, message: String) {
        let body = Data(message.utf8)
        let headerValue = String(message.unicodeScalars.map {
            (0x20...0x7e).contains($0.value) ? Character($0) : " "
        })
        guard let url = task.request.url,
              let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: [
                  "Content-Type": "text/plain; charset=utf-8",
                  "Content-Length": String(body.count),
                  Self.errorHeader: headerValue
              ]) else {
            task.didFailWithError(NSError(domain: "TriliumRequestBridge", code: status,
                                          userInfo: [NSLocalizedDescriptionKey: message]))
            return
        }
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }
}
