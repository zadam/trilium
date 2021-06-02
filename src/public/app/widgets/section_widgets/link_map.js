import NoteContextAwareWidget from "../note_context_aware_widget.js";
import froca from "../../services/froca.js";
import libraryLoader from "../../services/library_loader.js";
import server from "../../services/server.js";
import appContext from "../../services/app_context.js";

const TPL = `
<div class="link-map-widget">
    <style>
        .link-map-widget {
            position: relative;
        }
        
        .link-map-container {
            height: 300px;
        }
    
        .open-full-button, .collapse-button {
            position: absolute;
            right: 5px;
            bottom: 5px;
            font-size: 180%;
            z-index: 1000;
        }
        
        .style-resolver {
            color: var(--muted-text-color);
            display: none;
        }
    </style>

    <button class="bx bx-arrow-to-bottom icon-action open-full-button" title="Open full"></button>
    <button class="bx bx-arrow-to-top icon-action collapse-button" style="display: none;" title="Collapse to normal size"></button>

    <div class="link-map-container"></div>
    
    <div class="style-resolver"></div>
</div>`;

export default class LinkMapWidget extends NoteContextAwareWidget {
    isEnabled() {
        return this.note;
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            title: 'Link Map',
            icon: 'bx bx-network-chart'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.$container = this.$widget.find(".link-map-container");

        this.openState = 'small';

        this.$openFullButton = this.$widget.find('.open-full-button');
        this.$openFullButton.on('click', () => {
            this.setFullHeight();

            this.$openFullButton.hide();
            this.$collapseButton.show();

            this.openState = 'full';
        });

        this.$collapseButton = this.$widget.find('.collapse-button');
        this.$collapseButton.on('click', () => {
            this.setSmallSize();

            this.$openFullButton.show();
            this.$collapseButton.hide();

            this.openState = 'small';
        });

        this.$styleResolver = this.$widget.find('.style-resolver');

        this.overflowing();

        window.addEventListener('resize', () => {
            if (!this.graph) { // no graph has been even rendered
                return;
            }

            if (this.openState === 'full') {
                this.setFullHeight();
            }
            else if (this.openState === 'small') {
                this.setSmallSize();
            }
        }, false);
    }

    setSmallSize() {
        const SMALL_SIZE_HEIGHT = 300;
        const width = this.$widget.width();

        this.$widget.find('.link-map-container')
            .css("height", SMALL_SIZE_HEIGHT)
            .css("width", width);

        this.graph
            .height(SMALL_SIZE_HEIGHT)
            .width(width);
    }

    setFullHeight() {
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

    setZoomLevel(level) {
        this.zoomLevel = level;
    }

    async refreshWithNote(note) {
        this.linkIdToLinkMap = {};
        this.noteIdToLinkCountMap = {};

        this.$container.empty();

        this.css = {
            fontFamily: this.$container.css("font-family"),
            textColor: this.rgb2hex(this.$container.css("color")),
            mutedTextColor: this.rgb2hex(this.$styleResolver.css("color"))
        };

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

        this.renderData(await this.loadNotesAndRelations(this.noteId,2));
    }

    renderData(data, zoomToFit = true, zoomPadding = 10) {
        this.graph.graphData(data);

        if (zoomToFit) {
            setTimeout(() => this.graph.zoomToFit(400, zoomPadding), 1000);
        }
    }

    async nodeClicked(node) {
        if (!node.expanded) {
            this.renderData(
                await this.loadNotesAndRelations(node.id,1),
                false
            );
        }
        else {
            await appContext.tabManager.getActiveContext().setNote(node.id);
        }
    }

    async loadNotesAndRelations(noteId, maxDepth) {
        const resp = await server.post(`notes/${noteId}/link-map`, {
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

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes().find(attr => attr.type === 'relation' && (attr.noteId === this.noteId || attr.value === this.noteId))) {
            this.refresh();
        }
    }
}
