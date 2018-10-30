import server from "./server.js";
import noteDetailService from "./note_detail.js";
import linkService from "./link.js";
import libraryLoader from "./library_loader.js";

const $noteDetailRelationMap = $("#note-detail-relation-map");
const $relationMapCanvas = $("#relation-map-canvas");
const $addChildNotesButton = $("#relation-map-add-child-notes");
const $zoomInButton = $("#relation-map-zoom-in");
const $zoomOutButton = $("#relation-map-zoom-out");

let mapData;
let instance;
// outside of mapData because they are not persisted in the note content
let relations;

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
    $noteDetailRelationMap.show();

    await libraryLoader.requireLibrary(libraryLoader.RELATION_MAP);

    loadMapData();

    jsPlumb.ready(initJsPlumb);
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

    instance.batch(async function () {
        for (const note of mapData.notes) {
            const title = data.noteTitles[note.id];

            await createNoteBox(note.id, title, note.x, note.y);
        }

        for (const relation of relations) {
            if (relation.name === 'isChildOf') {
                continue;
            }

            const connection = instance.connect({
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
    const pz = panzoom($relationMapCanvas[0], {
        maxZoom: 2,
        minZoom: 0.1,
        smoothScroll: false
    });

    if (mapData.transform) {
        console.log(mapData.transform);

        pz.moveTo(mapData.transform.x, mapData.transform.y);
        pz.zoomTo(0, 0, mapData.transform.scale);
    }

    pz.on('zoom', function (e) {
        mapData.transform = pz.getTransform();

        console.log(mapData.transform);

        saveData();
    });

    pz.on('panend', function (e) {
        mapData.transform = pz.getTransform();

        saveData();
    }, true);

    $zoomInButton.click(() => {
        const transform = pz.getTransform();

        pz.zoomTo(0, 0, 1.2);
    });

    $zoomOutButton.click(() => {
        const transform = pz.getTransform();

        pz.zoomTo(0, 0, 0.8);
    });
}

async function initJsPlumb () {
    instance = jsPlumb.getInstance({
        Endpoint: ["Dot", {radius: 2}],
        Connector: "StateMachine",
        ConnectionOverlays: uniDirectionalOverlays,
        HoverPaintStyle: { stroke: "#777", strokeWidth: 1 },
        Container: "relation-map-canvas"
    });

    instance.registerConnectionType("uniDirectional", { anchor:"Continuous", connector:"StateMachine", overlays: uniDirectionalOverlays });

    instance.registerConnectionType("biDirectional", { anchor:"Continuous", connector:"StateMachine", overlays: biDirectionalOverlays });

    instance.bind("connection", connectionCreatedHandler);

    $relationMapCanvas.contextmenu({
        delegate: ".note-box",
        menu: [
            {title: "Remove note", cmd: "remove", uiIcon: "ui-icon-trash"},
            {title: "Edit title", cmd: "edit-title", uiIcon: "ui-icon-pencil"},
        ],
        select: noteContextMenuHandler
    });

    $.widget("moogle.contextmenuRelation", $.moogle.contextmenu, {});

    $relationMapCanvas.contextmenuRelation({
        delegate: ".connection-label,.jtk-connector",
        autoTrigger: false, // it doesn't open automatically, needs to be triggered explicitly by .open() call
        menu: [
            {title: "Remove relation", cmd: "remove", uiIcon: "ui-icon-trash"}
        ],
        select: relationContextMenuHandler
    });

    instance.bind("contextmenu", function (c, e) {
        e.preventDefault();

        $relationMapCanvas.contextmenuRelation("open", e, { connection: c });
    });

    await loadNotesAndRelations();

    // so that canvas is not panned when clicking/dragging note box
    $relationMapCanvas.on('mousedown touchstart', '.note-box, .connection-label', e => e.stopPropagation());

    jsPlumb.fire("jsPlumbDemoLoaded", instance);

    initPanZoom();
}

async function connectionCreatedHandler(info, originalEvent) {
    // if there's no event, then this has been triggered programatically
    if (!originalEvent) {
        return;
    }

    const connection = info.connection;
    const name = prompt("Specify new relation name:");

    if (!name || !name.trim()) {
        instance.deleteConnection(connection);

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

        instance.deleteConnection(connection);

        return;
    }

    const attribute = await server.put(`notes/${sourceNoteId}/relations/${name}/to/${targetNoteId}`);

    relations.push({ attributeId: attribute.attributeId , targetNoteId, sourceNoteId, name });

    connection.id = attribute.attributeId;
    connection.getOverlay("label").setLabel(name);
}

async function relationContextMenuHandler(event, ui) {
    const {connection} = ui.extraData;

    if (ui.cmd === 'remove') {
        if (!confirm("Are you sure you want to remove the relation?")) {
            return;
        }

        const relation = relations.find(rel => rel.attributeId === connection.id);

        await server.remove(`notes/${relation.sourceNoteId}/relations/${relation.name}/to/${relation.targetNoteId}`);

        instance.deleteConnection(connection);

        relations = relations.filter(relation => relation.attributeId !== connection.id);
    }
}

async function noteContextMenuHandler(event, ui) {
    const $noteBox = ui.target.closest(".note-box");
    const noteId = $noteBox.prop("id");

    if (ui.cmd === "remove") {
        if (!confirm("Are you sure you want to remove the note from this diagram?")) {
            return;
        }

        instance.remove(noteId);

        mapData.notes = mapData.notes.filter(note => note.id !== noteId);

        relations = relations.filter(relation => relation.sourceNoteId !== noteId && relation.targetNoteId !== noteId);

        saveData();
    }
    else if (ui.cmd === "edit-title") {
        const title = prompt("Enter new note title:");

        if (!title) {
            return;
        }

        const note = mapData.notes.find(note => note.id === noteId);
        note.title = title;

        $noteBox.find(".title").text(note.title);

        saveData();
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

    instance.getContainer().appendChild($noteBox[0]);

    instance.draggable($noteBox[0], {
        start:function(params) {},
        drag:function(params) {},
        stop:function(params) {
            const note = mapData.notes.find(note => note.id === params.el.id);

            if (!note) {
                console.error(`Note ${params.el.id} not found!`);
                return;
            }

            [note.x, note.y] = params.finalPos;

            saveData();
        }
    });

    instance.makeSource($noteBox[0], {
        filter: ".endpoint",
        anchor: "Continuous",
        connectorStyle: { stroke: "#000", strokeWidth: 1 },
        connectionType: "basic",
        extract:{
            "action": "the-action"
        }
    });

    instance.makeTarget($noteBox[0], {
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
    instance.deleteEveryEndpoint();

    await loadNotesAndRelations();
});

export default {
    show,
    getContent: () => JSON.stringify(mapData),
    focus: () => null,
    onNoteChange: () => null
}