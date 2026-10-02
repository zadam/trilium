/** The id the host has in every collaboration's list of people. */
export const COLLAB_HOST_PERSON_ID = "host";

/** The longest name a person on a collaboration can have, in characters. */
export const MAX_COLLAB_NAME_LENGTH = 40;

/**
 * The colors of people's carets and initials. Each carries white text at 4.5:1 or more and stands
 * out at 3:1 or more on a dark page. The host has the first; guests take the others in turn.
 */
export const COLLAB_PERSON_COLORS = [
    "#2066df", "#d22a1e", "#127d3e", "#8f44e4", "#a55a18", "#12797d", "#cd1d84", "#717411"
] as const;

/** Someone on a collaboration's pages, as each page and the host's app list them. */
export interface CollabPerson {
    /** {@link COLLAB_HOST_PERSON_ID} for the host; for a guest, an id that names no session. */
    id: string;
    name: string;
    /** One of {@link COLLAB_PERSON_COLORS}. */
    color: string;
    isHost: boolean;
    /** The note the person has open, or null while it is unknown. */
    noteId: string | null;
    /** Whether the person has that note open in an editor. */
    editing: boolean;
}

/** The person a shared selection belongs to. */
export type CollabCursorOwner = Pick<CollabPerson, "id" | "name" | "color">;

/**
 * A person's selection in a note, where equal ends are a caret. In a text note the ends are
 * CKEditor model paths in the `main` root; in a code note they are CodeMirror document offsets.
 */
export type CollabSelection =
    | { kind: "text"; anchor: number[]; head: number[] }
    | { kind: "code"; anchor: number; head: number };

/** The deepest model path a text selection can carry. */
const MAX_PATH_DEPTH = 16;
/** The largest offset a selection can carry, past the end of any note. */
const MAX_OFFSET = 100_000_000;

/**
 * Returns the value as a display name: trimmed, without control and formatting characters such as
 * direction overrides, each run of white space as one space, and cut to
 * {@link MAX_COLLAB_NAME_LENGTH} characters. Returns null when nothing is left.
 */
export function normalizeCollabName(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const cleaned = value.replace(/\p{Cf}/gu, "").replace(/[\p{Cc}\s]+/gu, " ").trim();
    const name = [ ...cleaned ].slice(0, MAX_COLLAB_NAME_LENGTH).join("").trim();

    return name || null;
}

/**
 * Returns a copy of the value with only the fields of a selection, or null when it is not one: an
 * unknown kind, an end that is not a whole number in range, or a path too deep.
 */
export function parseCollabSelection(value: unknown): CollabSelection | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const { kind, anchor, head } = value as Record<string, unknown>;

    if (kind === "code" && isOffset(anchor) && isOffset(head)) {
        return { kind, anchor, head };
    }

    if (kind === "text" && isModelPath(anchor) && isModelPath(head)) {
        return { kind, anchor, head };
    }

    return null;
}

function isOffset(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0
        && value <= MAX_OFFSET;
}

function isModelPath(value: unknown): value is number[] {
    return Array.isArray(value) && value.length > 0 && value.length <= MAX_PATH_DEPTH
        && value.every(isOffset);
}
