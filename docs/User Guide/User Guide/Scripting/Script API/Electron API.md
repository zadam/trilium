# Electron API
The Electron API is the bridge between Trilium's interface and Electron's main process, exposed as the global `window.electronApi` in the desktop application.

It is not part of the `api` global of script notes, but frontend scripts running in the desktop application can call it directly. It is `undefined` in the browser and in the standalone build, so guard calls with `if (window.electronApi)`.

## `ElectronApi`

The complete surface exposed to the renderer as `window.electronApi` via `contextBridge`. The renderer must access Electron-only functionality through this object — direct `require("electron")` and `@electron/remote` are unavailable because `nodeIntegration` is disabled and `contextIsolation` is enabled.

The runtime value lives in `apps/desktop/src/preload.ts`; this interface is the contract both the preload script (`satisfies ElectronApi`) and the client (`window.electronApi`) share.

| Property | Description |
| --- | --- |
| `window` | `ElectronWindowApi`  <br>Window chrome, zoom, theme, lifecycle, and main → renderer events. |
| `clipboard` | `ElectronClipboardApi`  <br>System clipboard access beyond what the standard Web Clipboard API offers. |
| `shell` | `ElectronShellApi`  <br>Shell integration — opening URLs, files, and downloads with OS handlers. |
| `contextMenu` | `ElectronContextMenuApi`  <br>Native context-menu plumbing for right-click events on web contents. |
| `spellcheck` | `ElectronSpellcheckApi`  <br>Chromium spell checker controls (dictionary, language list). |
| `systemIntegration` | `ElectronSystemIntegrationApi`  <br>OS integration — system tray and autostart / launch-on-login. |
| `printing` | `ElectronPrintingApi`  <br>Printing and PDF export pipeline. |
| `navigation` | `ElectronNavigationApi`  <br>Read/write access to Chromium's back/forward navigation history. |
| `ws` | `ElectronWsApi`  <br>In-process bridge that replaces the renderer↔server WebSocket. |
| `security` | `ElectronSecurityApi`  <br>Security settings (backend scripting, SQL console) stored outside the DB. |
| `backupPassphrase` | `ElectronBackupPassphraseApi`  <br>Write-only access to the backup passphrase, kept in the OS keyring. |
| `onenote` | `ElectronOneNoteApi`  <br>OneNote importer sign-in via a loopback OAuth redirect (desktop only). |
| `nativeExport` | `ElectronNativeExportApi`  <br>Desktop-native subtree export that streams a `.zip` straight to a file. |
| `nativeImport` | `ElectronNativeImportApi`  <br>Desktop-native large-`.zip` import that reads the user's file in place via a capability token. |
| `dialog` | `ElectronDialogApi`  <br>Native OS pickers that hand the renderer a location the user chose themselves. |
| `restore` | `ElectronRestoreApi`  <br>Choosing a backup to restore during setup, read where it lies rather than uploaded. |
| `transcription` | `ElectronTranscriptionApi`  <br>Meeting transcription: starting and stopping a recording, and following its state. |

## `ElectronWindowApi`

Window-level controls: zoom, theme, title bar, full screen, lifecycle, and a handful of main → renderer event subscriptions.

### `setZoomFactor`

```typescript
setZoomFactor(factor: number): void
```

Sets the page zoom factor for the current window.

| Parameter | Description |
| --- | --- |
| `factor` | `number`  <br>`1.0` is 100%; e.g. `1.2` zooms to 120%. |

### `getZoomFactor`

```typescript
getZoomFactor(): number
```

Returns the current page zoom factor (`1.0` = 100%).

**Returns** `number`

### `setNativeThemeSource`

```typescript
setNativeThemeSource(source: "system" | "light" | "dark"): void
```

Overrides the operating system's reported color scheme for this app. Use `"system"` to follow the OS setting.

| Parameter | Description |
| --- | --- |
| `source` | `"system" \| "light" \| "dark"` |

### `setTitleBarOverlay`

```typescript
setTitleBarOverlay(options: { color: string; symbolColor: string; height?: number }): void
```

Customizes the Windows and Linux native title bar overlay (the area containing the minimize / maximize / close buttons). `height` also controls their vertical placement, since the buttons are centered within the overlay. It is given in device-independent pixels, which the page zoom does not scale — see `setWindowButtonPosition`.

| Parameter | Description |
| --- | --- |
| `options` | `{ color: string; symbolColor: string; height?: number }` |

### `setWindowButtonPosition`

```typescript
setWindowButtonPosition(position: { x: number; y: number }): void
```

Repositions the macOS traffic-light window buttons. Coordinates are relative to the window's top-left corner and given in device-independent pixels: the buttons are drawn by the system rather than by the page, so unlike the surrounding chrome they are unaffected by the page zoom factor and callers have to scale the offsets themselves.

| Parameter | Description |
| --- | --- |
| `position` | `{ x: number; y: number }` |

### `onEnterFullScreen`

```typescript
onEnterFullScreen(callback: () => void): void
```

Registers a callback fired whenever the window enters full-screen mode.

| Parameter | Description |
| --- | --- |
| `callback` | `() => void` |

### `onLeaveFullScreen`

```typescript
onLeaveFullScreen(callback: () => void): void
```

Registers a callback fired whenever the window leaves full-screen mode.

| Parameter | Description |
| --- | --- |
| `callback` | `() => void` |

### `isFullScreen`

```typescript
isFullScreen(): boolean
```

Synchronously returns whether the window is currently in full-screen mode.

**Returns** `boolean`

### `setFullScreen`

```typescript
setFullScreen(enabled: boolean): void
```

Enters or leaves full-screen mode.

| Parameter | Description |
| --- | --- |
| `enabled` | `boolean` |

### `minimizeWindow`

```typescript
minimizeWindow(): void
```

Minimizes the current window to the taskbar / dock.

### `maximizeWindow`

```typescript
maximizeWindow(): void
```

Maximizes the current window to fill the available screen area.

### `unmaximizeWindow`

```typescript
unmaximizeWindow(): void
```

Restores the window from a maximized state to its previous size.

### `isMaximized`

```typescript
isMaximized(): boolean
```

Synchronously returns whether the window is currently maximized.

**Returns** `boolean`

### `closeWindow`

```typescript
closeWindow(): void
```

Closes the current window.

### `isAlwaysOnTop`

```typescript
isAlwaysOnTop(): boolean
```

Synchronously returns whether the window is pinned above all others.

**Returns** `boolean`

### `setAlwaysOnTop`

```typescript
setAlwaysOnTop(enabled: boolean): void
```

Toggles the always-on-top (pinned) state of the window.

| Parameter | Description |
| --- | --- |
| `enabled` | `boolean` |

### `toggleDevTools`

```typescript
toggleDevTools(): void
```

Opens or closes Chromium DevTools for the current window.

### `isDevToolsDocked`

```typescript
isDevToolsDocked(): boolean
```

Synchronously returns whether DevTools is currently open and docked into this window (as opposed to detached into a separate window).

**Returns** `boolean`

### `setBackgroundMaterial`

```typescript
setBackgroundMaterial(material: string): void
```

Sets the Windows 11 backdrop material (e.g. `"mica"`, `"acrylic"`, `"tabbed"`, `"none"`) applied behind the window contents. No-op on other platforms.

| Parameter | Description |
| --- | --- |
| `material` | `string` |

### `setVibrancy`

```typescript
setVibrancy(vibrancy: string): void
```

Sets the macOS vibrancy effect (e.g. `"sidebar"`, `"under-window"`, `"fullscreen-ui"`) applied behind the window contents. No-op on other platforms.

| Parameter | Description |
| --- | --- |
| `vibrancy` | `string` |

### `reloadAllWindows`

```typescript
reloadAllWindows(): void
```

Triggers a hard reload of every open Trilium window.

### `restartApp`

```typescript
restartApp(): void
```

Quits the app and immediately relaunches it.

### `toggleAllWindows`

```typescript
toggleAllWindows(): void
```

Shows all hidden windows or hides all visible ones — used by the "show/hide app" global shortcut and tray menu entry.

### `clearCache`

```typescript
clearCache(): Promise<void>
```

Clears the underlying Chromium HTTP cache. Resolves once the cache is empty.

**Returns** `Promise<void>`

### `showWindow`

```typescript
showWindow(): void
```

Brings the main window to the foreground, restoring it if minimized.

### `reportStartupMetric`

```typescript
reportStartupMetric(metric: "client-full-render"): void
```

Reports a renderer startup milestone to the main process, which records it relative to OS process creation alongside the main-process startup metrics. Only the first report of each metric is recorded; later reports (e.g. after a window reload or from extra windows) are ignored.

| Parameter | Description |
| --- | --- |
| `metric` | `"client-full-render"` |

### `onGlobalShortcut`

```typescript
onGlobalShortcut(callback: (actionName: string) => void): void
```

Subscribes to globally registered keyboard shortcuts. The callback receives the logical action name (not the keystroke).

| Parameter | Description |
| --- | --- |
| `callback` | `(actionName: string) => void` |

### `onOpenInSameTab`

```typescript
onOpenInSameTab(callback: (noteId: string) => void): void
```

Subscribes to "open note in active tab" requests originating from outside the renderer (e.g. tray menu, deep links).

| Parameter | Description |
| --- | --- |
| `callback` | `(noteId: string) => void` |

### `onDevToolsDockChanged`

```typescript
onDevToolsDockChanged(callback: (docked: boolean) => void): void
```

Subscribes to changes of the DevTools docking state. `docked` is `true` only while DevTools is attached to this window — where Chromium disables the native window material (Mica / vibrancy) — and `false` when it is closed or in a separate window.

| Parameter | Description |
| --- | --- |
| `callback` | `(docked: boolean) => void` |

## `ElectronClipboardApi`

Renderer access to the system clipboard for cases the standard Web API can't cover.

### `copyImageToClipboard`

```typescript
copyImageToClipboard(buffer: Uint8Array): void
```

Writes a raw image (PNG-encoded bytes) to the system clipboard so it can be pasted into other applications as an image rather than as a file.

| Parameter | Description |
| --- | --- |
| `buffer` | `Uint8Array` |

### `readText`

```typescript
readText(): Promise<string>
```

Reads plain text from the system clipboard via the main-process `electron.clipboard`. Used instead of `navigator.clipboard.readText()` so the renderer's deny-by-default permission policy does not have to grant the sensitive `clipboard-read` permission to the whole session.

**Returns** `Promise<string>`

### `readHTML`

```typescript
readHTML(): Promise<string>
```

Reads the HTML flavor of the system clipboard, the same way as `readText`. Empty when the clipboard has no HTML.

**Returns** `Promise<string>`

## `ElectronShellApi`

Wrappers around Electron's `shell` module for interacting with the OS (default browser, default file handler, downloads, etc.).

Every method here is validated in the main process before dispatch — see `apps/server/src/services/shell_validators.ts`. The renderer is treated as untrusted: invalid input throws on the main side rather than being silently passed through to `electron.shell` / `WebContents`.

### `openExternal`

```typescript
openExternal(url: string): void
```

Opens a URL in the user's default external browser via `electron.shell.openExternal`.

**Security:** the scheme is matched against the allowlist in `SHELL_OPEN_EXTERNAL_PROTOCOLS` (commons). Blocked schemes include `file:`, `data:`, `smb:`, `ldap:`, `ldaps:`, `jar:`, and `view-source:` — they cover Follina-class RCE primitives (`ms-msdt:`, `search-ms:`), NTLM credential theft, and Java loader vectors. URLs that fail to parse are rejected outright.

| Parameter | Description |
| --- | --- |
| `url` | `string` |

### `openPath`

```typescript
openPath(path: string): Promise<string>
```

Opens a local path with its default OS handler.

**Security:** the path is canonicalized and must resolve to either the Trilium data directory (or a descendant) or the Trilium tmp directory (or a descendant). Anything else — absolute paths elsewhere on disk, traversal attempts, UNC paths that don't normalize under those roots — is rejected. Null bytes, empty strings, and non-existent files are also rejected.

| Parameter | Description |
| --- | --- |
| `path` | `string` |

**Returns** `Promise<string>`: An empty string on success, or an error message on failure.

### `showItemInFolder`

```typescript
showItemInFolder(path: string): void
```

Shows a local file in the OS file manager, with the file itself selected, via `electron.shell.showItemInFolder`. For pointing at a file the user is not meant to open — the database, whose reader is Trilium itself.

**Security:** the same sandbox as `openPath`, with the database file added as a root of its own, since `TRILIUM_DOCUMENT_PATH` may put it outside the data directory. Revealing is the milder act of the two, the file being selected rather than launched, but a path the renderer names is still a path the renderer must not be free to choose.

Nothing is reported back: the OS is asked to bring a window forward, and whether it did is not something Electron answers.

| Parameter | Description |
| --- | --- |
| `path` | `string` |

### `openFileUrl`

```typescript
openFileUrl(fileUrl: string): Promise<string>
```

Opens a `file://` URL with its default OS handler. Exists as a separate channel from `openExternal` because neither Electron API opens every target correctly on Windows: `shell.openExternal` mishandles Unicode characters in `file:` URLs, while `shell.openPath` opens a directory with the Explorer-specific `explore` verb, bypassing the user's file manager. The main process picks between them per target.

**Security:** the URL must use the `file:` scheme and must have an empty hostname. UNC paths (`file://attacker.example/share/x`) are explicitly blocked because Windows would otherwise resolve them to `\\attacker.example\share\x` and leak the user's NTLM hash via SMB authentication. Drive-letter-as-host malformations like `file://C:/path` are normalized to `file:///C:/path` before parsing.

Note: unlike `openPath`, the resolved path is NOT confined to the Trilium data / tmp directories — this channel handles user-clicked `file://` links inside note content, which routinely reference arbitrary locations on disk (`file:///C:/Users/me/Documents/contract.pdf` and similar). Equivalent to a browser following a `file:` link the user clicked. Treat clicks on attacker-influenced note content accordingly.

| Parameter | Description |
| --- | --- |
| `fileUrl` | `string` |

**Returns** `Promise<string>`: An empty string on success, or an error message on failure.

### `downloadURL`

```typescript
downloadURL(url: string): void
```

Triggers a Chromium download for the given URL — the file is saved through the normal "Save As" flow instead of being opened in the renderer.

**Security:** locked to the renderer's own origin. The scheme, hostname, and port must all match the running app's origin (`http://localhost:PORT` for the dev server, or the custom `trilium-app://app/` protocol for packaged Electron). Cross-origin downloads, hostless URLs (`data:`, `blob:`, `about:`, plain `file:///`), and unparseable URLs are rejected. This stops a compromised renderer from pre-positioning a remote payload in the user's Downloads folder under a familiar name.

| Parameter | Description |
| --- | --- |
| `url` | `string` |

### `openCustom`

```typescript
openCustom(filePath: string): void
```

Opens a file with a Trilium-specific custom handler (configured via the "Open With" option), falling back to the OS default if none is set.

**Security:** the path must resolve to a strict descendant of Trilium's tmp directory and the file must exist on disk. The legitimate caller always passes a path that was just written by `saveToTmpDir`; anything else (the data dir itself, paths elsewhere on disk, null bytes, empty strings) is rejected.

| Parameter | Description |
| --- | --- |
| `filePath` | `string` |

## `ElectronContextMenuApi`

Bridge for the native context menu shown over web contents.

### `onContextMenu`

```typescript
onContextMenu(callback: (params: ElectronContextMenuParams) => void): void
```

Subscribes to right-click events forwarded from the main process.

| Parameter | Description |
| --- | --- |
| `callback` | `(params: ElectronContextMenuParams) => void` |

### `webContentsAction`

```typescript
webContentsAction(action: "cut" | "copy" | "paste" | "pasteAndMatchStyle" | "insertText", text?: string): void
```

Executes a clipboard / text-input action on the focused web contents. `"insertText"` requires the `text` argument; the other actions ignore it.

| Parameter | Description |
| --- | --- |
| `action` | `"cut" \| "copy" \| "paste" \| "pasteAndMatchStyle" \| "insertText"` |
| `text`  <br>_optional_ | `string` |

## `ElectronSpellcheckApi`

Renderer-side access to Chromium's built-in spell checker.

### `addWordToDictionary`

```typescript
addWordToDictionary(word: string): void
```

Adds a word to the user's personal dictionary so it is no longer flagged.

| Parameter | Description |
| --- | --- |
| `word` | `string` |

### `getAvailableSpellCheckerLanguages`

```typescript
getAvailableSpellCheckerLanguages(): string[]
```

Returns the BCP-47 language tags Chromium can spell-check on this platform.

**Returns** `string[]`

### `setSpellCheckerLanguages`

```typescript
setSpellCheckerLanguages(languageCodes: string[]): void
```

Applies the spell-check language list to every open window's session immediately, without an application restart. No-op on macOS, where the OS spell checker auto-detects the language.

| Parameter | Description |
| --- | --- |
| `languageCodes` | `string[]` |

### `setSpellCheckerEnabled`

```typescript
setSpellCheckerEnabled(enabled: boolean): void
```

Enables or disables the built-in spell checker on every open window's session immediately, without an application restart.

| Parameter | Description |
| --- | --- |
| `enabled` | `boolean` |

## `ElectronSystemIntegrationApi`

OS integration controls — system tray and autostart / launch-on-login.

### `reloadTray`

```typescript
reloadTray(): void
```

Rebuilds the tray icon and menu — call after changing tray-related settings.

### `reapplyLaunchOnStartup`

```typescript
reapplyLaunchOnStartup(): void
```

Re-applies the OS autostart entry after the `launchOnStartup` / `hideOnAutoStart` options change.

## `ElectronPrintingApi`

Printing and PDF export flow. Trilium drives Electron's printing pipeline through a small state machine that the main process owns, with progress and results pushed back to the renderer via IPC events.

### `sendPrintProgress`

```typescript
sendPrintProgress(progress: number): void
```

Reports rendering progress (`0..100`) from the renderer to the main process.

| Parameter | Description |
| --- | --- |
| `progress` | `number` |

### `onPrintProgress`

```typescript
onPrintProgress(callback: (data: { progress: number; action: string }) => void): void
```

Subscribes to progress updates emitted by the main process during a print or PDF export run. `action` describes the current stage (e.g. `"rendering"`).

| Parameter | Description |
| --- | --- |
| `callback` | `(data: { progress: number; action: string }) => void` |

### `onPrintDone`

```typescript
onPrintDone(callback: (printReport: unknown, liveJobId?: number) => void): void
```

Subscribes to the "print finished" event, fired once the OS print job is dispatched. `liveJobId` names the live print the job ended, for a job that printed the app window itself.

| Parameter | Description |
| --- | --- |
| `callback` | `(printReport: unknown, liveJobId?: number) => void` |

### `removePrintListeners`

```typescript
removePrintListeners(): void
```

Removes all listeners registered via `onPrintProgress` and `onPrintDone`.

### `getPrinters`

```typescript
getPrinters(): Promise<unknown[]>
```

Returns the list of printers known to the OS.

**Returns** `Promise<unknown[]>`

### `exportAsPdfPreview`

```typescript
exportAsPdfPreview(opts: Record<string, unknown>): void
```

Asks the main process to render the current note as a PDF and return the resulting bytes for the in-app preview. Result is delivered via `onExportAsPdfPreviewResult`.

| Parameter | Description |
| --- | --- |
| `opts` | `Record<string, unknown>` |

### `onExportAsPdfPreviewResult`

```typescript
onExportAsPdfPreviewResult(callback: (result: { buffer?: Uint8Array<ArrayBufferLike>; error?: string; requestId?: number }) => void): void
```

Subscribes to the result of an `exportAsPdfPreview` call.

| Parameter | Description |
| --- | --- |
| `callback` | `(result: { buffer?: Uint8Array<ArrayBufferLike>; error?: string; requestId?: number }) => void` |

### `removeExportAsPdfPreviewResultListener`

```typescript
removeExportAsPdfPreviewResultListener(): void
```

Removes the listener registered via `onExportAsPdfPreviewResult`.

### `savePdf`

```typescript
savePdf(data: { title: string; buffer: Uint8Array }): void
```

Persists a previously generated PDF buffer to disk via the native save dialog. `title` is used as the suggested filename.

| Parameter | Description |
| --- | --- |
| `data` | `{ title: string; buffer: Uint8Array }` |

### `printFromPreview`

```typescript
printFromPreview(opts: Record<string, unknown>): void
```

Sends the previewed PDF to the OS print dialog with the given options.

| Parameter | Description |
| --- | --- |
| `opts` | `Record<string, unknown>` |

## `ElectronNavigationApi`

Accessors for the underlying Chromium navigation history of the current web contents (back/forward stack), exposed so the renderer can mirror it in custom UI such as the breadcrumb / tab back button.

### `clearNavigationHistory`

```typescript
clearNavigationHistory(): void
```

Clears the entire back/forward navigation history.

### `navigationCanGoBack`

```typescript
navigationCanGoBack(): boolean
```

Synchronously returns whether a back navigation is possible.

**Returns** `boolean`

### `navigationCanGoForward`

```typescript
navigationCanGoForward(): boolean
```

Synchronously returns whether a forward navigation is possible.

**Returns** `boolean`

### `navigationGetAllEntries`

```typescript
navigationGetAllEntries(): { url: string; title: string }[]
```

Returns every entry in the navigation history, oldest first.

**Returns** `{ url: string; title: string }[]`

### `navigationGetActiveIndex`

```typescript
navigationGetActiveIndex(): number
```

Returns the index of the currently active entry inside `navigationGetAllEntries`.

**Returns** `number`

### `navigationLength`

```typescript
navigationLength(): number
```

Returns the total number of entries in the navigation history.

**Returns** `number`

### `navigationGoToIndex`

```typescript
navigationGoToIndex(index: number): void
```

Navigates to the entry at the given index in the history stack.

| Parameter | Description |
| --- | --- |
| `index` | `number` |

### `onDidNavigate`

```typescript
onDidNavigate(callback: () => void): void
```

Subscribes to top-level navigation events (URL changes that load a new document).

| Parameter | Description |
| --- | --- |
| `callback` | `() => void` |

### `onDidNavigateInPage`

```typescript
onDidNavigateInPage(callback: () => void): void
```

Subscribes to in-page navigation events (hash changes, `history.pushState`).

| Parameter | Description |
| --- | --- |
| `callback` | `() => void` |

### `removeDidNavigateListeners`

```typescript
removeDidNavigateListeners(): void
```

Removes all listeners registered via `onDidNavigate` and `onDidNavigateInPage`.

## `ElectronWsApi`

In-process replacement for the renderer↔server WebSocket. Backed by Chromium IPC instead of a TCP socket — no port is bound and no auth check is needed because the channel is only reachable from the renderer the BrowserWindow owns. Wire format is whatever the server's `MessagingProvider` accepts (currently `WebSocketMessage` / log-error / log-info / ping).

### `send`

```typescript
send(message: unknown): void
```

Sends a message from the renderer to the main-process messaging hub.

| Parameter | Description |
| --- | --- |
| `message` | `unknown` |

### `onMessage`

```typescript
onMessage(callback: (message: unknown) => void): () => void
```

Subscribes to messages pushed from the main process. Returns an unsubscribe function — call it when the listener is no longer needed (e.g. when a BrowserWindow is unloaded) to avoid leaking handlers.

| Parameter | Description |
| --- | --- |
| `callback` | `(message: unknown) => void` |

**Returns** `() => void`

## `ElectronSecurityApi`

Security settings that live outside the database (in `data_dir/security.json`) to prevent malicious scripts from modifying them. Changes require a native OS confirmation dialog and an app restart to take effect.

### `setLanAccessEnabled`

```typescript
setLanAccessEnabled(enabled: boolean): Promise<boolean>
```

Requests enabling/disabling LAN access. When enabled, the desktop binds its TCP listener to all interfaces (instead of loopback) so other devices can reach it — e.g. to sync from another device. Same confirmation + restart flow as above.

| Parameter | Description |
| --- | --- |
| `enabled` | `boolean` |

**Returns** `Promise<boolean>`

### `setBackendScriptingEnabled`

```typescript
setBackendScriptingEnabled(enabled: boolean): Promise<boolean>
```

Requests backend script execution be turned on or off.

| Parameter | Description |
| --- | --- |
| `enabled` | `boolean` |

**Returns** `Promise<boolean>`

### `setSqlConsoleEnabled`

```typescript
setSqlConsoleEnabled(enabled: boolean): Promise<boolean>
```

Requests the SQL console be turned on or off.

| Parameter | Description |
| --- | --- |
| `enabled` | `boolean` |

**Returns** `Promise<boolean>`

## `ElectronBackupPassphraseApi`

The backup passphrase, kept encrypted by the OS keyring in a file outside the database (the database is what ends up inside the backup, so a passphrase stored there would ride along inside the very container it protects).

Deliberately write-only: there is no way to read the passphrase back, so a frontend script cannot exfiltrate it. Only the main process ever sees the plaintext again, when it writes a backup.

Both changes are also gated on a native OS confirmation, which a script can request but cannot answer. Without that, a script could quietly swap in a passphrase of its own and every later backup would be encrypted to it.

### `getStatus`

```typescript
getStatus(): Promise<BackupPassphraseStatus>
```

Whether a passphrase can be stored on this system, and whether one already is.

**Returns** `Promise<BackupPassphraseStatus>`

### `set`

```typescript
set(passphrase: string): Promise<BackupPassphraseChange>
```

Stores a passphrase, replacing any existing one, once the user has confirmed it.

| Parameter | Description |
| --- | --- |
| `passphrase` | `string` |

**Returns** `Promise<BackupPassphraseChange>`

### `clear`

```typescript
clear(): Promise<BackupPassphraseChange>
```

Forgets the stored passphrase. Existing backups keep the passphrase they were written with.

**Returns** `Promise<BackupPassphraseChange>`

## `ElectronOneNoteApi`

Desktop-only OneNote importer sign-in, driven from the main process via a loopback OAuth redirect.

### `login`

```typescript
login(): Promise<OneNoteLoginResult>
```

Runs the Microsoft delegated-Graph OAuth flow: opens the system browser, captures the redirect on a throwaway loopback server, exchanges the code, and stores the token process-side. Resolves once the desktop session is connected (or with `connected: false` on failure/timeout).

**Returns** `Promise<OneNoteLoginResult>`

## `ElectronNativeExportApi`

Desktop-native subtree export that streams a `.zip` straight to a file.

### `exportSubtreeToFile`

```typescript
exportSubtreeToFile(opts: { branchId: string; format: string; title: string; taskId: string }): Promise<NativeExportResult>
```

Prompts a native "save as" dialog, then streams a subtree (branch) export to the chosen path on disk. This bypasses the in-memory download path, so memory stays bounded regardless of archive size. Progress/success/error are reported over the WebSocket via `taskId`. Resolves once the dialog is dismissed (`cancelled`) or the export finishes (`saved` / `error`).

| Parameter | Description |
| --- | --- |
| `opts` | `{ branchId: string; format: string; title: string; taskId: string }` |

**Returns** `Promise<NativeExportResult>`

## `ElectronNativeImportApi`

Desktop-native import that reads the user's file **in place** (bounded memory, no temp copy) — the whole point being multi-GB `.zip` archives, though any importable file is accepted. The renderer never handles a filesystem path: `pickFiles` runs the OS dialog in the main process and returns opaque capability tokens, which `importFromToken` redeems. A script can't forge a token or pass a path, so it can never read an arbitrary file.

### `pickFiles`

```typescript
pickFiles(): Promise<NativeImportPickResult>
```

Prompts a native "open file" dialog (multi-select, any type) and returns single-use tokens for the chosen files.

**Returns** `Promise<NativeImportPickResult>`

### `grantDroppedFiles`

```typescript
grantDroppedFiles(files: File[]): Promise<NativeImportPickResult>
```

Resolves files the user dropped onto a drop zone to capability tokens, so a drag-and-drop import takes the same in-place (streamed) path as the dialog. The `File` is the unforgeable capability: the path is obtained via `webUtils.getPathForFile`, which yields a real path only for a genuinely user-supplied file and an empty string for anything a script constructed — so a script can't smuggle in an arbitrary path. Returns `cancelled` when no dropped file resolved (e.g. dragged from a browser, not the OS), so the caller falls back to the normal upload route.

| Parameter | Description |
| --- | --- |
| `files` | `File[]` |

**Returns** `Promise<NativeImportPickResult>`

### `importFromToken`

```typescript
importFromToken(opts: { token: string; parentNoteId: string; taskId: string; options: NativeImportOptions; last: boolean; format?: string }): Promise<NativeImportResult>
```

Imports the file behind `token` into `parentNoteId`. Progress/success/error are reported over the WebSocket via `taskId`, matching the HTTP import path. When importing several files in one batch, set `last` only on the final call so the success toast fires once, after everything is in. `format` routes the file to a specific importer (e.g. "obsidian"), mirroring the HTTP route's format tag.

| Parameter | Description |
| --- | --- |
| `opts` | `{ token: string; parentNoteId: string; taskId: string; options: NativeImportOptions; last: boolean; format?: string }` |

**Returns** `Promise<NativeImportResult>`

## `ElectronDialogApi`

Native OS pickers that hand the renderer a location the user chose themselves.

### `pickDirectory`

```typescript
pickDirectory(opts?: { defaultPath?: string }): Promise<NativeDirectoryPickResult>
```

Prompts a native "select folder" dialog, starting at `defaultPath` when it is given. The renderer cannot supply the answer: a script can at most pop the dialog, which the user still has to accept before any path comes back.

| Parameter | Description |
| --- | --- |
| `opts`  <br>_optional_ | `{ defaultPath?: string }` |

**Returns** `Promise<NativeDirectoryPickResult>`

### `confirmStartOver`

```typescript
confirmStartOver(): Promise<boolean>
```

Prompts a native message box before the application restarts into the setup screen, where the user may replace or erase their knowledge base.

An OS dialog rather than one of the application's own, for the reason the security toggles use one: a note script can reach every dialog the app draws for itself, and this one guards the path to losing everything. It is never suppressible, so there is no "don't ask again" here.

**Returns** `Promise<boolean>`

## `ElectronRestoreApi`

Choosing a backup to restore from the desktop, where the file is already on the same disk as the database it is going to replace and has no business being uploaded to reach it.

Only usable during setup: what it puts forward is restored by the ordinary `POST /api/setup/restore/start`, which refuses once the application is initialized.

### `pickBackup`

```typescript
pickBackup(): Promise<NativeBackupPickResult>
```

Prompts a native "open file" dialog for a `.db` or `.tnbackup` backup and, if one is chosen, makes it the backup waiting to be restored.

**Returns** `Promise<NativeBackupPickResult>`

## `ElectronTranscriptionApi`

Meeting transcription, recorded and transcribed on this computer by the main process. The renderer only starts and stops it; the audio never passes through the renderer.

### `isSupported`

```typescript
isSupported(): Promise<boolean>
```

Whether this build can transcribe on this computer: `false` when it carries no speech recognition engine for the platform and processor it runs on.

**Returns** `Promise<boolean>`

### `start`

```typescript
start(noteId: string): Promise<string>
```

Starts recording the microphone and the system audio for the meeting note `noteId`.

| Parameter | Description |
| --- | --- |
| `noteId` | `string` |

**Returns** `Promise<string>`: An empty string once recording runs, or an error message when it cannot start.

### `stop`

```typescript
stop(): Promise<void>
```

Stops the recording, once the speech already captured has been transcribed.

**Returns** `Promise<void>`

### `getState`

```typescript
getState(): Promise<TranscriptionState>
```

**Returns** `Promise<TranscriptionState>`

### `renameSpeaker`

```typescript
renameSpeaker(attachmentId: string, key: string, name: string): Promise<boolean>
```

Names a speaker of the transcript attachment `attachmentId`, or restores the default name when `name` is blank, if a running recording writes that transcript. The recording applies it, so no utterance it writes meanwhile is lost.

| Parameter | Description |
| --- | --- |
| `attachmentId` | `string` |
| `key` | `string` |
| `name` | `string` |

**Returns** `Promise<boolean>`: `false` when no recording writes `attachmentId`; it can then be saved whole.

### `getRecordingsDirectory`

```typescript
getRecordingsDirectory(): Promise<string>
```

Returns the directory that keeps the audio and the transcript as produced of each recording while `transcriptionKeepRecordings` is on, creating it if needed.

**Returns** `Promise<string>`

### `onStateChanged`

```typescript
onStateChanged(callback: (state: TranscriptionState) => void): () => void
```

Calls `callback` every time the state changes, in any window.

| Parameter | Description |
| --- | --- |
| `callback` | `(state: TranscriptionState) => void` |

**Returns** `() => void`: A function that removes the listener.

### `onLevel`

```typescript
onLevel(callback: (source: TranscriptSource, level: number) => void): () => void
```

Calls `callback` with the RMS, from 0 to 1, of every chunk a source of the running recording delivers, about four times a second per source.

| Parameter | Description |
| --- | --- |
| `callback` | `(source: TranscriptSource, level: number) => void` |

**Returns** `() => void`: A function that stops the calls.

## `ElectronContextMenuParams`

Parameters delivered by the main process to the renderer when the user opens the system context menu (right-click) somewhere inside a web view.

Mirrors the subset of fields from Electron's `Electron.ContextMenuParams` that the renderer actually consumes when building its custom context menu.

| Property | Description |
| --- | --- |
| `x` | `number`  <br>Horizontal position of the click, in CSS pixels, relative to the web view. |
| `y` | `number`  <br>Vertical position of the click, in CSS pixels, relative to the web view. |
| `linkURL` | `string`  <br>URL of the link the user clicked on, or an empty string if not on a link. |
| `linkText` | `string`  <br>Visible text of the link the user clicked on, or an empty string. |
| `mediaType` | `string`  <br>Media kind under the cursor (e.g. `"none"`, `"image"`, `"video"`, `"audio"`). |
| `isEditable` | `boolean`  <br>Whether the element under the cursor is editable (input, textarea, contenteditable). |
| `selectionText` | `string`  <br>Currently selected text, or an empty string if nothing is selected. |
| `misspelledWord` | `string`  <br>The misspelled word under the cursor, or an empty string if none. |
| `dictionarySuggestions` | `string[]`  <br>Spell-check suggestions for `misspelledWord`, in order of relevance. |
| `editFlags` | `{ canCut: boolean; canCopy: boolean; canPaste: boolean }`  <br>Hints about which clipboard operations are currently available. |

## `BackupPassphraseStatus`

What the Options UI needs to know about the stored backup passphrase.

| Property | Description |
| --- | --- |
| `available` | `boolean`  <br>Whether the OS offers a keyring to keep the passphrase in. Without one it cannot be stored safely, and since unattended backups cannot ask for it, encryption is unavailable altogether. |
| `set` | `boolean`  <br>Whether a passphrase is currently stored. |

## `BackupPassphraseChange`

What became of a request to change the stored backup passphrase.

```typescript
type BackupPassphraseChange = "applied" | "cancelled" | "unavailable"
```

## `OneNoteLoginResult`

Outcome of a `ElectronOneNoteApi.login` attempt.

| Property | Description |
| --- | --- |
| `connected` | `boolean`  <br>True if sign-in completed and a Microsoft Graph token was stored. |
| `account`  <br>_optional_ | `{ name: string; email: string }`  <br>The connected Microsoft account, present when `connected` is true. |
| `error`  <br>_optional_ | `string`  <br>A human-readable failure reason when `connected` is false (absent on user cancellation). |

## `NativeExportResult`

Outcome of a `ElectronNativeExportApi.exportSubtreeToFile` request.

| Property | Description |
| --- | --- |
| `status` | `"cancelled" \| "saved" \| "error"` |
| `filePath`  <br>_optional_ | `string`  <br>Absolute path the archive was written to (when `status === "saved"`). |
| `message`  <br>_optional_ | `string`  <br>Failure detail (when `status === "error"`). |

## `NativeImportPickResult`

Outcome of `ElectronNativeImportApi.pickFiles`: capability tokens, never paths.

| Property | Description |
| --- | --- |
| `status` | `"cancelled" \| "selected"` |
| `files`  <br>_optional_ | `NativeImportPickedFile[]`  <br>The user-chosen files (when `status === "selected"`); one or more, since the dialog allows multi-select. |

## `NativeImportOptions`

Import flags forwarded to the native importer (mirrors the HTTP route's options; no path).

| Property | Description |
| --- | --- |
| `safeImport` | `boolean` |
| `shrinkImages` | `boolean` |
| `textImportedAsText` | `boolean` |
| `codeImportedAsCode` | `boolean` |
| `spreadsheetImportedAsSpreadsheet` | `boolean` |
| `explodeArchives` | `boolean` |
| `replaceUnderscoresWithSpaces` | `boolean` |

## `NativeImportResult`

Outcome of `ElectronNativeImportApi.importFromToken`.

| Property | Description |
| --- | --- |
| `status` | `"error" \| "imported"` |
| `importedNoteId`  <br>_optional_ | `string`  <br>Root note of the import (when `status === "imported"`). |
| `message`  <br>_optional_ | `string`  <br>Failure detail (when `status === "error"`). |

## `NativeDirectoryPickResult`

Outcome of `ElectronDialogApi.pickDirectory`.

| Property | Description |
| --- | --- |
| `status` | `"cancelled" \| "selected"` |
| `path`  <br>_optional_ | `string`  <br>Absolute path of the chosen directory (when `status === "selected"`). |

## `NativeBackupPickResult`

Outcome of `ElectronRestoreApi.pickBackup`: what the chosen backup is, never where it is.

The file itself stays with the main process, which holds it as the one waiting to be restored, so the renderer is given only what the screen has to show and decide with.

| Property | Description |
| --- | --- |
| `status` | `"cancelled" \| "error" \| "selected"` |
| `fileName`  <br>_optional_ | `string`  <br>Display name of the chosen backup (when `status === "selected"`). |
| `encrypted`  <br>_optional_ | `boolean`  <br>Whether a passphrase has to be asked for before it can be restored. |
| `message`  <br>_optional_ | `string`  <br>Failure detail (when `status === "error"`), e.g. setup already being busy. |

## `TranscriptionState`

What `ElectronTranscriptionApi` reports to every window.

| Property | Description |
| --- | --- |
| `status` | `TranscriptionStatus` |
| `noteId` | `string \| null`  <br>The meeting note the recording belongs to, or `null` when idle. |
| `pendingSources` | `TranscriptSource[]`  <br>The sources heard speaking, or whose speech is still being transcribed. |
| `sourceIssues`  <br>_optional_ | `Partial<Record<TranscriptSource, TranscriptSourceIssue>>`  <br>While recording, the sources whose audio is not being transcribed, and why; absent when every source delivers sound. |
| `startedAt`  <br>_optional_ | `number`  <br>When the recording started, in milliseconds since the epoch: set once it records, kept while it stops, absent otherwise. |
| `error`  <br>_optional_ | `string`  <br>A problem to tell the user about, sent once with the state it concerns: the recording ended without being stopped, or its transcript cannot be saved. `getState()` never returns it. |

## `NativeImportPickedFile`

A single user-chosen file: a capability token (redeemed to import it) and its display name — never a path.

| Property | Description |
| --- | --- |
| `token` | `string`  <br>Single-use, short-lived grant for the chosen file. |
| `fileName` | `string`  <br>Display name of the chosen file. |

## `TranscriptionStatus`

Phase of the meeting transcription; at most one recording runs at a time.

```typescript
type TranscriptionStatus = "idle" | "starting" | "recording" | "stopping"
```

## `TranscriptSourceIssue`

Why a source's audio is not being transcribed: its capture did not start (`not_captured`), it has delivered no audio for 10 s (`no_audio`), as when its capture hangs, or it has delivered only digital silence for a while (`silent`), as from a muted device.

```typescript
type TranscriptSourceIssue = "not_captured" | "no_audio" | "silent"
```

## `RendererStartupMetric`

Startup milestones the renderer may report to the main process for startup timing instrumentation (see `apps/desktop/src/services/startup_metrics.ts`).

*   `client-full-render` — the client finished its initial render: the layout widgets are attached to the DOM, the froca note cache is loaded, and a frame of the rendered layout has been painted.

```typescript
type RendererStartupMetric = "client-full-render"
```