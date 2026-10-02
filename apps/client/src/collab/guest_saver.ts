export type GuestSaveState = "idle" | "pending" | "saving" | "saved" | "conflict" | "error";

/** The server's version of a note whose save was refused because the note had moved on. */
export interface GuestSaveConflict {
    blobId: string;
    content: string;
}

export interface GuestSaverOptions {
    /** The guest API base relative to the page, such as `api/`. */
    apiBase: string;
    noteId: string;
    /** The blob the loaded content came from; every save names it so a stale save is refused. */
    blobId: string | null;
    /** The content of `blobId`, which the guest's edits start from. */
    content: string | null;
    csrfToken: string;
    /** Identifies this editor in entity changes, so its own saves do not come back as updates. */
    componentId: string;
    delayMs?: number;
    retryMs?: number;
    fetch?: typeof fetch;
    onState?: (state: GuestSaveState) => void;
}

const DEFAULT_DELAY_MS = 250;
const DEFAULT_RETRY_MS = 5000;

/**
 * Saves a guest's edits through the collaboration API: at most once every `delayMs` while they
 * keep coming, one request at a time, and carrying the blob id the content was loaded from, so
 * that a save over someone else's change is refused with their version instead of overwriting it.
 * {@link reconcile} merges the edits into that version, and the save goes out again. When it
 * cannot, nothing is sent until the guest takes the server's version or insists on their own.
 */
export class GuestSaver {

    /**
     * Draws the SVG that a diagram, canvas or mind map shows to viewers, from the content about to
     * be saved; the saver sends it along with that content.
     */
    preview: ((content: string) => Promise<string | null>) | null = null;

    /**
     * Puts the guest's edits since `base` into `theirs`, the version saved meanwhile, in the
     * editor. Returns false when the two cannot be merged.
     */
    reconcile: ((base: string, theirs: string) => boolean) | null = null;

    private readonly options: GuestSaverOptions;
    private noteId: string;
    private blobId: string | null;
    private base: string | null;
    private pendingContent: (() => string) | null = null;
    private pendingTitle: (() => string) | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private inFlight: Promise<void> | null = null;
    private _conflict: GuestSaveConflict | null = null;
    private _state: GuestSaveState = "idle";

    constructor(options: GuestSaverOptions) {
        this.options = options;
        this.noteId = options.noteId;
        this.blobId = options.blobId;
        this.base = options.content;
    }

    get state() {
        return this._state;
    }

    get conflict() {
        return this._conflict;
    }

    get currentBlobId() {
        return this.blobId;
    }

    /** The content of {@link currentBlobId}, as far as this page knows it. */
    get baseContent() {
        return this.base;
    }

    get componentId() {
        return this.options.componentId;
    }

    scheduleContent(read: () => string) {
        this.pendingContent = read;
        this.schedule(this.options.delayMs ?? DEFAULT_DELAY_MS);
    }

    scheduleTitle(read: () => string) {
        this.pendingTitle = read;
        this.schedule(this.options.delayMs ?? DEFAULT_DELAY_MS);
    }

    /** Sends what is pending now, waiting for a request already on its way first. */
    async flush(): Promise<void> {
        this.clearTimer();

        if (this.inFlight) {
            await this.inFlight;
        }

        if (this._conflict || (!this.pendingContent && !this.pendingTitle)) {
            return;
        }

        const title = this.pendingTitle;
        const content = this.pendingContent;
        this.pendingTitle = null;
        this.pendingContent = null;

        this.inFlight = this.send(title, content).finally(() => {
            this.inFlight = null;
        });
        await this.inFlight;

        if (this._state === "error") {
            const retryMs = this.options.retryMs ?? DEFAULT_RETRY_MS;
            this.timer = setTimeout(() => void this.flush(), retryMs);
        } else if (this.pendingContent || this.pendingTitle) {
            this.schedule(this.options.delayMs ?? DEFAULT_DELAY_MS);
        }
    }

    /** The guest took the server's version, which the caller has put in the editor. */
    acceptServerVersion() {
        if (!this._conflict) {
            return;
        }

        this.blobId = this._conflict.blobId;
        this.base = this._conflict.content;
        this._conflict = null;
        this.pendingContent = null;
        this.setState("idle");
    }

    /** The guest keeps their text: it goes out over the server's version. */
    async overwrite(read: () => string): Promise<void> {
        if (!this._conflict) {
            return;
        }

        this.blobId = this._conflict.blobId;
        this.base = this._conflict.content;
        this._conflict = null;
        this.pendingContent = read;
        await this.flush();
    }

    /** The server's version of the note is the guest's own last save, now stored as `blobId`. */
    adoptBlobId(blobId: string) {
        this.blobId = blobId;
    }

    /** The editor took in `content`, the server's version of the note stored as `blobId`. */
    adoptServerVersion(blobId: string, content: string) {
        this.blobId = blobId;
        this.base = content;
    }

    /** Resolves once the request on its way, if any, has its answer. */
    async settled(): Promise<void> {
        await this.inFlight;
    }

    dispose() {
        this.clearTimer();
    }

    private schedule(delayMs: number) {
        if (this._conflict) {
            return;
        }

        const retrying = this._state === "error";
        this.setState("pending");

        // Edits made while a save waits go out with it; a retry after an error waits no longer.
        if (this.timer && !retrying) {
            return;
        }

        this.clearTimer();
        this.timer = setTimeout(() => void this.flush(), delayMs);
    }

    private clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /**
     * Saves what the editor holds for the open note, then points the saver at another note, whose
     * content the editor shows next. Resolves `false`, staying on the open note, while a save of
     * it has failed or conflicts.
     */
    async switchNote(
        noteId: string, blobId: string | null, content: string | null
    ): Promise<boolean> {
        await this.flush();

        if (this._conflict || this.state === "error") {
            return false;
        }

        this.noteId = noteId;
        this.blobId = blobId;
        this.base = content;
        this.pendingContent = null;
        this.pendingTitle = null;
        this.setState("idle");

        return true;
    }

    /**
     * Saves what the editor holds, then switches the note to another type. The editor of the
     * other type only loads with the page, so the caller reloads on `true`.
     */
    async switchType(type: string, mime: string): Promise<boolean> {
        await this.flush();

        if (this._conflict || this.state === "error") {
            return false;
        }

        const response = await this.put(`notes/${this.noteId}/type`, { type, mime });

        return response.ok;
    }

    private async send(title: (() => string) | null, content: (() => string) | null) {
        this.setState("saving");

        try {
            if (title) {
                const response = await this.put(`notes/${this.noteId}/title`, {
                    title: title()
                });

                if (!response.ok) {
                    throw new Error(`Title save failed with HTTP ${response.status}.`);
                }
            }

            if (content) {
                const text = content();
                const preview = await this.drawPreview(text);
                const response = await this.put(`notes/${this.noteId}/content`, {
                    content: text,
                    baseBlobId: this.blobId,
                    ...(preview ? { preview } : {})
                });

                if (response.status === 409) {
                    const current = await response.json() as GuestSaveConflict;

                    if (this.base !== null && this.reconcile?.(this.base, current.content)) {
                        this.adoptServerVersion(current.blobId, current.content);
                        this.pendingContent ??= content;
                        this.setState("pending");
                        return;
                    }

                    this._conflict = { blobId: current.blobId, content: current.content };
                    this.pendingContent = content;
                    this.setState("conflict");
                    return;
                }

                if (!response.ok) {
                    throw new Error(`Content save failed with HTTP ${response.status}.`);
                }

                const saved = await response.json() as { blobId: string };
                this.blobId = saved.blobId;
                this.base = text;
            }

            this.setState("saved");
        } catch {
            // Keep the readers so the next attempt sends what the editor holds by then.
            this.pendingTitle ??= title;
            this.pendingContent ??= content;
            this.setState("error");
        }
    }

    /** A preview that cannot be drawn leaves the previous one in place; the content still saves. */
    private async drawPreview(content: string): Promise<string | null> {
        try {
            return await this.preview?.(content) ?? null;
        } catch {
            return null;
        }
    }

    private put(path: string, body: unknown): Promise<Response> {
        const doFetch = this.options.fetch ?? fetch;

        return doFetch(`${this.options.apiBase}${path}`, {
            method: "PUT",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "x-csrf-token": this.options.csrfToken,
                "trilium-component-id": this.options.componentId
            },
            body: JSON.stringify(body)
        });
    }

    private setState(state: GuestSaveState) {
        this._state = state;
        this.options.onState?.(state);
    }

}
