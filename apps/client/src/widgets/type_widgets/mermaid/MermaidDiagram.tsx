import "./MermaidDiagram.css";

import type VanillaCodeMirror from "@triliumnext/codemirror";
import { MERMAID_ATTACHMENT_MIME } from "@triliumnext/commons";
import fullscreenIcon from "boxicons/svg/regular/bx-fullscreen.svg?raw";
import zoomInIcon from "boxicons/svg/regular/bx-zoom-in.svg?raw";
import zoomOutIcon from "boxicons/svg/regular/bx-zoom-out.svg?raw";
import clsx from "clsx";
import type { RefObject } from "preact";
import { lazy, Suspense } from "preact/compat";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import { t } from "../../../services/i18n";
import { renderMermaidSvg } from "../../../services/mermaid";
import type { SourceEmbedProps } from "../../../services/source_embeds";
import OverlayControlGroup, { ZoomControls } from "../../react/OverlayControlGroup";
import { RawHtmlBlock } from "../../react/RawHtml";
import { useZoomPanPinch, useZoomPanWheel } from "../../react/zoom_pan";
import { useZoomPanKeyboard, ZOOM_PAN_VIEWPORT_CLASS } from "../../react/zoom_pan_keyboard";
import type { DisplayMode } from "../helpers/split_editor_mode";
import mermaidLinter from "../linters/mermaid";
import {
    type ContentEmbedTool,
    type ContentEmbedToolbarItem,
    type ContentEmbedToolProvider,
    showContentEmbedFullscreen,
    useContentEmbedDisplayMode
} from "../text/content_embed_tools";
import { useEditableEmbed } from "../text/editable_embed";

const CodeEmbedEditor = lazy(() => import("../code/CodeEmbedEditor"));

/**
 * A Mermaid diagram in an embed: its source in CodeMirror, the diagram in a zoom/pan viewer, or
 * both side by side, as the display mode of its embed picks. The zoom and fullscreen are buttons of
 * the toolbar of the embed. The source is kept inline or in an attachment, see
 * `SOURCE_EMBED_TYPES`.
 */
export default function MermaidDiagram({ content, editor }: SourceEmbedProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [ previewEl, setPreviewEl ] = useState<HTMLDivElement | null>(null);
    const [ source, setSource ] = useState(content);
    const { svg, error } = useMermaidRender(source);

    const zoom = useZoomPanPinch({ minScale: MIN_ZOOM, maxScale: MAX_ZOOM });
    const [ tools ] = useState(() => new MermaidDiagramTools(rootRef));
    const { canEdit } = useEditableEmbed(rootRef, {
        editor,
        note: null,
        tools,
        focusTarget: ".cm-content"
    });
    const embedMode = useContentEmbedDisplayMode(rootRef);
    const mode = canEdit ? embedMode : "preview";
    tools.setState(zoom, mode);

    // A source saved elsewhere, or undone, replaces the shown one unless it has unsaved edits.
    useEffect(() => {
        if (editor?.getUnsavedContent() === undefined) {
            setSource(content);
        }
    }, [ content ]);
    useZoomPanKeyboard(zoom.ref, previewEl);
    useZoomPanWheel(zoom.ref, previewEl, true);

    const setupEditor = useCallback((view: VanillaCodeMirror) => {
        view.setNamedExtension("mermaid-lint", mermaidLinter());
    }, []);

    const preview = (
        <div
            ref={setPreviewEl}
            tabIndex={0}
            role="group"
            aria-label={t("svg.preview")}
            className={clsx("mermaid-diagram-preview", ZOOM_PAN_VIEWPORT_CLASS, error && "on-error")}
        >
            <TransformWrapper
                ref={zoom.ref}
                minScale={MIN_ZOOM}
                maxScale={MAX_ZOOM}
                centerOnInit
                centerZoomedOut
                wheel={zoom.wheel}
                doubleClick={{ mode: "reset" }}
                onTransform={zoom.onTransform}
            >
                <TransformComponent
                    wrapperClass="mermaid-diagram-viewport"
                    contentClass="mermaid-diagram-content"
                >
                    <RawHtmlBlock className="render-container" html={svg} />
                </TransformComponent>
            </TransformWrapper>
            {error && <div className="mermaid-diagram-error">{error}</div>}
            {!canEdit && (
                <OverlayControlGroup className="mermaid-diagram-controls" placement="bottom-end">
                    <ZoomControls
                        percent={zoom.scale * 100}
                        canZoomIn={zoom.canZoomIn}
                        canZoomOut={zoom.canZoomOut}
                        onZoomIn={zoom.zoomIn}
                        onZoomOut={zoom.zoomOut}
                        onReset={zoom.reset}
                    />
                </OverlayControlGroup>
            )}
        </div>
    );

    return (
        <div ref={rootRef} className={`mermaid-diagram display-mode-${mode}`}>
            {mode !== "preview" && editor && (
                <div className="mermaid-diagram-source">
                    <Suspense fallback={null}>
                        <CodeEmbedEditor
                            note={null}
                            editor={editor}
                            content={source}
                            mime={MERMAID_ATTACHMENT_MIME}
                            onClose={setSource}
                            onChange={setSource}
                            onReady={setupEditor}
                        />
                    </Suspense>
                </div>
            )}
            {mode !== "source" && preview}
        </div>
    );
}

/**
 * The SVG of the Mermaid `source`, rendered a moment after it stops changing. While the source
 * fails to render, `error` holds why and `svg` keeps the last diagram that rendered.
 */
function useMermaidRender(source: string) {
    const [ svg, setSvg ] = useState("");
    const [ error, setError ] = useState<string | null>(null);
    const isFirstRender = useRef(true);

    useEffect(() => {
        let isCurrent = true;
        const delay = isFirstRender.current ? 0 : RENDER_DELAY;
        isFirstRender.current = false;

        const timeout = setTimeout(async () => {
            try {
                const rendered = await renderMermaidSvg(source);
                if (!isCurrent) return;
                setSvg(rendered);
                setError(null);
            } catch (e) {
                if (!isCurrent) return;
                setError((e as Error)?.message ?? String(e));
            }
        }, delay);

        return () => {
            isCurrent = false;
            clearTimeout(timeout);
        };
    }, [ source ]);

    return { svg, error };
}

type ZoomState = ReturnType<typeof useZoomPanPinch>;

/** The zoom and fullscreen of a Mermaid diagram, as buttons of the toolbar of its embed. */
class MermaidDiagramTools implements ContentEmbedToolProvider {
    readonly hiddenToolbarItems: readonly ContentEmbedToolbarItem[] = [
        "contentEmbedBoxSizeDropdown", "toggleContentEmbedTitle", "convertEmbedToLink"
    ];
    readonly hasDisplayModes = true;
    private zoom: ZoomState | null = null;
    private isDiagramShown = true;
    private listeners = new Set<() => void>();
    private shownTools = "";

    constructor(private readonly rootRef: RefObject<HTMLElement | null>) {}

    /** Follows the zoom state and the display mode of the latest render. */
    setState(zoom: ZoomState, mode: DisplayMode) {
        this.zoom = zoom;
        this.isDiagramShown = mode !== "source";
        // Notifies after the render, as a listener updates the toolbar of the editor.
        queueMicrotask(() => this.update());
    }

    getTools(): ContentEmbedTool[] {
        const zoom = this.zoom;
        if (!zoom) return [];
        if (!this.isDiagramShown) return this.getFullscreenTools();

        return [
            {
                id: "zoomOut",
                label: t("zoom_controls.zoom_out"),
                icon: zoomOutIcon,
                isEnabled: zoom.canZoomOut,
                group: "zoom"
            },
            {
                id: "resetZoom",
                label: t("zoom_controls.reset"),
                text: `${Math.round(zoom.scale * 100)}%`,
                group: "zoom"
            },
            {
                id: "zoomIn",
                label: t("zoom_controls.zoom_in"),
                icon: zoomInIcon,
                isEnabled: zoom.canZoomIn,
                group: "zoom"
            },
            ...this.getFullscreenTools()
        ];
    }

    execute(id: string) {
        const zoom = this.zoom;
        if (id === "fullscreen") {
            showContentEmbedFullscreen(this.rootRef.current);
        } else if (id === "zoomOut") {
            zoom?.zoomOut();
        } else if (id === "zoomIn") {
            zoom?.zoomIn();
        } else if (id === "resetZoom") {
            zoom?.reset();
        }
    }

    subscribe(callback: () => void) {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    /** Fullscreen, while the title row of the embed, which has a button for it, is hidden. */
    private getFullscreenTools(): ContentEmbedTool[] {
        const embed = this.rootRef.current?.closest<HTMLElement>(".include-note");
        const { hideTitle, boxSize } = embed?.dataset ?? {};
        if (hideTitle !== "true" || (boxSize !== "medium" && boxSize !== "full")) {
            return [];
        }

        return [
            { id: "fullscreen", label: t("common.fullscreen"), icon: fullscreenIcon, group: "zoom" }
        ];
    }

    private update() {
        const shownTools = JSON.stringify(this.getTools());
        if (shownTools !== this.shownTools) {
            this.shownTools = shownTools;
            for (const listener of this.listeners) {
                listener();
            }
        }
    }
}

/** Zoom bounds, as a multiple of the diagram fitted to the viewer. */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;
/** How long the source has to stay unchanged before the diagram renders again, in milliseconds. */
const RENDER_DELAY = 300;
