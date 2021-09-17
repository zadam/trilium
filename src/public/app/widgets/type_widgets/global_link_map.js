import TypeWidget from "./type_widget.js";
import libraryLoader from "../../services/library_loader.js";
import server from "../../services/server.js";
import froca from "../../services/froca.js";

const TPL = `<div class="note-detail-global-link-map note-detail-printable">
    <style>
        .type-special .note-detail, .note-detail-global-link-map {
            height: 100%;
        }
    </style>

    <div class="link-map-container"></div>
</div>`;

export default class GlobalLinkMapTypeWidget extends TypeWidget {
    static getType() { return "globallinkmap"; }

    doRender() {
        this.$widget = $(TPL);

        this.$container = this.$widget.find(".link-map-container");

        window.addEventListener('resize', () => this.setFullHeight(), false);

        super.doRender();
    }

    setFullHeight() {
        if (!this.graph) { // no graph has been even rendered
            return;
        }

        const {top} = this.$widget[0].getBoundingClientRect();

        const height = $(window).height() - top;
        const width = this.$widget.width();

        this.$widget.find('.link-map-container')
            .css("height", height)
            .css("width", this.$widget.width());

        this.graph
            .height(height)
            .width(width);
    }

    async doRefresh(note) {
        this.$widget.show();

        this.setFullHeight();

        await libraryLoader.requireLibrary(libraryLoader.FORCE_GRAPH);

        this.graph = ForceGraph()(this.$container[0])
            .width(this.$container.width())
            .height(this.$container.height())
            .onZoom(zoom => this.setZoomLevel(zoom.k))
            .nodeRelSize(7)
            .nodeCanvasObject((node, ctx) => this.paintNode(node, this.stringToColor(node.type), ctx))
            .nodePointerAreaPaint((node, ctx) => this.paintNode(node, this.stringToColor(node.type), ctx))
            .nodeLabel(node => node.name)
            .maxZoom(7)
            .nodePointerAreaPaint((node, color, ctx) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
                ctx.fill();
            })
            .linkLabel(l => `${l.source.name} - <strong>${l.name}</strong> - ${l.target.name}`)
            .linkCanvasObject((link, ctx) => this.paintLink(link, ctx))
            .linkCanvasObjectMode(() => "after")
            .linkDirectionalArrowLength(4)
            .linkDirectionalArrowRelPos(1)
            .linkWidth(2)
            .linkColor(() => this.css.mutedTextColor)
            .d3VelocityDecay(0.2)
            .onNodeClick(node => this.nodeClicked(node));

        this.graph.d3Force('link').distance(50);

        this.graph.d3Force('center').strength(0.9);

        this.graph.d3Force('charge').strength(-30);
        this.graph.d3Force('charge').distanceMax(400);

        this.renderData(await this.loadNotesAndRelations());
    }

    stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        let colour = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            colour += ('00' + value.toString(16)).substr(-2);
        }
        return colour;
    }

    rgb2hex(rgb) {
        return `#${rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
            .slice(1)
            .map(n => parseInt(n, 10).toString(16).padStart(2, '0'))
            .join('')}`
    }

    setZoomLevel(level) {
        this.zoomLevel = level;
    }

    paintNode(node, color, ctx) {
        const {x, y} = node;

        ctx.fillStyle = node.id === this.noteId ? 'red' : color;
        ctx.beginPath();
        ctx.arc(x, y, node.id === this.noteId ? 8 : 4, 0, 2 * Math.PI, false);
        ctx.fill();

        if (this.zoomLevel < 2) {
            return;
        }

        if (!node.expanded) {
            ctx.fillStyle =  this.css.textColor;
            ctx.font = 10 + 'px ' + this.css.fontFamily;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("+", x, y + 0.5);
        }

        ctx.fillStyle = this.css.textColor;
        ctx.font = 5 + 'px ' + this.css.fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let title = node.name;

        if (title.length > 15) {
            title = title.substr(0, 15) + "...";
        }

        ctx.fillText(title, x, y + (node.id === this.noteId ? 11 : 7));
    }

    paintLink(link, ctx) {
        if (this.zoomLevel < 5) {
            return;
        }

        ctx.font = '3px ' + this.css.fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.css.mutedTextColor;

        const {source, target} = link;

        const x = (source.x + target.x) / 2;
        const y = (source.y + target.y) / 2;

        ctx.save();
        ctx.translate(x, y);

        const deltaY = source.y - target.y;
        const deltaX = source.x - target.x;

        let angle = Math.atan2(deltaY, deltaX);
        let moveY = 2;

        if (angle < -Math.PI / 2 || angle > Math.PI / 2) {
            angle += Math.PI;
            moveY = -2;
        }

        ctx.rotate(angle);
        ctx.fillText(link.name, 0, moveY);
        ctx.restore();
    }

    async loadNotesAndRelations(noteId, maxDepth) {
        this.linkIdToLinkMap = {};
        this.noteIdToLinkCountMap = {};

        const resp = await server.post(`notes/root/link-map`, {
            maxNotes: 1000,
            maxDepth
        });

        this.noteIdToLinkCountMap = {...this.noteIdToLinkCountMap, ...resp.noteIdToLinkCountMap};

        for (const link of resp.links) {
            this.linkIdToLinkMap[link.id] = link;
        }

        // preload all notes
        const notes = await froca.getNotes(Object.keys(this.noteIdToLinkCountMap), true);

        const noteIdToLinkIdMap = {};
        noteIdToLinkIdMap[this.noteId] = new Set(); // for case there are no relations
        const linksGroupedBySourceTarget = {};

        for (const link of Object.values(this.linkIdToLinkMap)) {
            noteIdToLinkIdMap[link.sourceNoteId] = noteIdToLinkIdMap[link.sourceNoteId] || new Set();
            noteIdToLinkIdMap[link.sourceNoteId].add(link.id);

            noteIdToLinkIdMap[link.targetNoteId] = noteIdToLinkIdMap[link.targetNoteId] || new Set();
            noteIdToLinkIdMap[link.targetNoteId].add(link.id);

            const key = `${link.sourceNoteId}-${link.targetNoteId}`;

            if (key in linksGroupedBySourceTarget) {
                if (!linksGroupedBySourceTarget[key].names.includes(link.name)) {
                    linksGroupedBySourceTarget[key].names.push(link.name);
                }
            }
            else {
                linksGroupedBySourceTarget[key] = {
                    id: key,
                    sourceNoteId: link.sourceNoteId,
                    targetNoteId: link.targetNoteId,
                    names: [link.name]
                }
            }
        }

        return {
            nodes: notes.map(note => ({
                id: note.noteId,
                name: note.title,
                type: note.type,
                expanded: this.noteIdToLinkCountMap[note.noteId] === noteIdToLinkIdMap[note.noteId].size
            })),
            links: Object.values(linksGroupedBySourceTarget).map(link => ({
                id: link.id,
                source: link.sourceNoteId,
                target: link.targetNoteId,
                name: link.names.join(", ")
            }))
        };
    }

    renderData(data, zoomToFit = true, zoomPadding = 10) {
        this.graph.graphData(data);

        if (zoomToFit && data.nodes.length > 1) {
            setTimeout(() => this.graph.zoomToFit(400, zoomPadding), 1000);
        }
    }
}
