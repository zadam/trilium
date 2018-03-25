import treeService from './tree.js';
import treeChangesService from './tree_changes.js';

const dragAndDropSetup = {
    autoExpandMS: 600,
    draggable: { // modify default jQuery draggable options
        zIndex: 1000,
        scroll: false,
        containment: "parent",
        revert: "invalid"
    },
    focusOnClick: true,
    preventRecursiveMoves: true, // Prevent dropping nodes on own descendants
    preventVoidMoves: true, // Prevent dropping nodes 'before self', etc.

    dragStart: (node, data) => {
        // This function MUST be defined to enable dragging for the tree.
        // Return false to cancel dragging of node.
        return true;
    },
    dragEnter: (node, data) => {
        /* data.otherNode may be null for non-fancytree droppables.
        * Return false to disallow dropping on node. In this case
        * dragOver and dragLeave are not called.
        * Return 'over', 'before, or 'after' to force a hitMode.
        * Return ['before', 'after'] to restrict available hitModes.
        * Any other return value will calc the hitMode from the cursor position.
        */
        // Prevent dropping a parent below another parent (only sort
        // nodes under the same parent):
        //    if(node.parent !== data.otherNode.parent){
        //      return false;
        //    }
        // Don't allow dropping *over* a node (would create a child). Just
        // allow changing the order:
        //    return ["before", "after"];
        // Accept everything:
        return true;
    },
    dragExpand: (node, data) => {
        // return false to prevent auto-expanding data.node on hover
    },
    dragOver: (node, data) => {},
    dragLeave: (node, data) => {},
    dragStop: (node, data) => {},
    dragDrop: (node, data) => {
        // This function MUST be defined to enable dropping of items on the tree.
        // data.hitMode is 'before', 'after', or 'over'.

        const nodeToMove = data.otherNode;
        nodeToMove.setSelected(true);

        const selectedNodes = treeService.getSelectedNodes();

        if (data.hitMode === "before") {
            treeChangesService.moveBeforeNode(selectedNodes, node);
        }
        else if (data.hitMode === "after") {
            treeChangesService.moveAfterNode(selectedNodes, node);
        }
        else if (data.hitMode === "over") {
            treeChangesService.moveToNode(selectedNodes, node);
        }
        else {
            throw new Exception("Unknown hitMode=" + data.hitMode);
        }
    }
};

export default dragAndDropSetup;