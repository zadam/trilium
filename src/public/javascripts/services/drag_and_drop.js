import treeService from './tree.js';
import treeChangesService from './branches.js';
import importDialog from '../dialogs/import.js';

const dragAndDropSetup = {
    autoExpandMS: 600,
    dragStart: (node, data) => {
        // don't allow dragging root node
        if (node.data.noteId === 'root') {
            return false;
        }

        if (!data.originalEvent.ctrlKey) {
            // keep existing selection only if CTRL key is pressed
            for (const selectedNode of treeService.getSelectedNodes()) {
                selectedNode.setSelected(false);
                selectedNode.renderTitle();
            }
        }

        node.setSelected(true);

        // this is for dragging notes into relation map
        // we allow to drag only one note at a time because it multi-drag conflicts with multiple single drags
        // in UX and single drag is probably more useful
        data.dataTransfer.setData("text", JSON.stringify({
            noteId: node.data.noteId,
            title: node.title
        }));

        // This function MUST be defined to enable dragging for the tree.
        // Return false to cancel dragging of node.
        return true;
    },
    dragEnter: (node, data) => true, // allow drop on any node
    dragOver: (node, data) => true,
    dragDrop: (node, data) => {
        const dataTransfer = data.dataTransfer;

        if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
            importDialog.uploadFiles(node.data.noteId, dataTransfer.files, {
                safeImport: true,
                shrinkImages: true,
                textImportedAsText: true,
                codeImportedAsCode: true
            });
        }
        else {
            // This function MUST be defined to enable dropping of items on the tree.
            // data.hitMode is 'before', 'after', or 'over'.

            const selectedNodes = treeService.getSelectedNodes();

            if (data.hitMode === "before") {
                treeChangesService.moveBeforeNode(selectedNodes, node);
            } else if (data.hitMode === "after") {
                treeChangesService.moveAfterNode(selectedNodes, node);
            } else if (data.hitMode === "over") {
                treeChangesService.moveToNode(selectedNodes, node);
            } else {
                throw new Error("Unknown hitMode=" + data.hitMode);
            }
        }
    }
};

export default dragAndDropSetup;