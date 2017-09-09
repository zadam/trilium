const dragAndDropSetup = {
    autoExpandMS: 600,
    draggable: { // modify default jQuery draggable options
        zIndex: 1000,
        scroll: false,
        containment: "parent",
        revert: "invalid"
    },
    preventRecursiveMoves: true, // Prevent dropping nodes on own descendants
    preventVoidMoves: true, // Prevent dropping nodes 'before self', etc.

    dragStart: function (node, data) {
        // This function MUST be defined to enable dragging for the tree.
        // Return false to cancel dragging of node.
        return true;
    },
    dragEnter: function (node, data) {
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
    dragExpand: function (node, data) {
        // return false to prevent auto-expanding data.node on hover
    },
    dragOver: function (node, data) {
    },
    dragLeave: function (node, data) {
    },
    dragStop: function (node, data) {
    },
    dragDrop: function (node, data) {
        // This function MUST be defined to enable dropping of items on the tree.
        // data.hitMode is 'before', 'after', or 'over'.

        if (data.hitMode === "before") {
            moveBeforeNode(data.otherNode, node);
        }
        else if (data.hitMode === "after") {
            moveAfterNode(data.otherNode, node);
        }
        else if (data.hitMode === "over") {
            moveToNode(data.otherNode, node);
        }
        else {
            throw new Exception("Unknown hitMode=" + data.hitMode);
        }
    }
};
