import BasicWidget from "./basic_widget.js";
import appContext from "../services/app_context.js";

const WIDGET_TPL = `
<style>
.global-buttons {
    display: flex;
    justify-content: space-around;
    padding: 3px 0 3px 0;
    border: 1px solid var(--main-border-color);
    border-radius: 7px;
    margin: 3px 5px 5px 5px;
}
</style>

<div class="global-buttons">
    <a title="Create new top level note" class="create-top-level-note-button icon-action bx bx-folder-plus"></a>

    <a title="Collapse note tree" data-kb-action="CollapseTree" class="collapse-tree-button icon-action bx bx-layer-minus"></a>

    <a title="Scroll to active note" data-kb-action="ScrollToActiveNote" class="scroll-to-active-note-button icon-action bx bx-crosshair"></a>

    <a title="Search in notes" data-kb-action="SearchNotes" class="toggle-search-button icon-action bx bx-search"></a>
</div>
`;

class GlobalButtonsWidget extends BasicWidget {
    doRender($widget) {
        $widget = $(WIDGET_TPL);

        const $createTopLevelNoteButton = $widget.find(".create-top-level-note-button");
        const $collapseTreeButton = $widget.find(".collapse-tree-button");
        const $scrollToActiveNoteButton = $widget.find(".scroll-to-active-note-button");
        const $toggleSearchButton = $widget.find(".toggle-search-button");

        $createTopLevelNoteButton.on('click', () => this.trigger('createTopLevelNote'));
        $collapseTreeButton.on('click', () => this.trigger('collapseTree'));
        $scrollToActiveNoteButton.on('click', () => appContext.getMainNoteTree().scrollToActiveNote());
        $toggleSearchButton.on('click', () => this.trigger('toggleSearch'));

        return $widget;
    }
}

export default GlobalButtonsWidget;