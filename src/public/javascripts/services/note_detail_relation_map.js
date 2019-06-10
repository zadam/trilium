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

let containerCounter = 1;

class NoteDetailRelationMap {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$component = ctx.$tabContent.find(".note-detail-relation-map");
        this.$relationMapContainer = ctx.$tabContent.find(".relation-map-container");
        this.$createChildNote = ctx.$tabContent.find(".relation-map-create-child-note");
        this.$zoomInButton = ctx.$tabContent.find(".relation-map-zoom-in");
        this.$zoomOutButton = ctx.$tabContent.find(".relation-map-zoom-out");
        this.$resetPanZoomButton = ctx.$tabContent.find(".relation-map-reset-pan-zoom");

        this.mapData = null;
        this.jsPlumbInstance = null;
        // outside of mapData because they are not persisted in the note content
        this.relations = null;
        this.pzInstance = null;

        this.$relationMapWrapper = ctx.$tabContent.find('.relation-map-wrapper');
        this.$relationMapWrapper.click(event => {
            if (this.clipboard) {
                let {x, y} = this.getMousePosition(event);

                // modifying position so that cursor is on the top-center of the box
                x -= 80;
                y -= 15;

                this.createNoteBox(this.clipboard.noteId, this.clipboard.title, x, y);

                this.mapData.notes.push({ noteId: this.clipboard.noteId, x, y });

                this.saveData();

                this.clipboard = null;
            }

            return true;
        });

        this.$relationMapContainer.attr("id", "relation-map-container-" + (containerCounter++));
        this.$relationMapContainer.on("contextmenu", ".note-box", e => {
            contextMenuWidget.initContextMenu(e, {
                getContextMenuItems: () => {
                    return [
                        {title: "Open in new tab", cmd: "open-in-new-tab", uiIcon: "empty"},
                        {title: "Remove note", cmd: "remove", uiIcon: "trash"},
                        {title: "Edit title", cmd: "edit-title", uiIcon: "pencil"},
                    ];
                },
                selectContextMenuItem: (event, cmd) => this.tabContextMenuHandler(event, cmd)
            });

            return false;
        });

        this.clipboard = null;

        this.$createChildNote.click(async () => {
            const title = await promptDialog.ask({ message: "Enter title of new note",  defaultValue: "new note" });

            if (!title.trim()) {
                return;
            }

            const {note} = await server.post(`notes/${this.ctx.note.noteId}/children`, {
                title,
                target: 'into'
            });

            infoService.showMessage("Click on canvas to place new note");

            // reloading tree so that the new note appears there
            // no need to wait for it to finish
            treeService.reload();

            this.clipboard = { noteId: note.noteId, title };
        });

        this.$resetPanZoomButton.click(() => {
            // reset to initial pan & zoom state
            this.pzInstance.zoomTo(0, 0, 1 / this.getZoom());
            this.pzInstance.moveTo(0, 0);
        });

        this.$component.on("drop", ev => this.dropNoteOntoRelationMapHandler(ev));
        this.$component.on("dragover", ev => ev.preventDefault());
    }

    async tabContextMenuHandler(event, cmd) {
        const $noteBox = $(event.originalTarget).closest(".note-box");
        const $title = $noteBox.find(".title a");
        const noteId = this.idToNoteId($noteBox.prop("id"));

        if (cmd === "open-in-new-tab") {
            noteDetailService.openInTab(noteId);
        }
        else if (cmd === "remove") {
            if (!await confirmDialog.confirmDeleteNoteBoxWithNote($title.text())) {
                return;
            }

            this.jsPlumbInstance.remove(this.noteIdToId(noteId));

            if (confirmDialog.isDeleteNoteChecked()) {
                await server.remove("notes/" + noteId);

                // to force it to disappear from the tree
                treeService.reload();
            }

            this.mapData.notes = this.mapData.notes.filter(note => note.noteId !== noteId);

            this.relations = this.relations.filter(relation => relation.sourceNoteId !== noteId && relation.targetNoteId !== noteId);

            this.saveData();
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

    loadMapData() {
        this.mapData = {
            notes: [],
            // it is important to have this exact value here so that initial transform is same as this
            // which will guarantee note won't be saved on first conversion to relation map note type
            // this keeps the principle that note type change doesn't destroy note content unless user
            // does some actual change
            transform: {
                x: 0,
                y: 0,
                scale: 1
            }
        };

        if (this.ctx.note.content) {
            try {
                this.mapData = JSON.parse(this.ctx.note.content);
            } catch (e) {
                console.log("Could not parse content: ", e);
            }
        }
    }

    noteIdToId(noteId) {
        return "rel-map-note-" + noteId;
    }

    idToNoteId(id) {
        return id.substr(13);
    }

    async render() {
        this.$component.show();

        await libraryLoader.requireLibrary(libraryLoader.RELATION_MAP);

        this.loadMapData();

        jsPlumb.ready(() => {
            this.initJsPlumbInstance();

            this.initPanZoom();

            this.loadNotesAndRelations();
        });

    }

    clearMap() {
        // delete all endpoints and connections
        // this is done at this point (after async operations) to reduce flicker to the minimum
        this.jsPlumbInstance.deleteEveryEndpoint();

        // without this we still end up with note boxes remaining in the canvas
        this.$relationMapContainer.empty();
    }

    async loadNotesAndRelations() {
        const noteIds = this.mapData.notes.map(note => note.noteId);
        const data = await server.post("notes/relation-map", {noteIds});

        this.relations = [];

        for (const relation of data.relations) {
            const match = this.relations.find(rel =>
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

            this.relations.push(relation);
        }

        this.mapData.notes = this.mapData.notes.filter(note => note.noteId in data.noteTitles);

        this.jsPlumbInstance.batch(async () => {
            this.clearMap();

            for (const note of this.mapData.notes) {
                const title = data.noteTitles[note.noteId];

                await this.createNoteBox(note.noteId, title, note.x, note.y);
            }

            for (const relation of this.relations) {
                if (!relation.render) {
                    continue;
                }

                const connection = this.jsPlumbInstance.connect({
                    source: this.noteIdToId(relation.sourceNoteId),
                    target: this.noteIdToId(relation.targetNoteId),
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
                this.jsPlumbInstance.connect({
                    source: this.noteIdToId(link.sourceNoteId),
                    target: this.noteIdToId(link.targetNoteId),
                    type: 'link'
                });
            }
        });
    }

    initPanZoom() {
        if (this.pzInstance) {
            return;
        }

        this.pzInstance = panzoom(this.$relationMapContainer[0], {
            maxZoom: 2,
            minZoom: 0.3,
            smoothScroll: false,
            filterKey: function(e, dx, dy, dz) {
                // if ALT is pressed then panzoom should bubble the event up
                // this is to preserve ALT-LEFT, ALT-RIGHT navigation working
                return e.altKey;
            }
        });

        this.pzInstance.on('transform', () => { // gets triggered on any transform change
            this.jsPlumbInstance.setZoom(this.getZoom());

            this.saveCurrentTransform();
        });

        if (this.mapData.transform) {
            this.pzInstance.zoomTo(0, 0, this.mapData.transform.scale);

            this.pzInstance.moveTo(this.mapData.transform.x, this.mapData.transform.y);
        }
        else {
            // set to initial coordinates
            this.pzInstance.moveTo(0, 0);
        }

        this.$zoomInButton.click(() => this.pzInstance.zoomTo(0, 0, 1.2));
        this.$zoomOutButton.click(() => this.pzInstance.zoomTo(0, 0, 0.8));
    }

    saveCurrentTransform() {
        const newTransform = this.pzInstance.getTransform();

        if (JSON.stringify(newTransform) !== JSON.stringify(this.mapData.transform)) {
            // clone transform object
            this.mapData.transform = JSON.parse(JSON.stringify(newTransform));

            this.saveData();
        }
    }

    cleanup() {
        if (this.jsPlumbInstance) {
            this.clearMap();
        }

        if (this.pzInstance) {
            this.pzInstance.dispose();
            this.pzInstance = null;
        }
    }

    initJsPlumbInstance () {
        if (this.jsPlumbInstance) {
            this.cleanup();

            return;
        }

        this.jsPlumbInstance = jsPlumb.getInstance({
            Endpoint: ["Dot", {radius: 2}],
            Connector: "StateMachine",
            ConnectionOverlays: uniDirectionalOverlays,
            HoverPaintStyle: { stroke: "#777", strokeWidth: 1 },
            Container: this.$relationMapContainer.attr("id")
        });

        this.jsPlumbInstance.registerConnectionType("uniDirectional", { anchor:"Continuous", connector:"StateMachine", overlays: uniDirectionalOverlays });

        this.jsPlumbInstance.registerConnectionType("biDirectional", { anchor:"Continuous", connector:"StateMachine", overlays: biDirectionalOverlays });

        this.jsPlumbInstance.registerConnectionType("inverse", { anchor:"Continuous", connector:"StateMachine", overlays: inverseRelationsOverlays });

        this.jsPlumbInstance.registerConnectionType("link", { anchor:"Continuous", connector:"StateMachine", overlays: linkOverlays });

        this.jsPlumbInstance.bind("connection", (info, originalEvent) => this.connectionCreatedHandler(info, originalEvent));
    }

    async connectionCreatedHandler(info, originalEvent) {
        const connection = info.connection;

        connection.bind("contextmenu", (obj, event) => {
            if (connection.getType().includes("link")) {
                // don't create context menu if it's a link since there's nothing to do with link from relation map
                // (don't open browser menu either)
                event.preventDefault();
            }
            else {
                event.preventDefault();
                event.stopPropagation();

                contextMenuWidget.initContextMenu(event, {
                    getContextMenuItems: () => {
                        return [ {title: "Remove relation", cmd: "remove", uiIcon: "trash"} ];
                    },
                    selectContextMenuItem: async (event, cmd) => {
                        if (cmd === 'remove') {
                            if (!await confirmDialog.confirm("Are you sure you want to remove the relation?")) {
                                return;
                            }

                            const relation = this.relations.find(rel => rel.attributeId === connection.id);

                            await server.remove(`notes/${relation.sourceNoteId}/relations/${relation.name}/to/${relation.targetNoteId}`);

                            this.jsPlumbInstance.deleteConnection(connection);

                            this.relations = this.relations.filter(relation => relation.attributeId !== connection.id);
                        }
                    }
                });
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
            this.jsPlumbInstance.deleteConnection(connection);

            return;
        }

        const targetNoteId = this.idToNoteId(connection.target.id);
        const sourceNoteId = this.idToNoteId(connection.source.id);

        const relationExists = this.relations.some(rel =>
            rel.targetNoteId === targetNoteId
            && rel.sourceNoteId === sourceNoteId
            && rel.name === name);

        if (relationExists) {
            await infoDialog.info("Connection '" + name + "' between these notes already exists.");

            this.jsPlumbInstance.deleteConnection(connection);

            return;
        }

        await server.put(`notes/${sourceNoteId}/relations/${name}/to/${targetNoteId}`);

        await this.refresh();
    }

    saveData() {
        this.ctx.noteChanged();
    }

    async createNoteBox(noteId, title, x, y) {
        const $link = await linkService.createNoteLink(noteId, title);
        $link.mousedown(e => {
            console.log(e);

            linkService.goToLink(e);
        });

        const $noteBox = $("<div>")
            .addClass("note-box")
            .prop("id", this.noteIdToId(noteId))
            .append($("<span>").addClass("title").append($link))
            .append($("<div>").addClass("endpoint").attr("title", "Start dragging relations from here and drop them on another note."))
            .css("left", x + "px")
            .css("top", y + "px");

        this.jsPlumbInstance.getContainer().appendChild($noteBox[0]);

        this.jsPlumbInstance.draggable($noteBox[0], {
            start: params => {},
            drag: params => {},
            stop: params => {
                const noteId = this.idToNoteId(params.el.id);

                const note = this.mapData.notes.find(note => note.noteId === noteId);

                if (!note) {
                    console.error(`Note ${noteId} not found!`);
                    return;
                }

                [note.x, note.y] = params.finalPos;

                this.saveData();
            }
        });

        this.jsPlumbInstance.makeSource($noteBox[0], {
            filter: ".endpoint",
            anchor: "Continuous",
            connectorStyle: { stroke: "#000", strokeWidth: 1 },
            connectionType: "basic",
            extract:{
                "action": "the-action"
            }
        });

        this.jsPlumbInstance.makeTarget($noteBox[0], {
            dropOptions: { hoverClass: "dragHover" },
            anchor: "Continuous",
            allowLoopback: true
        });
    }

    async refresh() {
        await this.loadNotesAndRelations();
    }

    getZoom() {
        const matrixRegex = /matrix\((-?\d*\.?\d+),\s*0,\s*0,\s*-?\d*\.?\d+,\s*-?\d*\.?\d+,\s*-?\d*\.?\d+\)/;

        const transform = this.$relationMapContainer.css('transform');

        const matches = transform.match(matrixRegex);

        if (!matches) {
            throw new Error("Cannot match transform: " + transform);
        }

        return matches[1];
    }

    async dropNoteOntoRelationMapHandler(ev) {
        ev.preventDefault();

        const notes = JSON.parse(ev.originalEvent.dataTransfer.getData("text"));

        let {x, y} = this.getMousePosition(ev);

        for (const note of notes) {
            const exists = this.mapData.notes.some(n => n.noteId === note.noteId);

            if (exists) {
                infoService.showError(`Note "${note.title}" is already in the diagram.`);

                continue;
            }

            this.mapData.notes.push({noteId: note.noteId, x, y});

            if (x > 1000) {
                y += 100;
                x = 0;
            }
            else {
                x += 200;
            }
        }

        this.saveData();

        await this.refresh();
    }

    getMousePosition(evt) {
        const rect = this.$relationMapContainer[0].getBoundingClientRect();

        const zoom = this.getZoom();

        return {
            x: (evt.clientX - rect.left) / zoom,
            y: (evt.clientY - rect.top) / zoom
        };
    }

    getContent() {
        return JSON.stringify(this.mapData);
    }

    focus() {}

    onNoteChange() {}

    scrollToTop() {}
}

export default NoteDetailRelationMap;