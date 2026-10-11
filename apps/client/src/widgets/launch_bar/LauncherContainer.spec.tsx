import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import Component from "../../components/component.js";
import type FNote from "../../entities/fnote.js";
import { buildNote } from "../../test/easy-froca.js";
import { ParentComponent } from "../react/react_utils.js";
import { useLauncherChildNotes } from "./LauncherContainer.js";

let container: HTMLDivElement;

afterEach(() => {
    act(() => render(null, container));
    container.remove();
});

function mountHook() {
    const host = new Component();
    let childNotes: FNote[] | undefined;

    function Harness() {
        childNotes = useLauncherChildNotes();
        return null;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => render(<ParentComponent.Provider value={host}><Harness /></ParentComponent.Provider>, container));

    return { host, getChildNotes: () => childNotes };
}

// The hook resolves the root note, re-renders, then resolves the children — each async step
// needs its own act() round so the intermediate state commits and the next effect fires.
async function flush() {
    for (let i = 0; i < 3; i++) {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve)); });
    }
}

describe("useLauncherChildNotes", () => {
    it("swaps to fresh FNote refs on frocaReloaded (protected launcher titles decrypt after unlock)", async () => {
        // Locked protected session: the launcher note's title is the encrypted placeholder.
        buildNote({
            id: "_lbVisibleLaunchers",
            title: "Visible Launchers",
            children: [ { id: "_lbTestLauncher", title: "[protected]", type: "launcher" } ]
        });

        const { host, getChildNotes } = mountHook();
        await flush();

        const staleNote = getChildNotes()?.[0];
        expect(staleNote?.title).toBe("[protected]");

        // Unlocking rebuilds froca from scratch: same noteIds, brand-new FNote instances,
        // now with decrypted titles. The old instances stay orphaned in the hook's state
        // unless frocaReloaded triggers a re-resolve.
        buildNote({
            id: "_lbVisibleLaunchers",
            title: "Visible Launchers",
            children: [ { id: "_lbTestLauncher", title: "My secret launcher", type: "launcher" } ]
        });

        await act(async () => { await host.handleEvent("frocaReloaded", {}); });
        await flush();

        const freshNote = getChildNotes()?.[0];
        expect(freshNote?.title).toBe("My secret launcher");
        expect(freshNote).not.toBe(staleNote);
    });
});
