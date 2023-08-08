/*!
 * jquery.fancytree.grid.js
 *
 * Render tree as table (aka 'tree grid', 'table tree').
 * (Extension module for jquery.fancytree.js: https://github.com/mar10/fancytree/)
 *
 * Copyright (c) 2008-2023, Martin Wendt (http://wwWendt.de)
 *
 * Released under the MIT license
 * https://github.com/mar10/fancytree/wiki/LicenseInfo
 *
 * @version 2.38.3
 * @date 2023-02-01T20:52:50Z
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
		_assert = FT.assert,
		SCROLL_MODE = "wheel"; // 'wheel' | 'scroll'
	// EPS = 1.0;

	/*
	 * [ext-grid] ...
	 *
	 * @alias Fancytree#_addScrollbar
	 * @requires jquery.fancytree.grid.js
	 */
	function _addScrollbar(table) {
		var sbWidth = 10,
			$table = $(table),
			position = $table.position(),
			// top = $table.find("tbody").position().top,

			$sb = $("<div>", {
				class: "fancytree-scrollbar",
				css: {
					border: "1px solid gray",
					position: "absolute",
					top: position.top,
					left: position.left + $table.width(),
					width: sbWidth,
					height: $table.find("tbody").height(),
				},
			});

		$table
			.css({
				"margin-right": sbWidth,
			})
			.after($sb);

		return $sb;
	}

	/*
	 * [ext-grid] Invalidate renumber status, i.e. trigger renumber next time.
	 *
	 * @alias Fancytree#_renumberReset
	 * @requires jquery.fancytree.grid.js
	 */
	$.ui.fancytree._FancytreeClass.prototype._renumberReset = function () {
		// this.debug("_renumberReset()");
		this.visibleNodeList = null;
	};

	/*
	 * [ext-grid] Adjust the start value if the content would be outside otherwise.
	 *
	 * @alias Fancytree#_fixStart
	 * @requires jquery.fancytree.grid.js
	 */
	$.ui.fancytree._FancytreeClass.prototype._fixStart = function (
		start,
		apply
	) {
		var vp = this.viewport,
			nodeList = this.visibleNodeList;

		start = start == null ? vp.start : start;
		// this.debug("_fixStart(" + start + ", " + !!apply + ")");
		var orgStart = start;
		// Don't scroll down below bottom node
		if (nodeList) {
			start = Math.min(start, this.visibleNodeList.length - vp.count);
			start = Math.max(start, 0, start);
			if (start !== orgStart) {
				this.debug("Adjust start " + orgStart + " => " + start);
				if (apply) {
					vp.start = start;
				}
			}
		}
		return start;
	};

	/*
	 * [ext-grid] ...
	 *
	 * @alias Fancytree#_shiftViewport
	 * @requires jquery.fancytree.grid.js
	 */
	$.ui.fancytree._FancytreeClass.prototype._shiftViewport = function (
		mode,
		ofs
	) {
		this.debug("_shiftViewport", mode, ofs);
		switch (mode) {
			case "vscroll":
				if (ofs) {
					this.setViewport({
						start: this.viewport.start + (ofs > 0 ? 1 : -1),
					});
				}
				break;

			default:
				throw Error("Invalid  mode: " + mode);
		}
	};

	/**
	 * [ext-grid] Return true if viewport cannot be scrolled down any further.
	 *
	 * @alias Fancytree#isViewportBottom
	 * @requires jquery.fancytree.grid.js
	 */
	$.ui.fancytree._FancytreeClass.prototype.isViewportBottom = function () {
		return (
			this.viewport.start + this.viewport.count >=
			this.visibleNodeList.length
		);
	};

	/**
	 * [ext-grid] Define a subset of rows/columns to display and redraw.
	 *
	 * @param {object | boolean} options viewport boundaries and status.
	 *
	 * @alias Fancytree#setViewport
	 * @requires jquery.fancytree.grid.js
	 */
	$.ui.fancytree._FancytreeClass.prototype.setViewport = function (opts) {
		if (typeof opts === "boolean") {
			this.debug("setViewport( " + opts + ")");
			return this.setViewport({ enabled: opts });
		}
		opts = opts || {};
		var i,
			count,
			start,
			newRow,
			redrawReason = "",
			vp = this.viewport,
			diffVp = { start: 0, count: 0, enabled: null, force: null },
			newVp = $.extend({}, vp),
			trList = this.tbody.children,
			trCount = trList.length;

		// Sanitize viewport settings and check if we need to redraw
		this.debug("setViewport(" + opts.start + ", +" + opts.count + ")");
		if (opts.force) {
			redrawReason += "force";
			diffVp.force = true;
		}

		opts.enabled = opts.enabled !== false; // default to true
		if (vp.enabled !== opts.enabled) {
			redrawReason += "enable";
			newVp.enabled = diffVp.enabled = opts.enabled;
		}

		start = opts.start == null ? vp.start : Math.max(0, +opts.start);
		// Adjust start value to assure the current content is inside vp
		start = this._fixStart(start, false);

		if (vp.start !== +start) {
			redrawReason += "start";
			newVp.start = start;
			diffVp.start = start - vp.start;
		}

		count = opts.count == null ? vp.count : Math.max(1, +opts.count);
		if (vp.count !== +count) {
			redrawReason += "count";
			newVp.count = count;
			diffVp.count = count - vp.count;
		}
		// if (vp.left !== +opts.left) {
		// 	diffVp.left = left - vp.left;
		// 	newVp.left = opts.left;
		// 	redrawReason += "left";
		// }
		// if (vp.right !== +opts.right) {
		// 	diffVp.right = right - vp.right;
		// 	newVp.right = opts.right;
		// 	redrawReason += "right";
		// }

		if (!redrawReason) {
			return false;
		}
		// Let user cancel or modify the update
		var info = {
			next: newVp,
			diff: diffVp,
			reason: redrawReason,
			scrollOnly: redrawReason === "start",
		};
		if (
			!opts.noEvents &&
			this._triggerTreeEvent("beforeUpdateViewport", null, info) === false
		) {
			return false;
		}
		info.prev = $.extend({}, vp);
		delete info.next;
		// vp.enabled = newVp.enabled;
		vp.start = newVp.start;
		vp.count = newVp.count;

		// Make sure we have the correct count of TRs
		var prevPhase = this.isVpUpdating;

		if (trCount > count) {
			for (i = 0; i < trCount - count; i++) {
				delete this.tbody.lastChild.ftnode;
				this.tbody.removeChild(this.tbody.lastChild);
			}
		} else if (trCount < count) {
			for (i = 0; i < count - trCount; i++) {
				newRow = this.rowFragment.firstChild.cloneNode(true);
				this.tbody.appendChild(newRow);
			}
		}
		trCount = trList.length;

		// Update visible node cache if needed
		var force = opts.force;
		this.redrawViewport(force);

		if (!opts.noEvents) {
			this._triggerTreeEvent("updateViewport", null, info);
		}

		this.isVpUpdating = prevPhase;
		return true;
	};

	/**
	 * [ext-grid] Calculate the viewport count from current scroll wrapper height.
	 *
	 * @alias Fancytree#adjustViewportSize
	 * @requires jquery.fancytree.grid.js
	 */
	$.ui.fancytree._FancytreeClass.prototype.adjustViewportSize = function () {
		_assert(
			this.scrollWrapper,
			"No parent div.fancytree-grid-container found."
		);
		if (this.isVpUpdating) {
			this.debug("Ignoring adjustViewportSize() during VP update.");
			return;
		}
		// Calculate how many rows fit into current container height
		var $table = this.$container,
			wrapper = this.scrollWrapper,
			trHeight = $table.find(">tbody>tr").first().height() || 0,
			tableHeight = $table.height(),
			headHeight = tableHeight - this.viewport.count * trHeight,
			wrapperHeight = wrapper.offsetHeight,
			free = wrapperHeight - headHeight,
			newCount = trHeight ? Math.floor(free / trHeight) : 0;

		// console.info(
		// 	"set container height",
		// 	$(this)
		// 		.parent(".fancytree-grid-container")
		// 		.height()
		// );

		this.setViewport({ count: newCount });
		// if (SCROLL_MODE === "scroll") {
		// 	// Add bottom margin to the table, to make sure the wrapper becomes
		// 	// scrollable
		// 	var mb = wrapperHeight - $table.height() - 2.0 * EPS;
		// 	this.debug("margin-bottom=" + mb);
		// 	$table.css("margin-bottom", mb);
		// }
	};

	/*
	 * [ext-grid] Calculate the scroll container dimension from the current tree table.
	 *
	 * @alias Fancytree#initViewportWrapper
	 * @requires jquery.fancytree.grid.js
	 */
	$.ui.fancytree._FancytreeClass.prototype._initViewportWrapper =
		function () {
			var // wrapper = this.scrollWrapper,
				// $wrapper = $(wrapper),
				tree = this;

			// if (SCROLL_MODE === "scroll") {
			// 	$wrapper.on("scroll", function(e) {
			// 		var viewport = tree.viewport,
			// 			curTop = wrapper.scrollTop,
			// 			homeTop = viewport.start === 0 ? 0 : EPS,
			// 			dy = viewport.start === 0 ? 1 : curTop - EPS; //homeTop;

			// 		tree.debug(
			// 			"Got 'scroll' event: scrollTop=" +
			// 				curTop +
			// 				", homeTop=" +
			// 				homeTop +
			// 				", start=" +
			// 				viewport.start +
			// 				", dy=" +
			// 				dy
			// 		);
			// 		if (tree.isVpUpdating) {
			// 			tree.debug("Ignoring scroll during VP update.");
			// 			return;
			// 		} else if (curTop === homeTop) {
			// 			tree.debug("Ignoring scroll to neutral " + homeTop + ".");
			// 			return;
			// 		}
			// 		tree._shiftViewport("vscroll", dy);
			// 		homeTop = viewport.start === 0 ? 0 : EPS;
			// 		setTimeout(function() {
			// 			tree.debug(
			// 				"scrollTop(" +
			// 					wrapper.scrollTop +
			// 					" -> " +
			// 					homeTop +
			// 					")..."
			// 			);
			// 			wrapper.scrollTop = homeTop;
			// 		}, 0);
			// 	});
			// }
			if (SCROLL_MODE === "wheel") {
				this.$container.on("wheel", function (e) {
					var orgEvent = e.originalEvent,
						viewport = tree.viewport,
						dy = orgEvent.deltaY; // * orgEvent.wheelDeltaY;

					if (
						!dy ||
						e.altKey ||
						e.ctrlKey ||
						e.metaKey ||
						e.shiftKey
					) {
						return true;
					}
					if (dy < 0 && viewport.start === 0) {
						return true;
					}
					if (dy > 0 && tree.isViewportBottom()) {
						return true;
					}
					tree.debug(
						"Got 'wheel' event: dy=" +
							dy +
							", mode=" +
							orgEvent.deltaMode
					);
					tree._shiftViewport("vscroll", dy);
					return false;
				});
			}
		};

	/*
	 * [ext-grid] Renumber and collect all visible rows.
	 *
	 * @param {bool} [force=false]
	 * @param {FancytreeNode | int} [startIdx=0]
	 * @alias Fancytree#_renumberVisibleNodes
	 * @requires jquery.fancytree.grid.js
	 */
	$.ui.fancytree._FancytreeClass.prototype._renumberVisibleNodes = function (
		force,
		startIdx
	) {
		if (
			(!this.options.viewport.enabled || this.visibleNodeList != null) &&
			force !== true
		) {
			// this.debug("_renumberVisibleNodes() ignored.");
			return false;
		}
		this.debugTime("_renumberVisibleNodes()");
		var i = 0,
			prevLength = this.visibleNodeList ? this.visibleNodeList.length : 0,
			visibleNodeList = (this.visibleNodeList = []);

		// Reset previous data
		this.visit(function (node) {
			node._rowIdx = null;
			// node.span = null;
			// if (node.tr) {
			// 	delete node.tr.ftnode;
			// 	node.tr = null;
			// }
		});
		// Iterate over all *visible* nodes
		this.visitRows(function (node) {
			node._rowIdx = i++;
			visibleNodeList.push(node);
		});
		this.debugTimeEnd("_renumberVisibleNodes()");
		if (i !== prevLength) {
			this._triggerTreeEvent("updateViewport", null, {
				reason: "renumber",
				diff: { start: 0, count: 0, enabled: null, force: null },
				next: $.extend({}, this.viewport),
				// visibleCount: prevLength,
				// cur: i,
			});
		}
	};

	/**
	 * [ext-grid] Render all visible nodes into the viweport.
	 *
	 * @param {bool} [force=false]
	 * @alias Fancytree#redrawViewport
	 * @requires jquery.fancytree.grid.js
	 */
	$.ui.fancytree._FancytreeClass.prototype.redrawViewport = function (force) {
		if (this._enableUpdate === false) {
			// tree.debug("no render", tree._enableUpdate);
			return;
		}
		this.debugTime("redrawViewport()");
		this._renumberVisibleNodes(force);
		// Adjust vp.start value to assure the current content is inside:
		this._fixStart(null, true);

		var i = 0,
			vp = this.viewport,
			visibleNodeList = this.visibleNodeList,
			start = vp.start,
			bottom = start + vp.count,
			tr,
			_renderCount = 0,
			trIdx = 0,
			trList = this.tbody.children,
			prevPhase = this.isVpUpdating;

		// Reset previous data
		this.visit(function (node) {
			// node.debug("redrawViewport(): _rowIdx=" + node._rowIdx);
			node.span = null;
			if (node.tr) {
				delete node.tr.ftnode;
				node.tr = null;
			}
		});

		// Redraw the whole tree, erasing all node markup before and after
		// the viewport

		for (i = start; i < bottom; i++) {
			var node = visibleNodeList[i];

			tr = trList[trIdx];

			if (!node) {
				// TODO: make trailing empty rows configurable (custom template or remove TRs)
				var newRow = this.rowFragment.firstChild.cloneNode(true);
				this.tbody.replaceChild(newRow, tr);
				trIdx++;
				continue;
			}
			if (tr !== node.tr) {
				node.tr = tr;
				node.render();
				_renderCount++;

				// TODO:
				// Implement scrolling by re-using existing markup
				// e.g. shifting TRs or TR child elements instead of
				// re-creating all the time
			}
			trIdx++;
		}
		this.isVpUpdating = prevPhase;
		this.debugTimeEnd("redrawViewport()");
	};

	$.ui.fancytree.registerExtension({
		name: "grid",
		version: "2.38.3",
		// Default options for this extension.
		options: {
			checkboxColumnIdx: null, // render the checkboxes into the this column index (default: nodeColumnIdx)
			indentation: 16, // indent every node level by 16px
			mergeStatusColumns: true, // display 'nodata', 'loading', 'error' centered in a single, merged TR
			nodeColumnIdx: 0, // render node expander, icon, and title to this column (default: #0)
		},
		// Overide virtual methods for this extension.
		// `this`       : is this extension object
		// `this._super`: the virtual function that was overriden (member of prev. extension or Fancytree)
		treeInit: function (ctx) {
			var i,
				columnCount,
				n,
				$row,
				$tbody,
				tree = ctx.tree,
				opts = ctx.options,
				tableOpts = opts.table,
				$table = tree.widget.element,
				$scrollWrapper = $table.parent(".fancytree-grid-container");

			if ($.inArray("table", opts.extensions) >= 0) {
				$.error("ext-grid and ext-table are mutually exclusive.");
			}
			if (opts.renderStatusColumns === true) {
				opts.renderStatusColumns = opts.renderColumns;
			}
			// Note: we also re-use CSS rules from ext-table
			$table.addClass(
				"fancytree-container fancytree-ext-grid fancytree-ext-table"
			);
			$tbody = $table.find(">tbody");
			if (!$tbody.length) {
				// TODO: not sure if we can rely on browsers to insert missing <tbody> before <tr>s:
				if ($table.find(">tr").length) {
					$.error(
						"Expected table > tbody > tr. If you see this, please open an issue."
					);
				}
				$tbody = $("<tbody>").appendTo($table);
			}

			tree.tbody = $tbody[0];

			// Prepare row templates:
			// Determine column count from table header if any
			columnCount = $("thead >tr", $table).last().find(">th").length;
			// Read TR templates from tbody if any
			$row = $tbody.children("tr").first();
			if ($row.length) {
				n = $row.children("td").length;
				if (columnCount && n !== columnCount) {
					tree.warn(
						"Column count mismatch between thead (" +
							columnCount +
							") and tbody (" +
							n +
							"): using tbody."
					);
					columnCount = n;
				}
				$row = $row.clone();
			} else {
				// Only thead is defined: create default row markup
				_assert(
					columnCount >= 1,
					"Need either <thead> or <tbody> with <td> elements to determine column count."
				);
				$row = $("<tr />");
				for (i = 0; i < columnCount; i++) {
					$row.append("<td />");
				}
			}
			$row.find(">td")
				.eq(tableOpts.nodeColumnIdx)
				.html("<span class='fancytree-node' />");
			if (opts.aria) {
				$row.attr("role", "row");
				$row.find("td").attr("role", "gridcell");
			}
			tree.rowFragment = document.createDocumentFragment();
			tree.rowFragment.appendChild($row.get(0));

			$tbody.empty();

			// Make sure that status classes are set on the node's <tr> elements
			tree.statusClassPropName = "tr";
			tree.ariaPropName = "tr";
			this.nodeContainerAttrName = "tr";

			// #489: make sure $container is set to <table>, even if ext-dnd is listed before ext-grid
			tree.$container = $table;
			if ($scrollWrapper.length) {
				tree.scrollWrapper = $scrollWrapper[0];
				this._initViewportWrapper();
			} else {
				tree.scrollWrapper = null;
			}

			// Scrolling is implemented completely differently here
			$.ui.fancytree.overrideMethod(
				$.ui.fancytree._FancytreeNodeClass.prototype,
				"scrollIntoView",
				function (effects, options) {
					var node = this,
						tree = node.tree,
						topNode = options && options.topNode,
						vp = tree.viewport,
						start = vp ? vp.start : null;

					if (!tree.viewport) {
						return node._super.apply(this, arguments);
					}
					if (node._rowIdx < vp.start) {
						start = node._rowIdx;
					} else if (node._rowIdx >= vp.start + vp.count) {
						start = node._rowIdx - vp.count + 1;
					}
					if (topNode && topNode._rowIdx < start) {
						start = topNode._rowIdx;
					}
					tree.setViewport({ start: start });
					// Return a resolved promise
					return $.Deferred(function () {
						this.resolveWith(node);
					}).promise();
				}
			);

			tree.visibleNodeList = null; // Set by _renumberVisibleNodes()
			tree.viewport = {
				enabled: true,
				start: 0,
				count: 10,
				left: 0,
				right: 0,
			};
			this.setViewport(
				$.extend(
					{
						// enabled: true,
						autoSize: true,
						start: 0,
						count: 10,
						left: 0,
						right: 0,
						keepEmptyRows: true,
						noEvents: true,
					},
					opts.viewport
				)
			);
			// tree.$scrollbar = _addScrollbar($table);

			this._superApply(arguments);

			// standard Fancytree created a root UL
			$(tree.rootNode.ul).remove();
			tree.rootNode.ul = null;

			// Add container to the TAB chain
			// #577: Allow to set tabindex to "0", "-1" and ""
			this.$container.attr("tabindex", opts.tabindex);
			// this.$container.attr("tabindex", opts.tabbable ? "0" : "-1");
			if (opts.aria) {
				tree.$container
					.attr("role", "treegrid")
					.attr("aria-readonly", true);
			}
		},
		nodeKeydown: function (ctx) {
			var nextNode = null,
				nextIdx = null,
				tree = ctx.tree,
				node = ctx.node,
				nodeList = tree.visibleNodeList,
				// treeOpts = ctx.options,
				viewport = tree.viewport,
				event = ctx.originalEvent,
				eventString = FT.eventToString(event);

			tree.debug("nodeKeydown(" + eventString + ")");

			switch (eventString) {
				case "home":
				case "meta+up":
					nextIdx = 0;
					break;
				case "end":
				case "meta+down":
					nextIdx = nodeList.length - 1;
					break;
				case "pageup":
					nextIdx = node._rowIdx - viewport.count;
					break;
				case "pagedown":
					nextIdx = node._rowIdx + viewport.count;
					break;
			}
			if (nextIdx != null) {
				nextIdx = Math.min(Math.max(0, nextIdx), nodeList.length - 1);
				nextNode = nodeList[nextIdx];
				nextNode.makeVisible();
				nextNode.setActive();
				return false;
			}
			return this._superApply(arguments);
		},
		nodeRemoveChildMarkup: function (ctx) {
			var node = ctx.node;

			node.visit(function (n) {
				if (n.tr) {
					delete n.tr.ftnode;
					n.tr = null;
					n.span = null;
				}
			});
		},
		nodeRemoveMarkup: function (ctx) {
			var node = ctx.node;

			if (node.tr) {
				delete node.tr.ftnode;
				node.tr = null;
				node.span = null;
			}
			this.nodeRemoveChildMarkup(ctx);
		},
		/* Override standard render. */
		nodeRender: function (ctx, force, deep, collapsed, _recursive) {
			var children,
				i,
				l,
				outsideViewport,
				subCtx,
				tree = ctx.tree,
				node = ctx.node;

			if (tree._enableUpdate === false) {
				node.debug("nodeRender(): _enableUpdate: false");
				return;
			}
			var opts = ctx.options,
				viewport = tree.viewport.enabled ? tree.viewport : null,
				start = viewport && viewport.start > 0 ? +viewport.start : 0,
				bottom = viewport ? start + viewport.count - 1 : 0,
				isRootNode = !node.parent;

			_assert(viewport);

			// node.debug("nodeRender(): " + node + ", isRoot=" + isRootNode, "tr=" + node.tr, "hcp=" + ctx.hasCollapsedParents, "parent.tr=" + (node.parent && node.parent.tr));
			if (!_recursive) {
				// node.debug("nodeRender(): start top node");
				if (isRootNode && viewport) {
					node.debug("nodeRender(): redrawViewport() instead");
					return ctx.tree.redrawViewport();
				}
				ctx.hasCollapsedParents = node.parent && !node.parent.expanded;
				// Make sure visible row indices are up-to-date
				if (viewport) {
					tree._renumberVisibleNodes();
				}
			}

			if (!isRootNode) {
				outsideViewport =
					viewport &&
					(node._rowIdx < start ||
						node._rowIdx >= start + viewport.count);

				// node.debug(
				// 	"nodeRender(): idx=" +
				// 		node._rowIdx +
				// 		", outside=" +
				// 		outsideViewport +
				// 		", TR count=" +
				// 		tree.tbody.rows.length
				// );
				if (outsideViewport) {
					// node.debug("nodeRender(): outsideViewport: ignored");
					return;
				}
				if (!node.tr) {
					if (node._rowIdx == null) {
						// node.warn("nodeRender(): ignoring hidden");
						return;
					}
					node.debug("nodeRender(): creating new TR.");
					node.tr = tree.tbody.rows[node._rowIdx - start];
				}
				// _assert(
				// 	node.tr,
				// 	"nodeRender() called for node.tr == null: " + node
				// );
				node.tr.ftnode = node;

				if (node.key && opts.generateIds) {
					node.tr.id = opts.idPrefix + node.key;
				}
				node.span = $("span.fancytree-node", node.tr).get(0);

				// Set icon, link, and title (normally this is only required on initial render)
				// var ctx = this._makeHookContext(node);
				this.nodeRenderTitle(ctx); // triggers renderColumns()

				// Allow tweaking, binding, after node was created for the first time
				if (opts.createNode) {
					opts.createNode.call(this, { type: "createNode" }, ctx);
				}
			}
			// Allow tweaking after node state was rendered
			if (opts.renderNode) {
				opts.renderNode.call(tree, { type: "renderNode" }, ctx);
			}
			// Visit child nodes
			// Add child markup
			children = node.children;
			_assert(!deep, "deep is not supported");

			if (children && (isRootNode || deep || node.expanded)) {
				for (i = 0, l = children.length; i < l; i++) {
					var child = children[i];

					if (viewport && child._rowIdx > bottom) {
						children[i].debug("BREAK render children loop");
						return false;
					}
					subCtx = $.extend({}, ctx, { node: child });
					subCtx.hasCollapsedParents =
						subCtx.hasCollapsedParents || !node.expanded;
					this.nodeRender(subCtx, force, deep, collapsed, true);
				}
			}
		},
		nodeRenderTitle: function (ctx, title) {
			var $cb,
				res,
				tree = ctx.tree,
				node = ctx.node,
				opts = ctx.options,
				isStatusNode = node.isStatusNode();

			res = this._super(ctx, title);

			if (node.isRootNode()) {
				return res;
			}
			// Move checkbox to custom column
			if (
				opts.checkbox &&
				!isStatusNode &&
				opts.table.checkboxColumnIdx != null
			) {
				$cb = $("span.fancytree-checkbox", node.span); //.detach();
				$(node.tr)
					.find("td")
					.eq(+opts.table.checkboxColumnIdx)
					.html($cb);
			}
			// Update element classes according to node state
			this.nodeRenderStatus(ctx);

			if (isStatusNode) {
				if (opts.renderStatusColumns) {
					// Let user code write column content
					opts.renderStatusColumns.call(
						tree,
						{ type: "renderStatusColumns" },
						ctx
					);
				} else if (opts.grid.mergeStatusColumns && node.isTopLevel()) {
					node.warn("mergeStatusColumns is not yet implemented.");
					// This approach would not work, since the roe may be re-used:
					// $(node.tr)
					// 	.find(">td")
					// 	.eq(0)
					// 	.prop("colspan", tree.columnCount)
					// 	.text(node.title)
					// 	.addClass("fancytree-status-merged")
					// 	.nextAll()
					// 	.remove();
				} // else: default rendering for status node: leave other cells empty
			} else if (opts.renderColumns) {
				opts.renderColumns.call(tree, { type: "renderColumns" }, ctx);
			}
			return res;
		},
		nodeRenderStatus: function (ctx) {
			var indent,
				node = ctx.node,
				opts = ctx.options;

			this._super(ctx);

			$(node.tr).removeClass("fancytree-node");
			// indent
			indent = (node.getLevel() - 1) * opts.table.indentation;
			if (opts.rtl) {
				$(node.span).css({ paddingRight: indent + "px" });
			} else {
				$(node.span).css({ paddingLeft: indent + "px" });
			}
		},
		/* Expand node, return Deferred.promise. */
		nodeSetExpanded: function (ctx, flag, callOpts) {
			var node = ctx.node,
				tree = ctx.tree;

			// flag defaults to true
			flag = flag !== false;

			if ((node.expanded && flag) || (!node.expanded && !flag)) {
				// Expanded state isn't changed - just call base implementation
				return this._superApply(arguments);
			}

			var dfd = new $.Deferred(),
				subOpts = $.extend({}, callOpts, {
					noEvents: true,
					noAnimation: true,
				});

			callOpts = callOpts || {};

			function _afterExpand(ok) {
				tree.redrawViewport(true);

				if (ok) {
					if (
						flag &&
						ctx.options.autoScroll &&
						!callOpts.noAnimation &&
						node.hasChildren()
					) {
						// Scroll down to last child, but keep current node visible
						node.getLastChild()
							.scrollIntoView(true, { topNode: node })
							.always(function () {
								if (!callOpts.noEvents) {
									tree._triggerNodeEvent(
										flag ? "expand" : "collapse",
										ctx
									);
								}
								dfd.resolveWith(node);
							});
					} else {
						if (!callOpts.noEvents) {
							tree._triggerNodeEvent(
								flag ? "expand" : "collapse",
								ctx
							);
						}
						dfd.resolveWith(node);
					}
				} else {
					if (!callOpts.noEvents) {
						tree._triggerNodeEvent(
							flag ? "expand" : "collapse",
							ctx
						);
					}
					dfd.rejectWith(node);
				}
			}
			// Call base-expand with disabled events and animation
			this._super(ctx, flag, subOpts)
				.done(function () {
					_afterExpand(true);
				})
				.fail(function () {
					_afterExpand(false);
				});
			return dfd.promise();
		},
		treeClear: function (ctx) {
			// this.nodeRemoveChildMarkup(this._makeHookContext(this.rootNode));
			// this._renumberReset(); // Invalidate visible row cache
			return this._superApply(arguments);
		},
		treeDestroy: function (ctx) {
			this.$container.find("tbody").empty();
			this.$container.off("wheel");
			if (this.$source) {
				this.$source.removeClass("fancytree-helper-hidden");
			}
			this._renumberReset(); // Invalidate visible row cache
			return this._superApply(arguments);
		},
		treeStructureChanged: function (ctx, type) {
			// debugger;
			if (type !== "addNode" || ctx.tree.visibleNodeList) {
				// this.debug("treeStructureChanged(" + type + ")");
				this._renumberReset(); // Invalidate visible row cache
			}
		},
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
