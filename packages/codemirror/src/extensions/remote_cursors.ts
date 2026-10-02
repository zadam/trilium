import { type EditorState, type Range, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";

/** Another person's selection in the document, with the ends as character offsets. */
export interface RemoteCodeCursor {
    id: string;
    name: string;
    /** A `#rrggbb` color; a cursor in any other color is left out. */
    color: string;
    anchor: number;
    head: number;
}

const COLOR = /^#[0-9a-f]{6}$/i;

const setCursors = StateEffect.define<readonly RemoteCodeCursor[]>();

/** The carets and selections shown, which move with the local edits until the next update. */
const remoteCursors = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(decorations, transaction) {
        const update = transaction.effects.find((effect) => effect.is(setCursors));

        return update
            ? buildDecorations(transaction.state, update.value)
            : decorations.map(transaction.changes);
    },
    provide: (field) => EditorView.decorations.from(field)
});

/**
 * Shows these people's carets, with their names, and their selections, in place of the ones shown
 * before. Offsets past the end of the document are clamped to it. Installs itself on first use.
 */
export function setRemoteCursors(view: EditorView, cursors: readonly RemoteCodeCursor[]) {
    if (!view.state.field(remoteCursors, false)) {
        view.dispatch({
            effects: StateEffect.appendConfig.of([ remoteCursors, remoteCursorTheme ])
        });
    }

    view.dispatch({ effects: setCursors.of(cursors) });
}

/** The editor's own main selection, as character offsets. */
export function getLocalCodeSelection(view: EditorView): { anchor: number; head: number } {
    const { anchor, head } = view.state.selection.main;

    return { anchor, head };
}

class CaretWidget extends WidgetType {

    constructor(readonly name: string, readonly color: string, readonly below: boolean) {
        super();
    }

    override eq(other: CaretWidget) {
        return other.name === this.name && other.color === this.color && other.below === this.below;
    }

    toDOM() {
        const caret = document.createElement("span");
        const label = document.createElement("span");

        caret.className = this.below ? "cm-collab-caret cm-collab-caret-below" : "cm-collab-caret";
        caret.style.setProperty("--collab-color", this.color);
        label.className = "cm-collab-caret-label";
        label.textContent = this.name;
        caret.append(label);

        return caret;
    }

}

function buildDecorations(state: EditorState, cursors: readonly RemoteCodeCursor[]) {
    const decorations: Range<Decoration>[] = [];
    const clamp = (offset: number) => Math.min(Math.max(offset, 0), state.doc.length);

    for (const cursor of cursors.filter(({ color }) => COLOR.test(color))) {
        const anchor = clamp(cursor.anchor);
        const head = clamp(cursor.head);

        if (anchor !== head) {
            decorations.push(Decoration.mark({
                class: "cm-collab-selection",
                attributes: { style: `--collab-color: ${cursor.color}` }
            }).range(Math.min(anchor, head), Math.max(anchor, head)));
        }

        // A label above the first line would stand outside the editor, so it goes below.
        const below = state.doc.lineAt(head).number === 1;
        decorations.push(Decoration.widget({
            widget: new CaretWidget(cursor.name, cursor.color, below), side: 1
        }).range(head));
    }

    return Decoration.set(decorations, true);
}

const remoteCursorTheme = EditorView.baseTheme({
    ".cm-collab-caret": {
        position: "relative",
        display: "inline-block",
        width: "0",
        height: "1.2em",
        margin: "0 -1px",
        borderLeft: "2px solid var(--collab-color)",
        verticalAlign: "text-bottom",
        pointerEvents: "none",
        userSelect: "none"
    },
    // A moved caret is a new element, so the name shows again whenever its person moves.
    ".cm-collab-caret-label": {
        position: "absolute",
        bottom: "100%",
        left: "-2px",
        padding: "0 4px",
        borderRadius: "3px 3px 3px 0",
        background: "var(--collab-color)",
        color: "#fff",
        fontFamily: "var(--main-font-family, sans-serif)",
        fontSize: "11px",
        fontWeight: "600",
        lineHeight: "1.6",
        whiteSpace: "nowrap",
        animation: "cm-collab-caret-label-fade 0.4s ease 3s forwards"
    },
    ".cm-collab-caret-below .cm-collab-caret-label": {
        top: "100%",
        bottom: "auto",
        borderRadius: "0 3px 3px 3px"
    },
    "@keyframes cm-collab-caret-label-fade": {
        to: { opacity: "0" }
    },
    ".cm-collab-selection": {
        backgroundColor: "color-mix(in srgb, var(--collab-color) 25%, transparent)"
    }
});
