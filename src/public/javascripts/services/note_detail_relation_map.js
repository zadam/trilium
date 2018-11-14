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

const $component = $("#note-detail-relation-map");
const $relationMapContainer = $("#relation-map-container");
const $createChildNote = $("#relation-map-create-child-note");
const $zoomInButton = $("#relation-map-zoom-in");
const $zoomOutButton = $("#relation-map-zoom-out");
const $centerButton = $("#relation-map-center");

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

const mirrorOverlays = [
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
    return "note-" + noteId;
}

function idToNoteId(id) {
    return id.substr(5);
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

async function loadNotesAndRelations() {
    const noteIds = mapData.notes.map(note => note.noteId);console.log(noteIds);
    const data = await server.post("notes/relation-map", {noteIds});

    relations = [];

    for (const relation of data.relations) {
        const match = relations.find(rel =>
            rel.name === data.mirrorRelations[relation.name]
            && ((rel.sourceNoteId === relation.sourceNoteId && rel.targetNoteId === relation.targetNoteId)
            || (rel.sourceNoteId === relation.targetNoteId && rel.targetNoteId === relation.sourceNoteId)));

        if (match) {
            match.type = relation.type = relation.name === data.mirrorRelations[relation.name] ? 'biDirectional' : 'mirror';
            relation.render = false; // don't render second relation
        } else {
            relation.type = 'uniDirectional';
            relation.render = true;
        }

        relations.push(relation);
    }

    mapData.notes = mapData.notes.filter(note => note.noteId in data.noteTitles);

    // delete all endpoints and connections
    // this is done at this point (after async operations) to reduce flicker to the minimum
    jsPlumbInstance.deleteEveryEndpoint();

    jsPlumbInstance.batch(async function () {
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

            if (relation.type === 'mirror') {
                connection.getOverlay("label-source").setLabel(relation.name);
                connection.getOverlay("label-target").setLabel(data.mirrorRelations[relation.name]);
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

                clipboard = null;
            }

            return true;
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
        // delete all endpoints and connections
        jsPlumbInstance.deleteEveryEndpoint();

        // without this we still end up with note boxes remaining in the canvas
        $relationMapContainer.empty();
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

    jsPlumbInstance.registerConnectionType("mirror", { anchor:"Continuous", connector:"StateMachine", overlays: mirrorOverlays });

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
            if (!confirm("Are you sure you want to remove the relation?")) {
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

    const isRelation = relations.some(rel => rel.attributeId === connection.id);

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

    const attribute = await server.put(`notes/${sourceNoteId}/relations/${name}/to/${targetNoteId}`);

    relations.push({ attributeId: attribute.attributeId , targetNoteId, sourceNoteId, name });

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
    const noteId = $noteBox.prop("id");

    if (cmd === "remove") {
        if (!confirm("Are you sure you want to remove the note from this diagram?")) {
            return;
        }

        jsPlumbInstance.remove(noteId);

        mapData.notes = mapData.notes.filter(note => note.noteId !== noteId);

        relations = relations.filter(relation => relation.sourceNoteId !== noteId && relation.targetNoteId !== noteId);

        saveData();
    }
    else if (cmd === "edit-title") {
        const $title = $noteBox.find(".title a");
        const title = await promptDialog.ask({ message: "Enter new note title:", defaultValue: $title.text() });

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
        .append($("<span>").addClass("title").html(await linkService.createNoteLink(noteId, title)).append(`[${Math.floor(x)}, ${Math.floor(y)}]`))
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
    const title = await promptDialog.ask("Enter title of new note", "new note");

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

    const notes = JSON.parse(ev.originalEvent.dataTransfer.getData("text"));

    let {x, y} = getMousePosition(ev);

    // modifying position so that cursor is on the top-center of the box
    const startX = x -= 80;
    y -= 15;

    const currentNoteId = treeService.getCurrentNode().data.noteId;

    for (const note of notes) {
        if (note.noteId === currentNoteId) {
            // we don't allow placing current (relation map) into itself
            // the reason is that when dragging notes from the tree, the relation map is always selected
            // since it's focused.
            continue;
        }

        const exists = mapData.notes.some(n => n.noteId === note.noteId);

        if (exists) {
            await infoDialog.info(`Note "${note.title}" is already placed into the diagram`);

            continue;
        }

        mapData.notes.push({id: note.noteId, x, y});

        if (x - startX > 1000) {
            x = startX;
            y += 200;
        }
        else {
            x += 200;
        }
    }

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

$centerButton.click(() => {
    if (mapData.notes.length === 0) {
        return; // nothing to recenter on
    }

    let totalX = 0, totalY = 0;

    for (const note of mapData.notes) {
        totalX += note.x;
        totalY += note.y;
    }

    let averageX = totalX / mapData.notes.length;
    let averageY = totalY / mapData.notes.length;

    const $noteBox = $("#C1I7GPA8ORO4");

    console.log($noteBox);

    pzInstance.centerOn($noteBox[0], $relationMapContainer[0]);
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