import libraryLoader from "./library_loader.js";
import server from "./server.js";
import froca from "./froca.js";

export default class LinkMap {
    constructor(note, $linkMapContainer, options = {}) {
        this.note = note;
        this.options = Object.assign({
            maxDepth: 10,
            maxNotes: 100,
            zoom: 1.0
        }, options);

        this.$linkMapContainer = $linkMapContainer;

        this.zoomLevel = 1;
    }

    setZoomLevel(level) {
        this.zoomLevel = level;
    }

    async render() {
        await libraryLoader.requireLibrary(libraryLoader.FORCE_GRAPH);

        this.graph = ForceGraph()(this.$linkMapContainer[0])
            .width(this.options.width)
            .height(this.options.height)
            .onZoom(zoom => this.setZoomLevel(zoom.k))
            .nodeRelSize(7)
            .nodeCanvasObject((node, ctx) => this.paintNode(node, this.stringToColor(node.type), ctx))
            .nodePointerAreaPaint((node, ctx) => this.paintNode(node, this.stringToColor(node.type), ctx))
            .nodeLabel(node => node.name)
            .maxZoom(5)
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
            .linkColor("#ddd")
            .d3VelocityDecay(0.2)
            .onNodeClick(node => this.nodeClicked(node));

        this.graph.d3Force('link').distance(50);

        this.graph.d3Force('center').strength(0.9);

        this.graph.d3Force('charge').strength(-30);
        this.graph.d3Force('charge').distanceMax(400);

        this.renderData(await this.loadNotesAndRelations());
    }

    renderData(data, zoomToFit = true, zoomPadding = 10) {
        this.graph.graphData(data);

        if (zoomToFit) {
            setTimeout(() => this.graph.zoomToFit(400, zoomPadding), 1000);
        }
    }

    setHeight(height) {
        this.graph.height(height);
    }

    centerOnNode(node) {
        this.nodeClicked(node);

        this.graph.centerAt(node.x, node.y, 1000);
        this.graph.zoom(6, 2000);
    }

    async nodeClicked(node) {
        if (!node.expanded) {
            const neighborGraph = await fetchNeighborGraph(node.id);

            addToTasGraph(neighborGraph);

            renderData(getTasGraph(), false);
        }
    }

    async loadNotesAndRelations(options = {}) {
        this.options = Object.assign(this.options, options);

        const links = await server.post(`notes/${this.note.noteId}/link-map`, {
            maxNotes: this.options.maxNotes,
            maxDepth: this.options.maxDepth
        });

        const noteIds = new Set(links.map(l => l.noteId).concat(links.map(l => l.targetNoteId)));

        if (noteIds.size === 0) {
            noteIds.add(this.note.noteId);
        }

        // preload all notes
        const notes = await froca.getNotes(Array.from(noteIds), true);

        return {
            nodes: notes.map(note => ({
                id: note.noteId,
                name: note.title,
                type: note.type
            })),
            links: links.map(link => ({
                id: link.noteId + "-" + link.name + "-" + link.targetNoteId,
                source: link.noteId,
                target: link.targetNoteId,
                name: link.name
            }))
        };
    }

    cleanup() {
    }

    paintLink(link, ctx) {
        if (this.zoomLevel < 3) {
            return;
        }

        ctx.font = '3px MontserratLight';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = "grey";

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

    paintNode(node, color, ctx) {
        const {x, y} = node;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI, false);
        ctx.fill();

        if (this.zoomLevel < 2) {
            return;
        }

        if (!node.expanded) {
            ctx.fillStyle =  color;
            ctx.font = 10 + 'px MontserratLight';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("+", x, y + 1);
        }

        ctx.fillStyle = "#555";
        ctx.font = 5 + 'px MontserratLight';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let title = node.name;

        if (title.length > 15) {
            title = title.substr(0, 15) + "...";
        }

        ctx.fillText(title, x, y + 7);
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
}
