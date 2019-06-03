import server from '../services/server.js';
import noteDetailService from "../services/note_detail.js";
import libraryLoader from "../services/library_loader.js";

const $linkMapContainer = $("#link-map-container");

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

const $dialog = $("#link-map-dialog");

let jsPlumbInstance = null;

async function showDialog() {
    glob.activeDialog = $dialog;

    await libraryLoader.requireLibrary(libraryLoader.RELATION_MAP);
    await libraryLoader.requireLibrary(libraryLoader.SPRINGY);

    jsPlumb.ready(() => {
        initJsPlumbInstance();

        loadNotesAndRelations();
    });

    $dialog.modal();
}

async function loadNotesAndRelations() {
    const noteId = noteDetailService.getActiveNoteId();

    const links = await server.get(`notes/${noteId}/link-map`);

    const noteIds = new Set(links.map(l => l.noteId).concat(links.map(l => l.targetNoteId)));

    const graph = new Springy.Graph();
    graph.addNodes(...noteIds);
    graph.addEdges(links.map(l => [l.noteId, l.targetNoteId]));

    const layout = new Springy.Layout.ForceDirected(
        graph,
        400.0, // Spring stiffness
        400.0, // Node repulsion
        0.5 // Damping
    );


    for (const link of links) {

    }
}

function initJsPlumbInstance() {
    if (jsPlumbInstance) {
        // delete all endpoints and connections
        // this is done at this point (after async operations) to reduce flicker to the minimum
        jsPlumbInstance.deleteEveryEndpoint();

        // without this we still end up with note boxes remaining in the canvas
        $linkMapContainer.empty();

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

export default {
    showDialog
};