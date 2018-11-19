import server from "./server.js";
import noteDetailService from "./note_detail.js";
import linkService from "./link.js";
import libraryLoader from "./library_loader.js";
import treeService from "./tree.js";
import contextMenuWidget from "./context_menu.js";
import infoService from "./info.js";
import attributeAutocompleteService from "./attribute_autocomplete.js";
import promptDialog from "../dialogs/prompt.js";
import infoDialog from "../dialogs/info.js";
import confirmDialog from "../dialogs/confirm.js";

const $component = $("#note-detail-relation-map");
const $relationMapContainer = $("#relation-map-container");
const $createChildNote = $("#relation-map-create-child-note");
const $zoomInButton = $("#relation-map-zoom-in");
const $zoomOutButton = $("#relation-map-zoom-out");
const $resetPanZoomButton = $("#relation-map-reset-pan-zoom");

let mapData;
let jsPlumbInstance;
// outside of mapData because they are not persisted in the note content
let relations;
let pzInstance;

const uniDirectionalOverlays = [
    [ "Arrow", {
        location: 1,
        id: "arrow",
        length: 14,
        foldback: 0.8
    } ],
    [ "Label", { label: "", id: "label", cssClass: "connection-label" }]
];

const biDirectionalOverlays = [
    [ "Arrow", {
        location: 1,
        id: "arrow",
        length: 14,
        foldback: 0.8
    } ],
    [ "Label", { label: "", id: "label", cssClass: "connection-label" }],
    [ "Arrow", {
        location: 0,
        id: "arrow2",
        length: 14,
        direction: -1,
        foldback: 0.8
    } ]
];

const inverseRelationsOverlays = [
    [ "Arrow", {
        location: 1,
        id: "arrow",
        length: 14,
        foldback: 0.8
    } ],
    [ "Label", { label: "", location: 0.2, id: "label-source", cssClass: "connection-label" }],
    [ "Label", { label: "", location: 0.8, id: "label-target", cssClass: "connection-label" }],
    [ "Arrow", {
        location: 0,
        id: "arrow2",
        length: 14,
        direction: -1,
        foldback: 0.8
    } ]
];

const linkOverlays = [
    [ "Arrow", {
        location: 1,
        id: "arrow",
        length: 14,
        foldback: 0.8
    } ]
];

function loadMapData() {
    const currentNote = noteDetailService.getCurrentNote();
    mapData = {
        notes: []
    };

    if (currentNote.content) {
        try {
            mapData = JSON.parse(currentNote.content);
        } catch (e) {
            console.log("Could not parse content: ", e);
        }
    }
}

function noteIdToId(noteId) {
    return "rel-map-note-" + noteId;
}

function idToNoteId(id) {
    return id.substr(13);
}

async function show() {
    $component.show();

    await libraryLoader.requireLibrary(libraryLoader.RELATION_MAP);

    loadMapData();

    jsPlumb.ready(() => {
        initJsPlumbInstance();

        initPanZoom();

        loadNotesAndRelations();
    });

}

function clearMap() {
    // delete all endpoints and connections
    // this is done at this point (after async operations) to reduce flicker to the minimum
    jsPlumbInstance.deleteEveryEndpoint();

    // without this we still end up with note boxes remaining in the canvas
    $relationMapContainer.empty();
}

async function loadNotesAndRelations() {
    const noteIds = mapData.notes.map(note => note.noteId);
    const data = await server.post("notes/relation-map", {noteIds});

    relations = [];

    for (const relation of data.relations) {
        const match = relations.find(rel =>
            rel.name === data.inverseRelations[relation.name]
            && ((rel.sourceNoteId === relation.sourceNoteId && rel.targetNoteId === relation.targetNoteId)
            || (rel.sourceNoteId === relation.targetNoteId && rel.targetNoteId === relation.sourceNoteId)));

        if (match) {
            match.type = relation.type = relation.name === data.inverseRelations[relation.name] ? 'biDirectional' : 'inverse';
            relation.render = false; // don't render second relation
        } else {
            relation.type = 'uniDirectional';
            relation.render = true;
        }

        relations.push(relation);
    }

    mapData.notes = mapData.notes.filter(note => note.noteId in data.noteTitles);

    jsPlumbInstance.batch(async function () {
        clearMap();

        for (const note of mapData.notes) {
            const title = data.noteTitles[note.noteId];

            await createNoteBox(note.noteId, title, note.x, note.y);
        }

        for (const relation of relations) {
            if (!relation.render) {
                continue;
            }

            const connection = jsPlumbInstance.connect({
                source: noteIdToId(relation.sourceNoteId),
                target: noteIdToId(relation.targetNoteId),
                type: relation.type
            });

            connection.id = relation.attributeId;

            if (relation.type === 'inverse') {
                connection.getOverlay("label-source").setLabel(relation.name);
                connection.getOverlay("label-target").setLabel(data.inverseRelations[relation.name]);
            }
            else {
                connection.getOverlay("label").setLabel(relation.name);
            }

            connection.canvas.setAttribute("data-connection-id", connection.id);
        }

        for (const link of data.links) {
            jsPlumbInstance.connect({
                source: noteIdToId(link.sourceNoteId),
                target: noteIdToId(link.targetNoteId),
                type: 'link'
            });
        }
    });
}

function initPanZoom() {
    if (pzInstance) {
        return;
    }

    pzInstance = panzoom($relationMapContainer[0], {
        maxZoom: 2,
        minZoom: 0.3,
        smoothScroll: false,
        onMouseDown: function(event) {
            if (clipboard) {
                let {x, y} = getMousePosition(event);

                // modifying position so that cursor is on the top-center of the box
                x -= 80;
                y -= 15;

                createNoteBox(clipboard.noteId, clipboard.title, x, y);

                mapData.notes.push({ noteId: clipboard.noteId, x, y });

                saveData();

                clipboard = null;
            }

            return true;
        },
        filterKey: function(e, dx, dy, dz) {
            // if ALT is pressed then panzoom should bubble the event up
            // this is to preserve ALT-LEFT, ALT-RIGHT navigation working
            return e.altKey;
        }
    });

    pzInstance.on('transform', () => { // gets triggered on any transform change
        jsPlumbInstance.setZoom(getZoom());

        saveCurrentTransform();
    });

    if (mapData.transform) {
        pzInstance.zoomTo(0, 0, mapData.transform.scale);

        pzInstance.moveTo(mapData.transform.x, mapData.transform.y);
    }
    else {
        // set to initial coordinates
        pzInstance.moveTo(0, 0);
    }

    $zoomInButton.click(() => pzInstance.zoomTo(0, 0, 1.2));
    $zoomOutButton.click(() => pzInstance.zoomTo(0, 0, 0.8));
}

function saveCurrentTransform() {
    const newTransform = pzInstance.getTransform();

    if (JSON.stringify(newTransform) !== JSON.stringify(mapData.transform)) {
        // clone transform object
        mapData.transform = JSON.parse(JSON.stringify(newTransform));

        saveData();
    }
}

function cleanup() {
    if (jsPlumbInstance) {
        clearMap();
    }

    if (pzInstance) {
        pzInstance.dispose();
        pzInstance = null;
    }
}

function initJsPlumbInstance () {
    if (jsPlumbInstance) {
        cleanup();

        return;
    }

    jsPlumbInstance = jsPlumb.getInstance({
        Endpoint: ["Dot", {radius: 2}],
        Connector: "StateMachine",
        ConnectionOverlays: uniDirectionalOverlays,
        HoverPaintStyle: { stroke: "#777", strokeWidth: 1 },
        Container: "relation-map-container"
    });

    jsPlumbInstance.registerConnectionType("uniDirectional", { anchor:"Continuous", connector:"StateMachine", overlays: uniDirectionalOverlays });

    jsPlumbInstance.registerConnectionType("biDirectional", { anchor:"Continuous", connector:"StateMachine", overlays: biDirectionalOverlays });

    jsPlumbInstance.registerConnectionType("inverse", { anchor:"Continuous", connector:"StateMachine", overlays: inverseRelationsOverlays });

    jsPlumbInstance.registerConnectionType("link", { anchor:"Continuous", connector:"StateMachine", overlays: linkOverlays });

    jsPlumbInstance.bind("connection", connectionCreatedHandler);

    // so that canvas is not panned when clicking/dragging note box
    $relationMapContainer.on('mousedown touchstart', '.note-box, .connection-label', e => e.stopPropagation());
}

function connectionContextMenuHandler(connection, event) {
    event.preventDefault();
    event.stopPropagation();

    const contextMenuItems = [ {title: "Remove relation", cmd: "remove", uiIcon: "trash"} ];

    contextMenuWidget.initContextMenu(event, contextMenuItems, async (event, cmd) => {
        if (cmd === 'remove') {
            if (!await confirmDialog.confirm("Are you sure you want to remove the relation?")) {
                return;
            }

            const relation = relations.find(rel => rel.attributeId === connection.id);

            await server.remove(`notes/${relation.sourceNoteId}/relations/${relation.name}/to/${relation.targetNoteId}`);

            jsPlumbInstance.deleteConnection(connection);

            relations = relations.filter(relation => relation.attributeId !== connection.id);
        }
    });
}

async function connectionCreatedHandler(info, originalEvent) {
    const connection = info.connection;

    connection.bind("contextmenu", (obj, event) => {
        if (connection.getType().includes("link")) {
            // don't create context menu if it's a link since there's nothing to do with link from relation map
            // (don't open browser menu either)
            event.preventDefault();
        }
        else {
            connectionContextMenuHandler(connection, event);
        }
    });

    // if there's no event, then this has been triggered programatically
    if (!originalEvent) {
        return;
    }

    const name = await promptDialog.ask({
        message: "Specify new relation name:",
        shown: ({ $answer }) =>
            attributeAutocompleteService.initAttributeNameAutocomplete({
                $el: $answer,
                attributeType: "relation",
                open: true
            })
    });

    if (!name || !name.trim()) {
        jsPlumbInstance.deleteConnection(connection);

        return;
    }

    const targetNoteId = idToNoteId(connection.target.id);
    const sourceNoteId = idToNoteId(connection.source.id);

    const relationExists = relations.some(rel =>
        rel.targetNoteId === targetNoteId
        && rel.sourceNoteId === sourceNoteId
        && rel.name === name);

    if (relationExists) {
        await infoDialog.info("Connection '" + name + "' between these notes already exists.");

        jsPlumbInstance.deleteConnection(connection);

        return;
    }

    await server.put(`notes/${sourceNoteId}/relations/${name}/to/${targetNoteId}`);

    await refresh();
}

$relationMapContainer.on("contextmenu", ".note-box", e => {
    const contextMenuItems = [
        {title: "Remove note", cmd: "remove", uiIcon: "trash"},
        {title: "Edit title", cmd: "edit-title", uiIcon: "pencil"},
    ];

    contextMenuWidget.initContextMenu(e, contextMenuItems, noteContextMenuHandler);

    return false;
});

async function noteContextMenuHandler(event, cmd) {
    const $noteBox = $(event.originalTarget).closest(".note-box");
    const $title = $noteBox.find(".title a");
    const noteId = idToNoteId($noteBox.prop("id"));

    if (cmd === "remove") {
        if (!await confirmDialog.confirmDeleteNoteBoxWithNote($title.text())) {
            return;
        }

        jsPlumbInstance.remove(noteIdToId(noteId));

        if (confirmDialog.isDeleteNoteChecked()) {
            await server.remove("notes/" + noteId);

            // to force it to disappear from the tree
            treeService.reload();
        }

        mapData.notes = mapData.notes.filter(note => note.noteId !== noteId);

        relations = relations.filter(relation => relation.sourceNoteId !== noteId && relation.targetNoteId !== noteId);

        saveData();
    }
    else if (cmd === "edit-title") {
        const title = await promptDialog.ask({
            message: "Enter new note title:",
            defaultValue: $title.text()
        });

        if (!title) {
            return;
        }

        await server.put(`notes/${noteId}/change-title`, { title });

        treeService.setNoteTitle(noteId, title);

        $title.text(title);
    }
}

function saveData() {
    noteDetailService.noteChanged();
}

async function createNoteBox(noteId, title, x, y) {
    const $noteBox = $("<div>")
        .addClass("note-box")
        .prop("id", noteIdToId(noteId))
        .append($("<span>").addClass("title").html(await linkService.createNoteLink(noteId, title)))
        .append($("<div>").addClass("endpoint").attr("title", "Start dragging relations from here and drop them on another note."))
        .css("left", x + "px")
        .css("top", y + "px");

    jsPlumbInstance.getContainer().appendChild($noteBox[0]);

    jsPlumbInstance.draggable($noteBox[0], {
        start: params => {},
        drag: params => {},
        stop: params => {
            const noteId = idToNoteId(params.el.id);

            const note = mapData.notes.find(note => note.noteId === noteId);

            if (!note) {
                console.error(`Note ${noteId} not found!`);
                return;
            }

            [note.x, note.y] = params.finalPos;

            saveData();
        }
    });

    jsPlumbInstance.makeSource($noteBox[0], {
        filter: ".endpoint",
        anchor: "Continuous",
        connectorStyle: { stroke: "#000", strokeWidth: 1 },
        connectionType: "basic",
        extract:{
            "action": "the-action"
        }
    });

    jsPlumbInstance.makeTarget($noteBox[0], {
        dropOptions: { hoverClass: "dragHover" },
        anchor: "Continuous",
        allowLoopback: true
    });
}

async function refresh() {
    await loadNotesAndRelations();
}

let clipboard = null;

$createChildNote.click(async () => {
    const title = await promptDialog.ask({ message: "Enter title of new note",  defaultValue: "new note" });

    if (!title.trim()) {
        return;
    }

    const {note} = await server.post(`notes/${noteDetailService.getCurrentNoteId()}/children`, {
        title,
        target: 'into'
    });

    infoService.showMessage("Click on canvas to place new note");

    // reloading tree so that the new note appears there
    // no need to wait for it to finish
    treeService.reload();

    clipboard = { noteId: note.noteId, title };
});

function getZoom() {
    const matrixRegex = /matrix\((-?\d*\.?\d+),\s*0,\s*0,\s*-?\d*\.?\d+,\s*-?\d*\.?\d+,\s*-?\d*\.?\d+\)/;

    const matches = $relationMapContainer.css('transform').match(matrixRegex);

    return matches[1];
}

async function dropNoteOntoRelationMapHandler(ev) {
    ev.preventDefault();

    const note = JSON.parse(ev.originalEvent.dataTransfer.getData("text"));

    let {x, y} = getMousePosition(ev);

    const exists = mapData.notes.some(n => n.noteId === note.noteId);

    if (exists) {
        await infoDialog.info(`Note "${note.title}" is already placed into the diagram`);

        return;
    }

    mapData.notes.push({noteId: note.noteId, x, y});

    saveData();

    await refresh();
}

function getMousePosition(evt) {
    const rect = $relationMapContainer[0].getBoundingClientRect();

    const zoom = getZoom();

    return {
        x: (evt.clientX - rect.left) / zoom,
        y: (evt.clientY - rect.top) / zoom
    };
}

$resetPanZoomButton.click(() => {
    // reset to initial pan & zoom state
    pzInstance.zoomTo(0, 0, 1 / getZoom());
    pzInstance.moveTo(0, 0);
});

$component.on("drop", dropNoteOntoRelationMapHandler);
$component.on("dragover", ev => ev.preventDefault());

export default {
    show,
    getContent: () => JSON.stringify(mapData),
    focus: () => null,
    onNoteChange: () => null,
    cleanup
}