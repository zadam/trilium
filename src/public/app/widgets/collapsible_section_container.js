import AbstractContainer from "./abstract_container.js";

const TPL = `
<div class="section-container">
    <style>
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
    </style>

    <div class="section-title-container"></div>
    <div class="section-body-container"></div>
</div>`;

export default class CollapsibleSectionContainer extends AbstractContainer {
    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$titleContainer = this.$widget.find('.section-title-container');
        this.$bodyContainer = this.$widget.find('.section-body-container');

        this.$titleContainer.append('<div class="section-title section-title-empty">');

        for (const widget of this.children) {
            this.$titleContainer.append(
                $('<div class="section-title">')
                    .append(widget.renderTitle())
            );

            this.$titleContainer.append('<div class="section-title section-title-empty">');

            this.$bodyContainer.append(
                $('<div class="section-body">')
                    .append(widget.render())
            );
        }
    }
}
