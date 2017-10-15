/*!
 * jquery.fancytree.dnd.js
 *
 * Drag-and-drop support (jQuery UI draggable/droppable).
 * (Extension module for jquery.fancytree.js: https://github.com/mar10/fancytree/)
 *
 * Copyright (c) 2008-2017, Martin Wendt (http://wwWendt.de)
 *
 * Released under the MIT license
 * https://github.com/mar10/fancytree/wiki/LicenseInfo
 *
 * @version 2.23.0
 * @date 2017-05-27T20:09:38Z
 */

;(function($, window, document, undefined) {

"use strict";

/* *****************************************************************************
 * Private functions and variables
 */
var didRegisterDnd = false,
	classDropAccept = "fancytree-drop-accept",
	classDropAfter = "fancytree-drop-after",
	classDropBefore = "fancytree-drop-before",
	classDropOver = "fancytree-drop-over",
	classDropReject = "fancytree-drop-reject",
	classDropTarget = "fancytree-drop-target";

/* Convert number to string and prepend +/-; return empty string for 0.*/
function offsetString(n){
	return n === 0 ? "" : (( n > 0 ) ? ("+" + n) : ("" + n));
}

//--- Extend ui.draggable event handling --------------------------------------

function _registerDnd() {
	if(didRegisterDnd){
		return;
	}

	// Register proxy-functions for draggable.start/drag/stop

	$.ui.plugin.add("draggable", "connectToFancytree", {
		start: function(event, ui) {
			// 'draggable' was renamed to 'ui-draggable' since jQueryUI 1.10
			var draggable = $(this).data("ui-draggable") || $(this).data("draggable"),
				sourceNode = ui.helper.data("ftSourceNode") || null;

			if(sourceNode) {
				// Adjust helper offset, so cursor is slightly outside top/left corner
				draggable.offset.click.top = -2;
				draggable.offset.click.left = + 16;
				// Trigger dragStart event
				// TODO: when called as connectTo..., the return value is ignored(?)
				return sourceNode.tree.ext.dnd._onDragEvent("start", sourceNode, null, event, ui, draggable);
			}
		},
		drag: function(event, ui) {
			var ctx, isHelper, logObject,
				// 'draggable' was renamed to 'ui-draggable' since jQueryUI 1.10
				draggable = $(this).data("ui-draggable") || $(this).data("draggable"),
				sourceNode = ui.helper.data("ftSourceNode") || null,
				prevTargetNode = ui.helper.data("ftTargetNode") || null,
				targetNode = $.ui.fancytree.getNode(event.target),
				dndOpts = sourceNode && sourceNode.tree.options.dnd;

			// logObject = sourceNode || prevTargetNode || $.ui.fancytree;
			// logObject.debug("Drag event:", event, event.shiftKey);
			if(event.target && !targetNode){
				// We got a drag event, but the targetNode could not be found
				// at the event location. This may happen,
				// 1. if the mouse jumped over the drag helper,
				// 2. or if a non-fancytree element is dragged
				// We ignore it:
				isHelper = $(event.target).closest("div.fancytree-drag-helper,#fancytree-drop-marker").length > 0;
				if(isHelper){
					logObject = sourceNode || prevTargetNode || $.ui.fancytree;
					logObject.debug("Drag event over helper: ignored.");
					return;
				}
			}
			ui.helper.data("ftTargetNode", targetNode);

			if( dndOpts && dndOpts.updateHelper ) {
				ctx = sourceNode.tree._makeHookContext(sourceNode, event, {
					otherNode: targetNode,
					ui: ui,
					draggable: draggable,
					dropMarker: $("#fancytree-drop-marker")
				});
				dndOpts.updateHelper.call(sourceNode.tree, sourceNode, ctx);
			}

			// Leaving a tree node
			if(prevTargetNode && prevTargetNode !== targetNode ) {
				prevTargetNode.tree.ext.dnd._onDragEvent("leave", prevTargetNode, sourceNode, event, ui, draggable);
			}
			if(targetNode){
				if(!targetNode.tree.options.dnd.dragDrop) {
					// not enabled as drop target
				} else if(targetNode === prevTargetNode) {
					// Moving over same node
					targetNode.tree.ext.dnd._onDragEvent("over", targetNode, sourceNode, event, ui, draggable);
				}else{
					// Entering this node first time
					targetNode.tree.ext.dnd._onDragEvent("enter", targetNode, sourceNode, event, ui, draggable);
					targetNode.tree.ext.dnd._onDragEvent("over", targetNode, sourceNode, event, ui, draggable);
				}
			}
			// else go ahead with standard event handling
		},
		stop: function(event, ui) {
			var logObject,
				// 'draggable' was renamed to 'ui-draggable' since jQueryUI 1.10:
				draggable = $(this).data("ui-draggable") || $(this).data("draggable"),
				sourceNode = ui.helper.data("ftSourceNode") || null,
				targetNode = ui.helper.data("ftTargetNode") || null,
				dropped = (event.type === "mouseup" && event.which === 1);

			if(!dropped){
				logObject = sourceNode || targetNode || $.ui.fancytree;
				logObject.debug("Drag was cancelled");
			}
			if(targetNode) {
				if(dropped){
					targetNode.tree.ext.dnd._onDragEvent("drop", targetNode, sourceNode, event, ui, draggable);
				}
				targetNode.tree.ext.dnd._onDragEvent("leave", targetNode, sourceNode, event, ui, draggable);
			}
			if(sourceNode){
				sourceNode.tree.ext.dnd._onDragEvent("stop", sourceNode, null, event, ui, draggable);
			}
		}
	});

	didRegisterDnd = true;
}


/* *****************************************************************************
 * Drag and drop support
 */
function _initDragAndDrop(tree) {
	var dnd = tree.options.dnd || null,
		glyph = tree.options.glyph || null;

	// Register 'connectToFancytree' option with ui.draggable
	if( dnd ) {
		_registerDnd();
	}
	// Attach ui.draggable to this Fancytree instance
	if(dnd && dnd.dragStart ) {
		tree.widget.element.draggable($.extend({
			addClasses: false,
			// DT issue 244: helper should be child of scrollParent:
			appendTo: tree.$container,
//			appendTo: "body",
			containment: false,
//			containment: "parent",
			delay: 0,
			distance: 4,
			revert: false,
			scroll: true, // to disable, also set css 'position: inherit' on ul.fancytree-container
			scrollSpeed: 7,
			scrollSensitivity: 10,
			// Delegate draggable.start, drag, and stop events to our handler
			connectToFancytree: true,
			// Let source tree create the helper element
			helper: function(event) {
				var $helper, $nodeTag, opts,
					sourceNode = $.ui.fancytree.getNode(event.target);

				if(!sourceNode){
					// #405, DT issue 211: might happen, if dragging a table *header*
					return "<div>ERROR?: helper requested but sourceNode not found</div>";
				}
				opts = sourceNode.tree.options.dnd;
				$nodeTag = $(sourceNode.span);
				// Only event and node argument is available
				$helper = $("<div class='fancytree-drag-helper'><span class='fancytree-drag-helper-img' /></div>")
					.css({zIndex: 3, position: "relative"}) // so it appears above ext-wide selection bar
					.append($nodeTag.find("span.fancytree-title").clone());

				// Attach node reference to helper object
				$helper.data("ftSourceNode", sourceNode);

				// Support glyph symbols instead of icons
				if( glyph ) {
					$helper.find(".fancytree-drag-helper-img")
						.addClass(glyph.map.dragHelper);
				}
				// Allow to modify the helper, e.g. to add multi-node-drag feedback
				if( opts.initHelper ) {
					opts.initHelper.call(sourceNode.tree, sourceNode, {
						node: sourceNode,
						tree: sourceNode.tree,
						originalEvent: event,
						ui: { helper: $helper }
					});
				}
				// We return an unconnected element, so `draggable` will add this
				// to the parent specified as `appendTo` option
				return $helper;
			},
			start: function(event, ui) {
				var sourceNode = ui.helper.data("ftSourceNode");
				return !!sourceNode; // Abort dragging if no node could be found
			}
		}, tree.options.dnd.draggable));
	}
	// Attach ui.droppable to this Fancytree instance
	if(dnd && dnd.dragDrop) {
		tree.widget.element.droppable($.extend({
			addClasses: false,
			tolerance: "intersect",
			greedy: false
/*
			activate: function(event, ui) {
				tree.debug("droppable - activate", event, ui, this);
			},
			create: function(event, ui) {
				tree.debug("droppable - create", event, ui);
			},
			deactivate: function(event, ui) {
				tree.debug("droppable - deactivate", event, ui);
			},
			drop: function(event, ui) {
				tree.debug("droppable - drop", event, ui);
			},
			out: function(event, ui) {
				tree.debug("droppable - out", event, ui);
			},
			over: function(event, ui) {
				tree.debug("droppable - over", event, ui);
			}
*/
		}, tree.options.dnd.droppable));
	}
}


/* *****************************************************************************
 *
 */

$.ui.fancytree.registerExtension({
	name: "dnd",
	version: "2.23.0",
	// Default options for this extension.
	options: {
		// Make tree nodes accept draggables
		autoExpandMS: 1000,  // Expand nodes after n milliseconds of hovering.
		draggable: null,     // Additional options passed to jQuery draggable
		droppable: null,     // Additional options passed to jQuery droppable
		focusOnClick: false, // Focus, although draggable cancels mousedown event (#270)
		preventVoidMoves: true, 	// Prevent dropping nodes 'before self', etc.
		preventRecursiveMoves: true,// Prevent dropping nodes on own descendants
		smartRevert: true,   // set draggable.revert = true if drop was rejected
		dropMarkerOffsetX: -24,			// absolute position offset for .fancytree-drop-marker relatively to ..fancytree-title (icon/img near a node accepting drop)
		dropMarkerInsertOffsetX: -16,	// additional offset for drop-marker with hitMode = "before"/"after"
		// Events (drag support)
		dragStart: null,     // Callback(sourceNode, data), return true, to enable dnd
		dragStop: null,      // Callback(sourceNode, data)
		initHelper: null,    // Callback(sourceNode, data)
		updateHelper: null,  // Callback(sourceNode, data)
		// Events (drop support)
		dragEnter: null,     // Callback(targetNode, data)
		dragOver: null,      // Callback(targetNode, data)
		dragExpand: null,    // Callback(targetNode, data), return false to prevent autoExpand
		dragDrop: null,      // Callback(targetNode, data)
		dragLeave: null      // Callback(targetNode, data)
	},

	treeInit: function(ctx){
		var tree = ctx.tree;
		this._superApply(arguments);
		// issue #270: draggable eats mousedown events
		if( tree.options.dnd.dragStart ){
			tree.$container.on("mousedown", function(event){
//				if( !tree.hasFocus() && ctx.options.dnd.focusOnClick ) {
				if( ctx.options.dnd.focusOnClick ) {  // #270
					var node = $.ui.fancytree.getNode(event);
					if (node){
						node.debug("Re-enable focus that was prevented by jQuery UI draggable.");
						// node.setFocus();
						// $(node.span).closest(":tabbable").focus();
						// $(event.target).trigger("focus");
						// $(event.target).closest(":tabbable").trigger("focus");
					}
					setTimeout(function() { // #300
						$(event.target).closest(":tabbable").focus();
					}, 10);
				}
			});
		}
		_initDragAndDrop(tree);
	},
	/* Display drop marker according to hitMode ('after', 'before', 'over'). */
	_setDndStatus: function(sourceNode, targetNode, helper, hitMode, accept) {
		var markerOffsetX,
			markerAt = "center",
			instData = this._local,
			dndOpt = this.options.dnd ,
			glyphOpt = this.options.glyph,
			$source = sourceNode ? $(sourceNode.span) : null,
			$target = $(targetNode.span),
			$targetTitle = $target.find("span.fancytree-title");

		if( !instData.$dropMarker ) {
			instData.$dropMarker = $("<div id='fancytree-drop-marker'></div>")
				.hide()
				.css({"z-index": 1000})
				.prependTo($(this.$div).parent());
//                .prependTo("body");

			if( glyphOpt ) {
				// instData.$dropMarker.addClass(glyph.map.dragHelper);
				instData.$dropMarker
					.addClass(glyphOpt.map.dropMarker);
			}
		}
		if( hitMode === "after" || hitMode === "before" || hitMode === "over" ){
			markerOffsetX = dndOpt.dropMarkerOffsetX || 0;
			switch(hitMode){
			case "before":
				markerAt = "top";
				markerOffsetX += (dndOpt.dropMarkerInsertOffsetX || 0);
				break;
			case "after":
				markerAt = "bottom";
				markerOffsetX += (dndOpt.dropMarkerInsertOffsetX || 0);
				break;
			}

			instData.$dropMarker
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
			instData.$dropMarker.hide();
		}
		if( $source ){
			$source
				.toggleClass(classDropAccept, accept === true)
				.toggleClass(classDropReject, accept === false);
		}
		$target
			.toggleClass(classDropTarget, hitMode === "after" || hitMode === "before" || hitMode === "over")
			.toggleClass(classDropAfter, hitMode === "after")
			.toggleClass(classDropBefore, hitMode === "before")
			.toggleClass(classDropAccept, accept === true)
			.toggleClass(classDropReject, accept === false);

		helper
			.toggleClass(classDropAccept, accept === true)
			.toggleClass(classDropReject, accept === false);
	},

	/*
	 * Handles drag'n'drop functionality.
	 *
	 * A standard jQuery drag-and-drop process may generate these calls:
	 *
	 * start:
	 *     _onDragEvent("start", sourceNode, null, event, ui, draggable);
	 * drag:
	 *     _onDragEvent("leave", prevTargetNode, sourceNode, event, ui, draggable);
	 *     _onDragEvent("over", targetNode, sourceNode, event, ui, draggable);
	 *     _onDragEvent("enter", targetNode, sourceNode, event, ui, draggable);
	 * stop:
	 *     _onDragEvent("drop", targetNode, sourceNode, event, ui, draggable);
	 *     _onDragEvent("leave", targetNode, sourceNode, event, ui, draggable);
	 *     _onDragEvent("stop", sourceNode, null, event, ui, draggable);
	 */
	_onDragEvent: function(eventName, node, otherNode, event, ui, draggable) {
		// if(eventName !== "over"){
		// 	this.debug("tree.ext.dnd._onDragEvent(%s, %o, %o) - %o", eventName, node, otherNode, this);
		// }
		var accept, nodeOfs, parentRect, rect, relPos, relPos2,
			enterResponse, hitMode, r,
			opts = this.options,
			dnd = opts.dnd,
			ctx = this._makeHookContext(node, event, {otherNode: otherNode, ui: ui, draggable: draggable}),
			res = null,
			that = this,
			$nodeTag = $(node.span);

		if( dnd.smartRevert ) {
			draggable.options.revert = "invalid";
		}

		switch (eventName) {

		case "start":
			if( node.isStatusNode() ) {
				res = false;
			} else if(dnd.dragStart) {
				res = dnd.dragStart(node, ctx);
			}
			if(res === false) {
				this.debug("tree.dragStart() cancelled");
				//draggable._clear();
				// NOTE: the return value seems to be ignored (drag is not cancelled, when false is returned)
				// TODO: call this._cancelDrag()?
				ui.helper.trigger("mouseup")
					.hide();
			} else {
				if( dnd.smartRevert ) {
					// #567, #593: fix revert position
					// rect = node.li.getBoundingClientRect();
					rect = node[ctx.tree.nodeContainerAttrName].getBoundingClientRect();
					parentRect = $(draggable.options.appendTo)[0].getBoundingClientRect();
					draggable.originalPosition.left = Math.max(0, rect.left - parentRect.left);
					draggable.originalPosition.top = Math.max(0, rect.top - parentRect.top);
				}
				$nodeTag.addClass("fancytree-drag-source");
				// Register global handlers to allow cancel
				$(document)
					.on("keydown.fancytree-dnd,mousedown.fancytree-dnd", function(event){
						// node.tree.debug("dnd global event", event.type, event.which);
						if( event.type === "keydown" && event.which === $.ui.keyCode.ESCAPE ) {
							that.ext.dnd._cancelDrag();
						} else if( event.type === "mousedown" ) {
							that.ext.dnd._cancelDrag();
						}
					});
			}
			break;

		case "enter":
			if(dnd.preventRecursiveMoves && node.isDescendantOf(otherNode)){
				r = false;
			}else{
				r = dnd.dragEnter ? dnd.dragEnter(node, ctx) : null;
			}
			if(!r){
				// convert null, undefined, false to false
				res = false;
			}else if ( $.isArray(r) ) {
				// TODO: also accept passing an object of this format directly
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
			ui.helper.data("enterResponse", res);
			// this.debug("helper.enterResponse: %o", res);
			break;

		case "over":
			enterResponse = ui.helper.data("enterResponse");
			hitMode = null;
			if(enterResponse === false){
				// Don't call dragOver if onEnter returned false.
//                break;
			} else if(typeof enterResponse === "string") {
				// Use hitMode from onEnter if provided.
				hitMode = enterResponse;
			} else {
				// Calculate hitMode from relative cursor position.
				nodeOfs = $nodeTag.offset();
				relPos = { x: event.pageX - nodeOfs.left,
						   y: event.pageY - nodeOfs.top };
				relPos2 = { x: relPos.x / $nodeTag.width(),
							y: relPos.y / $nodeTag.height() };

				if( enterResponse.after && relPos2.y > 0.75 ){
					hitMode = "after";
				} else if(!enterResponse.over && enterResponse.after && relPos2.y > 0.5 ){
					hitMode = "after";
				} else if(enterResponse.before && relPos2.y <= 0.25) {
					hitMode = "before";
				} else if(!enterResponse.over && enterResponse.before && relPos2.y <= 0.5) {
					hitMode = "before";
				} else if(enterResponse.over) {
					hitMode = "over";
				}
				// Prevent no-ops like 'before source node'
				// TODO: these are no-ops when moving nodes, but not in copy mode
				if( dnd.preventVoidMoves ){
					if(node === otherNode){
						this.debug("    drop over source node prevented");
						hitMode = null;
					}else if(hitMode === "before" && otherNode && node === otherNode.getNextSibling()){
						this.debug("    drop after source node prevented");
						hitMode = null;
					}else if(hitMode === "after" && otherNode && node === otherNode.getPrevSibling()){
						this.debug("    drop before source node prevented");
						hitMode = null;
					}else if(hitMode === "over" && otherNode && otherNode.parent === node && otherNode.isLastSibling() ){
						this.debug("    drop last child over own parent prevented");
						hitMode = null;
					}
				}
//                this.debug("hitMode: %s - %s - %s", hitMode, (node.parent === otherNode), node.isLastSibling());
				ui.helper.data("hitMode", hitMode);
			}
			// Auto-expand node (only when 'over' the node, not 'before', or 'after')
			if(hitMode !== "before" && hitMode !== "after" && dnd.autoExpandMS &&
				node.hasChildren() !== false && !node.expanded &&
				(!dnd.dragExpand || dnd.dragExpand(node, ctx) !== false)
				) {
				node.scheduleAction("expand", dnd.autoExpandMS);
			}
			if(hitMode && dnd.dragOver){
				// TODO: http://code.google.com/p/dynatree/source/detail?r=625
				ctx.hitMode = hitMode;
				res = dnd.dragOver(node, ctx);
			}
			accept = (res !== false && hitMode !== null);
			if( dnd.smartRevert ) {
				draggable.options.revert = !accept;
			}
			this._local._setDndStatus(otherNode, node, ui.helper, hitMode, accept);
			break;

		case "drop":
			hitMode = ui.helper.data("hitMode");
			if(hitMode && dnd.dragDrop){
				ctx.hitMode = hitMode;
				dnd.dragDrop(node, ctx);
			}
			break;

		case "leave":
			// Cancel pending expand request
			node.scheduleAction("cancel");
			ui.helper.data("enterResponse", null);
			ui.helper.data("hitMode", null);
			this._local._setDndStatus(otherNode, node, ui.helper, "out", undefined);
			if(dnd.dragLeave){
				dnd.dragLeave(node, ctx);
			}
			break;

		case "stop":
			$nodeTag.removeClass("fancytree-drag-source");
			$(document).off(".fancytree-dnd");
			if(dnd.dragStop){
				dnd.dragStop(node, ctx);
			}
			break;

		default:
			$.error("Unsupported drag event: " + eventName);
		}
		return res;
	},

	_cancelDrag: function() {
		 var dd = $.ui.ddmanager.current;
		 if(dd){
			 dd.cancel();
		 }
	}
});
}(jQuery, window, document));
