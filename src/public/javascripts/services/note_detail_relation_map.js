import server from "./server.js";
import noteDetailService from "./note_detail.js";
import linkService from "./link.js";
import libraryLoader from "./library_loader.js";
import treeService from "./tree.js";
import contextMenuWidget from "./context_menu.js";
import infoService from "./info.js";

const $component = $("#note-detail-relation-map");
const $relationMapContainer = $("#relation-map-container");
const $addChildNotesButton = $("#relation-map-add-child-notes");
const $createChildNote = $("#relation-map-create-child-note");
const $zoomInButton = $("#relation-map-zoom-in");
const $zoomOutButton = $("#relation-map-zoom-out");

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
    const noteIds = mapData.notes.map(note => note.id);
    const data = await server.post("notes/relation-map", {noteIds});

    relations = [];

    for (const relation of data.relations) {
        const match = relations.find(rel =>
            rel.name === relation.name
            && ((rel.sourceNoteId === relation.sourceNoteId && rel.targetNoteId === relation.targetNoteId)
            || (rel.sourceNoteId === relation.targetNoteId && rel.targetNoteId === relation.sourceNoteId)));

        if (match) {
            match.type = 'biDirectional';
        } else {
            relation.type = 'uniDirectional';
            relations.push(relation);
        }
    }

    mapData.notes = mapData.notes.filter(note => note.id in data.noteTitles);

    jsPlumbInstance.batch(async function () {
        for (const note of mapData.notes) {
            const title = data.noteTitles[note.id];

            await createNoteBox(note.id, title, note.x, note.y);
        }

        for (const relation of relations) {
            if (relation.name === 'isChildOf') {
                continue;
            }

            const connection = jsPlumbInstance.connect({
                source: relation.sourceNoteId,
                target: relation.targetNoteId,
                type: relation.type
            });

            connection.id = relation.attributeId;
            connection.getOverlay("label").setLabel(relation.name);
            connection.canvas.setAttribute("data-connection-id", connection.id);
        }
    });
}

function initPanZoom() {
    if (pzInstance) {
        return;
    }

    pzInstance = panzoom($relationMapContainer[0], {
        maxZoom: 2,
        minZoom: 0.1,
        smoothScroll: false,
        onMouseDown: function(event) {
            if (clipboard) {
                let {x, y} = getMousePosition(event);

                // modifying position so that cursor is on the top-center of the box
                x -= 80;
                y -= 15;

                createNoteBox(clipboard.id, clipboard.title, x, y);

                mapData.notes.push({ id: clipboard.id, x, y });

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
        mapData.transform = newTransform;

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

    connection.bind("contextmenu", (obj, event) => connectionContextMenuHandler(connection, event));

    // if there's no event, then this has been triggered programatically
    if (!originalEvent) {
        return;
    }

    const name = prompt("Specify new relation name:");

    if (!name || !name.trim()) {
        jsPlumbInstance.deleteConnection(connection);

        return;
    }

    const targetNoteId = connection.target.id;
    const sourceNoteId = connection.source.id;

    const relationExists = relations.some(rel =>
        rel.targetNoteId === targetNoteId
        && rel.sourceNoteId === sourceNoteId
        && rel.name === name);

    if (relationExists) {
        alert("Connection '" + name + "' between these notes already exists.");

        jsPlumbInstance.deleteConnection(connection);

        return;
    }

    const attribute = await server.put(`notes/${sourceNoteId}/relations/${name}/to/${targetNoteId}`);

    relations.push({ attributeId: attribute.attributeId , targetNoteId, sourceNoteId, name });

    connection.id = attribute.attributeId;
    connection.getOverlay("label").setLabel(name);
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

        mapData.notes = mapData.notes.filter(note => note.id !== noteId);

        relations = relations.filter(relation => relation.sourceNoteId !== noteId && relation.targetNoteId !== noteId);

        saveData();
    }
    else if (cmd === "edit-title") {
        const $title = $noteBox.find(".title a");
        const title = prompt("Enter new note title:", $title.text());

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

async function createNoteBox(id, title, x, y) {
    const $noteBox = $("<div>")
        .addClass("note-box")
        .prop("id", id)
        .append($("<span>").addClass("title").html(await linkService.createNoteLink(id, title)))
        .append($("<div>").addClass("endpoint").attr("title", "Start dragging relations from here and drop them on another note."))
        .css("left", x + "px")
        .css("top", y + "px");

    jsPlumbInstance.getContainer().appendChild($noteBox[0]);

    jsPlumbInstance.draggable($noteBox[0], {
        start: params => {},
        drag: params => {},
        stop: params => {
            const note = mapData.notes.find(note => note.id === params.el.id);

            if (!note) {
                console.error(`Note ${params.el.id} not found!`);
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

function getFreePosition() {
    const maxY = mapData.notes.filter(note => !!note.y).map(note => note.y).reduce((a, b) => Math.max(a, b), 0);

    return [100, maxY + 200];
}

$addChildNotesButton.click(async () => {
    const children = await server.get("notes/" + noteDetailService.getCurrentNoteId() + "/children");

    let [curX, curY] = getFreePosition();

    for (const child of children) {
        if (mapData.notes.some(note => note.id === child.noteId)) {
            // note already exists
            continue;
        }

        mapData.notes.push({
            id: child.noteId,
            x: curX,
            y: curY
        });

        if (curX > 1000) {
            curX = 100;
            curY += 200;
        }
        else {
            curX += 200;
        }
    }

    saveData();

    // delete all endpoints and connections
    jsPlumbInstance.deleteEveryEndpoint();

    await loadNotesAndRelations();
});

let clipboard = null;

$createChildNote.click(async () => {
    const title = prompt("Enter title of new note", "new note");

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

    clipboard = { id: note.noteId, title };
});

function getZoom() {
    const matrixRegex = /matrix\((-?\d*\.?\d+),\s*0,\s*0,\s*-?\d*\.?\d+,\s*-?\d*\.?\d+,\s*-?\d*\.?\d+\)/;

    const matches = $relationMapContainer.css('transform').match(matrixRegex);

    return matches[1];
}


function dragover_handler(ev) {
    ev.preventDefault();
    // Set the dropEffect to move
    //ev.dataTransfer.dropEffect = "move";

    console.log("DRAGOVER");
}

function drop_handler(ev) {
    ev.preventDefault();

    const note = JSON.parse(ev.originalEvent.dataTransfer.getData("text"));

    let {x, y} = getMousePosition(ev);

    // modifying position so that cursor is on the top-center of the box
    x -= 80;
    y -= 15;

    createNoteBox(note.noteId, note.title, x, y);
}

function getMousePosition(evt) {
    const rect = $relationMapContainer[0].getBoundingClientRect();

    const zoom = getZoom();

    return {
        x: (evt.clientX - rect.left) / zoom,
        y: (evt.clientY - rect.top) / zoom
    };
}

$component.on("drop", drop_handler);
$component.on("dragover", dragover_handler);

export default {
    show,
    getContent: () => JSON.stringify(mapData),
    focus: () => null,
    onNoteChange: () => null,
    cleanup
}