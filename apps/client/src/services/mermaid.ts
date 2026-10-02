import type { MermaidConfig } from "mermaid";

export function getMermaidConfig(): MermaidConfig {
    const documentStyle = window.getComputedStyle(document.documentElement);
    const mermaidTheme = documentStyle.getPropertyValue("--mermaid-theme") as "default";

    return {
        theme: mermaidTheme.trim() as "default",
        // Mermaid 12 made ELK the default layout and `neo` the default look. Both are pinned to the
        // pre-12 values so diagrams already stored in notes keep rendering as they were written;
        // front matter still overrides either one per diagram.
        layout: "dagre",
        look: "classic",
        securityLevel: "antiscript",
        flowchart: { useMaxWidth: false },
        sequence: { useMaxWidth: false },
        gantt: { useMaxWidth: false },
        class: { useMaxWidth: false },
        state: { useMaxWidth: false },
        pie: { useMaxWidth: true },
        journey: { useMaxWidth: false },
        gitGraph: { useMaxWidth: false }
    };
}

let renderCount = 0;

/**
 * Draws a Mermaid diagram as the app's diagram editor shows it and stores its preview, in `theme`
 * when given and otherwise in the one the app's theme sets. An empty source draws nothing, and a
 * source Mermaid cannot parse rejects with Mermaid's error.
 */
export async function renderMermaidSvg(
    source: string, theme?: MermaidConfig["theme"]
): Promise<string> {
    const mermaid = (await import("mermaid")).default;

    if (!source.trim()) {
        return "";
    }

    mermaid.initialize({
        startOnLoad: false,
        // A source Mermaid cannot parse rejects without leaving its error drawing in the body.
        suppressErrorRendering: true,
        ...getMermaidConfig(),
        ...(theme ? { theme } : {})
    });

    renderCount++;
    const { svg } = await mermaid.render(`mermaid-graph-${renderCount}`, source);
    return postprocessMermaidSvg(svg);
}

/**
 * Processes the output of a Mermaid SVG render before it should be delivered to the user.
 *
 * <p>
 * Currently this fixes <br> to <br/> and replaces named HTML entities like &nbsp; with their
 * numeric equivalents, both of which would otherwise cause invalid XML when the SVG is saved
 * as an attachment.
 *
 * @param svg the Mermaid SVG to process.
 * @returns the processed SVG.
 */
export function postprocessMermaidSvg(svg: string) {
    return svg
        .replaceAll(/<br\s*>/ig, "<br/>")
        .replaceAll(/&nbsp;/g, "&#160;");
}
