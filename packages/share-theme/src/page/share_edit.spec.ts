// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import setupShareEdit, { type EditSession } from "./share_edit.js";

const mocks = vi.hoisted(() => ({
    prepareAppHost: vi.fn(),
    mountEditView: vi.fn(),
    stop: vi.fn(),
    resume: vi.fn()
}));

vi.mock("../content/app_view.js", () => ({ prepareAppHost: mocks.prepareAppHost }));
vi.mock("../content/edit_view.js", () => ({ default: mocks.mountEditView }));

const STRINGS = {
    edit: "Edit", unlock: "Unlock", password: "Password", stop: "Stop", logOut: "Log out",
    wrongPassword: "Wrong password.", failed: "Failed.", unsaved: "Not saved yet.",
    locked: "Locked."
};
const LOGIN = { csrfToken: "csrf", version: "blob1", payload: { notes: [] } };

describe("setupShareEdit", () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    let reload: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        reload = vi.fn();
        vi.spyOn(window, "location", "get").mockReturnValue({ reload } as unknown as Location);
        vi.stubGlobal("glob", { isShare: true, isStatic: false });
        document.body.dataset.noteId = "note";
        document.body.innerHTML = `
            <div id="title-row"></div>
            <div id="content">
                <header id="note-header">
                    <h1 id="title">Title</h1><div id="note-header-actions"></div>
                </header>
                <p class="rendered">Rendered</p>
            </div>`;
        mocks.mountEditView.mockResolvedValue({ stop: mocks.stop, resume: mocks.resume });
        mocks.stop.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        vi.clearAllMocks();
        delete document.body.dataset.noteId;
    });

    it("asks nothing on a static export's page, nor shows anything for a locked note", async () => {
        vi.stubGlobal("glob", { isShare: true, isStatic: true });
        await setupShareEdit();
        expect(fetchMock).not.toHaveBeenCalled();

        vi.stubGlobal("glob", { isShare: true, isStatic: false });
        delete document.body.dataset.noteId;
        await setupShareEdit();
        expect(fetchMock).not.toHaveBeenCalled();

        document.body.dataset.noteId = "note";
        answerSession({ editable: false });
        await setupShareEdit();
        expect(fetchMock).toHaveBeenCalledWith("api/edit/session?noteId=note");
        expect(document.querySelector(".share-edit-bar")).toBeNull();

        fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
        await setupShareEdit();
        fetchMock.mockRejectedValueOnce(new Error("offline"));
        await setupShareEdit();
        expect(document.querySelector(".share-edit-bar")).toBeNull();
    });

    it("unlocks an open note at a click and mounts the editor over the content", async () => {
        answerSession({
            editable: true, needsPassword: false, unlocked: false, attachments: true,
            strings: STRINGS
        });
        await setupShareEdit();
        const bar = document.querySelector(".share-edit-bar");
        expect(bar?.parentElement?.id).toBe("note-header-actions");
        const editButton = document.querySelector<HTMLButtonElement>(".share-edit-start");
        expect(editButton?.textContent).toBe("Edit");
        expect(editButton?.hidden).toBe(false);

        answerJson(LOGIN);
        editButton?.click();
        await vi.waitFor(() => expect(mocks.mountEditView).toHaveBeenCalled());

        expect(fetchMock).toHaveBeenLastCalledWith("api/edit/login", expect.objectContaining({
            method: "POST", body: JSON.stringify({ noteId: "note" })
        }));
        expect(mocks.prepareAppHost).toHaveBeenCalledWith(LOGIN.payload);
        expect(document.querySelector("#content p.rendered")).toBeNull();
        expect(document.querySelector("#content.share-editing > .share-edit-view")).not.toBeNull();
        expect(document.querySelector("#title")).not.toBeNull();
        const view = document.querySelector(".share-edit-view");
        expect(mocks.mountEditView).toHaveBeenCalledWith(view, {
            noteId: "note",
            title: document.getElementById("title"),
            payload: LOGIN.payload,
            csrfToken: "csrf",
            version: "blob1",
            attachments: true,
            statusContainer: undefined,
            toolbarContainer: undefined,
            onLocked: expect.any(Function)
        });
        expect(editButton?.hidden).toBe(true);
        expect(document.querySelector<HTMLButtonElement>(".share-edit-stop")?.hidden).toBe(false);
        // Without a password there is nothing to log out of.
        expect(document.querySelector<HTMLButtonElement>(".share-edit-log-out")?.hidden).toBe(true);

        document.querySelector<HTMLButtonElement>(".share-edit-stop")?.click();
        await vi.waitFor(() => expect(reload).toHaveBeenCalled());
        expect(mocks.stop).toHaveBeenCalled();
    });

    it("gives the editor slots in the top bar and in the footer's last-updated line", async () => {
        document.body.innerHTML = `
            <div id="top-bar"><div id="title-row"></div></div>
            <div id="content"><h1 id="title">Title</h1><p>Rendered</p></div>
            <footer id="content-footer">
                <div class="updated">Last updated on <time>today</time></div>
            </footer>`;
        answerSession({ editable: true, needsPassword: false, unlocked: true });
        await setupShareEdit();
        answerJson(LOGIN);
        document.querySelector<HTMLButtonElement>(".share-edit-start")?.click();
        await vi.waitFor(() => expect(mocks.mountEditView).toHaveBeenCalled());

        const slot = document.querySelector(
            "#content-footer .updated > .share-edit-status-slot:first-child");
        expect(slot).not.toBeNull();
        expect(mocks.mountEditView.mock.calls[0][1].statusContainer).toBe(slot);
        const toolbarSlot = document.querySelector(
            "#top-bar > .share-edit-toolbar-slot:has(+ #title-row)");
        expect(toolbarSlot).not.toBeNull();
        expect(mocks.mountEditView.mock.calls[0][1].toolbarContainer).toBe(toolbarSlot);
    });

    it("places its bar after the title of a template without the header's actions", async () => {
        document.body.innerHTML =
            `<div id="content"><h1 id="title">Title</h1><p>Rendered</p></div>`;
        answerSession({ editable: true, needsPassword: false, unlocked: true });
        await setupShareEdit();
        expect(document.querySelector(".share-edit-bar")?.previousElementSibling?.id).toBe("title");

        document.body.innerHTML =
            `<div id="content"><div id="title-row"><h1 id="title">Title</h1></div>
                <p>Rendered</p></div>`;
        answerSession({ editable: true, needsPassword: false, unlocked: true });
        await setupShareEdit();
        expect(document.querySelector(".share-edit-bar")?.previousElementSibling?.id)
            .toBe("title-row");
    });

    it("waits for a loading editor before a click on Stop reloads the page", async () => {
        let mountEditor: (view: { stop(): Promise<void> }) => void = () => {};
        mocks.mountEditView.mockReturnValueOnce(new Promise((resolve) => {
            mountEditor = resolve;
        }));
        answerSession({ editable: true, needsPassword: false, unlocked: true });
        await setupShareEdit();
        answerJson(LOGIN);
        document.querySelector<HTMLButtonElement>(".share-edit-start")?.click();
        await vi.waitFor(() => expect(mocks.mountEditView).toHaveBeenCalled());

        document.querySelector<HTMLButtonElement>(".share-edit-stop")?.click();
        await flush();
        expect(mocks.stop).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();

        mountEditor({ stop: mocks.stop });
        await vi.waitFor(() => expect(reload).toHaveBeenCalled());
        expect(mocks.stop).toHaveBeenCalled();
    });

    it("asks for the password, says when it is wrong, and logs out once editing", async () => {
        answerSession({ editable: true, needsPassword: true, unlocked: false, strings: STRINGS });
        await setupShareEdit();
        const editButton = document.querySelector<HTMLButtonElement>(".share-edit-start");
        const form = document.querySelector<HTMLFormElement>(".share-edit-login");
        const input = document.querySelector<HTMLInputElement>(".share-edit-password");
        const error = document.querySelector<HTMLElement>(".share-edit-error");
        expect(form?.hidden).toBe(true);

        editButton?.click();
        expect(editButton?.hidden).toBe(true);
        expect(form?.hidden).toBe(false);
        expect(input?.placeholder).toBe("Password");

        if (input) input.value = "nope";
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
        form?.dispatchEvent(new Event("submit", { cancelable: true }));
        await flush();
        expect(fetchMock).toHaveBeenLastCalledWith("api/edit/login", expect.objectContaining({
            body: JSON.stringify({ noteId: "note", password: "nope" })
        }));
        expect(error?.hidden).toBe(false);
        expect(error?.textContent).toBe("Wrong password.");

        fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
        form?.dispatchEvent(new Event("submit", { cancelable: true }));
        await flush();
        expect(error?.textContent).toBe("Failed.");

        if (input) input.value = "right";
        answerJson(LOGIN);
        form?.dispatchEvent(new Event("submit", { cancelable: true }));
        await vi.waitFor(() => expect(mocks.mountEditView).toHaveBeenCalled());
        expect(error?.hidden).toBe(true);
        const logOut = document.querySelector<HTMLButtonElement>(".share-edit-log-out");
        expect(logOut?.hidden).toBe(false);

        fetchMock.mockResolvedValueOnce({ ok: true, status: 204 });
        logOut?.click();
        await vi.waitFor(() => expect(reload).toHaveBeenCalled());
        expect(mocks.stop).toHaveBeenCalled();
        expect(fetchMock).toHaveBeenLastCalledWith("api/edit/logout", expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({ "x-csrf-token": "csrf" }),
            body: JSON.stringify({ noteId: "note" })
        }));
    });

    it("asks for the password again once access ends, and resumes the editor with it", async () => {
        answerSession({ editable: true, needsPassword: true, unlocked: false, strings: STRINGS });
        await setupShareEdit();
        const form = document.querySelector<HTMLFormElement>(".share-edit-login");
        const input = document.querySelector<HTMLInputElement>(".share-edit-password");
        const error = document.querySelector<HTMLElement>(".share-edit-error");
        document.querySelector<HTMLButtonElement>(".share-edit-start")?.click();
        if (input) input.value = "secret1";
        answerJson(LOGIN);
        form?.dispatchEvent(new Event("submit", { cancelable: true }));
        await vi.waitFor(() => expect(mocks.mountEditView).toHaveBeenCalled());
        const { onLocked } = mocks.mountEditView.mock.calls[0][1] as { onLocked(): void };

        answerSession({ editable: true, needsPassword: true, unlocked: false });
        onLocked();
        await vi.waitFor(() => expect(form?.hidden).toBe(false));
        expect(input?.value).toBe("");
        expect(error?.textContent).toBe("Locked.");
        expect(document.querySelector<HTMLButtonElement>(".share-edit-stop")?.hidden).toBe(false);

        // The old password no longer unlocks it.
        if (input) input.value = "secret1";
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
        form?.dispatchEvent(new Event("submit", { cancelable: true }));
        await vi.waitFor(() => expect(error?.textContent).toBe("Wrong password."));
        expect(mocks.resume).not.toHaveBeenCalled();

        if (input) input.value = "secret2";
        answerJson({ ...LOGIN, csrfToken: "csrf2" });
        form?.dispatchEvent(new Event("submit", { cancelable: true }));
        await vi.waitFor(() => expect(mocks.resume).toHaveBeenCalledWith("csrf2"));
        expect(fetchMock).toHaveBeenCalledWith("api/edit/login", expect.objectContaining({
            body: JSON.stringify({ noteId: "note", password: "secret2" })
        }));
        expect(mocks.mountEditView).toHaveBeenCalledTimes(1);
        expect(form?.hidden).toBe(true);
        expect(error?.hidden).toBe(true);

        // Logging out sends the token of the session unlocked last.
        fetchMock.mockResolvedValueOnce({ ok: true, status: 204 });
        document.querySelector<HTMLButtonElement>(".share-edit-log-out")?.click();
        await vi.waitFor(() => expect(reload).toHaveBeenCalled());
        expect(fetchMock).toHaveBeenLastCalledWith("api/edit/logout", expect.objectContaining({
            headers: expect.objectContaining({ "x-csrf-token": "csrf2" })
        }));
    });

    it("unlocks again on its own once access ends where no password is needed", async () => {
        answerSession({ editable: true, needsPassword: false, unlocked: true, strings: STRINGS });
        await setupShareEdit();
        answerJson(LOGIN);
        document.querySelector<HTMLButtonElement>(".share-edit-start")?.click();
        await vi.waitFor(() => expect(mocks.mountEditView).toHaveBeenCalled());
        const { onLocked } = mocks.mountEditView.mock.calls[0][1] as { onLocked(): void };

        answerSession({ editable: true, needsPassword: false, unlocked: false });
        answerJson({ ...LOGIN, csrfToken: "csrf3" });
        onLocked();
        await vi.waitFor(() => expect(mocks.resume).toHaveBeenCalledWith("csrf3"));
        expect(document.querySelector<HTMLFormElement>(".share-edit-login")?.hidden).toBe(true);

        // A share that stopped answering asks for the password, which then tells what is wrong.
        fetchMock.mockRejectedValueOnce(new Error("offline"));
        onLocked();
        const form = document.querySelector<HTMLFormElement>(".share-edit-login");
        await vi.waitFor(() => expect(form?.hidden).toBe(false));
    });

    it("stays in the editor while something is unsaved, and says so", async () => {
        answerSession({ editable: true, needsPassword: true, unlocked: true, strings: STRINGS });
        await setupShareEdit();
        answerJson(LOGIN);
        document.querySelector<HTMLButtonElement>(".share-edit-start")?.click();
        await vi.waitFor(() => expect(mocks.mountEditView).toHaveBeenCalled());

        mocks.stop.mockResolvedValue(false);
        document.querySelector<HTMLButtonElement>(".share-edit-stop")?.click();
        await vi.waitFor(() => expect(document.querySelector(".share-edit-error")?.textContent)
            .toBe("Not saved yet."));
        document.querySelector<HTMLButtonElement>(".share-edit-log-out")?.click();
        await flush();
        expect(mocks.stop).toHaveBeenCalledTimes(2);
        expect(fetchMock).not.toHaveBeenCalledWith("api/edit/logout", expect.anything());
        expect(reload).not.toHaveBeenCalled();
    });

    it("reports an editor that fails to mount; no labels without the share's texts", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        answerSession({ editable: true, needsPassword: false, unlocked: true });
        await setupShareEdit();
        expect(document.querySelector(".share-edit-start")?.textContent).toBe("");
        expect(document.querySelector(".share-edit-stop")?.textContent).toBe("");

        mocks.mountEditView.mockRejectedValueOnce(new Error("no editor"));
        answerJson(LOGIN);
        document.querySelector<HTMLButtonElement>(".share-edit-start")?.click();
        await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
        expect(document.querySelector(".share-edit-error")?.textContent).toBe("failed");
        // An editor that never mounted holds nothing to save.
        document.querySelector<HTMLButtonElement>(".share-edit-stop")?.click();
        await vi.waitFor(() => expect(reload).toHaveBeenCalled());

        // A page whose title went away cannot mount the editor.
        document.getElementById("title")?.remove();
        answerJson(LOGIN);
        document.querySelector<HTMLButtonElement>(".share-edit-start")?.click();
        await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(2));
    });

    function answerSession(session: EditSession) {
        answerJson(session);
    }

    function answerJson(body: unknown) {
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body });
    }
});

async function flush() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}
