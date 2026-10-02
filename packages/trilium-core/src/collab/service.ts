import {
    type Collaboration,
    COLLABORATION_CREATE_MODES,
    COLLABORATION_EDIT_MODES,
    COLLABORATION_VIEW_MODES,
    type CollaborationCreateMode,
    type CollaborationEditMode,
    type CollaborationRow,
    type CollaborationViewMode,
    DEFAULT_COLLABORATION_MAX_GUESTS,
    MAX_COLLABORATION_MAX_GUESTS,
    normalizeCollabName
} from "@triliumnext/commons";
import { t } from "i18next";

import becca from "../becca/becca.js";
import BCollaboration from "../becca/entities/bcollaboration.js";
import type BNote from "../becca/entities/bnote.js";
import { ValidationError } from "../errors.js";
import type { GuestCapability } from "../services/context.js";
import { getCrypto } from "../services/encryption/crypto.js";
import { getScryptHash } from "../services/encryption/scrypt.js";
import { encodeBase64, encodeUtf8 } from "../services/utils/binary.js";

export type CollabCapability = GuestCapability;

export const COLLAB_CAPABILITIES: readonly CollabCapability[] = [ "view", "edit", "create" ];

/**
 * What the host sets on a collaboration. A password left `undefined` keeps the stored hash on
 * an update; a capability whose mode is not `password` drops its hash.
 */
export interface CollaborationSettings {
    includeSubtree: boolean;
    viewMode: CollaborationViewMode;
    editMode: CollaborationEditMode;
    createMode: CollaborationCreateMode;
    slug?: string | null;
    /** How many guests can be connected at once; left out, the default or stored limit stays. */
    maxGuests?: number;
    /**
     * The name the host goes by on the guest pages. Left out, the stored name stays; a blank name
     * goes back to the default.
     */
    hostName?: string | null;
    viewPassword?: string | null;
    editPassword?: string | null;
    createPassword?: string | null;
}

export const MIN_PASSWORD_LENGTH = 4;

const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Opens the note to guests. Rejects notes that must never leave the host's app. */
export async function createCollaboration(
    noteId: string, settings: CollaborationSettings
): Promise<BCollaboration> {
    const note = becca.getNote(noteId);

    assertCollaborableNote(note);

    if (becca.getActiveCollaborationForNote(note.noteId)) {
        throw new ValidationError(`Note '${noteId}' already has a collaboration.`);
    }

    validateSettings(settings, null);

    const row: CollaborationRow = {
        noteId: note.noteId,
        includeSubtree: settings.includeSubtree,
        viewMode: settings.viewMode,
        editMode: settings.editMode,
        createMode: settings.createMode,
        slug: normalizeSlug(settings.slug),
        maxGuests: settings.maxGuests ?? DEFAULT_COLLABORATION_MAX_GUESTS,
        hostName: normalizeCollabName(settings.hostName)
    };

    Object.assign(row, await hashPasswords(settings, null));

    return new BCollaboration(row).save();
}

export async function updateCollaboration(
    collab: BCollaboration, settings: CollaborationSettings
): Promise<BCollaboration> {
    validateSettings(settings, collab);

    collab.includeSubtree = settings.includeSubtree;
    collab.viewMode = settings.viewMode;
    collab.editMode = settings.editMode;
    collab.createMode = settings.createMode;
    collab.slug = normalizeSlug(settings.slug);
    collab.maxGuests = settings.maxGuests ?? collab.maxGuests;

    if (settings.hostName !== undefined) {
        collab.hostName = normalizeCollabName(settings.hostName);
    }

    Object.assign(collab, await hashPasswords(settings, collab));

    return collab.save();
}

/** Renames the host on the collaboration's pages; a blank name goes back to the default. */
export function setHostName(collab: BCollaboration, name: unknown) {
    collab.hostName = normalizeCollabName(name);
    collab.save();
}

/** The name the host goes by on the collaboration's pages. */
export function getHostDisplayName(collab: BCollaboration): string {
    return collab.hostName ?? t("collab_theme.host_name");
}

/** The settings as the host's client sees them, without the password hashes. */
export function toCollaborationDto(collab: BCollaboration): Collaboration {
    return {
        collabId: collab.collabId ?? "",
        noteId: collab.noteId,
        includeSubtree: collab.includeSubtree,
        viewMode: collab.viewMode,
        editMode: collab.editMode,
        createMode: collab.createMode,
        slug: collab.slug,
        maxGuests: collab.maxGuests,
        hostName: collab.hostName,
        utcDateCreated: collab.utcDateCreated,
        utcDateModified: collab.utcDateModified ?? collab.utcDateCreated
    };
}

/**
 * What an open guest page depends on: whether the subtree is included and how each capability is
 * opened. The guest limit, the link name and the passwords leave open pages as they are.
 */
export function getAccessSignature(collab: BCollaboration): string {
    return [
        collab.includeSubtree ? "subtree" : "note", collab.viewMode, collab.editMode,
        collab.createMode
    ].join(":");
}

/** Ends the collaboration: guests get 404 from the next request on. */
export function stopCollaboration(collab: BCollaboration) {
    collab.markAsDeletedSimple();
}

/** Returns the live collaboration behind a link segment, by id first and then by slug. */
export function resolveCollaboration(idOrSlug: string): BCollaboration | null {
    const byId = becca.getCollaboration(idOrSlug);

    if (byId && !byId.isDeleted) {
        return byId;
    }

    return becca.getCollaborations()
        .find((collab) => !collab.isDeleted && collab.slug === idOrSlug) ?? null;
}

/**
 * The single gate every guest read and write goes through: the collaboration's own note, or a
 * descendant when the subtree is included. Protected and hidden notes are never in scope.
 */
export function isNoteInCollabScope(collab: BCollaboration, note: BNote): boolean {
    if (note.isDeleted || note.isProtected || note.noteId.startsWith("_")
            || note.isInHiddenSubtree()) {
        return false;
    }

    return note.noteId === collab.noteId
        || (collab.includeSubtree && note.hasAncestor(collab.noteId));
}

/** Returns the live collaborations whose scope contains the note. */
export function getCollaborationsForNote(note: BNote): BCollaboration[] {
    const result: BCollaboration[] = [];

    for (const collab of becca.getCollaborations()) {
        if (!collab.isDeleted && isNoteInCollabScope(collab, note)) {
            result.push(collab);
        }
    }

    return result;
}

/** How the host set one capability: open to anyone, behind a password, or off. */
export function getCapabilityMode(collab: BCollaboration, capability: CollabCapability) {
    return getMode(collab, capability);
}

/** The capabilities anyone with the link holds without a password. */
export function getOpenCapabilities(collab: BCollaboration): CollabCapability[] {
    return COLLAB_CAPABILITIES.filter((capability) => getMode(collab, capability) === "open");
}

/** The capabilities a password can unlock. */
export function getPasswordGatedCapabilities(collab: BCollaboration): CollabCapability[] {
    return COLLAB_CAPABILITIES.filter((capability) => getMode(collab, capability) === "password");
}

/**
 * Returns every password-gated capability the password matches. Every gated capability is
 * checked, so the time taken does not say which one failed.
 */
export async function unlockCapabilities(
    collab: BCollaboration, password: string
): Promise<CollabCapability[]> {
    const unlocked: CollabCapability[] = [];

    for (const capability of getPasswordGatedCapabilities(collab)) {
        const column = PASSWORD_COLUMNS[capability];

        if (await matchesPassword(password, collab[column.hash], collab[column.salt])) {
            unlocked.push(capability);
        }
    }

    return unlocked;
}

/**
 * What a guest can do right now: the open capabilities plus the unlocked ones that are still
 * password-gated, closed over the implications `create` → `edit` → `view`. Recomputed on every
 * request, so a capability the host turns off is gone at once.
 */
export function getEffectiveCapabilities(
    collab: BCollaboration, unlocked: readonly CollabCapability[]
): CollabCapability[] {
    const held = new Set<CollabCapability>(getOpenCapabilities(collab));

    for (const capability of getPasswordGatedCapabilities(collab)) {
        if (unlocked.includes(capability)) {
            held.add(capability);
        }
    }

    if (held.has("create")) {
        held.add("edit");
    }

    if (held.has("edit")) {
        held.add("view");
    }

    return COLLAB_CAPABILITIES.filter((capability) => held.has(capability));
}

function assertCollaborableNote(note: BNote | null): asserts note is BNote {
    if (!note || note.isDeleted) {
        throw new ValidationError("The note does not exist.");
    }

    if (note.noteId === "root" || note.noteId.startsWith("_") || note.isInHiddenSubtree()) {
        throw new ValidationError("System notes cannot be opened to guests.");
    }

    if (note.isProtected) {
        throw new ValidationError("Protected notes cannot be opened to guests.");
    }
}

function validateSettings(settings: CollaborationSettings, existing: BCollaboration | null) {
    if (!COLLABORATION_VIEW_MODES.includes(settings.viewMode)
            || !COLLABORATION_EDIT_MODES.includes(settings.editMode)
            || !COLLABORATION_CREATE_MODES.includes(settings.createMode)) {
        throw new ValidationError("Unknown access mode.");
    }

    if (settings.createMode !== "none" && !settings.includeSubtree) {
        throw new ValidationError("Guests can only add child notes when child notes are included.");
    }

    if (settings.createMode !== "none" && settings.editMode === "none") {
        throw new ValidationError("Guests can only add child notes when editing is allowed.");
    }

    if (settings.editMode === "open" && settings.viewMode !== "open") {
        throw new ValidationError(
            "Editing cannot be open to anyone while viewing needs a password.");
    }

    for (const capability of COLLAB_CAPABILITIES) {
        if (getSettingsMode(settings, capability) !== "password") {
            continue;
        }

        const password = settings[PASSWORD_SETTINGS[capability]];

        if (password === undefined && existing && existing[PASSWORD_COLUMNS[capability].hash]) {
            continue;
        }

        if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
            throw new ValidationError(
                `The ${capability} password needs ${MIN_PASSWORD_LENGTH} characters or more.`);
        }
    }

    if (settings.maxGuests !== undefined && (!Number.isInteger(settings.maxGuests)
            || settings.maxGuests < 1 || settings.maxGuests > MAX_COLLABORATION_MAX_GUESTS)) {
        throw new ValidationError(
            `The guest limit must be a whole number from 1 to ${MAX_COLLABORATION_MAX_GUESTS}.`);
    }

    const slug = normalizeSlug(settings.slug);

    if (slug !== null) {
        if (!SLUG_PATTERN.test(slug)) {
            throw new ValidationError(
                "The link name can only contain letters, digits, '-' and '_'.");
        }

        const taken = becca.getCollaborations().some((collab) =>
            !collab.isDeleted && collab.slug === slug && collab.collabId !== existing?.collabId);

        if (taken) {
            throw new ValidationError(`The link name '${slug}' is already in use.`);
        }
    }
}

type PasswordColumns = Pick<CollaborationRow,
    | "viewPasswordHash" | "viewPasswordSalt"
    | "editPasswordHash" | "editPasswordSalt"
    | "createPasswordHash" | "createPasswordSalt">;

/** Hashes the passwords the settings supply and clears the ones their mode no longer needs. */
async function hashPasswords(
    settings: CollaborationSettings, existing: BCollaboration | null
): Promise<PasswordColumns> {
    const columns: PasswordColumns = {};

    for (const capability of COLLAB_CAPABILITIES) {
        const { hash: hashColumn, salt: saltColumn } = PASSWORD_COLUMNS[capability];
        const password = settings[PASSWORD_SETTINGS[capability]];

        if (getSettingsMode(settings, capability) !== "password") {
            columns[hashColumn] = null;
            columns[saltColumn] = null;
        } else if (typeof password === "string") {
            const hashed = await hashPassword(password);
            columns[hashColumn] = hashed.hash;
            columns[saltColumn] = hashed.salt;
        } else if (existing) {
            columns[hashColumn] = existing[hashColumn];
            columns[saltColumn] = existing[saltColumn];
        }
    }

    return columns;
}

async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    const salt = encodeBase64(getCrypto().randomBytes(32));
    const hash = encodeBase64(await getScryptHash(password, salt));

    return { hash, salt };
}

async function matchesPassword(
    password: string, hash: string | null, salt: string | null
): Promise<boolean> {
    if (!hash || !salt) {
        return false;
    }

    const given = encodeBase64(await getScryptHash(password, salt));

    return getCrypto().constantTimeCompare(encodeUtf8(given), encodeUtf8(hash));
}

function getMode(collab: BCollaboration, capability: CollabCapability) {
    if (capability === "view") {
        return collab.viewMode;
    }

    return capability === "edit" ? collab.editMode : collab.createMode;
}

function getSettingsMode(settings: CollaborationSettings, capability: CollabCapability) {
    if (capability === "view") {
        return settings.viewMode;
    }

    return capability === "edit" ? settings.editMode : settings.createMode;
}

function normalizeSlug(slug: string | null | undefined): string | null {
    const trimmed = slug?.trim();

    return trimmed ? trimmed : null;
}

const PASSWORD_COLUMNS = {
    view: { hash: "viewPasswordHash", salt: "viewPasswordSalt" },
    edit: { hash: "editPasswordHash", salt: "editPasswordSalt" },
    create: { hash: "createPasswordHash", salt: "createPasswordSalt" }
} as const;

const PASSWORD_SETTINGS = {
    view: "viewPassword",
    edit: "editPassword",
    create: "createPassword"
} as const;

export default {
    createCollaboration,
    updateCollaboration,
    toCollaborationDto,
    setHostName,
    getHostDisplayName,
    getAccessSignature,
    stopCollaboration,
    resolveCollaboration,
    isNoteInCollabScope,
    getCollaborationsForNote,
    getCapabilityMode,
    getOpenCapabilities,
    getPasswordGatedCapabilities,
    unlockCapabilities,
    getEffectiveCapabilities
};
