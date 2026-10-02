import "mind-elixir/style";
import "./mind_map_editor.css";

import MindElixir, { DARK_THEME, type MindElixirData, type Operation, THEME } from "mind-elixir";

import type { EditorHandle } from "../../collab_editor.js";
import { renderMindMapPreviewSvg } from "../../widgets/type_widgets/mind_map/export.js";
import { renderNodeLinks } from "../../widgets/type_widgets/mind_map/links.js";
import { sanitizeMindMapData } from "../../widgets/type_widgets/mind_map/sanitize.js";
import type { GuestSaver } from "../guest_saver.js";
import { isPageDark, onPageThemeChange } from "../page_theme.js";

/**
 * The guest page's mind map editor: Mind Elixir with its own toolbar, menu and keys, loading and
 * saving the map as the app does. The picture the app stores of a map is the preview that the
 * saver sends with the content; it fetches the map's pictures through the guest routes, which
 * the relative addresses that nodes hold resolve to on this page.
 */
export default function mountMindMapEditor(
    host: HTMLElement, content: string, saver: GuestSaver, newTopic: string
): EditorHandle {
    host.classList.add("collab-mind-map-host");
    // Mind Elixir empties the element it is given.
    const container = document.createElement("div");
    container.className = "collab-mind-map";
    host.replaceChildren(container);

    const mind = new MindElixir({
        el: container,
        editable: true,
        newTopicName: newTopic,
        theme: isPageDark() ? DARK_THEME : THEME
    });
    onPageThemeChange((dark) => mind.changeTheme(dark ? DARK_THEME : THEME));
    let applyingRemote = false;
    const load = (text: string) => {
        mind.init(parseMindMap(text, newTopic));
        renderNodeLinks(mind.nodes);
    };
    const scheduleSave = () => {
        if (!applyingRemote) {
            saver.scheduleContent(() => mind.getDataString());
        }
    };

    load(content);
    mind.bus.addListener("operation", (operation: Operation) => {
        if (operation.name !== "beginEdit") {
            scheduleSave();
        }
    });
    mind.bus.addListener("changeDirection", scheduleSave);
    // Mind Elixir builds a node's link anew on every layout.
    mind.bus.addListener("linkDiv", () => renderNodeLinks(mind.nodes));

    saver.preview = () => renderMindMapPreviewSvg(mind);

    return {
        get: () => mind.getDataString(),
        set: (text) => {
            applyingRemote = true;

            try {
                load(text);
            } finally {
                applyingRemote = false;
            }
        },
        focusStart: () => {
            mind.selectNode(mind.findEle(mind.nodeData.id));
            mind.map.focus();
        }
    };
}

/**
 * The map a note holds, cleaned as the app cleans it before Mind Elixir draws it, or a new map
 * when the content is not one, as after a switch from another type.
 */
export function parseMindMap(content: string, newTopic: string): MindElixirData {
    try {
        const data: unknown = JSON.parse(content);

        if (data && typeof data === "object" && "nodeData" in data) {
            const map = sanitizeMindMapData(data as MindElixirData);
            // The editor draws the map in the page's theme, as the app does in its own.
            delete map.theme;
            return map;
        }
    } catch {
        // Not a map: the editor starts a new one.
    }

    return MindElixir.new(newTopic);
}
