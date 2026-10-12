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
 * editable, then shows an *Edit* button beside the title, which unlocks the note with its password
 * where it has one and mounts the app's editor in place of the rendered content. A page of the
 * static export, and one whose share answers nothing, show nothing.
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
    (title.closest("#title-row") ?? title).after(controls.bar);

    controls.editButton.addEventListener("click", () => {
        if (session.needsPassword && !session.unlocked) {
            controls.showLogin();
            controls.passwordInput.focus();
        } else {
            void unlock(controls, noteId, session);
        }
    });
    controls.loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        void unlock(controls, noteId, session, controls.passwordInput.value);
    });
}

type Controls = ReturnType<typeof buildControls>;

async function unlock(controls: Controls, noteId: string, session: EditSession, password?: string) {
    controls.setError(null);
    const response = await fetch("api/edit/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, password })
    });
    if (response.status === 401) {
        controls.setError("wrongPassword");
        controls.passwordInput.select();
        return;
    }
    if (!response.ok) {
        controls.setError("failed");
        return;
    }

    const login = await response.json() as EditLogin;
    controls.showEditing(!!session.needsPassword);
    const mounted = mountEditor(noteId, login, session, controls);
    // A click while the editor is still loading waits for it, so nothing pending is lost.
    controls.stopButton.addEventListener("click", () => {
        void mounted.then((view) => view.stop()).then(() => window.location.reload());
    });
    controls.logOutButton.addEventListener("click", () => {
        void mounted.then((view) => view.stop())
            .then(() => fetch("api/edit/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-csrf-token": login.csrfToken },
                body: JSON.stringify({ noteId })
            }))
            .then(() => window.location.reload());
    });
    try {
        await mounted;
    } catch (e) {
        console.error(e);
        controls.setError("failed");
    }
}

/**
 * Replaces the rendered content with the app's editor, which the edit view mounts once the
 * app's globals and the page's locale are ready. The rendered content comes back with the page,
 * which *Stop editing* reloads once the editor has saved.
 */
async function mountEditor(
    noteId: string,
    login: EditLogin,
    session: EditSession,
    controls: Controls
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
        attachments: !!session.attachments
    });
}

async function fetchSession(noteId: string): Promise<EditSession | null> {
    try {
        const response = await fetch(`api/edit/session?noteId=${encodeURIComponent(noteId)}`);
        return response.ok ? await response.json() as EditSession : null;
    } catch {
        return null;
    }
}

/** The bar below the title: the *Edit* button, the password form, and the buttons while editing. */
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

    editButton.textContent = strings.edit ?? "Edit";
    passwordInput.placeholder = strings.password ?? "Password";
    find(".share-edit-login button").textContent = strings.unlock ?? "Unlock editing";
    stopButton.textContent = strings.stop ?? "Stop editing";
    logOutButton.textContent = strings.logOut ?? "Log out";

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
        setError(key: "wrongPassword" | "failed" | null) {
            error.hidden = key === null;
            error.textContent = key === null ? "" : strings[key] ?? key;
        }
    };
}
