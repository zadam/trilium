import "./share_edit.css";

import { prepareAppHost } from "../content/app_view.js";
import type { EditView, EditViewOptions } from "../content/edit_view.js";

/** What `GET api/edit/session` answers a page about its note. */
export interface EditSession {
    editable: boolean;
    needsPassword?: boolean;
    unlocked?: boolean;
    rootNoteId?: string;
    attachments?: boolean;
    /** The texts of the page's controls, in the share's language. */
    strings?: Record<string, string>;
}

/** What `POST api/edit/login` answers once the note is unlocked. */
interface EditLogin {
    csrfToken: string;
    version: string;
    payload: EditViewOptions["payload"];
}

/**
 * Offers to edit a text note the host opened to its visitors: asks the share whether the note is
 * editable, then shows an *Edit* button at the end of the note's header, which unlocks the note
 * with its password where it has one and mounts the app's editor in place of the rendered
 * content. A page of the static export, and one whose share answers nothing, show nothing.
 */
export default async function setupShareEdit() {
    const noteId = document.body.dataset.noteId;
    const title = document.getElementById("title");
    if (window.glob?.isStatic || !noteId || !title) {
        return;
    }

    const session = await fetchSession(noteId);
    if (!session?.editable) {
        return;
    }

    const controls = buildControls(session.strings ?? {});
    // A custom template without the header's actions gets the controls below its title.
    const actions = document.getElementById("note-header-actions");
    if (actions) {
        actions.append(controls.bar);
    } else {
        (title.closest("#title-row") ?? title).after(controls.bar);
    }

    const editing: Editing = { relock: null };
    controls.editButton.addEventListener("click", () => {
        if (session.needsPassword && !session.unlocked) {
            controls.showLogin();
            controls.passwordInput.focus();
        } else {
            void unlock(controls, noteId, session, editing);
        }
    });
    controls.loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const password = controls.passwordInput.value;
        void (editing.relock?.(password) ?? unlock(controls, noteId, session, editing, password));
    });
}

type Controls = ReturnType<typeof buildControls>;

interface Editing {
    /** Once the editor is open, unlocks the note again after the visitor's access ended. */
    relock: ((password?: string) => Promise<void>) | null;
}

/** Unlocks the note for this session, saying in `controls` what went wrong when it cannot. */
async function login(
    controls: Controls, noteId: string, password?: string
): Promise<EditLogin | null> {
    controls.setError(null);
    const response = await fetch("api/edit/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, password })
    });
    if (response.status === 401) {
        controls.setError("wrongPassword");
        controls.passwordInput.select();
        return null;
    }
    if (!response.ok) {
        controls.setError("failed");
        return null;
    }
    return await response.json() as EditLogin;
}

async function unlock(
    controls: Controls, noteId: string, session: EditSession, editing: Editing, password?: string
) {
    const first = await login(controls, noteId, password);
    if (!first) {
        return;
    }

    let { csrfToken } = first;
    let canLogOut = !!session.needsPassword;
    controls.showEditing(canLogOut);
    // A new password, or closing and reopening editing, ends the access: the editor holds what
    // it could not save, and the note is unlocked again, without a password where none is needed.
    const onLocked = async () => {
        const current = await fetchSession(noteId);
        if (current?.editable && !current.needsPassword) {
            await editing.relock?.();
            return;
        }
        controls.passwordInput.value = "";
        controls.showLogin();
        controls.setError("locked");
        controls.passwordInput.focus();
    };
    const mounted = mountEditor(noteId, first, session, controls, () => void onLocked());
    editing.relock = async (again?: string) => {
        const next = await login(controls, noteId, again);
        if (!next) {
            return;
        }
        csrfToken = next.csrfToken;
        canLogOut ||= again !== undefined;
        controls.showEditing(canLogOut);
        (await mounted).resume(csrfToken);
    };
    // A click while the editor is still loading waits for it, so nothing pending is lost, and the
    // editor stays open while something is unsaved. An editor that never mounted holds nothing.
    const leave = async (beforeReload?: () => Promise<unknown>) => {
        const saved = await mounted.then((view) => view.stop(), () => true);
        if (!saved) {
            controls.setError("unsaved");
            return;
        }
        await beforeReload?.();
        window.location.reload();
    };
    const logOut = () => fetch("api/edit/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ noteId })
    });
    controls.stopButton.addEventListener("click", () => void leave());
    controls.logOutButton.addEventListener("click", () => void leave(logOut));
    try {
        await mounted;
    } catch (e) {
        console.error(e);
        controls.setError("failed");
    }
}

/**
 * Replaces the rendered content with the app's editor, which the edit view mounts once the
 * app's globals and the page's locale are ready, with its toolbar in the sticky top bar. The
 * rendered content comes back with the page, which *Stop editing* reloads once the editor has
 * saved.
 */
async function mountEditor(
    noteId: string,
    login: EditLogin,
    session: EditSession,
    controls: Controls,
    onLocked: () => void
): Promise<EditView> {
    const content = document.getElementById("content");
    const title = document.getElementById("title");
    if (!content || !title) {
        throw new Error("The page has no content to edit.");
    }

    await prepareAppHost(login.payload);
    const { default: mountEditView } = await import("../content/edit_view.js");
    const container = document.createElement("div");
    container.className = "share-edit-view";
    const rendered = [ ...content.children ].filter((child) =>
        child !== title && !child.contains(title) && child !== controls.bar);
    for (const child of rendered) {
        child.remove();
    }
    content.append(container);
    content.classList.add("share-editing");

    return await mountEditView(container, {
        noteId,
        title,
        payload: login.payload,
        csrfToken: login.csrfToken,
        version: login.version,
        attachments: !!session.attachments,
        statusContainer: buildStatusSlot(),
        toolbarContainer: buildToolbarSlot(),
        onLocked
    });
}

/** A slot in the sticky top bar, above the title row, where the page has one. */
function buildToolbarSlot() {
    const topBar = document.getElementById("top-bar");
    if (!topBar) {
        return undefined;
    }

    const slot = document.createElement("div");
    slot.className = "share-edit-toolbar-slot";
    topBar.insertBefore(slot, topBar.querySelector(":scope > #title-row"));
    return slot;
}

/** A slot at the start of the footer's "Last updated" line, where the page has one. */
function buildStatusSlot() {
    const updated = document.querySelector("#content-footer .updated");
    if (!updated) {
        return undefined;
    }

    const slot = document.createElement("span");
    slot.className = "share-edit-status-slot";
    updated.prepend(slot);
    return slot;
}

async function fetchSession(noteId: string): Promise<EditSession | null> {
    try {
        const response = await fetch(`api/edit/session?noteId=${encodeURIComponent(noteId)}`);
        return response.ok ? await response.json() as EditSession : null;
    } catch {
        return null;
    }
}

/** The controls: the *Edit* button, the password form, and the buttons while editing. */
function buildControls(strings: Record<string, string>) {
    const bar = document.createElement("div");
    bar.className = "share-edit-bar";
    bar.innerHTML = `
        <button type="button" class="share-edit-button share-edit-start"></button>
        <form class="share-edit-login" hidden>
            <input type="password" class="share-edit-password"
                autocomplete="current-password" required>
            <button type="submit" class="share-edit-button"></button>
        </form>
        <button type="button" class="share-edit-button share-edit-stop" hidden></button>
        <button type="button" class="share-edit-button share-edit-log-out" hidden></button>
        <p class="share-edit-error" role="alert" hidden></p>`;
    const find = <T extends HTMLElement>(selector: string) => bar.querySelector(selector) as T;
    const editButton = find<HTMLButtonElement>(".share-edit-start");
    const loginForm = find<HTMLFormElement>(".share-edit-login");
    const passwordInput = find<HTMLInputElement>(".share-edit-password");
    const stopButton = find<HTMLButtonElement>(".share-edit-stop");
    const logOutButton = find<HTMLButtonElement>(".share-edit-log-out");
    const error = find<HTMLParagraphElement>(".share-edit-error");

    editButton.textContent = strings.edit ?? "";
    passwordInput.placeholder = strings.password ?? "";
    find(".share-edit-login button").textContent = strings.unlock ?? "";
    stopButton.textContent = strings.stop ?? "";
    logOutButton.textContent = strings.logOut ?? "";

    return {
        bar,
        editButton,
        loginForm,
        passwordInput,
        stopButton,
        logOutButton,
        showLogin() {
            editButton.hidden = true;
            loginForm.hidden = false;
        },
        showEditing(canLogOut: boolean) {
            editButton.hidden = true;
            loginForm.hidden = true;
            stopButton.hidden = false;
            logOutButton.hidden = !canLogOut;
        },
        setError(key: "wrongPassword" | "failed" | "unsaved" | "locked" | null) {
            error.hidden = key === null;
            error.textContent = key === null ? "" : strings[key] ?? key;
        }
    };
}
