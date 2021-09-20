import TypeWidget from "./type_widget.js";
import libraryLoader from "../../services/library_loader.js";
import server from "../../services/server.js";
import attributeService from "../../services/attributes.js";

const TPL = `<div class="note-detail-note-map note-detail-printable" style="position: relative;">
    <style>
        .type-special .note-detail, .note-detail-note-map {
            height: 100%;
        }
        
        .map-type-switcher {
            position: absolute; 
            top: 10px; 
            right: 10px; 
            background-color: var(--accented-background-color);
            z-index: 1000;
        }
        
        .map-type-switcher .bx {
            font-size: x-large;
        }
    </style>
    
    <div class="btn-group btn-group-sm map-type-switcher" role="group">
      <button type="button" class="btn btn-secondary" title="Link Map" data-type="link"><span class="bx bx-network-chart"></span></button>
      <button type="button" class="btn btn-secondary" title="Tree map" data-type="tree"><span class="bx bx-sitemap"></span></button>
    </div>

    <div class="note-map-container"></div>
</div>`;

export default class NoteMapTypeWidget extends TypeWidget {
    static getType() { return "note-map"; }

    doRender() {
        this.$widget = $(TPL);

        this.$container = this.$widget.find(".note-map-container");

        window.addEventListener('resize', () => this.setFullHeight(), false);

        this.$widget.find(".map-type-switcher button").on("click",  async e => {
            const type = $(e.target).closest("button").attr("data-type");

            await attributeService.setLabel(this.noteId, 'mapType', type);
        });

        super.doRender();
    }

    setFullHeight() {
        if (!this.graph) { // no graph has been even rendered
            return;
        }

        const {top} = this.$widget[0].getBoundingClientRect();

        const height = $(window).height() - top;
        const width = this.$widget.width();

        this.$widget.find('.note-map-container')
            .css("height", height)
            .css("width", this.$widget.width());

        this.graph
            .height(height)
            .width(width);
    }

    async doRefresh(note) {
        this.$widget.show();

        this.mapType = this.note.getLabelValue("mapType") === "tree" ? "tree" : "link";

        this.setFullHeight();

        await libraryLoader.requireLibrary(libraryLoader.FORCE_GRAPH);

        this.graph = ForceGraph()(this.$container[0])
            .width(this.$container.width())
            .height(this.$container.height())
            .onZoom(zoom => this.setZoomLevel(zoom.k))
            .d3AlphaDecay(0.01)
            .d3VelocityDecay(0.08)
            .nodeCanvasObject((node, ctx) => this.paintNode(node, this.stringToColor(node.type), ctx))
            .nodePointerAreaPaint((node, ctx) => this.paintNode(node, this.stringToColor(node.type), ctx))
            .nodeLabel(node => node.name)
            .maxZoom(7)
            .nodePointerAreaPaint((node, color, ctx) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, this.noteIdToSizeMap[node.id], 0, 2 * Math.PI, false);
                ctx.fill();
            })
            .linkLabel(l => `${l.source.name} - <strong>${l.name}</strong> - ${l.target.name}`)
            .linkCanvasObject((link, ctx) => this.paintLink(link, ctx))
            .linkCanvasObjectMode(() => "after")
            .warmupTicks(10)
//            .linkDirectionalArrowLength(5)
            .linkDirectionalArrowRelPos(1)
            .linkWidth(1)
            .linkColor(() => this.css.mutedTextColor)
//            .d3VelocityDecay(0.2)
//            .dagMode("radialout")
            .onNodeClick(node => this.nodeClicked(node));

        this.graph.d3Force('link').distance(40);
        //
        this.graph.d3Force('center').strength(0.01);
        //
        this.graph.d3Force('charge').strength(-30);


        this.graph.d3Force('charge').distanceMax(1000);

        const data = await this.loadNotesAndRelations();

        this.renderData(data);
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
        const size = this.noteIdToSizeMap[node.id];

        ctx.fillStyle = node.id === this.noteId ? 'red' : color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI, false);
        ctx.fill();

        const toRender = this.zoomLevel > 2
            || (this.zoomLevel > 1 && size > 6)
            || (this.zoomLevel > 0.3 && size > 10);

        if (!toRender) {
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
        ctx.font = size + 'px ' + this.css.fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let title = node.name;

        if (title.length > 15) {
            title = title.substr(0, 15) + "...";
        }

        ctx.fillText(title, x, y + Math.round(size * 1.5));
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

    async loadNotesAndRelations() {
        this.linkIdToLinkMap = {};
        this.noteIdToLinkCountMap = {};

        const resp = await server.post(`note-map/${this.mapType}`);

        this.noteIdToLinkCountMap = resp.noteIdToLinkCountMap;

        this.calculateSizes(resp.noteIdToDescendantCountMap);

        for (const link of resp.links) {
            this.linkIdToLinkMap[link.id] = link;
        }

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
            nodes: resp.notes.map(([noteId, title, type]) => ({
                id: noteId,
                name: title,
                type: type,
                expanded: true
            })),
            links: Object.values(linksGroupedBySourceTarget).map(link => ({
                id: link.id,
                source: link.sourceNoteId,
                target: link.targetNoteId,
                name: link.names.join(", ")
            }))
        };
    }

    calculateSizes(noteIdToDescendantCountMap) {
        this.noteIdToSizeMap = {};

        for (const noteId in noteIdToDescendantCountMap) {
            this.noteIdToSizeMap[noteId] = 4;

            const count = noteIdToDescendantCountMap[noteId];

            if (count > 0) {
                this.noteIdToSizeMap[noteId] += 1 + Math.round(Math.log(count) / Math.log(1.5));
            }
        }
    }

    renderData(data, zoomToFit = true, zoomPadding = 10) {
        this.graph.graphData(data);

        if (zoomToFit && data.nodes.length > 1) {
            setTimeout(() => this.graph.zoomToFit(400, zoomPadding), 1000);
        }
    }

    cleanup() {
        this.$container.html('');
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes(this.componentId).find(attr => attr.name === 'mapType' && attributeService.isAffecting(attr, this.note))) {
            this.refresh();
        }
    }
}
