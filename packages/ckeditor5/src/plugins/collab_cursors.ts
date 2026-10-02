import "../theme/collab_cursors.css";

import { type ModelElement, type ModelPosition, type ModelWriter, Plugin } from "ckeditor5";

/** Another person's selection in the note, with the ends as model paths in the `main` root. */
export interface RemoteCursor {
    id: string;
    name: string;
    /** A `#rrggbb` color; a cursor in any other color is left out. */
    color: string;
    anchor: readonly number[];
    head: readonly number[];
}

const CARET = "collab-caret";
const SELECTION = "collab-selection";
const COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Draws other people's carets, with their names, and their selections, in their colors. Both are
 * markers of the editing view alone: they never reach `getData()`, the undo stack or `change:data`,
 * so they never cause a save. A path the content no longer has is clamped to the nearest position
 * a caret can take.
 */
export default class CollabCursors extends Plugin {

    static get pluginName() {
        return "CollabCursors" as const;
    }

    /** The cursors shown now. */
    private cursors: RemoteCursor[] = [];
    /**
     * Everyone's latest name and color, kept after they leave: removing a selection's highlight
     * reads the color again.
     */
    private people = new Map<string, RemoteCursor>();
    /** What each person's markers show, so an update redraws only the people who changed. */
    private drawn = new Map<string, string>();

    init() {
        const editor = this.editor;

        editor.conversion.for("editingDowncast").markerToElement({
            model: CARET,
            view: (data, { writer }) => {
                const cursor = this.getPerson(data.markerName);

                return writer.createUIElement("span", { class: "ck-collab-caret" },
                    function (domDocument) {
                        const caret = this.toDomElement(domDocument);
                        const label = domDocument.createElement("span");

                        caret.style.setProperty("--collab-color", cursor.color);
                        label.className = "ck-collab-caret__label";
                        label.textContent = cursor.name;
                        caret.append(label);

                        return caret;
                    });
            }
        });
        editor.conversion.for("editingDowncast").markerToHighlight({
            model: SELECTION,
            view: (data) => ({
                classes: "ck-collab-selection",
                attributes: { style: `--collab-color: ${this.getPerson(data.markerName).color}` }
            })
        });

        // Replacing the content takes the markers with it.
        this.listenTo(editor.data, "set", () => {
            this.drawn.clear();
            this.draw();
        }, { priority: "lowest" });
    }

    /** Shows these people's selections, in place of the ones shown before. */
    setRemoteCursors(cursors: readonly RemoteCursor[]) {
        this.cursors = cursors.filter((cursor) => COLOR.test(cursor.color));

        for (const cursor of this.cursors) {
            this.people.set(cursor.id, cursor);
        }

        this.draw();
    }

    /** This editor's own selection as model paths, or null without one. */
    getLocalSelection(): { anchor: number[]; head: number[] } | null {
        const { anchor, focus } = this.editor.model.document.selection;

        return anchor && focus ? { anchor: [ ...anchor.path ], head: [ ...focus.path ] } : null;
    }

    /** The person a marker belongs to; a marker is only added for someone in `people`. */
    private getPerson(markerName: string) {
        return this.people.get(markerName.slice(markerName.indexOf(":") + 1)) as RemoteCursor;
    }

    private draw() {
        const model = this.editor.model;
        const root = model.document.getRoot("main");

        model.change((writer) => {
            const shown = new Set(this.cursors.map((cursor) => cursor.id));

            for (const id of this.drawn.keys()) {
                if (!shown.has(id)) {
                    removeMarkers(writer, id);
                    this.drawn.delete(id);
                }
            }

            for (const cursor of root ? this.cursors : []) {
                const anchor = this.positionNear(cursor.anchor);
                const head = this.positionNear(cursor.head);
                const caret = model.schema.getNearestSelectionRange(head)?.start ?? head;
                const [ start, end ] = anchor.isBefore(head) ? [ anchor, head ] : [ head, anchor ];
                const drawing = JSON.stringify([
                    cursor.name, cursor.color, caret.path, start.path, end.path
                ]);

                if (this.drawn.get(cursor.id) === drawing) {
                    continue;
                }

                // A new marker, rather than a moved one, redraws a renamed person's label.
                removeMarkers(writer, cursor.id);
                writer.addMarker(`${CARET}:${cursor.id}`, {
                    range: model.createRange(caret), usingOperation: false, affectsData: false
                });

                if (!start.isEqual(end)) {
                    writer.addMarker(`${SELECTION}:${cursor.id}`, {
                        range: model.createRange(start, end),
                        usingOperation: false,
                        affectsData: false
                    });
                }

                this.drawn.set(cursor.id, drawing);
            }
        });
    }

    /** The position at the path, or the nearest one the content has: each step is clamped. */
    private positionNear(path: readonly number[]): ModelPosition {
        const model = this.editor.model;
        let parent = model.document.getRoot("main") as ModelElement;

        for (const [ depth, step ] of path.entries()) {
            const offset = Math.min(Math.max(step, 0), parent.maxOffset);
            const child = parent.getChild(parent.offsetToIndex(offset));

            if (depth === path.length - 1 || !child?.is("element")) {
                return model.createPositionAt(parent, offset);
            }

            parent = child;
        }

        return model.createPositionAt(parent, 0);
    }

}

function removeMarkers(writer: ModelWriter, id: string) {
    for (const group of [ CARET, SELECTION ]) {
        if (writer.model.markers.has(`${group}:${id}`)) {
            writer.removeMarker(`${group}:${id}`);
        }
    }
}

declare module "ckeditor5" {
    interface PluginsMap {
        [CollabCursors.pluginName]: CollabCursors;
    }
}
