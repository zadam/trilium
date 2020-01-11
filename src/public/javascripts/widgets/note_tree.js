import BasicWidget from "./basic_widget.js";
import hoistedNoteService from "../services/hoisted_note.js";
import searchNotesService from "../services/search_notes.js";
import keyboardActionService from "../services/keyboard_actions.js";
import treeService from "../services/tree.js";
import treeUtils from "../services/tree_utils.js";
import noteDetailService from "../services/note_detail.js";

const TPL = `
<style>
#tree {
    overflow: auto;
    flex-grow: 1;
    flex-shrink: 1;
    flex-basis: 60%;
    font-family: var(--tree-font-family);
    font-size: var(--tree-font-size);
}
</style>

<div id="tree"></div>
`;

export default class NoteTreeWidget extends BasicWidget {
    async doRender($widget) {
        $widget.append($(TPL));

        const $tree = $widget.find('#tree');

        await treeService.showTree($tree);

        $tree.on("click", ".unhoist-button", hoistedNoteService.unhoist);
        $tree.on("click", ".refresh-search-button", searchNotesService.refreshSearch);

        keyboardActionService.setGlobalActionHandler('CollapseTree', () => treeService.collapseTree()); // don't use shortened form since collapseTree() accepts argument

        // fancytree doesn't support middle click so this is a way to support it
        $widget.on('mousedown', '.fancytree-title', e => {
            if (e.which === 2) {
                const node = $.ui.fancytree.getNode(e);

                treeUtils.getNotePath(node).then(notePath => {
                    if (notePath) {
                        noteDetailService.openInTab(notePath, false);
                    }
                });

                e.stopPropagation();
                e.preventDefault();
            }
        });
    }

    createTopLevelNoteListener() {
        treeService.createNewTopLevelNote();
    }

    collapseTreeListener() {
        treeService.collapseTree();
    }

    scrollToActiveNoteListener() {
        treeService.scrollToActiveNote();
    }
}