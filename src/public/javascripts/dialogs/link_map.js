import server from '../services/server.js';
import noteDetailService from "../services/note_detail.js";
import libraryLoader from "../services/library_loader.js";
import treeCache from "../services/tree_cache.js";
import linkService from "../services/link.js";
import utils from "../services/utils.js";

const $linkMapContainer = $("#link-map-container");

const linkOverlays = [
    [ "Arrow", {
        location: 1,
        id: "arrow",
        length: 10,
        width: 10,
        foldback: 0.7
    } ]
];

const LINK_TYPES = [ "hyper", "image", "relation", "relation-map" ];

const $dialog = $("#link-map-dialog");
const $maxNotesInput = $("#link-map-max-notes");

let jsPlumbInstance = null;
let pzInstance = null;
let renderer = null;

async function showDialog() {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    // set default settings
    $maxNotesInput.val(10);
    LINK_TYPES.forEach(lt => $("#link-map-" + lt).prop('checked', true));

    await libraryLoader.requireLibrary(libraryLoader.LINK_MAP);

    jsPlumb.ready(() => {
        initJsPlumbInstance();

        initPanZoom();

        loadNotesAndRelations();
    });

    $dialog.modal();
}

async function loadNotesAndRelations() {
    cleanup();

    const linkTypes = LINK_TYPES.filter(lt => $(`#link-map-${lt}:checked`).length > 0);
    const maxNotes = parseInt($maxNotesInput.val());

    const activeNoteId = noteDetailService.getActiveNoteId();

    const links = await server.post(`notes/${activeNoteId}/link-map`, {
        linkTypes,
        maxNotes
    });

    const noteIds = new Set(links.map(l => l.noteId).concat(links.map(l => l.targetNoteId)));

    if (noteIds.size === 0) {
        noteIds.add(activeNoteId);
    }

    // preload all notes
    const notes = await treeCache.getNotes(Array.from(noteIds));

    const graph = new Springy.Graph();
    graph.addNodes(...noteIds);
    graph.addEdges(...links.map(l => [l.noteId, l.targetNoteId]));

    const layout = new Springy.Layout.ForceDirected(
        graph,
        400.0, // Spring stiffness
        400.0, // Node repulsion
        0.5 // Damping
    );

    function getNoteBox(noteId) {
        const noteBoxId = noteIdToId(noteId);
        const $existingNoteBox = $("#" + noteBoxId);

        if ($existingNoteBox.length > 0) {
            return $existingNoteBox;
        }

        const note = notes.find(n => n.noteId === noteId);

        const $noteBox = $("<div>")
            .addClass("note-box")
            .prop("id", noteBoxId);

        linkService.createNoteLink(noteId, note.title).then($link => {
            $noteBox.append($("<span>").addClass("title").append($link));
        });

        if (activeNoteId === noteId) {
            $noteBox.addClass("link-map-active-note");
        }

        jsPlumbInstance.getContainer().appendChild($noteBox[0]);

        jsPlumbInstance.draggable($noteBox[0], {
            start: params => {
                renderer.stop();
            },
            drag: params => {},
            stop: params => {}
        });


        return $noteBox;
    }

    renderer = new Springy.Renderer(
        layout,
        () => {},
        (edge, p1, p2) => {
            const connectionId = edge.source.id + '-' + edge.target.id;

            if ($("#" + connectionId).length > 0) {
                return;
            }

            getNoteBox(edge.source.id);
            getNoteBox(edge.target.id);

            const connection = jsPlumbInstance.connect({
                source: noteIdToId(edge.source.id),
                target: noteIdToId(edge.target.id),
                type: 'link'
            });

            connection.canvas.id = connectionId;
        },
        (node, p) => {
            const $noteBox = getNoteBox(node.id);
            const middleW = $linkMapContainer.width() / 2;
            const middleH = $linkMapContainer.height() / 2;

            $noteBox
                .css("left", (middleW + p.x * 100) + "px")
                .css("top", (middleH + p.y * 100) + "px");
        },
        () => {},
        () => {},
        () => {
            jsPlumbInstance.repaintEverything();
        }
    );

    renderer.start();
}

function initPanZoom() {
    if (pzInstance) {
        return;
    }

    pzInstance = panzoom($linkMapContainer[0], {
        maxZoom: 2,
        minZoom: 0.3,
        smoothScroll: false,
        filterKey: function (e, dx, dy, dz) {
            // if ALT is pressed then panzoom should bubble the event up
            // this is to preserve ALT-LEFT, ALT-RIGHT navigation working
            return e.altKey;
        }
    });
}

function cleanup() {
    if (renderer) {
        renderer.stop();
    }

    // delete all endpoints and connections
    // this is done at this point (after async operations) to reduce flicker to the minimum
    jsPlumbInstance.deleteEveryEndpoint();

    // without this we still end up with note boxes remaining in the canvas
    $linkMapContainer.empty();

    // reset zoom/pan
    pzInstance.zoomTo(0, 0, 1);
    pzInstance.moveTo(0, 0);
}

function initJsPlumbInstance() {
    if (jsPlumbInstance) {
        cleanup();

        return;
    }

    jsPlumbInstance = jsPlumb.getInstance({
        Endpoint: ["Blank", {}],
        ConnectionOverlays: linkOverlays,
        PaintStyle: { stroke: "var(--muted-text-color)", strokeWidth: 1 },
        HoverPaintStyle: { stroke: "var(--main-text-color)", strokeWidth: 1 },
        Container: $linkMapContainer.attr("id")
    });

    jsPlumbInstance.registerConnectionType("link", { anchor: "Continuous", connector: "Straight", overlays: linkOverlays });
}

function noteIdToId(noteId) {
    return "link-map-note-" + noteId;
}

$(".link-map-settings").change(loadNotesAndRelations);

$maxNotesInput.on("input", loadNotesAndRelations);

export default {
    showDialog
};