import { loadClientEntry } from "./client_entry.js";

export default async function setupMermaid() {
    const mermaidEls = document.querySelectorAll("#content pre code.language-mermaid");
    if (mermaidEls.length === 0) {
        return;
    }

    const mermaid = await loadMermaid();

    for (const codeBlock of mermaidEls) {
        const parentPre = codeBlock.parentElement;
        if (!parentPre) {
            continue;
        }

        const mermaidDiv = document.createElement("div");
        mermaidDiv.classList.add("mermaid");
        mermaidDiv.innerHTML = codeBlock.innerHTML;
        parentPre.replaceWith(mermaidDiv);
    }

    // Mermaid 12 made ELK the default layout, `neo` the default look and `redux-color` the default
    // theme. All three are pinned to the pre-12 values so a published diagram renders the same way
    // it does in the app; front matter still overrides them per diagram.
    mermaid.initialize({ theme: "default", layout: "dagre", look: "classic" });
    mermaid.init();
}

interface Mermaid {
    initialize(config: Record<string, unknown>): void;
    init(): void;
}

/** Imports the client's mermaid through its manifest, `client/share_mermaid.json`. */
export async function loadMermaid(): Promise<Mermaid> {
    return loadClientEntry<Mermaid>("share_mermaid");
}
