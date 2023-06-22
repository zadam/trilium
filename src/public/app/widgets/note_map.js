import libraryLoader from "../services/library_loader.js";
import server from "../services/server.js";
import attributeService from "../services/attributes.js";
import hoistedNoteService from "../services/hoisted_note.js";
import appContext from "../components/app_context.js";
import NoteContextAwareWidget from "./note_context_aware_widget.js";
import linkContextMenuService from "../menus/link_context_menu.js";
import utils from "../services/utils.js";

const esc = utils.escapeHtml;

const TPL = `<div class="note-map-widget" style="position: relative;">
    <style>
        .note-detail-note-map {
            height: 100%;
            overflow: hidden;
        }
        
        .map-type-switcher {
            position: absolute; 
            top: 10px; 
            left: 10px; 
            z-index: 10; /* should be below dropdown (note actions) */
        }
        
        .map-type-switcher button.bx {
            font-size: 130%;
            padding: 1px 10px 1px 10px;
        }
    </style>
    
    <div class="btn-group btn-group-sm map-type-switcher" role="group">
      <button type="button" class="btn bx bx-network-chart" title="Link Map" data-type="link"></button>
      <button type="button" class="btn bx bx-sitemap" title="Tree map" data-type="tree"></button>
    </div>

    <div class="style-resolver"></div>

    <div class="note-map-container"></div>
</div>`;

export default class NoteMapWidget extends NoteContextAwareWidget {
    constructor(widgetMode) {
        super();

        this.widgetMode = widgetMode; // 'type' or 'ribbon'
    }

    doRender() {
        this.$widget = $(TPL);

        const documentStyle = window.getComputedStyle(document.documentElement);
        this.themeStyle = documentStyle.getPropertyValue('--theme-style')?.trim();

        this.$container = this.$widget.find(".note-map-container");
        this.$styleResolver = this.$widget.find('.style-resolver');

        new ResizeObserver(() => this.setDimensions()).observe(this.$container[0])

        this.$widget.find(".map-type-switcher button").on("click",  async e => {
            const type = $(e.target).closest("button").attr("data-type");

            await attributeService.setLabel(this.noteId, 'mapType', type);
        });

        super.doRender();
    }

    setDimensions() {
        if (!this.graph) { // no graph has been even rendered
            return;
        }

        const $parent = this.$widget.parent();

        this.graph
            .height($parent.height())
            .width($parent.width());
    }

    async refreshWithNote() {
        this.$widget.show();

        this.css = {
            fontFamily: this.$container.css("font-family"),
            textColor: this.rgb2hex(this.$container.css("color")),
            mutedTextColor: this.rgb2hex(this.$styleResolver.css("color"))
        };

        this.mapType = this.note.getLabelValue("mapType") === "tree" ? "tree" : "link";

        await libraryLoader.requireLibrary(libraryLoader.FORCE_GRAPH);

        this.graph = ForceGraph()(this.$container[0])
            .width(this.$container.width())
            .height(this.$container.height())
            .onZoom(zoom => this.setZoomLevel(zoom.k))
            .d3AlphaDecay(0.01)
            .d3VelocityDecay(0.08)
            .nodeCanvasObject((node, ctx) => this.paintNode(node, this.getColorForNode(node), ctx))
            .nodePointerAreaPaint((node, ctx) => this.paintNode(node, this.getColorForNode(node), ctx))
            .nodePointerAreaPaint((node, color, ctx) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, this.noteIdToSizeMap[node.id], 0, 2 * Math.PI, false);
                ctx.fill();
            })
            .nodeLabel(node => esc(node.name))
            .maxZoom(7)
            .warmupTicks(30)
            .linkDirectionalArrowLength(5)
            .linkDirectionalArrowRelPos(1)
            .linkWidth(1)
            .linkColor(() => this.css.mutedTextColor)
            .onNodeClick(node => appContext.tabManager.getActiveContext().setNote(node.id))
            .onNodeRightClick((node, e) => linkContextMenuService.openContextMenu(node.id, null, e));

        if (this.mapType === 'link') {
            this.graph
                .linkLabel(l => `${esc(l.source.name)} - <strong>${esc(l.name)}</strong> - ${esc(l.target.name)}`)
                .linkCanvasObject((link, ctx) => this.paintLink(link, ctx))
                .linkCanvasObjectMode(() => "after");
        }

        const mapRootNoteId = this.getMapRootNoteId();
        const data = await this.loadNotesAndRelations(mapRootNoteId);

        const nodeLinkRatio = data.nodes.length / data.links.length;
        const magnifiedRatio = Math.pow(nodeLinkRatio, 1.5);
        const charge = -20 / magnifiedRatio;
        const boundedCharge = Math.min(-3, charge);

        this.graph.d3Force('link').distance(40);
        this.graph.d3Force('center').strength(0.2);
        this.graph.d3Force('charge').strength(boundedCharge);
        this.graph.d3Force('charge').distanceMax(1000);

        this.renderData(data);
    }

    getMapRootNoteId() {
        if (this.widgetMode === 'ribbon') {
            return this.noteId;
        }

        let mapRootNoteId = this.note.getLabelValue("mapRootNoteId");

        if (mapRootNoteId === 'hoisted') {
            mapRootNoteId = hoistedNoteService.getHoistedNoteId();
        } else if (!mapRootNoteId) {
            mapRootNoteId = appContext.tabManager.getActiveContext().parentNoteId;
        }

        return mapRootNoteId;
    }

    getColorForNode(node) {
        if (node.color) {
            return node.color;
        } else if (this.widgetMode === 'ribbon' && node.id === this.noteId) {
            return 'red'; // subtree root mark as red
        } else {
            return this.generateColorFromString(node.type);
        }
    }

    generateColorFromString(str) {
        if (this.themeStyle === "dark") {
            str = `0${str}`; // magic lightning modifier
        }

        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        let color = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;

            color += (`00${value.toString(16)}`).substr(-2);
        }
        return color;
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

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI, false);
        ctx.fill();

        const toRender = this.zoomLevel > 2
            || (this.zoomLevel > 1 && size > 6)
            || (this.zoomLevel > 0.3 && size > 10);

        if (!toRender) {
            return;
        }

        ctx.fillStyle = this.css.textColor;
        ctx.font = `${size}px ${this.css.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let title = node.name;

        if (title.length > 15) {
            title = `${title.substr(0, 15)}...`;
        }

        ctx.fillText(title, x, y + Math.round(size * 1.5));
    }

    paintLink(link, ctx) {
        if (this.zoomLevel < 5) {
            return;
        }

        ctx.font = `3px ${this.css.fontFamily}`;
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

    async loadNotesAndRelations(mapRootNoteId) {
        const resp = await server.post(`note-map/${mapRootNoteId}/${this.mapType}`);

        this.calculateNodeSizes(resp);

        const links = this.getGroupedLinks(resp.links);

        this.nodes = resp.notes.map(([noteId, title, type, color]) => ({
            id: noteId,
            name: title,
            type: type,
            color: color
        }));

        return {
            nodes: this.nodes,
            links: links.map(link => ({
                id: `${link.sourceNoteId}-${link.targetNoteId}`,
                source: link.sourceNoteId,
                target: link.targetNoteId,
                name: link.names.join(", ")
            }))
        };
    }

    getGroupedLinks(links) {
        const linksGroupedBySourceTarget = {};

        for (const link of links) {
            const key = `${link.sourceNoteId}-${link.targetNoteId}`;

            if (key in linksGroupedBySourceTarget) {
                if (!linksGroupedBySourceTarget[key].names.includes(link.name)) {
                    linksGroupedBySourceTarget[key].names.push(link.name);
                }
            } else {
                linksGroupedBySourceTarget[key] = {
                    id: key,
                    sourceNoteId: link.sourceNoteId,
                    targetNoteId: link.targetNoteId,
                    names: [link.name]
                }
            }
        }

        return Object.values(linksGroupedBySourceTarget);
    }

    calculateNodeSizes(resp) {
        this.noteIdToSizeMap = {};

        if (this.mapType === 'tree') {
            const {noteIdToDescendantCountMap} = resp;

            for (const noteId in noteIdToDescendantCountMap) {
                this.noteIdToSizeMap[noteId] = 4;

                const count = noteIdToDescendantCountMap[noteId];

                if (count > 0) {
                    this.noteIdToSizeMap[noteId] += 1 + Math.round(Math.log(count) / Math.log(1.5));
                }
            }
        }
        else if (this.mapType === 'link') {
            const noteIdToLinkCount = {};

            for (const link of resp.links) {
                noteIdToLinkCount[link.targetNoteId] = 1 + (noteIdToLinkCount[link.targetNoteId] || 0);
            }

            for (const [noteId] of resp.notes) {
                this.noteIdToSizeMap[noteId] = 4;

                if (noteId in noteIdToLinkCount) {
                    this.noteIdToSizeMap[noteId] += Math.min(Math.pow(noteIdToLinkCount[noteId], 0.5), 15);
                }
            }
        }
    }

    renderData(data) {
        this.graph.graphData(data);

        if (this.widgetMode === 'ribbon' && this.note?.type !== 'search') {
            setTimeout(() => {
                this.setDimensions();

                const subGraphNoteIds = this.getSubGraphConnectedToCurrentNote(data);

                this.graph.zoomToFit(400, 50, node => subGraphNoteIds.has(node.id));

                if (subGraphNoteIds.size < 30) {
                    this.graph.d3VelocityDecay(0.4);
                }
            }, 1000);
        }
        else {
            if (data.nodes.length > 1) {
                setTimeout(() => {
                    this.setDimensions();

                    const noteIdsWithLinks = this.getNoteIdsWithLinks(data);

                    if (noteIdsWithLinks.size > 0) {
                        this.graph.zoomToFit(400, 30, node => noteIdsWithLinks.has(node.id));
                    }

                    if (noteIdsWithLinks.size < 30) {
                        this.graph.d3VelocityDecay(0.4);
                    }
                }, 1000);
            }
        }
    }

    getNoteIdsWithLinks(data) {
        const noteIds = new Set();

        for (const link of data.links) {
            noteIds.add(link.source.id);
            noteIds.add(link.target.id);
        }

        return noteIds;
    }

    getSubGraphConnectedToCurrentNote(data) {
        function getGroupedLinks(links, type) {
            const map = {};

            for (const link of links) {
                const key = link[type].id;
                map[key] = map[key] || [];
                map[key].push(link);
            }

            return map;
        }

        const linksBySource = getGroupedLinks(data.links, "source");
        const linksByTarget = getGroupedLinks(data.links, "target");

        const subGraphNoteIds = new Set();

        function traverseGraph(noteId) {
            if (subGraphNoteIds.has(noteId)) {
                return;
            }

            subGraphNoteIds.add(noteId);

            for (const link of linksBySource[noteId] || []) {
                traverseGraph(link.target.id);
            }

            for (const link of linksByTarget[noteId] || []) {
                traverseGraph(link.source.id);
            }
        }

        traverseGraph(this.noteId);
        return subGraphNoteIds;
    }

    cleanup() {
        this.$container.html('');
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes(this.componentId).find(
            attr =>
                attr.type === 'label'
                && ['mapType', 'mapRootNoteId'].includes(attr.name)
                && attributeService.isAffecting(attr, this.note)
        )) {
            this.refresh();
        }
    }
}
