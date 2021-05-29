import NoteContextAwareWidget from "../note_context_aware_widget.js";

const TPL = `
<div class="section-container">
    <style>
    .section-container {
        margin-bottom: 5px;  
    }
    
    .section-top-row {
        display: flex;
    }
    
    .section-title-container {
        display: flex;
        flex-direction: row;
        justify-content: center;
        margin-left: 10px;
        flex-grow: 1;
    }
    
    .section-title {
        color: var(--muted-text-color);
        border-bottom: 1px solid var(--main-border-color); 
    }

    .section-title .bx {
        font-size: 150%;
        position: relative;
        top: 3px;
    }
    
    .section-title.active {
        color: var(--main-text-color);
        border-bottom: 1px solid var(--main-text-color);
        flex-shrink: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .section-title:hover {
        cursor: pointer;
    }
        
    .section-title:hover {
        color: var(--main-text-color);
    }
    
    .section-title:first-of-type {
        padding-left: 10px;
    }
    
    .section-title-empty {
        flex-basis: 35px;
        flex-shrink: 1;
    }
        
    .section-title-empty:last-of-type {
        flex-shrink: 1;
        flex-grow: 1;
    }
    
    .section-button-container {
        display: flex;
        border-bottom: 1px solid var(--main-border-color); 
        margin-right: 5px;
    }
    
    .section-button-container .icon-action {
        padding: 5px;
        position: relative;
        top: -3px;
        margin-left: 10px;
    }
    
    .section-body {
        display: none;
        border-bottom: 1px solid var(--main-border-color);
        margin-left: 10px;
        margin-right: 10px;
    }
    
    .section-body.active {
        display: block;
    }
    
    .section-title-label {
        display: none;
    }
    
    .section-title.active .section-title-label {
        display: inline;
    }
    </style>

    <div class="section-top-row">
        <div class="section-title-container"></div>
        <div class="section-button-container"></div>
    </div>
    
    <div class="section-body-container"></div>
</div>`;

export default class CollapsibleSectionContainer extends NoteContextAwareWidget {
    constructor() {
        super();

        this.sectionWidgets = [];
        this.buttonWidgets = [];
    }

    section(widget) {
        super.child(widget);

        this.sectionWidgets.push(widget);

        return this;
    }

    button(widget) {
        super.child(widget);

        this.buttonWidgets.push(widget);

        return this;
    }

    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$titleContainer = this.$widget.find('.section-title-container');
        this.$buttonContainer = this.$widget.find('.section-button-container');
        this.$bodyContainer = this.$widget.find('.section-body-container');

        for (const sectionWidget of this.sectionWidgets) {
            this.$bodyContainer.append(
                $('<div class="section-body">')
                    .attr('data-section-component-id', sectionWidget.componentId)
                    .append(sectionWidget.render())
            );
        }

        for (const buttonWidget of this.buttonWidgets) {
            this.$buttonContainer.append(buttonWidget.render());
        }

        this.$titleContainer.on('click', '.section-title-real', e => {
            const $sectionTitle = $(e.target).closest('.section-title-real');

            const activate = !$sectionTitle.hasClass("active");

            this.$titleContainer.find('.section-title-real').removeClass("active");
            this.$bodyContainer.find('.section-body').removeClass("active");

            if (activate) {
                const sectionComponentId = $sectionTitle.attr('data-section-component-id');

                this.lastActiveComponentId = sectionComponentId;

                this.$titleContainer.find(`.section-title-real[data-section-component-id="${sectionComponentId}"]`).addClass("active");
                this.$bodyContainer.find(`.section-body[data-section-component-id="${sectionComponentId}"]`).addClass("active");

                const activeChild = this.getActiveSectionWidget();

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
        let $sectionToActivate, $lastActiveSection;

        this.$titleContainer.empty();

        for (const sectionWidget of this.sectionWidgets) {
            const ret = sectionWidget.getTitle(note);

            if (!ret.show) {
                continue;
            }

            const $sectionTitle = $('<div class="section-title section-title-real">')
                .attr('data-section-component-id', sectionWidget.componentId)
                .append($('<span class="section-title-icon">')
                            .addClass(ret.icon)
                            .attr("title", ret.title))
                .append(" ")
                .append($('<span class="section-title-label">').text(ret.title));

            this.$titleContainer.append($sectionTitle);
            this.$titleContainer.append('<div class="section-title section-title-empty">');

            if (ret.activate && !this.lastActiveComponentId && !$sectionToActivate && !noExplicitActivation) {
                $sectionToActivate = $sectionTitle;
            }

            if (this.lastActiveComponentId === sectionWidget.componentId) {
                $lastActiveSection = $sectionTitle;
            }
        }

        this.$titleContainer.find('.section-title-icon').tooltip();

        if (!$sectionToActivate) {
            $sectionToActivate = $lastActiveSection;
        }

        if ($sectionToActivate) {
            $sectionToActivate.trigger('click');
        }
        else {
            this.$bodyContainer.find('.section-body').removeClass("active");
        }
    }

    refreshSectionContainerCommand() {
        this.refreshWithNote(this.note, true);
    }

    async handleEventInChildren(name, data) {
        if (['activeContextChanged', 'setNoteContext'].includes(name)) {
            // won't trigger .refresh();
            await super.handleEventInChildren('setNoteContext', data);
        }
        else {
            const activeSectionWidget = this.getActiveSectionWidget();

            // forward events only to active section, inactive ones don't need to be updated
            if (activeSectionWidget) {
                await activeSectionWidget.handleEvent(name, data);
            }

            for (const buttonWidget of this.buttonWidgets) {
                await buttonWidget.handleEvent(name, data);
            }
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId) && this.lastNoteType !== this.note.type) {
            // note type influences the list of available sections the most
            // check for type is so that we don't update on each title rename
            this.lastNoteType = this.note.type;

            this.refresh();
        }
    }

    getActiveSectionWidget() {
        return this.sectionWidgets.find(ch => ch.componentId === this.lastActiveComponentId)
    }
}
