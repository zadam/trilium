/*!
 * jquery.fancytree.dnd5.js
 *
 * Drag-and-drop support (native HTML5).
 * (Extension module for jquery.fancytree.js: https://github.com/mar10/fancytree/)
 *
 * Copyright (c) 2008-2023, Martin Wendt (https://wwWendt.de)
 *
 * Released under the MIT license
 * https://github.com/mar10/fancytree/wiki/LicenseInfo
 *
 * @version 2.38.3
 * @date 2023-02-01T20:52:50Z
 */

/*
 #TODO
	Compatiblity when dragging between *separate* windows:

		   Drag from Chrome   Edge    FF    IE11    Safari
	  To Chrome      ok       ok      ok    NO      ?
		 Edge        ok       ok      ok    NO      ?
		 FF          ok       ok      ok    NO      ?
		 IE 11       ok       ok      ok    ok      ?
		 Safari      ?        ?       ?     ?       ok

 */

(function (factory) {
	if (typeof define === "function" && define.amd) {
		// AMD. Register as an anonymous module.
		define(["jquery", "./jquery.fancytree"], factory);
	} else if (typeof module === "object" && module.exports) {
		// Node/CommonJS
		require("./jquery.fancytree");
		module.exports = factory(require("jquery"));
	} else {
		// Browser globals
		factory(jQuery);
	}
})(function ($) {
	"use strict";

	/******************************************************************************
	 * Private functions and variables
	 */
	var FT = $.ui.fancytree,
		isMac = /Mac/.test(navigator.platform),
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
		$dragImage,
		$extraHelper,
		SOURCE_NODE = null,
		SOURCE_NODE_LIST = null,
		$sourceList = null,
		DRAG_ENTER_RESPONSE = null,
		// SESSION_DATA = null, // plain object passed to events as `data`
		SUGGESTED_DROP_EFFECT = null,
		REQUESTED_DROP_EFFECT = null,
		REQUESTED_EFFECT_ALLOWED = null,
		LAST_HIT_MODE = null,
		DRAG_OVER_STAMP = null; // Time when a node entered the 'over' hitmode

	/* */
	function _clearGlobals() {
		DRAG_ENTER_RESPONSE = null;
		DRAG_OVER_STAMP = null;
		REQUESTED_DROP_EFFECT = null;
		REQUESTED_EFFECT_ALLOWED = null;
		SUGGESTED_DROP_EFFECT = null;
		SOURCE_NODE = null;
		SOURCE_NODE_LIST = null;
		if ($sourceList) {
			$sourceList.removeClass(classDragSource + " " + classDragRemove);
		}
		$sourceList = null;
		if ($dropMarker) {
			$dropMarker.hide();
		}
		// Take this badge off of me - I can't use it anymore:
		if ($extraHelper) {
			$extraHelper.remove();
			$extraHelper = null;
		}
	}

	/* Convert number to string and prepend +/-; return empty string for 0.*/
	function offsetString(n) {
		// eslint-disable-next-line no-nested-ternary
		return n === 0 ? "" : n > 0 ? "+" + n : "" + n;
	}

	/* Convert a dragEnter() or dragOver() response to a canonical form.
	 * Return false or plain object
	 * @param {string|object|boolean} r
	 * @return {object|false}
	 */
	function normalizeDragEnterResponse(r) {
		var res;

		if (!r) {
			return false;
		}
		if ($.isPlainObject(r)) {
			res = {
				over: !!r.over,
				before: !!r.before,
				after: !!r.after,
			};
		} else if (Array.isArray(r)) {
			res = {
				over: $.inArray("over", r) >= 0,
				before: $.inArray("before", r) >= 0,
				after: $.inArray("after", r) >= 0,
			};
		} else {
			res = {
				over: r === true || r === "over",
				before: r === true || r === "before",
				after: r === true || r === "after",
			};
		}
		if (Object.keys(res).length === 0) {
			return false;
		}
		// if( Object.keys(res).length === 1 ) {
		// 	res.unique = res[0];
		// }
		return res;
	}

	/* Convert a dataTransfer.effectAllowed to a canonical form.
	 * Return false or plain object
	 * @param {string|boolean} r
	 * @return {object|false}
	 */
	// function normalizeEffectAllowed(r) {
	// 	if (!r || r === "none") {
	// 		return false;
	// 	}
	// 	var all = r === "all",
	// 		res = {
	// 			copy: all || /copy/i.test(r),
	// 			link: all || /link/i.test(r),
	// 			move: all || /move/i.test(r),
	// 		};

	// 	return res;
	// }

	/* Implement auto scrolling when drag cursor is in top/bottom area of scroll parent. */
	function autoScroll(tree, event) {
		var spOfs,
			scrollTop,
			delta,
			dndOpts = tree.options.dnd5,
			sp = tree.$scrollParent[0],
			sensitivity = dndOpts.scrollSensitivity,
			speed = dndOpts.scrollSpeed,
			scrolled = 0;

		if (sp !== document && sp.tagName !== "HTML") {
			spOfs = tree.$scrollParent.offset();
			scrollTop = sp.scrollTop;
			if (spOfs.top + sp.offsetHeight - event.pageY < sensitivity) {
				delta =
					sp.scrollHeight -
					tree.$scrollParent.innerHeight() -
					scrollTop;
				// console.log ("sp.offsetHeight: " + sp.offsetHeight
				// 	+ ", spOfs.top: " + spOfs.top
				// 	+ ", scrollTop: " + scrollTop
				// 	+ ", innerHeight: " + tree.$scrollParent.innerHeight()
				// 	+ ", scrollHeight: " + sp.scrollHeight
				// 	+ ", delta: " + delta
				// 	);
				if (delta > 0) {
					sp.scrollTop = scrolled = scrollTop + speed;
				}
			} else if (scrollTop > 0 && event.pageY - spOfs.top < sensitivity) {
				sp.scrollTop = scrolled = scrollTop - speed;
			}
		} else {
			scrollTop = $(document).scrollTop();
			if (scrollTop > 0 && event.pageY - scrollTop < sensitivity) {
				scrolled = scrollTop - speed;
				$(document).scrollTop(scrolled);
			} else if (
				$(window).height() - (event.pageY - scrollTop) <
				sensitivity
			) {
				scrolled = scrollTop + speed;
				$(document).scrollTop(scrolled);
			}
		}
		if (scrolled) {
			tree.debug("autoScroll: " + scrolled + "px");
		}
		return scrolled;
	}

	/* Guess dropEffect from modifier keys.
	 * Using rules suggested here:
	 *     https://ux.stackexchange.com/a/83769
	 * @returns
	 *     'copy', 'link', 'move', or 'none'
	 */
	function evalEffectModifiers(tree, event, effectDefault) {
		var res = effectDefault;

		if (isMac) {
			if (event.metaKey && event.altKey) {
				// Mac: [Control] + [Option]
				res = "link";
			} else if (event.ctrlKey) {
				// Chrome on Mac: [Control]
				res = "link";
			} else if (event.metaKey) {
				// Mac: [Command]
				res = "move";
			} else if (event.altKey) {
				// Mac: [Option]
				res = "copy";
			}
		} else {
			if (event.ctrlKey) {
				// Windows: [Ctrl]
				res = "copy";
			} else if (event.shiftKey) {
				// Windows: [Shift]
				res = "move";
			} else if (event.altKey) {
				// Windows: [Alt]
				res = "link";
			}
		}
		if (res !== SUGGESTED_DROP_EFFECT) {
			tree.info(
				"evalEffectModifiers: " +
					event.type +
					" - evalEffectModifiers(): " +
					SUGGESTED_DROP_EFFECT +
					" -> " +
					res
			);
		}
		SUGGESTED_DROP_EFFECT = res;
		// tree.debug("evalEffectModifiers: " + res);
		return res;
	}
	/*
	 * Check if the previous callback (dragEnter, dragOver, ...) has changed
	 * the `data` object and apply those settings.
	 *
	 * Safari:
	 *     It seems that `dataTransfer.dropEffect` can only be set on dragStart, and will remain
	 *     even if the cursor changes when [Alt] or [Ctrl] are pressed (?)
	 * Using rules suggested here:
	 *     https://ux.stackexchange.com/a/83769
	 * @returns
	 *     'copy', 'link', 'move', or 'none'
	 */
	function prepareDropEffectCallback(event, data) {
		var tree = data.tree,
			dataTransfer = data.dataTransfer;

		if (event.type === "dragstart") {
			data.effectAllowed = tree.options.dnd5.effectAllowed;
			data.dropEffect = tree.options.dnd5.dropEffectDefault;
		} else {
			data.effectAllowed = REQUESTED_EFFECT_ALLOWED;
			data.dropEffect = REQUESTED_DROP_EFFECT;
		}
		data.dropEffectSuggested = evalEffectModifiers(
			tree,
			event,
			tree.options.dnd5.dropEffectDefault
		);
		data.isMove = data.dropEffect === "move";
		data.files = dataTransfer.files || [];

		// if (REQUESTED_EFFECT_ALLOWED !== dataTransfer.effectAllowed) {
		// 	tree.warn(
		// 		"prepareDropEffectCallback(" +
		// 			event.type +
		// 			"): dataTransfer.effectAllowed changed from " +
		// 			REQUESTED_EFFECT_ALLOWED +
		// 			" -> " +
		// 			dataTransfer.effectAllowed
		// 	);
		// }
		// if (REQUESTED_DROP_EFFECT !== dataTransfer.dropEffect) {
		// 	tree.warn(
		// 		"prepareDropEffectCallback(" +
		// 			event.type +
		// 			"): dataTransfer.dropEffect changed from requested " +
		// 			REQUESTED_DROP_EFFECT +
		// 			" to " +
		// 			dataTransfer.dropEffect
		// 	);
		// }
	}

	function applyDropEffectCallback(event, data, allowDrop) {
		var tree = data.tree,
			dataTransfer = data.dataTransfer;

		if (
			event.type !== "dragstart" &&
			REQUESTED_EFFECT_ALLOWED !== data.effectAllowed
		) {
			tree.warn(
				"effectAllowed should only be changed in dragstart event: " +
					event.type +
					": data.effectAllowed changed from " +
					REQUESTED_EFFECT_ALLOWED +
					" -> " +
					data.effectAllowed
			);
		}

		if (allowDrop === false) {
			tree.info("applyDropEffectCallback: allowDrop === false");
			data.effectAllowed = "none";
			data.dropEffect = "none";
		}
		// if (REQUESTED_DROP_EFFECT !== data.dropEffect) {
		// 	tree.debug(
		// 		"applyDropEffectCallback(" +
		// 			event.type +
		// 			"): data.dropEffect changed from previous " +
		// 			REQUESTED_DROP_EFFECT +
		// 			" to " +
		// 			data.dropEffect
		// 	);
		// }

		data.isMove = data.dropEffect === "move";
		// data.isMove = data.dropEffectSuggested === "move";

		// `effectAllowed` must only be defined in dragstart event, so we
		// store it in a global variable for reference
		if (event.type === "dragstart") {
			REQUESTED_EFFECT_ALLOWED = data.effectAllowed;
			REQUESTED_DROP_EFFECT = data.dropEffect;
		}

		// if (REQUESTED_DROP_EFFECT !== dataTransfer.dropEffect) {
		// 	data.tree.info(
		// 		"applyDropEffectCallback(" +
		// 			event.type +
		// 			"): dataTransfer.dropEffect changed from " +
		// 			REQUESTED_DROP_EFFECT +
		// 			" -> " +
		// 			dataTransfer.dropEffect
		// 	);
		// }
		dataTransfer.effectAllowed = REQUESTED_EFFECT_ALLOWED;
		dataTransfer.dropEffect = REQUESTED_DROP_EFFECT;

		// tree.debug(
		// 	"applyDropEffectCallback(" +
		// 		event.type +
		// 		"): set " +
		// 		dataTransfer.dropEffect +
		// 		"/" +
		// 		dataTransfer.effectAllowed
		// );
		// if (REQUESTED_DROP_EFFECT !== dataTransfer.dropEffect) {
		// 	data.tree.warn(
		// 		"applyDropEffectCallback(" +
		// 			event.type +
		// 			"): could not set dataTransfer.dropEffect to " +
		// 			REQUESTED_DROP_EFFECT +
		// 			": got " +
		// 			dataTransfer.dropEffect
		// 	);
		// }
		return REQUESTED_DROP_EFFECT;
	}

	/* Handle dragover event (fired every x ms) on valid drop targets.
	 *
	 * - Auto-scroll when cursor is in border regions
	 * - Apply restrictioan like 'preventVoidMoves'
	 * - Calculate hit mode
	 * - Calculate drop effect
	 * - Trigger dragOver() callback to let user modify hit mode and drop effect
	 * - Adjust the drop marker accordingly
	 *
	 * @returns hitMode
	 */
	function handleDragOver(event, data) {
		// Implement auto-scrolling
		if (data.options.dnd5.scroll) {
			autoScroll(data.tree, event);
		}
		// Bail out with previous response if we get an invalid dragover
		if (!data.node) {
			data.tree.warn("Ignored dragover for non-node"); //, event, data);
			return LAST_HIT_MODE;
		}

		var markerOffsetX,
			nodeOfs,
			pos,
			relPosY,
			hitMode = null,
			tree = data.tree,
			options = tree.options,
			dndOpts = options.dnd5,
			targetNode = data.node,
			sourceNode = data.otherNode,
			markerAt = "center",
			$target = $(targetNode.span),
			$targetTitle = $target.find("span.fancytree-title");

		if (DRAG_ENTER_RESPONSE === false) {
			tree.debug("Ignored dragover, since dragenter returned false.");
			return false;
		} else if (typeof DRAG_ENTER_RESPONSE === "string") {
			$.error("assert failed: dragenter returned string");
		}
		// Calculate hitMode from relative cursor position.
		nodeOfs = $target.offset();
		relPosY = (event.pageY - nodeOfs.top) / $target.height();
		if (event.pageY === undefined) {
			tree.warn("event.pageY is undefined: see issue #1013.");
		}

		if (DRAG_ENTER_RESPONSE.after && relPosY > 0.75) {
			hitMode = "after";
		} else if (
			!DRAG_ENTER_RESPONSE.over &&
			DRAG_ENTER_RESPONSE.after &&
			relPosY > 0.5
		) {
			hitMode = "after";
		} else if (DRAG_ENTER_RESPONSE.before && relPosY <= 0.25) {
			hitMode = "before";
		} else if (
			!DRAG_ENTER_RESPONSE.over &&
			DRAG_ENTER_RESPONSE.before &&
			relPosY <= 0.5
		) {
			hitMode = "before";
		} else if (DRAG_ENTER_RESPONSE.over) {
			hitMode = "over";
		}
		// Prevent no-ops like 'before source node'
		// TODO: these are no-ops when moving nodes, but not in copy mode
		if (dndOpts.preventVoidMoves && data.dropEffect === "move") {
			if (targetNode === sourceNode) {
				targetNode.debug("Drop over source node prevented.");
				hitMode = null;
			} else if (
				hitMode === "before" &&
				sourceNode &&
				targetNode === sourceNode.getNextSibling()
			) {
				targetNode.debug("Drop after source node prevented.");
				hitMode = null;
			} else if (
				hitMode === "after" &&
				sourceNode &&
				targetNode === sourceNode.getPrevSibling()
			) {
				targetNode.debug("Drop before source node prevented.");
				hitMode = null;
			} else if (
				hitMode === "over" &&
				sourceNode &&
				sourceNode.parent === targetNode &&
				sourceNode.isLastSibling()
			) {
				targetNode.debug("Drop last child over own parent prevented.");
				hitMode = null;
			}
		}
		// Let callback modify the calculated hitMode
		data.hitMode = hitMode;
		if (hitMode && dndOpts.dragOver) {
			prepareDropEffectCallback(event, data);
			dndOpts.dragOver(targetNode, data);
			var allowDrop = !!hitMode;
			applyDropEffectCallback(event, data, allowDrop);
			hitMode = data.hitMode;
		}
		LAST_HIT_MODE = hitMode;
		//
		if (hitMode === "after" || hitMode === "before" || hitMode === "over") {
			markerOffsetX = dndOpts.dropMarkerOffsetX || 0;
			switch (hitMode) {
				case "before":
					markerAt = "top";
					markerOffsetX += dndOpts.dropMarkerInsertOffsetX || 0;
					break;
				case "after":
					markerAt = "bottom";
					markerOffsetX += dndOpts.dropMarkerInsertOffsetX || 0;
					break;
			}

			pos = {
				my: "left" + offsetString(markerOffsetX) + " center",
				at: "left " + markerAt,
				of: $targetTitle,
			};
			if (options.rtl) {
				pos.my = "right" + offsetString(-markerOffsetX) + " center";
				pos.at = "right " + markerAt;
				// console.log("rtl", pos);
			}
			$dropMarker
				.toggleClass(classDropAfter, hitMode === "after")
				.toggleClass(classDropOver, hitMode === "over")
				.toggleClass(classDropBefore, hitMode === "before")
				.show()
				.position(FT.fixPositionOptions(pos));
		} else {
			$dropMarker.hide();
			// console.log("hide dropmarker")
		}

		$(targetNode.span)
			.toggleClass(
				classDropTarget,
				hitMode === "after" ||
					hitMode === "before" ||
					hitMode === "over"
			)
			.toggleClass(classDropAfter, hitMode === "after")
			.toggleClass(classDropBefore, hitMode === "before")
			.toggleClass(classDropAccept, hitMode === "over")
			.toggleClass(classDropReject, hitMode === false);

		return hitMode;
	}

	/*
	 * Handle dragstart drag dragend events on the container
	 */
	function onDragEvent(event) {
		var json,
			tree = this,
			dndOpts = tree.options.dnd5,
			node = FT.getNode(event),
			dataTransfer =
				event.dataTransfer || event.originalEvent.dataTransfer,
			data = {
				tree: tree,
				node: node,
				options: tree.options,
				originalEvent: event.originalEvent,
				widget: tree.widget,
				dataTransfer: dataTransfer,
				useDefaultImage: true,
				dropEffect: undefined,
				dropEffectSuggested: undefined,
				effectAllowed: undefined, // set by dragstart
				files: undefined, // only for drop events
				isCancelled: undefined, // set by dragend
				isMove: undefined,
			};

		switch (event.type) {
			case "dragstart":
				if (!node) {
					tree.info("Ignored dragstart on a non-node.");
					return false;
				}
				// Store current source node in different formats
				SOURCE_NODE = node;

				// Also optionally store selected nodes
				if (dndOpts.multiSource === false) {
					SOURCE_NODE_LIST = [node];
				} else if (dndOpts.multiSource === true) {
					if (node.isSelected()) {
						SOURCE_NODE_LIST = tree.getSelectedNodes();
					} else {
						SOURCE_NODE_LIST = [node];
					}
				} else {
					SOURCE_NODE_LIST = dndOpts.multiSource(node, data);
				}
				// Cache as array of jQuery objects for faster access:
				$sourceList = $(
					$.map(SOURCE_NODE_LIST, function (n) {
						return n.span;
					})
				);
				// Set visual feedback
				$sourceList.addClass(classDragSource);

				// Set payload
				// Note:
				// Transfer data is only accessible on dragstart and drop!
				// For all other events the formats and kinds in the drag
				// data store list of items representing dragged data can be
				// enumerated, but the data itself is unavailable and no new
				// data can be added.
				var nodeData = node.toDict(true, dndOpts.sourceCopyHook);
				nodeData.treeId = node.tree._id;
				json = JSON.stringify(nodeData);
				try {
					dataTransfer.setData(nodeMimeType, json);
					dataTransfer.setData("text/html", $(node.span).html());
					dataTransfer.setData("text/plain", node.title);
				} catch (ex) {
					// IE only accepts 'text' type
					tree.warn(
						"Could not set data (IE only accepts 'text') - " + ex
					);
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
				if (dndOpts.setTextTypeJson) {
					dataTransfer.setData("text", json);
				} else {
					dataTransfer.setData("text", node.title);
				}

				// Set the allowed drag modes (combinations of move, copy, and link)
				// (effectAllowed can only be set in the dragstart event.)
				// This can be overridden in the dragStart() callback
				prepareDropEffectCallback(event, data);

				// Let user cancel or modify above settings
				// Realize potential changes by previous callback
				if (dndOpts.dragStart(node, data) === false) {
					// Cancel dragging
					// dataTransfer.dropEffect = "none";
					_clearGlobals();
					return false;
				}
				applyDropEffectCallback(event, data);

				// Unless user set `data.useDefaultImage` to false in dragStart,
				// generata a default drag image now:
				$extraHelper = null;

				if (data.useDefaultImage) {
					// Set the title as drag image (otherwise it would contain the expander)
					$dragImage = $(node.span).find(".fancytree-title");

					if (SOURCE_NODE_LIST && SOURCE_NODE_LIST.length > 1) {
						// Add a counter badge to node title if dragging more than one node.
						// We want this, because the element that is used as drag image
						// must be *visible* in the DOM, so we cannot create some hidden
						// custom markup.
						// See https://kryogenix.org/code/browser/custom-drag-image.html
						// Also, since IE 11 and Edge don't support setDragImage() alltogether,
						// it gives som feedback to the user.
						// The badge will be removed later on drag end.
						$extraHelper = $(
							"<span class='fancytree-childcounter'/>"
						)
							.text("+" + (SOURCE_NODE_LIST.length - 1))
							.appendTo($dragImage);
					}
					if (dataTransfer.setDragImage) {
						// IE 11 and Edge do not support this
						dataTransfer.setDragImage($dragImage[0], -10, -10);
					}
				}
				return true;

			case "drag":
				// Called every few milliseconds (no matter if the
				// cursor is over a valid drop target)
				// data.tree.info("drag", SOURCE_NODE)
				prepareDropEffectCallback(event, data);
				dndOpts.dragDrag(node, data);
				applyDropEffectCallback(event, data);

				$sourceList.toggleClass(classDragRemove, data.isMove);
				break;

			case "dragend":
				// Called at the end of a d'n'd process (after drop)
				// Note caveat: If drop removed the dragged source element,
				// we may not get this event, since the target does not exist
				// anymore
				prepareDropEffectCallback(event, data);

				_clearGlobals();

				data.isCancelled = !LAST_HIT_MODE;
				dndOpts.dragEnd(node, data, !LAST_HIT_MODE);
				// applyDropEffectCallback(event, data);
				break;
		}
	}
	/*
	 * Handle dragenter dragover dragleave drop events on the container
	 */
	function onDropEvent(event) {
		var json,
			allowAutoExpand,
			nodeData,
			isSourceFtNode,
			r,
			res,
			tree = this,
			dndOpts = tree.options.dnd5,
			allowDrop = null,
			node = FT.getNode(event),
			dataTransfer =
				event.dataTransfer || event.originalEvent.dataTransfer,
			data = {
				tree: tree,
				node: node,
				options: tree.options,
				originalEvent: event.originalEvent,
				widget: tree.widget,
				hitMode: DRAG_ENTER_RESPONSE,
				dataTransfer: dataTransfer,
				otherNode: SOURCE_NODE || null,
				otherNodeList: SOURCE_NODE_LIST || null,
				otherNodeData: null, // set by drop event
				useDefaultImage: true,
				dropEffect: undefined,
				dropEffectSuggested: undefined,
				effectAllowed: undefined, // set by dragstart
				files: null, // list of File objects (may be [])
				isCancelled: undefined, // set by drop event
				isMove: undefined,
			};

		// data.isMove = dropEffect === "move";

		switch (event.type) {
			case "dragenter":
				// The dragenter event is fired when a dragged element or
				// text selection enters a valid drop target.

				DRAG_OVER_STAMP = null;
				if (!node) {
					// Sometimes we get dragenter for the container element
					tree.debug(
						"Ignore non-node " +
							event.type +
							": " +
							event.target.tagName +
							"." +
							event.target.className
					);
					DRAG_ENTER_RESPONSE = false;
					break;
				}

				$(node.span)
					.addClass(classDropOver)
					.removeClass(classDropAccept + " " + classDropReject);

				// Data is only readable in the dragstart and drop event,
				// but we can check for the type:
				isSourceFtNode =
					$.inArray(nodeMimeType, dataTransfer.types) >= 0;

				if (dndOpts.preventNonNodes && !isSourceFtNode) {
					node.debug("Reject dropping a non-node.");
					DRAG_ENTER_RESPONSE = false;
					break;
				} else if (
					dndOpts.preventForeignNodes &&
					(!SOURCE_NODE || SOURCE_NODE.tree !== node.tree)
				) {
					node.debug("Reject dropping a foreign node.");
					DRAG_ENTER_RESPONSE = false;
					break;
				} else if (
					dndOpts.preventSameParent &&
					data.otherNode &&
					data.otherNode.tree === node.tree &&
					node.parent === data.otherNode.parent
				) {
					node.debug("Reject dropping as sibling (same parent).");
					DRAG_ENTER_RESPONSE = false;
					break;
				} else if (
					dndOpts.preventRecursion &&
					data.otherNode &&
					data.otherNode.tree === node.tree &&
					node.isDescendantOf(data.otherNode)
				) {
					node.debug("Reject dropping below own ancestor.");
					DRAG_ENTER_RESPONSE = false;
					break;
				} else if (dndOpts.preventLazyParents && !node.isLoaded()) {
					node.warn("Drop over unloaded target node prevented.");
					DRAG_ENTER_RESPONSE = false;
					break;
				}
				$dropMarker.show();

				// Call dragEnter() to figure out if (and where) dropping is allowed
				prepareDropEffectCallback(event, data);
				r = dndOpts.dragEnter(node, data);

				res = normalizeDragEnterResponse(r);
				// alert("res:" + JSON.stringify(res))
				DRAG_ENTER_RESPONSE = res;

				allowDrop = res && (res.over || res.before || res.after);

				applyDropEffectCallback(event, data, allowDrop);
				break;

			case "dragover":
				if (!node) {
					tree.debug(
						"Ignore non-node " +
							event.type +
							": " +
							event.target.tagName +
							"." +
							event.target.className
					);
					break;
				}
				// The dragover event is fired when an element or text
				// selection is being dragged over a valid drop target
				// (every few hundred milliseconds).
				// tree.debug(
				// 	event.type +
				// 		": dropEffect: " +
				// 		dataTransfer.dropEffect
				// );
				prepareDropEffectCallback(event, data);
				LAST_HIT_MODE = handleDragOver(event, data);

				// The flag controls the preventDefault() below:
				allowDrop = !!LAST_HIT_MODE;
				allowAutoExpand =
					LAST_HIT_MODE === "over" || LAST_HIT_MODE === false;

				if (
					allowAutoExpand &&
					!node.expanded &&
					node.hasChildren() !== false
				) {
					if (!DRAG_OVER_STAMP) {
						DRAG_OVER_STAMP = Date.now();
					} else if (
						dndOpts.autoExpandMS &&
						Date.now() - DRAG_OVER_STAMP > dndOpts.autoExpandMS &&
						!node.isLoading() &&
						(!dndOpts.dragExpand ||
							dndOpts.dragExpand(node, data) !== false)
					) {
						node.setExpanded();
					}
				} else {
					DRAG_OVER_STAMP = null;
				}
				break;

			case "dragleave":
				// NOTE: dragleave is fired AFTER the dragenter event of the
				// FOLLOWING element.
				if (!node) {
					tree.debug(
						"Ignore non-node " +
							event.type +
							": " +
							event.target.tagName +
							"." +
							event.target.className
					);
					break;
				}
				if (!$(node.span).hasClass(classDropOver)) {
					node.debug("Ignore dragleave (multi).");
					break;
				}
				$(node.span).removeClass(
					classDropOver +
						" " +
						classDropAccept +
						" " +
						classDropReject
				);
				node.scheduleAction("cancel");
				dndOpts.dragLeave(node, data);
				$dropMarker.hide();
				break;

			case "drop":
				// Data is only readable in the (dragstart and) drop event:

				if ($.inArray(nodeMimeType, dataTransfer.types) >= 0) {
					nodeData = dataTransfer.getData(nodeMimeType);
					tree.info(
						event.type +
							": getData('application/x-fancytree-node'): '" +
							nodeData +
							"'"
					);
				}
				if (!nodeData) {
					// 1. Source is not a Fancytree node, or
					// 2. If the FT mime type was set, but returns '', this
					//    is probably IE 11 (which only supports 'text')
					nodeData = dataTransfer.getData("text");
					tree.info(
						event.type + ": getData('text'): '" + nodeData + "'"
					);
				}
				if (nodeData) {
					try {
						// 'text' type may contain JSON if IE is involved
						// and setTextTypeJson option was set
						json = JSON.parse(nodeData);
						if (json.title !== undefined) {
							data.otherNodeData = json;
						}
					} catch (ex) {
						// assume 'text' type contains plain text, so `otherNodeData`
						// should not be set
					}
				}
				tree.debug(
					event.type +
						": nodeData: '" +
						nodeData +
						"', otherNodeData: ",
					data.otherNodeData
				);

				$(node.span).removeClass(
					classDropOver +
						" " +
						classDropAccept +
						" " +
						classDropReject
				);

				// Let user implement the actual drop operation
				data.hitMode = LAST_HIT_MODE;
				prepareDropEffectCallback(event, data, !LAST_HIT_MODE);
				data.isCancelled = !LAST_HIT_MODE;

				var orgSourceElem = SOURCE_NODE && SOURCE_NODE.span,
					orgSourceTree = SOURCE_NODE && SOURCE_NODE.tree;

				dndOpts.dragDrop(node, data);
				// applyDropEffectCallback(event, data);

				// Prevent browser's default drop handling, i.e. open as link, ...
				event.preventDefault();

				if (orgSourceElem && !document.body.contains(orgSourceElem)) {
					// The drop handler removed the original drag source from
					// the DOM, so the dragend event will probaly not fire.
					if (orgSourceTree === tree) {
						tree.debug(
							"Drop handler removed source element: generating dragEnd."
						);
						dndOpts.dragEnd(SOURCE_NODE, data);
					} else {
						tree.warn(
							"Drop handler removed source element: dragend event may be lost."
						);
					}
				}

				_clearGlobals();

				break;
		}
		// Dnd API madness: we must PREVENT default handling to enable dropping
		if (allowDrop) {
			event.preventDefault();
			return false;
		}
	}

	/** [ext-dnd5] Return a Fancytree instance, from element, index, event, or jQueryObject.
	 *
	 * @returns {FancytreeNode[]} List of nodes (empty if no drag operation)
	 * @example
	 * $.ui.fancytree.getDragNodeList();
	 *
	 * @alias Fancytree_Static#getDragNodeList
	 * @requires jquery.fancytree.dnd5.js
	 * @since 2.31
	 */
	$.ui.fancytree.getDragNodeList = function () {
		return SOURCE_NODE_LIST || [];
	};

	/** [ext-dnd5] Return the FancytreeNode that is currently being dragged.
	 *
	 * If multiple nodes are dragged, only the first is returned.
	 *
	 * @returns {FancytreeNode | null} dragged nodes or null if no drag operation
	 * @example
	 * $.ui.fancytree.getDragNode();
	 *
	 * @alias Fancytree_Static#getDragNode
	 * @requires jquery.fancytree.dnd5.js
	 * @since 2.31
	 */
	$.ui.fancytree.getDragNode = function () {
		return SOURCE_NODE;
	};

	/******************************************************************************
	 *
	 */

	$.ui.fancytree.registerExtension({
		name: "dnd5",
		version: "2.38.3",
		// Default options for this extension.
		options: {
			autoExpandMS: 1500, // Expand nodes after n milliseconds of hovering
			dropMarkerInsertOffsetX: -16, // Additional offset for drop-marker with hitMode = "before"/"after"
			dropMarkerOffsetX: -24, // Absolute position offset for .fancytree-drop-marker relatively to ..fancytree-title (icon/img near a node accepting drop)
			// #1021 `document.body` is not available yet
			dropMarkerParent: "body", // Root Container used for drop marker (could be a shadow root)
			multiSource: false, // true: Drag multiple (i.e. selected) nodes. Also a callback() is allowed
			effectAllowed: "all", // Restrict the possible cursor shapes and modifier operations (can also be set in the dragStart event)
			// dropEffect: "auto", // 'copy'|'link'|'move'|'auto'(calculate from `effectAllowed`+modifier keys) or callback(node, data) that returns such string.
			dropEffectDefault: "move", // Default dropEffect ('copy', 'link', or 'move') when no modifier is pressed (overide in dragDrag, dragOver).
			preventForeignNodes: false, // Prevent dropping nodes from different Fancytrees
			preventLazyParents: true, // Prevent dropping items on unloaded lazy Fancytree nodes
			preventNonNodes: false, // Prevent dropping items other than Fancytree nodes
			preventRecursion: true, // Prevent dropping nodes on own descendants
			preventSameParent: false, // Prevent dropping nodes under same direct parent
			preventVoidMoves: true, // Prevent dropping nodes 'before self', etc.
			scroll: true, // Enable auto-scrolling while dragging
			scrollSensitivity: 20, // Active top/bottom margin in pixel
			scrollSpeed: 5, // Pixel per event
			setTextTypeJson: false, // Allow dragging of nodes to different IE windows
			sourceCopyHook: null, // Optional callback passed to `toDict` on dragStart @since 2.38
			// Events (drag support)
			dragStart: null, // Callback(sourceNode, data), return true, to enable dnd drag
			dragDrag: $.noop, // Callback(sourceNode, data)
			dragEnd: $.noop, // Callback(sourceNode, data)
			// Events (drop support)
			dragEnter: null, // Callback(targetNode, data), return true, to enable dnd drop
			dragOver: $.noop, // Callback(targetNode, data)
			dragExpand: $.noop, // Callback(targetNode, data), return false to prevent autoExpand
			dragDrop: $.noop, // Callback(targetNode, data)
			dragLeave: $.noop, // Callback(targetNode, data)
		},

		treeInit: function (ctx) {
			var $temp,
				tree = ctx.tree,
				opts = ctx.options,
				glyph = opts.glyph || null,
				dndOpts = opts.dnd5;

			if ($.inArray("dnd", opts.extensions) >= 0) {
				$.error("Extensions 'dnd' and 'dnd5' are mutually exclusive.");
			}
			if (dndOpts.dragStop) {
				$.error(
					"dragStop is not used by ext-dnd5. Use dragEnd instead."
				);
			}
			if (dndOpts.preventRecursiveMoves != null) {
				$.error(
					"preventRecursiveMoves was renamed to preventRecursion."
				);
			}

			// Implement `opts.createNode` event to add the 'draggable' attribute
			// #680: this must happen before calling super.treeInit()
			if (dndOpts.dragStart) {
				FT.overrideMethod(
					ctx.options,
					"createNode",
					function (event, data) {
						// Default processing if any
						this._super.apply(this, arguments);
						if (data.node.span) {
							data.node.span.draggable = true;
						} else {
							data.node.warn(
								"Cannot add `draggable`: no span tag"
							);
						}
					}
				);
			}
			this._superApply(arguments);

			this.$container.addClass("fancytree-ext-dnd5");

			// Store the current scroll parent, which may be the tree
			// container, any enclosing div, or the document.
			// #761: scrollParent() always needs a container child
			$temp = $("<span>").appendTo(this.$container);
			this.$scrollParent = $temp.scrollParent();
			$temp.remove();

			$dropMarker = $("#fancytree-drop-marker");
			if (!$dropMarker.length) {
				$dropMarker = $("<div id='fancytree-drop-marker'></div>")
					.hide()
					.css({
						"z-index": 1000,
						// Drop marker should not steal dragenter/dragover events:
						"pointer-events": "none",
					})
					.prependTo(dndOpts.dropMarkerParent);
				if (glyph) {
					FT.setSpanIcon(
						$dropMarker[0],
						glyph.map._addClass,
						glyph.map.dropMarker
					);
				}
			}
			$dropMarker.toggleClass("fancytree-rtl", !!opts.rtl);

			// Enable drag support if dragStart() is specified:
			if (dndOpts.dragStart) {
				// Bind drag event handlers
				tree.$container.on(
					"dragstart drag dragend",
					onDragEvent.bind(tree)
				);
			}
			// Enable drop support if dragEnter() is specified:
			if (dndOpts.dragEnter) {
				// Bind drop event handlers
				tree.$container.on(
					"dragenter dragover dragleave drop",
					onDropEvent.bind(tree)
				);
			}
		},
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
