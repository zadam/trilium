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
    <a data-trigger-event="createTopLevelNote"
       title="Create new top level note" 
       class="icon-action bx bx-folder-plus"></a>

    <a data-trigger-event="collapseTree"
       title="Collapse note tree" 
       data-kb-action="CollapseTree" 
       class="icon-action bx bx-layer-minus"></a>

    <a data-trigger-event="scrollToActiveNote"
       title="Scroll to active note" 
       data-kb-action="ScrollToActiveNote" 
       class="icon-action bx bx-crosshair"></a>

    <a data-trigger-event="searchNotes"
       title="Search in notes"
       data-kb-action="SearchNotes"
       class="icon-action bx bx-search"></a>
</div>
`;

class GlobalButtonsWidget extends BasicWidget {
    doRender($widget) {
        return $(WIDGET_TPL);
    }
}

export default GlobalButtonsWidget;