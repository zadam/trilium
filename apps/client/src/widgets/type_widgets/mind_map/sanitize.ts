import { sanitizeNoteContentHtml } from "../../../services/sanitize_content";

/**
 * Recursively sanitizes a parsed Mind Elixir data structure in place, neutralizing any
 * `dangerouslySetInnerHTML` payloads found anywhere in the tree.
 *
 * Mind Elixir nodes support an (undocumented in its README) `dangerouslySetInnerHTML`
 * property which replaces the node's content with raw HTML via `element.innerHTML`
 * (see mind-elixir `utils/dom.ts`). Trilium's UI never produces this property, but a
 * malicious note can embed it in the stored JSON. Because Safe Import only sanitizes
 * notes of `type === "text"` and skips `mindMap` notes, such a payload reaches the
 * client unsanitized and is injected into the DOM when the map is rendered, yielding
 * stored XSS (and historically RCE on the Electron desktop client) — GHSA-rj57-j38v-3577.
 *
 * Rather than dropping the field, we run every occurrence through the same DOMPurify
 * sanitizer used for text notes, so any legitimate markup is preserved while script
 * execution vectors are stripped.
 *
 * @param data the parsed Mind Elixir content (mutated in place).
 * @returns the same object, for convenience.
 */
export function sanitizeMindMapData<T>(data: T): T {
    sanitizeMindMapNode(data);
    return data;
}

function sanitizeMindMapNode(value: unknown): void {
    if (Array.isArray(value)) {
        for (const item of value) {
            sanitizeMindMapNode(item);
        }
        return;
    }

    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;

        if (typeof record.dangerouslySetInnerHTML === "string") {
            record.dangerouslySetInnerHTML =
                sanitizeNoteContentHtml(record.dangerouslySetInnerHTML);
        }

        for (const key of Object.keys(record)) {
            sanitizeMindMapNode(record[key]);
        }
    }
}
