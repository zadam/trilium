import server from "./server.js";
import noteDetailService from "./note_detail.js";
import libraryLoader from "./library_loader.js";

const $noteDetailRelationMap = $("#note-detail-relation-map");
const $relationMapCanvas = $("#relation-map-canvas");
const $addChildNotesButton = $("#relation-map-add-child-notes");

let mapData;
let instance;
let initDone = false;

const uniDirectionalOverlays = [
    [ "Arrow", {
        location: 1,
        id: "arrow",
        length: 14,
        foldback: 0.8
    } ],
    [ "Label", { label: "", id: "label", cssClass: "aLabel" }]
];

const biDirectionalOverlays = [
    [ "Arrow", {
        location: 1,
        id: "arrow",
        length: 14,
        foldback: 0.8
    } ],
    [ "Label", { label: "", id: "label", cssClass: "aLabel" }],
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
        notes: [],
        relations: []
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

    const relations = [];

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

    instance.batch(function () {
        const maxY = mapData.notes.filter(note => !!note.y).map(note => note.y).reduce((a, b) => Math.max(a, b), 0);
        let curX = 100;
        let curY = maxY + 200;

        for (const note of mapData.notes) {
            const title = data.noteTitles[note.id];

            if (note.x && note.y) {
                newNode(note.id, title, note.x, note.y);
            } else {
                newNode(note.id, title, curX, curY);

                if (curX > 1000) {
                    curX = 100;
                    curY += 200;
                } else {
                    curX += 200;
                }
            }
        }

        for (const relation of relations) {
            if (relation.name === 'isChildOf') {
                continue;
            }

            const connection = instance.connect({
                id: `${relation.sourceNoteId}${relation.targetNoteId}`,
                source: relation.sourceNoteId,
                target: relation.targetNoteId,
                type: relation.type
            });

            relation.connectionId = connection.id;

            connection.getOverlay("label").setLabel(relation.name);
            connection.canvas.setAttribute("data-connection-id", connection.id);
        }

        initDone = true;
    });
}

function initPanZoom() {
    const pz = panzoom($relationMapCanvas[0], {
        maxZoom: 2,
        minZoom: 0.1,
        smoothScroll: false
    });

    if (mapData.transform) {
        pz.moveTo(mapData.transform.x, mapData.transform.y);
        pz.zoomTo(0, 0, mapData.transform.scale);
    }

    $relationMapCanvas[0].addEventListener('zoom', function (e) {
        mapData.transform = pz.getTransform();
        saveData();
    });

    $relationMapCanvas[0].addEventListener('panend', function (e) {
        mapData.transform = pz.getTransform();
        saveData();
    }, true);
}

async function initJsPlumb () {
    instance = jsPlumb.getInstance({
        Endpoint: ["Dot", {radius: 2}],
        Connector: "StateMachine",
        HoverPaintStyle: {stroke: "#1e8151", strokeWidth: 2 },
        Container: "relation-map-canvas"
    });


    instance.registerConnectionType("uniDirectional", { anchor:"Continuous", connector:"StateMachine", overlays: uniDirectionalOverlays });

    instance.registerConnectionType("biDirectional", { anchor:"Continuous", connector:"StateMachine", overlays: biDirectionalOverlays });

    // instance.bind("connection", function (info) {
    //     const connection = info.connection;
    //     let name = "none";
    //
    //     if (initDone) {
    //         name = prompt("Specify new connection label:");
    //
    //         mapData.relations.push({
    //             connectionId: connection.id,
    //             source: connection.sourceId,
    //             target: connection.targetId,
    //             name: name
    //         });
    //
    //         saveData();
    //     }
    //
    //     connection.getOverlay("label").setLabel(name);
    // });

    jsPlumb.on($relationMapCanvas[0], "dblclick", function(e) {
        newNode(jsPlumbUtil.uuid(),"new", e.offsetX, e.offsetY);
    });

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
        delegate: ".aLabel,.jtk-connector",
        autoTrigger: false, // it doesn't open automatically, needs to be triggered explicitly by .open() call
        menu: [
            {title: "Remove relation", cmd: "remove", uiIcon: "ui-icon-trash"},
            {title: "Edit relation name", cmd: "edit-name", uiIcon: "ui-icon-pencil"},
        ],
        select: relationContextMenuHandler
    });

    instance.bind("contextmenu", function (c, e) {
        e.preventDefault();

        $relationMapCanvas.contextmenuRelation("open", e, { connection: c });
    });

    await loadNotesAndRelations();

    // so that canvas is not panned when clicking/dragging note box
    $relationMapCanvas.on('mousedown touchstart', '.note-box, .aLabel', e => e.stopPropagation());

    jsPlumb.fire("jsPlumbDemoLoaded", instance);

    initPanZoom();
}

function relationContextMenuHandler(event, ui) {
    const {connection} = ui.extraData;

    if (ui.cmd === 'remove') {
        if (!confirm("Are you sure you want to remove the relation?")) {
            return;
        }

        instance.deleteConnection(connection);

        mapData.relations = mapData.relations.filter(relation => relation.connectionId !== connection.id);
        saveData();
    }
    else if (ui.cmd === 'edit-name') {
        const relationName = prompt("Specify new relation name:");

        connection.getOverlay("label").setLabel(relationName);

        const relation = mapData.relations.find(relation => relation.connectionId === connection.id);
        relation.name = relationName;

        saveData();
    }
}

function noteContextMenuHandler(event, ui) {
    const $noteBox = ui.target.closest(".note-box");
    const noteId = $noteBox.prop("id");

    if (ui.cmd === "remove") {
        if (!confirm("Are you sure you want to remove the note?")) {
            return;
        }

        instance.remove(noteId);

        mapData.notes = mapData.notes.filter(note => note.id !== noteId);
        mapData.relations = mapData.relations.filter(relation => relation.source !== noteId && relation.target !== noteId);

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

function initNode(el) {
    instance.draggable(el, {
        handle: ".handle",
        start:function(params) {
        },
        drag:function(params) {

        },
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

    instance.makeSource(el, {
        filter: ".endpoint",
        anchor: "Continuous",
        connectorStyle: {
            stroke: "#5c96bc",
            strokeWidth: 2,
            outlineStroke: "transparent",
            outlineWidth: 4
        },
        connectionType: "basic",
        extract:{
            "action": "the-action"
        }
    });

    instance.makeTarget(el, {
        dropOptions: { hoverClass: "dragHover" },
        anchor: "Continuous",
        allowLoopback: true
    });

    // this is not part of the core demo functionality; it is a means for the Toolkit edition's wrapped
    // version of this demo to find out about new nodes being added.
    //
    instance.fire("jsPlumbDemoNodeAdded", el);
}

function newNode(id, title, x, y) {
    const $noteBox = $("<div>")
        .addClass("note-box")
        .prop("id", id)
        .append($("<div>").addClass("handle"))
        .append($("<span>").addClass("title").text(title))
        .append($("<div>").addClass("endpoint"))
        .css("left", x + "px")
        .css("top", y + "px");

    instance.getContainer().appendChild($noteBox[0]);

    initNode($noteBox[0]);
}

$addChildNotesButton.click(async () => {
    const children = await server.get("notes/" + noteDetailService.getCurrentNoteId() + "/children");

    const maxY = mapData.notes.filter(note => !!note.y).map(note => note.y).reduce((a, b) => Math.max(a, b), 0);
    let curX = 100;
    let curY = maxY + 200;

    for (const child of children) {
        if (mapData.notes.some(note => note.id === child.noteId)) {
            // note already exists
            continue;
        }

        const note = { id: child.noteId };

        mapData.notes.push(note);

        newNode(note.id, note.title, curX, curY);

        if (curX > 1000) {
            curX = 100;
            curY += 200;
        }
        else {
            curX += 200;
        }
    }

    for (const child of children) {
        for (const relation of child.relations) {
            const connection = instance.connect({
                id: relation.attributeId,
                source: child.noteId,
                target: relation.targetNoteId,
                type: "basic"
            });

            if (!connection) {
                continue;
            }

            mapData.relations.push({
                source: child.noteId,
                target: relation.targetNoteId,
                name: relation.name
            });

            relation.connectionId = connection.id;

            connection.getOverlay("label").setLabel(relation.name);
            connection.canvas.setAttribute("data-connection-id", connection.id);
        }
    }

    saveData();
});

export default {
    show,
    getContent: () => JSON.stringify(mapData),
    focus: () => null,
    onNoteChange: () => null
}