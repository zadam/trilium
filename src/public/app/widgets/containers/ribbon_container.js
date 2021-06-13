import NoteContextAwareWidget from "../note_context_aware_widget.js";

const TPL = `
<div class="ribbon-container">
    <style>
    .ribbon-container {
        margin-bottom: 5px;
    }
    
    .ribbon-top-row {
        display: flex;
    }
    
    .ribbon-tab-container {
        display: flex;
        flex-direction: row;
        justify-content: center;
        margin-left: 10px;
        flex-grow: 1;
        flex-flow: row wrap;
    }
    
    .ribbon-tab-title {
        color: var(--muted-text-color);
        border-bottom: 1px solid var(--main-border-color); 
        min-width: 24px;
        flex-basis: 24px;
        max-width: fit-content;
        flex-grow: 10;
    }

    .ribbon-tab-title .bx {
        font-size: 150%;
        position: relative;
        top: 3px;
    }
    
    .ribbon-tab-title.active {
        color: var(--main-text-color);
        border-bottom: 1px solid var(--main-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .ribbon-tab-title:hover {
        cursor: pointer;
    }

    .ribbon-tab-title:hover {
        color: var(--main-text-color);
    }
    
    .ribbon-tab-title:first-of-type {
        padding-left: 10px;
    }
    
    .ribbon-tab-spacer {
        flex-basis: 0;
        min-width: 0;
        max-width: 35px;
        flex-grow: 1;
        border-bottom: 1px solid var(--main-border-color);
    }
        
    .ribbon-tab-spacer:last-of-type {
        flex-grow: 1;
        flex-basis: 0;
        min-width: 0;
        max-width: 10000px;
    }
    
    .ribbon-button-container {
        display: flex;
        border-bottom: 1px solid var(--main-border-color); 
        margin-right: 5px;
    }
    
    .ribbon-button-container .icon-action {
        padding: 5px;
    }
    
    .ribbon-button-container > * {
        position: relative;
        top: -3px;
        margin-left: 10px;
    }
    
    .ribbon-body {
        display: none;
        border-bottom: 1px solid var(--main-border-color);
        margin-left: 10px;
        margin-right: 10px;
    }
    
    .ribbon-body.active {
        display: block;
    }
    
    .ribbon-tab-title-label {
        display: none;
    }
    
    .ribbon-tab-title.active .ribbon-tab-title-label {
        display: inline;
    }
    </style>

    <div class="ribbon-top-row">
        <div class="ribbon-tab-container"></div>
        <div class="ribbon-button-container"></div>
    </div>
    
    <div class="ribbon-body-container"></div>
</div>`;

export default class RibbonContainer extends NoteContextAwareWidget {
    constructor() {
        super();

        this.contentSized();
        this.ribbonWidgets = [];
        this.buttonWidgets = [];
    }

    ribbon(widget) {
        super.child(widget);

        this.ribbonWidgets.push(widget);

        return this;
    }

    button(widget) {
        super.child(widget);

        this.buttonWidgets.push(widget);

        return this;
    }

    doRender() {
        this.$widget = $(TPL);

        this.$tabContainer = this.$widget.find('.ribbon-tab-container');
        this.$buttonContainer = this.$widget.find('.ribbon-button-container');
        this.$bodyContainer = this.$widget.find('.ribbon-body-container');

        for (const ribbonWidget of this.ribbonWidgets) {
            this.$bodyContainer.append(
                $('<div class="ribbon-body">')
                    .attr('data-ribbon-component-id', ribbonWidget.componentId)
                    .append(ribbonWidget.render())
            );
        }

        for (const buttonWidget of this.buttonWidgets) {
            this.$buttonContainer.append(buttonWidget.render());
        }

        this.$tabContainer.on('click', '.ribbon-tab-title', e => {
            const $ribbonTitle = $(e.target).closest('.ribbon-tab-title');

            const activate = !$ribbonTitle.hasClass("active");

            this.$tabContainer.find('.ribbon-tab-title').removeClass("active");
            this.$bodyContainer.find('.ribbon-body').removeClass("active");

            if (activate) {
                const ribbonComponendId = $ribbonTitle.attr('data-ribbon-component-id');

                this.lastActiveComponentId = ribbonComponendId;

                this.$tabContainer.find(`.ribbon-tab-title[data-ribbon-component-id="${ribbonComponendId}"]`).addClass("active");
                this.$bodyContainer.find(`.ribbon-body[data-ribbon-component-id="${ribbonComponendId}"]`).addClass("active");

                const activeChild = this.getActiveRibbonWidget();

                if (activeChild) {
                    activeChild.handleEvent('noteSwitched', {noteContext: this.noteContext, notePath: this.notePath});
                }
            }
            else {
                this.lastActiveComponentId = null;
            }
        });
    }

    async refreshWithNote(note, noExplicitActivation = false) {
        this.lastNoteType = note.type;

        let $ribbonTabToActivate, $lastActiveRibbon;

        this.$tabContainer.empty();

        for (const ribbonWidget of this.ribbonWidgets) {
            const ret = ribbonWidget.getTitle(note);

            if (!ret.show) {
                continue;
            }

            const $ribbonTitle = $('<div class="ribbon-tab-title">')
                .attr('data-ribbon-component-id', ribbonWidget.componentId)
                .append($('<span class="ribbon-tab-title-icon">')
                            .addClass(ret.icon)
                            .attr("title", ret.title))
                .append(" ")
                .append($('<span class="ribbon-tab-title-label">').text(ret.title));

            this.$tabContainer.append($ribbonTitle);
            this.$tabContainer.append('<div class="ribbon-tab-spacer">');

            if (ret.activate && !this.lastActiveComponentId && !$ribbonTabToActivate && !noExplicitActivation) {
                $ribbonTabToActivate = $ribbonTitle;
            }

            if (this.lastActiveComponentId === ribbonWidget.componentId) {
                $lastActiveRibbon = $ribbonTitle;
            }
        }

        this.$tabContainer.find('.ribbon-tab-title-icon').tooltip();

        if (!$ribbonTabToActivate) {
            $ribbonTabToActivate = $lastActiveRibbon;
        }

        if ($ribbonTabToActivate) {
            $ribbonTabToActivate.trigger('click');
        }
        else {
            this.$bodyContainer.find('.ribbon-body').removeClass("active");
        }
    }

    refreshRibbonContainerCommand() {
        this.refreshWithNote(this.note, true);
    }

    async handleEventInChildren(name, data) {
        if (['activeContextChanged', 'setNoteContext'].includes(name)) {
            // won't trigger .refresh();
            await super.handleEventInChildren('setNoteContext', data);
        }
        else {
            const activeRibbonWidget = this.getActiveRibbonWidget();

            // forward events only to active ribbon tab, inactive ones don't need to be updated
            if (activeRibbonWidget) {
                await activeRibbonWidget.handleEvent(name, data);
            }

            for (const buttonWidget of this.buttonWidgets) {
                await buttonWidget.handleEvent(name, data);
            }
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId) && this.lastNoteType !== this.note.type) {
            // note type influences the list of available ribbon tabs the most
            // check for type is so that we don't update on each title rename
            this.lastNoteType = this.note.type;

            this.refresh();
        }
    }

    getActiveRibbonWidget() {
        return this.ribbonWidgets.find(ch => ch.componentId === this.lastActiveComponentId)
    }
}
