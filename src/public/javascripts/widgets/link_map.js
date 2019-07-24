import libraryLoader from "../services/library_loader.js";
import linkMapDialog from "../dialogs/link_map.js";
import server from "../services/server.js";
import treeCache from "../services/tree_cache.js";
import linkService from "../services/link.js";

let linkMapContainerIdCtr = 1;

const TPL = `
<div style="outline: none; overflow: hidden;">
    <div class="link-map-container"></div>
</div>
`;

const linkOverlays = [
    [ "Arrow", {
        location: 1,
        id: "arrow",
        length: 10,
        width: 10,
        foldback: 0.7
    } ]
];

class LinkMapWidget {
    /**
     * @param {TabContext} ctx
     * @param {jQuery} $widget
     */
    constructor(ctx, $widget) {
        this.ctx = ctx;
        this.$widget = $widget;
        this.$title = this.$widget.find('.widget-title');
        this.$title.text("Link map");
        this.$headerActions = this.$widget.find('.widget-header-actions');

        const $showFullButton = $("<a>").append("show full").addClass('widget-header-action');
        $showFullButton.click(() => {
            linkMapDialog.showDialog();
        });

        this.$headerActions.append($showFullButton);
    }

    async renderBody() {
        const $body = this.$widget.find('.card-body');
        $body.html(TPL);

        this.$linkMapContainer = $body.find('.link-map-container');
        this.$linkMapContainer.attr("id", "link-map-container-" + linkMapContainerIdCtr++);

        await libraryLoader.requireLibrary(libraryLoader.LINK_MAP);

        jsPlumb.ready(() => {
            this.initJsPlumbInstance();

            this.initPanZoom();

            this.loadNotesAndRelations();
        });
    }

    async loadNotesAndRelations() {
        this.cleanup();

        const linkTypes = [ "hyper", "image", "relation", "relation-map" ];
        const maxNotes = 50;

        const noteId = this.ctx.note.noteId;

        const links = await server.post(`notes/${noteId}/link-map`, {
            linkTypes,
            maxNotes,
            maxDepth: 1
        });

        const noteIds = new Set(links.map(l => l.noteId).concat(links.map(l => l.targetNoteId)));

        if (noteIds.size === 0) {
            noteIds.add(noteId);
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

        const getNoteBox = noteId => {
            const noteBoxId = this.noteIdToId(noteId);
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

            if (noteId === noteId) {
                $noteBox.addClass("link-map-active-note");
            }

            this.$linkMapContainer.append($noteBox);

            this.jsPlumbInstance.draggable($noteBox[0], {
                start: params => {
                    renderer.stop();
                },
                drag: params => {},
                stop: params => {}
            });


            return $noteBox;
        };

        this.renderer = new Springy.Renderer(
            layout,
            () => {},
            (edge, p1, p2) => {
                const connectionId = edge.source.id + '-' + edge.target.id;

                if ($("#" + connectionId).length > 0) {
                    return;
                }

                getNoteBox(edge.source.id);
                getNoteBox(edge.target.id);

                const connection = this.jsPlumbInstance.connect({
                    source: this.noteIdToId(edge.source.id),
                    target: this.noteIdToId(edge.target.id),
                    type: 'link'
                });

                connection.canvas.id = connectionId;
            },
            (node, p) => {
                const $noteBox = getNoteBox(node.id);
                const middleW = this.$linkMapContainer.width() / 2;
                const middleH = this.$linkMapContainer.height() / 2;

                $noteBox
                    .css("left", (middleW + p.x * 100) + "px")
                    .css("top", (middleH + p.y * 100) + "px");
            },
            () => {},
            () => {},
            () => {
                this.jsPlumbInstance.repaintEverything();
            }
        );

        this.renderer.start();
    }

    initPanZoom() {
        if (this.pzInstance) {
            return;
        }

        this.pzInstance = panzoom(this.$linkMapContainer[0], {
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

    cleanup() {
        if (this.renderer) {
            this.renderer.stop();
        }

        // delete all endpoints and connections
        // this is done at this point (after async operations) to reduce flicker to the minimum
        this.jsPlumbInstance.deleteEveryEndpoint();

        // without this we still end up with note boxes remaining in the canvas
        this.$linkMapContainer.empty();

        // reset zoom/pan
        this.pzInstance.zoomTo(0, 0, 0.7);
        this.pzInstance.moveTo(0, 0);
    }

    initJsPlumbInstance() {
        if (this.jsPlumbInstance) {
            this.cleanup();

            return;
        }

        this.jsPlumbInstance = jsPlumb.getInstance({
            Endpoint: ["Blank", {}],
            ConnectionOverlays: linkOverlays,
            PaintStyle: { stroke: "var(--muted-text-color)", strokeWidth: 1 },
            HoverPaintStyle: { stroke: "var(--main-text-color)", strokeWidth: 1 },
            Container: this.$linkMapContainer.attr("id")
        });

        this.jsPlumbInstance.registerConnectionType("link", { anchor: "Continuous", connector: "Straight", overlays: linkOverlays });
    }

    noteIdToId(noteId) {
        return "link-map-note-" + noteId;
    }
}

export default LinkMapWidget;