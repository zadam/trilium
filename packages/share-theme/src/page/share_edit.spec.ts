// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import setupShareEdit, { type EditSession } from "./share_edit.js";

const mocks = vi.hoisted(() => ({
    prepareAppHost: vi.fn(),
    mountEditView: vi.fn(),
    stop: vi.fn()
}));

vi.mock("../content/app_view.js", () => ({ prepareAppHost: mocks.prepareAppHost }));
vi.mock("../content/edit_view.js", () => ({ default: mocks.mountEditView }));

const STRINGS = {
    edit: "Edit", unlock: "Unlock", password: "Password", stop: "Stop", logOut: "Log out",
    wrongPassword: "Wrong password.", failed: "Failed."
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
        document.body.innerHTML = `<div id="content">
            <div id="title-row"><h1 id="title">Title</h1></div>
            <p class="rendered">Rendered</p></div>`;
        mocks.mountEditView.mockResolvedValue({ stop: mocks.stop });
        mocks.stop.mockResolvedValue(undefined);
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
        expect(bar?.previousElementSibling?.id).toBe("title-row");
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
            attachments: true
        });
        expect(editButton?.hidden).toBe(true);
        expect(document.querySelector<HTMLButtonElement>(".share-edit-stop")?.hidden).toBe(false);
        // Without a password there is nothing to log out of.
        expect(document.querySelector<HTMLButtonElement>(".share-edit-log-out")?.hidden).toBe(true);

        document.querySelector<HTMLButtonElement>(".share-edit-stop")?.click();
        await vi.waitFor(() => expect(reload).toHaveBeenCalled());
        expect(mocks.stop).toHaveBeenCalled();
    });

    it("places its bar after a bare title, on a page without a title row", async () => {
        document.body.innerHTML =
            `<div id="content"><h1 id="title">Title</h1><p>Rendered</p></div>`;
        answerSession({ editable: true, needsPassword: false, unlocked: true });
        await setupShareEdit();
        expect(document.querySelector(".share-edit-bar")?.previousElementSibling?.id).toBe("title");
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

    it("reports an editor that fails to mount; English without the share's texts", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        answerSession({ editable: true, needsPassword: false, unlocked: true });
        await setupShareEdit();
        expect(document.querySelector(".share-edit-start")?.textContent).toBe("Edit");
        expect(document.querySelector(".share-edit-stop")?.textContent).toBe("Stop editing");

        mocks.mountEditView.mockRejectedValueOnce(new Error("no editor"));
        answerJson(LOGIN);
        document.querySelector<HTMLButtonElement>(".share-edit-start")?.click();
        await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
        expect(document.querySelector(".share-edit-error")?.textContent).toBe("failed");

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
