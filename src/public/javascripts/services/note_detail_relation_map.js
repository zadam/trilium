import server from "./server.js";
import noteDetailService from "./note_detail.js";
import libraryLoader from "./library_loader.js";

const $noteDetailRelationMap = $("#note-detail-relation-map");
const $relationMapCanvas = $("#relation-map-canvas");
const $addChildNotesButton = $("#relation-map-add-child-notes");

let mapData;
let instance;
let initDone = false;

async function show() {
    $noteDetailRelationMap.show();

    await libraryLoader.requireLibrary(libraryLoader.RELATION_MAP);

    const currentNote = noteDetailService.getCurrentNote();
    mapData = {
        notes: [],
        relations: []
    };

    if (currentNote.content) {
        try {
            mapData = JSON.parse(currentNote.content);
        }
        catch (e) {
            console.log("Could not parse content: ", e);
        }
    }

    jsPlumb.ready(function () {
        instance = jsPlumb.getInstance({
            Endpoint: ["Dot", {radius: 2}],
            Connector: "StateMachine",
            HoverPaintStyle: {stroke: "#1e8151", strokeWidth: 2 },
            ConnectionOverlays: [
                [ "Arrow", {
                    location: 1,
                    id: "arrow",
                    length: 14,
                    foldback: 0.8
                } ],
                [ "Label", { label: "", id: "label", cssClass: "aLabel" }]
            ],
            Container: "relation-map-canvas"
        });

        instance.registerConnectionType("basic", { anchor:"Continuous", connector:"StateMachine" });

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
            newNode(jsPlumbUtil.uuid(),"new", e.offsetX, e.offsetY, "auto", "auto");
        });

        $relationMapCanvas.contextmenu({
            delegate: ".note-box",
            menu: [
                {title: "Remove note", cmd: "remove", uiIcon: "ui-icon-trash"},
                {title: "Edit title", cmd: "edit-title", uiIcon: "ui-icon-pencil"},
            ],
            select: function(event, ui) {
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
        });

        $.widget("moogle.contextmenuRelation", $.moogle.contextmenu, {});

        $relationMapCanvas.contextmenuRelation({
            delegate: ".aLabel,.jtk-connector",
            autoTrigger: false, // it doesn't open automatically, needs to be triggered explicitly by .open() call
            menu: [
                {title: "Remove relation", cmd: "remove", uiIcon: "ui-icon-trash"},
                {title: "Edit relation name", cmd: "edit-name", uiIcon: "ui-icon-pencil"},
            ],
            select: function(event, ui) {
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
        });

        instance.bind("contextmenu", function (c, e) {
            e.preventDefault();

            $relationMapCanvas.contextmenuRelation("open", e, { connection: c });
        });

        instance.batch(function () {
            const maxY = mapData.notes.filter(note => !!note.y).map(note => note.y).reduce((a, b) => Math.max(a, b), 0);
            let curX = 100;
            let curY = maxY + 200;

            for (const note of mapData.notes) {
                if (note.x && note.y) {
                    newNode(note.id, note.title, note.x, note.y, note.width + "px", note.height + "px");
                }
                else {
                    note.width = "auto";
                    note.height = "auto";

                    newNode(note.id, note.title, curX, curY, note.width, note.height);

                    if (curX > 1000) {
                        curX = 100;
                        curY += 200;
                    }
                    else {
                        curX += 200;
                    }
                }
            }

            for (const relation of mapData.relations) {
                const connection = instance.connect({ id: relation.id, source: relation.source, target: relation.target, type: "basic" });

                relation.connectionId = connection.id;

                connection.getOverlay("label").setLabel(relation.name);
                connection.canvas.setAttribute("data-connection-id", connection.id);
            }

            initDone = true;
        });

        // so that canvas is not panned when clicking/dragging note box
        $relationMapCanvas.on('mousedown touchstart', '.note-box, .aLabel', e => e.stopPropagation());

        jsPlumb.fire("jsPlumbDemoLoaded", instance);

        panzoom($relationMapCanvas[0]);
    });
}

function saveData() {
    const currentNote = noteDetailService.getCurrentNote();

    noteDetailService.saveNote();
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

    $(el).resizable({
        resize: function(event, ui) {
//                instance.repaint(ui.helper.prop("id"));

            instance.repaintEverything();
        },
        stop: function(event, ui) {
            const note = mapData.notes.find(note => note.id === ui.helper.prop("id"));

            note.width = ui.helper.width();
            note.height = ui.helper.height();

            saveData();
        },
        handles: "all"
    });
}

function newNode(id, title, x, y, width, height) {
    const $noteBox = $("<div>")
        .addClass("note-box")
        .prop("id", id)
        .append($("<div>").addClass("handle"))
        .append($("<span>").addClass("title").text(title))
        .append($("<div>").addClass("endpoint"))
        .css("left", x + "px")
        .css("top", y + "px")
        .css("width", width)
        .css("height", height);

    instance.getContainer().appendChild($noteBox[0]);

    initNode($noteBox[0]);
}

$addChildNotesButton.click(async () => {
    const children = await server.get("notes/" + noteDetailService.getCurrentNoteId() + "/children");

    const maxY = mapData.notes.filter(note => !!note.y).map(note => note.y).reduce((a, b) => Math.max(a, b), 0);
    let curX = 100;
    let curY = maxY + 200;

    for (const child of children) {
        const note = {
            id: child.noteId,
            title: child.title,
            width: "auto",
            height: "auto"
        };

        mapData.notes.push(note);

        newNode(note.id, note.title, curX, curY, note.width, note.height);

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