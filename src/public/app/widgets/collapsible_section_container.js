import TabAwareWidget from "./tab_aware_widget.js";

const TPL = `
<div class="section-container">
    <style>
    .section-container {
        margin-bottom: 10px;
    }
    
    .section-title-container {
        display: flex;
        flex-direction: row;
        justify-content: center;
        margin-top: 7px;
    }
    
    .section-title {
        padding-right: 10px;
        padding-left: 10px;
        color: var(--muted-text-color);
        border-bottom: 1px solid var(--main-border-color); 
    }
    
    .section-title.active {
        color: var(--main-text-color);
        border-bottom: 1px solid var(--main-text-color);
    }
    
    .section-title:hover {
        cursor: pointer;
    }
        
    .section-title:hover {
        color: var(--main-text-color);
    }
    
    .section-title-empty {
        flex-shrink: 1;
        flex-grow: 1;
    }
    
    .section-body {
        display: none;
        border-bottom: 1px solid var(--main-border-color);
    }
    
    .section-body.active {
        display: block;
    }
    </style>

    <div class="section-title-container"></div>
    <div class="section-body-container"></div>
</div>`;

export default class CollapsibleSectionContainer extends TabAwareWidget {
    constructor() {
        super();

        this.children = [];

        this.positionCounter = 10;
    }

    child(...components) {
        if (!components) {
            return this;
        }

        super.child(...components);

        for (const component of components) {
            if (!component.position) {
                component.position = this.positionCounter;
                this.positionCounter += 10;
            }
        }

        this.children.sort((a, b) => a.position - b.position < 0 ? -1 : 1);

        return this;
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$titleContainer = this.$widget.find('.section-title-container');
        this.$bodyContainer = this.$widget.find('.section-body-container');

        this.$titleContainer.append('<div class="section-title section-title-empty">');

        for (const widget of this.children) {
            this.$titleContainer.append(
                $('<div class="section-title section-title-real">')
                    .attr('data-section-component-id', widget.componentId)
                    .append(widget.renderTitle())
            );

            this.$titleContainer.append('<div class="section-title section-title-empty">');

            this.$bodyContainer.append(
                $('<div class="section-body">')
                    .attr('data-section-component-id', widget.componentId)
                    .append(widget.render())
            );
        }

        this.$titleContainer.on('click', '.section-title-real', e => {
            const $sectionTitle = $(e.target).closest('.section-title-real');

            const activate = !$sectionTitle.hasClass("active");

            this.$titleContainer.find('.section-title-real').removeClass("active");
            this.$bodyContainer.find('.section-body').removeClass("active");

            if (activate) {
                this.$titleContainer.find(`.section-title-real[data-section-component-id="${$sectionTitle.attr('data-section-component-id')}"]`).addClass("active");
                this.$bodyContainer.find(`.section-body[data-section-component-id="${$sectionTitle.attr('data-section-component-id')}"]`).addClass("active");
            }
        });
    }

    async refreshWithNote(note) {
        this.$titleContainer.find('.section-title-real:first').trigger('click');
    }
}
