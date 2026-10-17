import { render } from "preact";
import { useRef } from "preact/hooks";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import type { DisplayMode } from "../helpers/split_editor_mode";
import { useContentEmbedDisplayMode } from "./content_embed_tools";

const containers: HTMLElement[] = [];

afterEach(() => {
    for (const container of containers) {
        act(() => render(null, container));
        container.remove();
    }
    containers.length = 0;
});

describe("useContentEmbedDisplayMode", () => {
    it("follows the mode of the embed, or its Editable flag while it has none", async () => {
        const figure = document.createElement("figure");
        figure.className = "include-note";
        const probe = await mountProbe(figure);
        expect(probe.mode).toBe("preview");

        await act(async () => {
            figure.dataset.editable = "true";
            await Promise.resolve();
        });
        expect(probe.mode).toBe("split");

        await act(async () => {
            figure.dataset.displayMode = "source";
            await Promise.resolve();
        });
        expect(probe.mode).toBe("source");

        await act(async () => {
            figure.dataset.displayMode = "preview";
            await Promise.resolve();
        });
        expect(probe.mode).toBe("preview");
    });

    it("shows both outside an embed", async () => {
        expect((await mountProbe(document.createElement("div"))).mode).toBe("split");
    });

    it("finds the embed that content rendered apart joins later", async () => {
        const container = document.createElement("div");
        const probe = await mountProbe(container, false);
        expect(probe.mode).toBe("preview");

        const figure = document.createElement("figure");
        figure.className = "include-note";
        figure.dataset.displayMode = "source";
        document.body.append(figure);
        await act(async () => {
            figure.append(container);
            await Promise.resolve();
        });
        expect(probe.mode).toBe("source");

        await act(async () => {
            figure.dataset.displayMode = "split";
            await Promise.resolve();
        });
        expect(probe.mode).toBe("split");
        figure.remove();
    });
});

async function mountProbe(parent: HTMLElement, isConnected = true) {
    if (isConnected) {
        document.body.append(parent);
    }
    containers.push(parent);

    const probe = { mode: null as DisplayMode | null };
    function Probe() {
        const ref = useRef<HTMLDivElement>(null);
        probe.mode = useContentEmbedDisplayMode(ref);
        return <div ref={ref} />;
    }

    await act(async () => render(<Probe />, parent));
    return probe;
}
