import type { Collaboration, CollabPerson } from "@triliumnext/commons";
import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";

// The badge's menu is a Dropdown, which wires Bootstrap; a fake instance is enough here.
vi.mock("bootstrap", () => ({
    Dropdown: { getOrCreateInstance: () => ({ show() {}, hide() {}, update() {}, dispose() {}, _menu: null }) },
    Tooltip: Object.assign(class {}, { getInstance: () => null })
}));

// i18next is not initialized under test; the key, with the name it was given, stands in.
vi.mock("../../services/i18n", () => ({
    t: (key: string, options?: { name?: string }) => (options?.name ? `${key}:${options.name}` : key)
}));

const state = vi.hoisted(() => ({
    collaborations: [] as Collaboration[],
    presences: new Map<string, { guests: number; people: CollabPerson[] }>(),
    syncServerHost: ""
}));
const actions = vi.hoisted(() => ({
    renameCollabPerson: vi.fn(async () => {}),
    recolorCollabPerson: vi.fn(async () => {}),
    removeCollabPerson: vi.fn(async () => {}),
    prompt: vi.fn(async (): Promise<string | null> => null),
    confirm: vi.fn(async () => false)
}));
vi.mock("./collaboration", () => ({
    useCollaborationsInScope: () => state.collaborations,
    useCollabPresences: () => state.presences,
    renameCollabPerson: actions.renameCollabPerson,
    recolorCollabPerson: actions.recolorCollabPerson,
    removeCollabPerson: actions.removeCollabPerson
}));
vi.mock("../../services/dialog", () => ({
    default: { prompt: actions.prompt, confirm: actions.confirm }
}));
const tooltipStub = vi.hoisted(() => ({ showTooltip: () => {}, hideTooltip: () => {} }));
vi.mock("../react/hooks", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../react/hooks")>()),
    useNoteContext: () => ({ note: { noteId: "n1" } }),
    useNoteTitle: (noteId: string | undefined) => (noteId === "n2" ? "Second note" : undefined),
    useTriliumOption: () => [ state.syncServerHost, () => {} ],
    useTooltip: () => tooltipStub
}));

import { renderInto } from "../../test/render";
import CollabPeopleBadge from "./CollabPeopleBadge";

// happy-dom has no ResizeObserver; the Dropdown only needs observe and disconnect.
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;

const COLLAB = { collabId: "c1", noteId: "n1" } as Collaboration;

function person(id: string, name: string, fields: Partial<CollabPerson> = {}): CollabPerson {
    return { id, name, color: "#2066df", isHost: false, noteId: "n1", editing: false, ...fields };
}

function show(people: CollabPerson[], syncServerHost = "") {
    state.collaborations = [ COLLAB ];
    state.presences = new Map([ [ "c1", { guests: people.filter((p) => !p.isHost).length, people } ] ]);
    state.syncServerHost = syncServerHost;
    return renderInto(<CollabPeopleBadge />);
}

async function openMenu(container: HTMLElement) {
    const dropdown = container.querySelector(".dropdown");
    if (!dropdown) throw new Error("no badge");
    await act(async () => {
        window.$(dropdown).children("button:not([aria-expanded=true])").trigger("click");
    });
}

/** Opens the badge's menu, which running a row closes, and the person's submenu in it. */
async function openPerson(container: HTMLElement, name: string) {
    await openMenu(container);
    const row = [ ...document.querySelectorAll<HTMLElement>(".collab-people-person") ]
        .find((element) => element.querySelector(".collab-people-label")?.textContent === name);
    if (!row) throw new Error(`no row for ${name}`);
    await act(async () => {
        row.click();
    });
}

async function clickItem(label: string) {
    const item = [ ...document.querySelectorAll<HTMLElement>(".dropdown-item") ]
        .find((element) => element.textContent === label);
    if (!item) throw new Error(`no item ${label}`);
    await act(async () => {
        item.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

const HOST = person("host", "Ada", { isHost: true, noteId: "n2", editing: true });
const GRACE = person("p-grace", "Grace", { noteId: "n2" });

describe("CollabPeopleBadge", () => {
    it("counts who is here while a guest is, and stays away otherwise", async () => {
        expect(show([ HOST ]).querySelector(".collab-people-badge")).toBeNull();
        expect(show([ HOST, GRACE ], "https://sync.example").querySelector(".collab-people-badge"))
            .toBeNull();

        const container = show([ HOST, GRACE, person("p-alan", "Alan") ]);
        expect(container.querySelector(".collab-people-badge")?.textContent).toContain("3");

        await openMenu(container);
        const rows = [ ...document.querySelectorAll(".collab-people-person") ];
        expect(rows.map((row) => row.querySelector(".collab-people-label")?.textContent))
            .toEqual([ "Ada", "Grace", "Alan" ]);
        expect(rows.map((row) => row.querySelector(".collab-people-host")?.textContent ?? null))
            .toEqual([ "collab_people.host", null, null ]);
        expect(rows.map((row) => row.querySelector(".collab-people-note")?.textContent ?? null))
            .toEqual([ "Second note", "Second note", null ]);
        expect(rows.map((row) => row.querySelector(".collab-people-initial")?.textContent))
            .toEqual([ "A", "G", "A" ]);
    });

    it("renames anyone and removes only guests, each after the host says so", async () => {
        const container = show([ HOST, GRACE ]);

        await openPerson(container, "Ada");
        expect(document.body.textContent).not.toContain("collab_people.remove");
        actions.prompt.mockResolvedValueOnce("Ada Lovelace");
        await clickItem("collab_people.rename");
        expect(actions.prompt).toHaveBeenCalledWith(expect.objectContaining({ defaultValue: "Ada" }));
        expect(actions.renameCollabPerson).toHaveBeenCalledWith("c1", "host", "Ada Lovelace");

        await openPerson(container, "Grace");
        actions.confirm.mockResolvedValueOnce(false);
        await clickItem("collab_people.remove");
        expect(actions.confirm).toHaveBeenCalledWith("collab_people.remove_confirm:Grace");
        expect(actions.removeCollabPerson).not.toHaveBeenCalled();

        await openPerson(container, "Grace");
        actions.confirm.mockResolvedValueOnce(true);
        await clickItem("collab_people.remove");
        expect(actions.removeCollabPerson).toHaveBeenCalledWith("c1", "p-grace");

        // The host recolors anyone, themselves included, from the palette.
        await openPerson(container, "Grace");
        const colors = [ ...document.querySelectorAll<HTMLElement>(".dropdown-item.dropdown-submenu") ]
            .find((row) => row.textContent === "collab_people.color");
        if (!colors) throw new Error("no color submenu");
        await act(async () => {
            colors.click();
        });
        const blue = [ ...document.querySelectorAll<HTMLElement>(".dropdown-item") ]
            .find((row) => row.textContent === "collab_people.colors.blue");
        expect(blue?.getAttribute("aria-checked")).toBe("true");
        await clickItem("collab_people.colors.red");
        expect(actions.recolorCollabPerson).toHaveBeenCalledWith("c1", "p-grace", "#d22a1e");

        // A rename the host cancels changes nothing.
        actions.renameCollabPerson.mockClear();
        await openPerson(container, "Grace");
        await clickItem("collab_people.rename");
        expect(actions.renameCollabPerson).not.toHaveBeenCalled();
    });
});
