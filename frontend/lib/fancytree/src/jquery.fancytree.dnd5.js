/*!
 * jquery.fancytree.dnd5.js
 *
 * Drag-and-drop support (native HTML5).
 * (Extension module for jquery.fancytree.js: https://github.com/mar10/fancytree/)
 *
 * Copyright (c) 2008-2017, Martin Wendt (http://wwWendt.de)
 *
 * Released under the MIT license
 * https://github.com/mar10/fancytree/wiki/LicenseInfo
 *
 * @version 2.22.5
 * @date 2017-05-11T17:01:53Z
 */


 /*
 #TODO
   - glyph

	Compatiblity when dragging between *separate* windows:

		   Drag from Chrome   Edge    FF    IE11    Safari
	  To Chrome      ok       ok      ok    NO      ?
		 Edge        ok       ok      ok    NO      ?
		 FF          ok       ok      ok    NO      ?
		 IE 11       ok       ok      ok    ok      ?
		 Safari      ?        ?       ?     ?       ok

 */

;(function($, window, document, undefined) {

"use strict";

/* *****************************************************************************
 * Private functions and variables
 */
var
	classDragSource = "fancytree-drag-source",
	classDragRemove = "fancytree-drag-remove",
	classDropAccept = "fancytree-drop-accept",
	classDropAfter = "fancytree-drop-after",
	classDropBefore = "fancytree-drop-before",
	classDropOver = "fancytree-drop-over",
	classDropReject = "fancytree-drop-reject",
	classDropTarget = "fancytree-drop-target",
	nodeMimeType = "application/x-fancytree-node",
	$dropMarker = null,
	SOURCE_NODE = null,
	DRAG_ENTER_RESPONSE = null,
	LAST_HIT_MODE = null;

/* Convert number to string and prepend +/-; return empty string for 0.*/
function offsetString(n){
	return n === 0 ? "" : (( n > 0 ) ? ("+" + n) : ("" + n));
}

/* Convert a dragEnter() or dragOver() response to a canonical form.
 * Return false or plain object
 * @param {string|object|boolean} r
 * @return {object|false}
 */
function normalizeDragEnterResponse(r) {
	var res;

	if( !r ){
		return false;
	}
	if ( $.isPlainObject(r) ) {
		res = {
			over: !!r.over,
			before: !!r.before,
			after: !!r.after
		};
	}else if ( $.isArray(r) ) {
		res = {
			over: ($.inArray("over", r) >= 0),
			before: ($.inArray("before", r) >= 0),
			after: ($.inArray("after", r) >= 0)
		};
	}else{
		res = {
			over: ((r === true) || (r === "over")),
			before: ((r === true) || (r === "before")),
			after: ((r === true) || (r === "after"))
		};
	}
	if( Object.keys(res).length === 0 ) {
		return false;
	}
	// if( Object.keys(res).length === 1 ) {
	// 	res.unique = res[0];
	// }
	return res;
}

/* Implement auto scrolling when drag cursor is in top/bottom area of scroll parent. */
function autoScroll(tree, event) {
	var spOfs, scrollTop, delta,
		dndOpts = tree.options.dnd5,
		sp = tree.$scrollParent[0],
		sensitivity = dndOpts.scrollSensitivity,
		speed = dndOpts.scrollSpeed,
		scrolled = 0;

	if ( sp !== document && sp.tagName !== "HTML" ) {
		spOfs = tree.$scrollParent.offset();
		scrollTop = sp.scrollTop;
		if ( spOfs.top + sp.offsetHeight - event.pageY < sensitivity ) {
			delta = (sp.scrollHeight - tree.$scrollParent.innerHeight() - scrollTop);
			// console.log ("sp.offsetHeight: " + sp.offsetHeight
			// 	+ ", spOfs.top: " + spOfs.top
			// 	+ ", scrollTop: " + scrollTop
			// 	+ ", innerHeight: " + tree.$scrollParent.innerHeight()
			// 	+ ", scrollHeight: " + sp.scrollHeight
			// 	+ ", delta: " + delta
			// 	);
			if( delta > 0 ) {
				sp.scrollTop = scrolled = scrollTop + speed;
			}
		} else if ( scrollTop > 0 && event.pageY - spOfs.top < sensitivity ) {
			sp.scrollTop = scrolled = scrollTop - speed;
		}
	} else {
		scrollTop = $(document).scrollTop();
		if (scrollTop > 0 && event.pageY - scrollTop < sensitivity) {
			scrolled = scrollTop - speed;
			$(document).scrollTop(scrolled);
		} else if ($(window).height() - (event.pageY - scrollTop) < sensitivity) {
			scrolled = scrollTop + speed;
			$(document).scrollTop(scrolled);
		}
	}
	if( scrolled ) {
		tree.debug("autoScroll: " + scrolled + "px");
	}
	return scrolled;
}

/* Handle dragover event (fired every x ms) and return hitMode. */
function handleDragOver(event, data) {
	// Implement auto-scrolling
	if ( data.options.dnd5.scroll ) {
		autoScroll(data.tree, event);
	}
	// Bail out with previous response if we get an invalid dragover
	if( !data.node ) {
		data.tree.warn("Ignore dragover for non-node");  //, event, data);
		return LAST_HIT_MODE;
	}

	var markerOffsetX, nodeOfs, relPosY, //res,
		// eventHash = getEventHash(event),
		hitMode = null,
		tree = data.tree,
		options = tree.options,
		dndOpts = options.dnd5,
		targetNode = data.node,
		sourceNode = data.otherNode,
		markerAt = "center",
		// glyph = options.glyph || null,
		// $source = sourceNode ? $(sourceNode.span) : null,
		$target = $(targetNode.span),
		$targetTitle = $target.find("span.fancytree-title");

	if(DRAG_ENTER_RESPONSE === false){
		tree.warn("Ignore dragover, since dragenter returned false");  //, event, data);
		// $.error("assert failed: dragenter returned false");
		return false;
	} else if(typeof DRAG_ENTER_RESPONSE === "string") {
		$.error("assert failed: dragenter returned string");
		// Use hitMode from onEnter if provided.
		// hitMode = DRAG_ENTER_RESPONSE;
	} else {
		// Calculate hitMode from relative cursor position.
		nodeOfs = $target.offset();
		relPosY = (event.pageY - nodeOfs.top) / $target.height();

		if( DRAG_ENTER_RESPONSE.after && relPosY > 0.75 ){
			hitMode = "after";
		} else if(!DRAG_ENTER_RESPONSE.over && DRAG_ENTER_RESPONSE.after && relPosY > 0.5 ){
			hitMode = "after";
		} else if(DRAG_ENTER_RESPONSE.before && relPosY <= 0.25) {
			hitMode = "before";
		} else if(!DRAG_ENTER_RESPONSE.over && DRAG_ENTER_RESPONSE.before && relPosY <= 0.5) {
			hitMode = "before";
		} else if(DRAG_ENTER_RESPONSE.over) {
			hitMode = "over";
		}
		// Prevent no-ops like 'before source node'
		// TODO: these are no-ops when moving nodes, but not in copy mode
		if( dndOpts.preventVoidMoves ){
			if(targetNode === sourceNode){
				targetNode.debug("drop over source node prevented");
				hitMode = null;
			}else if(hitMode === "before" && sourceNode && targetNode === sourceNode.getNextSibling()){
				targetNode.debug("drop after source node prevented");
				hitMode = null;
			}else if(hitMode === "after" && sourceNode && targetNode === sourceNode.getPrevSibling()){
				targetNode.debug("drop before source node prevented");
				hitMode = null;
			}else if(hitMode === "over" && sourceNode && sourceNode.parent === targetNode && sourceNode.isLastSibling() ){
				targetNode.debug("drop last child over own parent prevented");
				hitMode = null;
			}
		}
	}
	// Let callback modify the calculated hitMode
	data.hitMode = hitMode;
	if(hitMode && dndOpts.dragOver){
		// TODO: http://code.google.com/p/dynatree/source/detail?r=625
		dndOpts.dragOver(targetNode, data);
		hitMode = data.hitMode;
	}
	// LAST_DROP_EFFECT = data.dataTransfer.dropEffect;
	// LAST_EFFECT_ALLOWED = data.dataTransfer.effectAllowed;
	LAST_HIT_MODE = hitMode;
	//
	if( hitMode === "after" || hitMode === "before" || hitMode === "over" ){
		markerOffsetX = dndOpts.dropMarkerOffsetX || 0;
		switch(hitMode){
		case "before":
			markerAt = "top";
			markerOffsetX += (dndOpts.dropMarkerInsertOffsetX || 0);
			break;
		case "after":
			markerAt = "bottom";
			markerOffsetX += (dndOpts.dropMarkerInsertOffsetX || 0);
			break;
		}

		$dropMarker
			.toggleClass(classDropAfter, hitMode === "after")
			.toggleClass(classDropOver, hitMode === "over")
			.toggleClass(classDropBefore, hitMode === "before")
			.show()
			.position($.ui.fancytree.fixPositionOptions({
				my: "left" + offsetString(markerOffsetX) + " center",
				at: "left " + markerAt,
				of: $targetTitle
				}));
	} else {
		$dropMarker.hide();
		// console.log("hide dropmarker")
	}
	// if( $source ){
	// 	$source.toggleClass(classDragRemove, isMove);
	// }
	$(targetNode.span)
		.toggleClass(classDropTarget, hitMode === "after" || hitMode === "before" || hitMode === "over")
		.toggleClass(classDropAfter, hitMode === "after")
		.toggleClass(classDropBefore, hitMode === "before")
		.toggleClass(classDropAccept, hitMode === "over")
		.toggleClass(classDropReject, hitMode === false);

	return hitMode;
}

/* *****************************************************************************
 *
 */

$.ui.fancytree.registerExtension({
	name: "dnd5",
	version: "2.22.5",
	// Default options for this extension.
	options: {
		autoExpandMS: 1500,          // Expand nodes after n milliseconds of hovering
		setTextTypeJson: false,      // Allow dragging of nodes to different IE windows
		preventForeignNodes: false,  // Prevent dropping nodes from different Fancytrees
		preventNonNodes: false,      // Prevent dropping items other than Fancytree nodes
		preventRecursiveMoves: true, // Prevent dropping nodes on own descendants
		preventVoidMoves: true,      // Prevent dropping nodes 'before self', etc.
		scroll: true,                // Enable auto-scrolling while dragging
		scrollSensitivity: 20,       // Active top/bottom margin in pixel
		scrollSpeed: 5,              // Pixel per event
		dropMarkerOffsetX: -24,		 // absolute position offset for .fancytree-drop-marker relatively to ..fancytree-title (icon/img near a node accepting drop)
		dropMarkerInsertOffsetX: -16,// additional offset for drop-marker with hitMode = "before"/"after"
		// Events (drag support)
		dragStart: null,       // Callback(sourceNode, data), return true, to enable dnd drag
		dragDrag: $.noop,      // Callback(sourceNode, data)
		dragEnd: $.noop,       // Callback(sourceNode, data)
		// Events (drop support)
		dragEnter: null,       // Callback(targetNode, data), return true, to enable dnd drop
		dragOver: $.noop,      // Callback(targetNode, data)
		dragExpand: $.noop,    // Callback(targetNode, data), return false to prevent autoExpand
		dragDrop: $.noop,      // Callback(targetNode, data)
		dragLeave: $.noop      // Callback(targetNode, data)
	},

	treeInit: function(ctx){
		var tree = ctx.tree,
			opts = ctx.options,
			dndOpts = opts.dnd5,
			getNode = $.ui.fancytree.getNode;

		if( $.inArray("dnd", opts.extensions) >= 0 ) {
			$.error("Extensions 'dnd' and 'dnd5' are mutually exclusive.");
		}
		if( dndOpts.dragStop ) {
			$.error("dragStop is not used by ext-dnd5. Use dragEnd instead.");
		}

		// Implement `opts.createNode` event to add the 'draggable' attribute
		// #680: this must happen before calling super.treeInit()
		if( dndOpts.dragStart ) {
			$.ui.fancytree.overrideMethod(ctx.options, "createNode", function(event, data) {
				// Default processing if any
				this._super.apply(this, arguments);

				data.node.span.draggable = true;
			});
		}
		this._superApply(arguments);

		this.$container.addClass("fancytree-ext-dnd5");

		// Store the current scroll parent, which may be the tree
		// container, any enclosing div, or the document
		this.$scrollParent = this.$container.children(":first").scrollParent();

		$dropMarker = $("#fancytree-drop-marker");
		if( !$dropMarker.length ) {
			$dropMarker = $("<div id='fancytree-drop-marker'></div>")
				.hide()
				.css({
					"z-index": 1000,
					// Drop marker should not steal dragenter/dragover events:
					"pointer-events": "none"
				}).prependTo("body");
				// if( glyph ) {
					// instData.$dropMarker
						// .addClass(glyph.map.dropMarker);
				// }
		}
		// Enable drag support if dragStart() is specified:
		if( dndOpts.dragStart ) {
			// Bind drag event handlers
			tree.$container.on("dragstart drag dragend", function(event){
				var json,
					node = getNode(event),
					dataTransfer = event.dataTransfer || event.originalEvent.dataTransfer,
					isMove = dataTransfer.dropEffect === "move",
					$source = node ? $(node.span) : null,
					data = {
						node: node,
						tree: tree,
						options: tree.options,
						originalEvent: event,
						dataTransfer: dataTransfer,
//						dropEffect: undefined,  // set by dragend
						isCancelled: undefined  // set by dragend
					};

				switch( event.type ) {

				case "dragstart":
					$(node.span).addClass(classDragSource);

					// Store current source node in different formats
					SOURCE_NODE = node;

					// Set payload
					// Note:
					// Transfer data is only accessible on dragstart and drop!
					// For all other events the formats and kinds in the drag
					// data store list of items representing dragged data can be
					// enumerated, but the data itself is unavailable and no new
					// data can be added.
					json = JSON.stringify(node.toDict());
					try {
						dataTransfer.setData(nodeMimeType, json);
						dataTransfer.setData("text/html", $(node.span).html());
						dataTransfer.setData("text/plain", node.title);
					} catch(ex) {
						// IE only accepts 'text' type
						tree.warn("Could not set data (IE only accepts 'text') - " + ex);
					}
					// We always need to set the 'text' type if we want to drag
					// Because IE 11 only accepts this single type.
					// If we pass JSON here, IE can can access all node properties,
					// even when the source lives in another window. (D'n'd inside
					// the same window will always work.)
					// The drawback is, that in this case ALL browsers will see
					// the JSON representation as 'text', so dragging
					// to a text field will insert the JSON string instead of
					// the node title.
					if( dndOpts.setTextTypeJson ) {
						dataTransfer.setData("text", json);
					} else {
						dataTransfer.setData("text", node.title);
					}

					// Set the allowed and current drag mode (move, copy, or link)
					dataTransfer.effectAllowed = "all";  // "copyMove"
					// dataTransfer.dropEffect = "move";

					// Set the title as drag image (otherwise it would contain the expander)
					if( dataTransfer.setDragImage ) {
						// IE 11 does not support this
						dataTransfer.setDragImage($(node.span).find(".fancytree-title")[0], -10, -10);
						// dataTransfer.setDragImage($(node.span)[0], -10, -10);
					}
					// Let user modify above settings
					return dndOpts.dragStart(node, data) !== false;

				case "drag":
					// Called every few miliseconds
					$source.toggleClass(classDragRemove, isMove);
					dndOpts.dragDrag(node, data);
					break;

				case "dragend":
					$(node.span).removeClass(classDragSource + " " + classDragRemove);
					SOURCE_NODE = null;
					DRAG_ENTER_RESPONSE = null;
//					data.dropEffect = dataTransfer.dropEffect;
					data.isCancelled = (dataTransfer.dropEffect === "none");
					$dropMarker.hide();
					dndOpts.dragEnd(node, data);
					break;
				}
			});
		}
		// Enable drop support if dragEnter() is specified:
		if( dndOpts.dragEnter ) {
			// Bind drop event handlers
			tree.$container.on("dragenter dragover dragleave drop", function(event){
				var json, nodeData, r, res,
					allowDrop = null,
					node = getNode(event),
					dataTransfer = event.dataTransfer || event.originalEvent.dataTransfer,
					// glyph = opts.glyph || null,
					data = {
						node: node,
						tree: tree,
						options: tree.options,
						hitMode: DRAG_ENTER_RESPONSE,
						originalEvent: event,
						dataTransfer: dataTransfer,
						otherNode: SOURCE_NODE || null,
						otherNodeData: null,    // set by drop event
						dropEffect: undefined,  // set by drop event
						isCancelled: undefined  // set by drop event
					};

				switch( event.type ) {

				case "dragenter":
					// The dragenter event is fired when a dragged element or
					// text selection enters a valid drop target.

					if( !node ) {
						// Sometimes we get dragenter for the container element
						tree.debug("Ignore non-node " + event.type + ": " + event.target.tagName + "." + event.target.className);
						DRAG_ENTER_RESPONSE = false;
						break;
					}

					$(node.span)
						.addClass(classDropOver)
						.removeClass(classDropAccept + " " + classDropReject);

					if( dndOpts.preventNonNodes && !nodeData ) {
						node.debug("Reject dropping a non-node");
						DRAG_ENTER_RESPONSE = false;
						break;
					} else if( dndOpts.preventForeignNodes && (!SOURCE_NODE || SOURCE_NODE.tree !== node.tree ) ) {
						node.debug("Reject dropping a foreign node");
						DRAG_ENTER_RESPONSE = false;
						break;
					}

					// NOTE: dragenter is fired BEFORE the dragleave event
					// of the previous element!
					// https://www.w3.org/Bugs/Public/show_bug.cgi?id=19041
					setTimeout(function(){
						// node.info("DELAYED " + event.type, event.target, DRAG_ENTER_RESPONSE);
						// Auto-expand node (only when 'over' the node, not 'before', or 'after')
						if( dndOpts.autoExpandMS &&
							node.hasChildren() !== false && !node.expanded &&
							(!dndOpts.dragExpand || dndOpts.dragExpand(node, data) !== false)
							) {
							node.scheduleAction("expand", dndOpts.autoExpandMS);
						}
					}, 0);

					$dropMarker.show();

					// Call dragEnter() to figure out if (and where) dropping is allowed
					if( dndOpts.preventRecursiveMoves && node.isDescendantOf(data.otherNode) ){
						res = false;
					}else{
						r = dndOpts.dragEnter(node, data);
						res = normalizeDragEnterResponse(r);
					}
					DRAG_ENTER_RESPONSE = res;

					allowDrop = res && ( res.over || res.before || res.after );
					break;

				case "dragover":
					// The dragover event is fired when an element or text
					// selection is being dragged over a valid drop target
					// (every few hundred milliseconds).
					LAST_HIT_MODE = handleDragOver(event, data);
					allowDrop = !!LAST_HIT_MODE;
					break;

				case "dragleave":
					// NOTE: dragleave is fired AFTER the dragenter event of the
					// FOLLOWING element.
					if( !node ) {
						tree.debug("Ignore non-node " + event.type + ": " + event.target.tagName + "." + event.target.className);
						break;
					}
					if( !$(node.span).hasClass(classDropOver) ) {
						node.debug("Ignore dragleave (multi)"); //, event.currentTarget);
						break;
					}
					$(node.span).removeClass(classDropOver + " " + classDropAccept + " " + classDropReject);
					node.scheduleAction("cancel");
					dndOpts.dragLeave(node, data);
					$dropMarker.hide();
					break;

				case "drop":
					// Data is only readable in the (dragenter and) drop event:

					if( $.inArray(nodeMimeType, dataTransfer.types) >= 0 ) {
						nodeData = dataTransfer.getData(nodeMimeType);
						tree.info(event.type + ": getData('application/x-fancytree-node'): '" + nodeData + "'");
					}
					if( !nodeData ) {
						// 1. Source is not a Fancytree node, or
						// 2. If the FT mime type was set, but returns '', this
						//    is probably IE 11 (which only supports 'text')
						nodeData = dataTransfer.getData("text");
						tree.info(event.type + ": getData('text'): '" + nodeData + "'");
					}
					if( nodeData ) {
						try {
							// 'text' type may contain JSON if IE is involved
							// and setTextTypeJson option was set
							json = JSON.parse(nodeData);
							if( json.title !== undefined ) {
								data.otherNodeData = json;
							}
						} catch(ex) {
							// assume 'text' type contains plain text, so `otherNodeData`
							// should not be set
						}
					}
					tree.debug(event.type + ": nodeData: '" + nodeData + "', otherNodeData: ", data.otherNodeData);

					$(node.span).removeClass(classDropOver + " " + classDropAccept + " " + classDropReject);
					$dropMarker.hide();

					data.hitMode = LAST_HIT_MODE;
					data.dropEffect = dataTransfer.dropEffect;
					data.isCancelled = data.dropEffect === "none";

					// Let user implement the actual drop operation
					dndOpts.dragDrop(node, data);

					// Prevent browser's default drop handling
					event.preventDefault();
					break;
				}
				// Dnd API madness: we must PREVENT default handling to enable dropping
				if( allowDrop ) {
					event.preventDefault();
					return false;
				}
			});
		}
	}
});
}(jQuery, window, document));
