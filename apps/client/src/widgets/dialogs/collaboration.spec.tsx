import type { Collaboration } from "@triliumnext/commons";
import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Component from "../../components/component";
import server from "../../services/server";
import { renderInto } from "../../test/render";
import { ParentComponent } from "../react/react_utils";
import CollaborationDialog, { parseGuestLimit } from "./collaboration";

vi.mock("../../services/i18n", () => ({ t: (key: string) => key }));
vi.mock("../../services/toast", () => ({ default: { showMessage: vi.fn(), showError: vi.fn() } }));
vi.mock("../../services/froca", () => ({
    default: { getNote: async (noteId: string) => ({ noteId, title: `Title of ${noteId}` }) }
}));

const EXISTING: Collaboration = {
    collabId: "c1",
    noteId: "n1",
    includeSubtree: true,
    viewMode: "password",
    editMode: "none",
    createMode: "none",
    slug: "team",
    maxGuests: 25,
    hostName: "Ada",
    hostColor: null,
    utcDateCreated: "2026-10-01 10:00:00.000Z",
    utcDateModified: "2026-10-01 10:00:00.000Z"
};

describe("parseGuestLimit", () => {
    it("accepts a whole number inside the range and nothing else", () => {
        expect(parseGuestLimit(" 10 ")).toBe(10);
        expect(parseGuestLimit("1")).toBe(1);
        expect(parseGuestLimit("1000")).toBe(1000);
        expect(parseGuestLimit("0")).toBeNull();
        expect(parseGuestLimit("1001")).toBeNull();
        expect(parseGuestLimit("2.5")).toBeNull();
        expect(parseGuestLimit("")).toBeNull();
        expect(parseGuestLimit("ten")).toBeNull();
    });
});

describe("CollaborationDialog", () => {
    let host: Component;
    let container: HTMLElement;
    let get: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        window.glob = { httpBaseUrl: "http://127.0.0.1:37742" } as unknown as typeof window.glob;
        host = new Component();
        get = vi.spyOn(server, "get").mockImplementation(async (url: string) =>
            url.endsWith("/presence") ? { guests: 2, people: [] } : []);
        container = renderInto(
            <ParentComponent.Provider value={host}>
                <CollaborationDialog />
            </ParentComponent.Provider>
        );
    });

    async function open(noteId = "n1") {
        await act(async () => {
            await host.handleEventInChildren("openCollaborationDialog", { noteId });
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }

    function capability(index: 0 | 1 | 2) {
        const groups = container.querySelectorAll(".collaboration-capability");
        const group = groups[index];
        if (!group) throw new Error(`No capability group ${index}.`);
        return group;
    }

    function radios(index: 0 | 1 | 2) {
        return [ ...capability(index).querySelectorAll<HTMLInputElement>("input[type=radio]") ];
    }

    async function choose(index: 0 | 1 | 2, value: string) {
        const radio = radios(index).find((input) => input.value === value);
        if (!radio) throw new Error(`No '${value}' choice in group ${index}.`);
        await act(async () => {
            radio.checked = true;
            radio.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }

    async function type(input: HTMLInputElement | null | undefined, value: string) {
        if (!input) throw new Error("No input to type into.");
        await act(async () => {
            input.value = value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
    }

    function passwordInputs() {
        return [ ...container.querySelectorAll<HTMLInputElement>("input[type=password]") ];
    }

    /** The separate-password checkboxes; the subtree toggle is a checkbox too, but not a form check. */
    function checkboxes() {
        return [ ...container.querySelectorAll<HTMLInputElement>("input.form-check-input[type=checkbox]") ];
    }

    async function check(checkbox: HTMLInputElement | undefined) {
        if (!checkbox) throw new Error("No checkbox to tick.");
        await act(async () => {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }

    function saveButton() {
        const button = container.querySelector<HTMLButtonElement>("button.collaboration-save");
        if (!button) throw new Error("No save button.");
        return button;
    }

    function guestLimitInput() {
        return container.querySelector<HTMLInputElement>("input[type=number]");
    }

    function hostNameInput() {
        return container.querySelector<HTMLInputElement>(
            "input[placeholder='collaboration.host_name_placeholder']");
    }

    async function submit() {
        const form = container.querySelector("form");
        if (!form) throw new Error("The dialog has no form.");
        await act(async () => {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
    }

    it("opens with the defaults for a private note and only offers adding notes with a subtree and editing", async () => {
        await open();

        expect(get).toHaveBeenCalledWith("collaborations?noteId=n1");
        expect(saveButton().textContent).toContain("collaboration.start");
        expect(saveButton().disabled).toBe(false);
        expect(container.querySelector(".collaboration-link")).toBeNull();
        expect(guestLimitInput()?.value).toBe("10");
        expect(radios(0).map((radio) => radio.value)).toEqual([ "open", "password" ]);
        expect(radios(1).map((radio) => radio.value)).toEqual([ "none", "open", "password" ]);
        expect(radios(2)).toHaveLength(0);

        await choose(1, "password");
        expect(radios(2)).toHaveLength(0);

        const toggle = container.querySelector(".switch-toggle");
        await act(async () => {
            toggle?.dispatchEvent(new Event("input", { bubbles: true }));
        });
        expect(radios(2).map((radio) => radio.value)).toEqual([ "none", "password" ]);

        // Adding notes takes the editing password unless asked otherwise.
        await choose(2, "password");
        expect(passwordInputs()).toHaveLength(2);
        expect(container.textContent).toContain("collaboration.password_for_edit_create");
        await check(checkboxes()[0]);
        expect(passwordInputs()).toHaveLength(4);
        expect(container.textContent).not.toContain("collaboration.password_for_edit_create");
        expect(container.textContent).toContain("collaboration.password_for_create");

        await choose(1, "none");
        expect(radios(2)).toHaveLength(0);
        expect(passwordInputs()).toHaveLength(0);
    });

    it("drops open editing behind a view password, needs every password typed and starts with them", async () => {
        const post = vi.spyOn(server, "post").mockResolvedValue({ ...EXISTING, viewMode: "password", editMode: "password", slug: null });
        await open();

        await choose(1, "open");
        expect(container.querySelector(".alert-warning")).not.toBeNull();
        expect(saveButton().disabled).toBe(false);

        await choose(0, "password");
        expect(radios(1).map((radio) => radio.value)).toEqual([ "none", "password" ]);
        expect(radios(1).find((radio) => radio.checked)?.value).toBe("password");
        expect(container.querySelector(".alert-warning")).toBeNull();
        // One password opens both by default, so there is one pair of fields and a checkbox.
        expect(passwordInputs()).toHaveLength(2);
        expect(container.textContent).toContain("collaboration.password_for_view_edit");
        expect(saveButton().disabled).toBe(true);

        await type(passwordInputs()[0], "secret-1");
        await type(passwordInputs()[1], "secret-1");
        expect(saveButton().disabled).toBe(false);

        // The subtree toggle is a checkbox too; the separate-password one is a plain form check.
        await check(checkboxes()[0]);
        expect(passwordInputs()).toHaveLength(4);
        expect(container.textContent).not.toContain("collaboration.password_for_view_edit");
        expect(container.textContent).toContain("collaboration.password_for_edit");
        expect(saveButton().disabled).toBe(true);
        await type(passwordInputs()[2], "secret-2");
        await type(passwordInputs()[3], "secret-2");
        expect(saveButton().disabled).toBe(false);

        // Adding notes behind a password follows the editing password without a field of its own.
        const toggle = container.querySelector(".switch-toggle");
        await act(async () => {
            toggle?.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await choose(2, "password");
        expect(passwordInputs()).toHaveLength(4);
        expect(container.textContent).toContain("collaboration.password_for_edit_create");
        expect(saveButton().disabled).toBe(false);

        await submit();
        expect(post).toHaveBeenCalledWith("collaborations", {
            noteId: "n1",
            includeSubtree: true,
            viewMode: "password",
            editMode: "password",
            createMode: "password",
            slug: null,
            maxGuests: 10,
            hostName: "",
            viewPassword: "secret-1",
            editPassword: "secret-2",
            createPassword: "secret-2"
        });
        expect(container.querySelector(".collaboration-link")).not.toBeNull();
        expect(saveButton().textContent).toContain("collaboration.save");
    });

    it("loads an existing collaboration, keeps its password and checks the guest limit", async () => {
        get.mockImplementation(async (url: string) =>
            url.endsWith("/presence") ? { guests: 2, people: [] } : [ EXISTING ]);
        const patch = vi.spyOn(server, "patch").mockResolvedValue({ ...EXISTING, maxGuests: 40 });
        await open();

        const link = container.querySelector<HTMLInputElement>(".collaboration-link input");
        expect(link?.value).toBe("http://127.0.0.1:37742/collab/team/");
        expect(container.querySelector(".collaboration-presence")).not.toBeNull();
        expect(container.querySelector(".collaboration-stop")).not.toBeNull();
        expect(radios(0).find((radio) => radio.checked)?.value).toBe("password");
        expect(passwordInputs()).toHaveLength(2);
        expect(guestLimitInput()?.value).toBe("25");
        expect(hostNameInput()?.value).toBe("Ada");
        expect(hostNameInput()?.maxLength).toBe(40);
        expect(saveButton().disabled).toBe(false);

        // The number box clamps a typed value into its range but lets a fraction through.
        await type(guestLimitInput(), "2.5");
        expect(saveButton().disabled).toBe(true);
        expect(container.textContent).toContain("collaboration.max_guests_invalid");

        await type(guestLimitInput(), "40");
        expect(saveButton().disabled).toBe(false);
        await type(hostNameInput(), " Grace ");

        await submit();
        expect(patch).toHaveBeenCalledWith("collaborations/c1", expect.objectContaining({
            includeSubtree: true,
            viewMode: "password",
            slug: "team",
            maxGuests: 40,
            hostName: "Grace",
            viewPassword: undefined
        }));
        expect(guestLimitInput()?.value).toBe("40");
    });
});
