/*!
 * jquery.fancytree.ariagrid.js
 *
 * Support ARIA compliant markup and keyboard navigation for tree grids with
 * embedded input controls.
 * (Extension module for jquery.fancytree.js: https://github.com/mar10/fancytree/)
 *
 * @requires ext-table
 *
 * Copyright (c) 2008-2023, Martin Wendt (https://wwWendt.de)
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
		define([
			"jquery",
			"./jquery.fancytree",
			"./jquery.fancytree.table",
		], factory);
	} else if (typeof module === "object" && module.exports) {
		// Node/CommonJS
		require("./jquery.fancytree.table"); // core + table
		module.exports = factory(require("jquery"));
	} else {
		// Browser globals
		factory(jQuery);
	}
})(function ($) {
	"use strict";

	/*******************************************************************************
	 * Private functions and variables
	 */

	// Allow these navigation keys even when input controls are focused

	var FT = $.ui.fancytree,
		clsFancytreeActiveCell = "fancytree-active-cell",
		clsFancytreeCellMode = "fancytree-cell-mode",
		clsFancytreeCellNavMode = "fancytree-cell-nav-mode",
		VALID_MODES = ["allow", "force", "start", "off"],
		// Define which keys are handled by embedded <input> control, and should
		// *not* be passed to tree navigation handler in cell-edit mode:
		INPUT_KEYS = {
			text: ["left", "right", "home", "end", "backspace"],
			number: ["up", "down", "left", "right", "home", "end", "backspace"],
			checkbox: [],
			link: [],
			radiobutton: ["up", "down"],
			"select-one": ["up", "down"],
			"select-multiple": ["up", "down"],
		},
		NAV_KEYS = ["up", "down", "left", "right", "home", "end"];

	/* Set aria-activedescendant on container to active cell's ID (generate one if required).*/
	function setActiveDescendant(tree, $target) {
		var id = $target ? $target.uniqueId().attr("id") : "";

		tree.$container.attr("aria-activedescendant", id);
	}

	/* Calculate TD column index (considering colspans).*/
	function getColIdx($tr, $td) {
		var colspan,
			td = $td.get(0),
			idx = 0;

		$tr.children().each(function () {
			if (this === td) {
				return false;
			}
			colspan = $(this).prop("colspan");
			idx += colspan ? colspan : 1;
		});
		return idx;
	}

	/* Find TD at given column index (considering colspans).*/
	function findTdAtColIdx($tr, colIdx) {
		var colspan,
			res = null,
			idx = 0;

		$tr.children().each(function () {
			if (idx >= colIdx) {
				res = $(this);
				return false;
			}
			colspan = $(this).prop("colspan");
			idx += colspan ? colspan : 1;
		});
		return res;
	}

	/* Find adjacent cell for a given direction. Skip empty cells and consider merged cells */
	function findNeighbourTd(tree, $target, keyCode) {
		var nextNode,
			node,
			navMap = { "ctrl+home": "first", "ctrl+end": "last" },
			$td = $target.closest("td"),
			$tr = $td.parent(),
			treeOpts = tree.options,
			colIdx = getColIdx($tr, $td),
			$tdNext = null;

		keyCode = navMap[keyCode] || keyCode;

		switch (keyCode) {
			case "left":
				$tdNext = treeOpts.rtl ? $td.next() : $td.prev();
				break;
			case "right":
				$tdNext = treeOpts.rtl ? $td.prev() : $td.next();
				break;
			case "up":
			case "down":
			case "ctrl+home":
			case "ctrl+end":
				node = $tr[0].ftnode;
				nextNode = tree.findRelatedNode(node, keyCode);
				if (nextNode) {
					nextNode.makeVisible();
					nextNode.setActive();
					$tdNext = findTdAtColIdx($(nextNode.tr), colIdx);
				}
				break;
			case "home":
				$tdNext = treeOpts.rtl
					? $tr.children("td").last()
					: $tr.children("td").first();
				break;
			case "end":
				$tdNext = treeOpts.rtl
					? $tr.children("td").first()
					: $tr.children("td").last();
				break;
		}
		return $tdNext && $tdNext.length ? $tdNext : null;
	}

	/* Return a descriptive string of the current mode. */
	function getGridNavMode(tree) {
		if (tree.$activeTd) {
			return tree.forceNavMode ? "cell-nav" : "cell-edit";
		}
		return "row";
	}

	/* .*/
	function activateEmbeddedLink($td) {
		// $td.find( "a" )[ 0 ].trigger("click");  // does not work (always)?
		// $td.find( "a" ).trigger("click");
		var event = document.createEvent("MouseEvent"),
			a = $td.find("a")[0]; // document.getElementById('nameOfID');

		event = new CustomEvent("click");
		a.dispatchEvent(event);
	}

	/**
	 * [ext-ariagrid] Set active cell and activate cell-nav or cell-edit mode if needed.
	 * Pass $td=null to enter row-mode.
	 *
	 * See also FancytreeNode#setActive(flag, {cell: idx})
	 *
	 * @param {jQuery | Element | integer} [$td]
	 * @param {Event|null} [orgEvent=null]
	 * @alias Fancytree#activateCell
	 * @requires jquery.fancytree.ariagrid.js
	 * @since 2.23
	 */
	$.ui.fancytree._FancytreeClass.prototype.activateCell = function (
		$td,
		orgEvent
	) {
		var colIdx,
			$input,
			$tr,
			res,
			tree = this,
			$prevTd = this.$activeTd || null,
			newNode = $td ? FT.getNode($td) : null,
			prevNode = $prevTd ? FT.getNode($prevTd) : null,
			anyNode = newNode || prevNode,
			$prevTr = $prevTd ? $prevTd.closest("tr") : null;

		anyNode.debug(
			"activateCell(" +
				($prevTd ? $prevTd.text() : "null") +
				") -> " +
				($td ? $td.text() : "OFF")
		);

		// Make available as event

		if ($td) {
			FT.assert($td.length, "Invalid active cell");
			colIdx = getColIdx($(newNode.tr), $td);
			res = this._triggerNodeEvent("activateCell", newNode, orgEvent, {
				activeTd: tree.$activeTd,
				colIdx: colIdx,
				mode: null, // editMode ? "cell-edit" : "cell-nav"
			});
			if (res === false) {
				return false;
			}
			this.$container.addClass(clsFancytreeCellMode);
			this.$container.toggleClass(
				clsFancytreeCellNavMode,
				!!this.forceNavMode
			);
			$tr = $td.closest("tr");
			if ($prevTd) {
				// cell-mode => cell-mode
				if ($prevTd.is($td)) {
					return;
				}
				$prevTd
					.removeAttr("tabindex")
					.removeClass(clsFancytreeActiveCell);

				if (!$prevTr.is($tr)) {
					// We are moving to a different row: only the inputs in the
					// active row should be tabbable
					$prevTr.find(">td :input,a").attr("tabindex", "-1");
				}
			}
			$tr.find(">td :input:enabled,a").attr("tabindex", "0");
			newNode.setActive();
			$td.addClass(clsFancytreeActiveCell);
			this.$activeTd = $td;

			$input = $td.find(":input:enabled,a");
			this.debug("Focus input", $input);
			if ($input.length) {
				$input.focus();
				setActiveDescendant(this, $input);
			} else {
				$td.attr("tabindex", "-1").focus();
				setActiveDescendant(this, $td);
			}
		} else {
			res = this._triggerNodeEvent("activateCell", prevNode, orgEvent, {
				activeTd: null,
				colIdx: null,
				mode: "row",
			});
			if (res === false) {
				return false;
			}
			// $td == null: switch back to row-mode
			this.$container.removeClass(
				clsFancytreeCellMode + " " + clsFancytreeCellNavMode
			);
			// console.log("activateCell: set row-mode for " + this.activeNode, $prevTd);
			if ($prevTd) {
				// cell-mode => row-mode
				$prevTd
					.removeAttr("tabindex")
					.removeClass(clsFancytreeActiveCell);
				// In row-mode, only embedded inputs of the active row are tabbable
				$prevTr
					.find("td")
					.blur() // we need to blur first, because otherwise the focus frame is not reliably removed(?)
					.removeAttr("tabindex");
				$prevTr.find(">td :input,a").attr("tabindex", "-1");
				this.$activeTd = null;
				// The cell lost focus, but the tree still needs to capture keys:
				this.activeNode.setFocus();
				setActiveDescendant(this, $tr);
			} else {
				// row-mode => row-mode (nothing to do)
			}
		}
	};

	/*******************************************************************************
	 * Extension code
	 */
	$.ui.fancytree.registerExtension({
		name: "ariagrid",
		version: "2.38.3",
		// Default options for this extension.
		options: {
			// Internal behavior flags
			activateCellOnDoubelclick: true,
			cellFocus: "allow",
			// TODO: use a global tree option `name` or `title` instead?:
			label: "Tree Grid", // Added as `aria-label` attribute
		},

		treeInit: function (ctx) {
			var tree = ctx.tree,
				treeOpts = ctx.options,
				opts = treeOpts.ariagrid;

			// ariagrid requires the table extension to be loaded before itself
			if (tree.ext.grid) {
				this._requireExtension("grid", true, true);
			} else {
				this._requireExtension("table", true, true);
			}
			if (!treeOpts.aria) {
				$.error("ext-ariagrid requires `aria: true`");
			}
			if ($.inArray(opts.cellFocus, VALID_MODES) < 0) {
				$.error("Invalid `cellFocus` option");
			}
			this._superApply(arguments);

			// The combination of $activeTd and forceNavMode determines the current
			// navigation mode:
			this.$activeTd = null; // active cell (null in row-mode)
			this.forceNavMode = true;

			this.$container
				.addClass("fancytree-ext-ariagrid")
				.toggleClass(clsFancytreeCellNavMode, !!this.forceNavMode)
				.attr("aria-label", "" + opts.label);
			this.$container
				.find("thead > tr > th")
				.attr("role", "columnheader");

			// Store table options for easier evaluation of default actions
			// depending of active cell column
			this.nodeColumnIdx = treeOpts.table.nodeColumnIdx;
			this.checkboxColumnIdx = treeOpts.table.checkboxColumnIdx;
			if (this.checkboxColumnIdx == null) {
				this.checkboxColumnIdx = this.nodeColumnIdx;
			}

			this.$container
				.on("focusin", function (event) {
					// Activate node if embedded input gets focus (due to a click)
					var node = FT.getNode(event.target),
						$td = $(event.target).closest("td");

					// tree.debug( "focusin: " + ( node ? node.title : "null" ) +
					// 	", target: " + ( $td ? $td.text() : null ) +
					// 	", node was active: " + ( node && node.isActive() ) +
					// 	", last cell: " + ( tree.$activeTd ? tree.$activeTd.text() : null ) );
					// tree.debug( "focusin: target", event.target );

					// TODO: add ":input" as delegate filter instead of testing here
					if (
						node &&
						!$td.is(tree.$activeTd) &&
						$(event.target).is(":input")
					) {
						node.debug("Activate cell on INPUT focus event");
						tree.activateCell($td);
					}
				})
				.on("fancytreeinit", function (event, data) {
					if (
						opts.cellFocus === "start" ||
						opts.cellFocus === "force"
					) {
						tree.debug("Enforce cell-mode on init");
						tree.debug(
							"init",
							tree.getActiveNode() || tree.getFirstChild()
						);
						(
							tree.getActiveNode() || tree.getFirstChild()
						).setActive(true, { cell: tree.nodeColumnIdx });
						tree.debug(
							"init2",
							tree.getActiveNode() || tree.getFirstChild()
						);
					}
				})
				.on("fancytreefocustree", function (event, data) {
					// Enforce cell-mode when container gets focus
					if (opts.cellFocus === "force" && !tree.$activeTd) {
						var node = tree.getActiveNode() || tree.getFirstChild();
						tree.debug("Enforce cell-mode on focusTree event");
						node.setActive(true, { cell: 0 });
					}
				})
				// .on("fancytreeupdateviewport", function(event, data) {
				// 	tree.debug(event.type, data);
				// })
				.on("fancytreebeforeupdateviewport", function (event, data) {
					// When scrolling, the TR may be re-used by another node, so the
					// active cell marker an
					// tree.debug(event.type, data);
					if (tree.viewport && tree.$activeTd) {
						tree.info("Cancel cell-mode due to scroll event.");
						tree.activateCell(null);
					}
				});
		},
		nodeClick: function (ctx) {
			var targetType = ctx.targetType,
				tree = ctx.tree,
				node = ctx.node,
				event = ctx.originalEvent,
				$target = $(event.target),
				$td = $target.closest("td");

			tree.debug(
				"nodeClick: node: " +
					(node ? node.title : "null") +
					", targetType: " +
					targetType +
					", target: " +
					($td.length ? $td.text() : null) +
					", node was active: " +
					(node && node.isActive()) +
					", last cell: " +
					(tree.$activeTd ? tree.$activeTd.text() : null)
			);

			if (tree.$activeTd) {
				// If already in cell-mode, activate new cell
				tree.activateCell($td);
				if ($target.is(":input")) {
					return;
				} else if (
					$target.is(".fancytree-checkbox") ||
					$target.is(".fancytree-expander")
				) {
					return this._superApply(arguments);
				}
				return false;
			}
			return this._superApply(arguments);
		},
		nodeDblclick: function (ctx) {
			var tree = ctx.tree,
				treeOpts = ctx.options,
				opts = treeOpts.ariagrid,
				event = ctx.originalEvent,
				$td = $(event.target).closest("td");

			// console.log("nodeDblclick", tree.$activeTd, ctx.options.ariagrid.cellFocus)
			if (
				opts.activateCellOnDoubelclick &&
				!tree.$activeTd &&
				opts.cellFocus === "allow"
			) {
				// If in row-mode, activate new cell
				tree.activateCell($td);
				return false;
			}
			return this._superApply(arguments);
		},
		nodeRenderStatus: function (ctx) {
			// Set classes for current status
			var res,
				node = ctx.node,
				$tr = $(node.tr);

			res = this._super(ctx);

			if (node.parent) {
				$tr.attr("aria-level", node.getLevel())
					.attr("aria-setsize", node.parent.children.length)
					.attr("aria-posinset", node.getIndex() + 1);

				// 2018-06-24: not required according to
				// https://github.com/w3c/aria-practices/issues/132#issuecomment-397698250
				// if ( $tr.is( ":hidden" ) ) {
				// 	$tr.attr( "aria-hidden", true );
				// } else {
				// 	$tr.removeAttr( "aria-hidden" );
				// }

				// this.debug("nodeRenderStatus: " + this.$activeTd + ", " + $tr.attr("aria-expanded"));
				// In cell-mode, move aria-expanded attribute from TR to first child TD
				if (this.$activeTd && $tr.attr("aria-expanded") != null) {
					$tr.remove("aria-expanded");
					$tr.find("td")
						.eq(this.nodeColumnIdx)
						.attr("aria-expanded", node.isExpanded());
				} else {
					$tr.find("td")
						.eq(this.nodeColumnIdx)
						.removeAttr("aria-expanded");
				}
			}
			return res;
		},
		nodeSetActive: function (ctx, flag, callOpts) {
			var $td,
				node = ctx.node,
				tree = ctx.tree,
				$tr = $(node.tr);

			flag = flag !== false;
			node.debug("nodeSetActive(" + flag + ")", callOpts);
			// Support custom `cell` option
			if (flag && callOpts && callOpts.cell != null) {
				// `cell` may be a col-index, <td>, or `$(td)`
				if (typeof callOpts.cell === "number") {
					$td = findTdAtColIdx($tr, callOpts.cell);
				} else {
					$td = $(callOpts.cell);
				}
				tree.activateCell($td);
				return;
			}
			// tree.debug( "nodeSetActive: activeNode " + this.activeNode );
			return this._superApply(arguments);
		},
		nodeKeydown: function (ctx) {
			var handleKeys,
				inputType,
				res,
				$td,
				$embeddedCheckbox = null,
				tree = ctx.tree,
				node = ctx.node,
				treeOpts = ctx.options,
				opts = treeOpts.ariagrid,
				event = ctx.originalEvent,
				eventString = FT.eventToString(event),
				$target = $(event.target),
				$activeTd = this.$activeTd,
				$activeTr = $activeTd ? $activeTd.closest("tr") : null,
				colIdx = $activeTd ? getColIdx($activeTr, $activeTd) : -1,
				forceNav =
					$activeTd &&
					tree.forceNavMode &&
					$.inArray(eventString, NAV_KEYS) >= 0;

			if (opts.cellFocus === "off") {
				return this._superApply(arguments);
			}

			if ($target.is(":input:enabled")) {
				inputType = $target.prop("type");
			} else if ($target.is("a")) {
				inputType = "link";
			}
			if ($activeTd && $activeTd.find(":checkbox:enabled").length === 1) {
				$embeddedCheckbox = $activeTd.find(":checkbox:enabled");
				inputType = "checkbox";
			}
			tree.debug(
				"nodeKeydown(" +
					eventString +
					"), activeTd: '" +
					($activeTd && $activeTd.text()) +
					"', inputType: " +
					inputType
			);

			if (inputType && eventString !== "esc" && !forceNav) {
				handleKeys = INPUT_KEYS[inputType];
				if (handleKeys && $.inArray(eventString, handleKeys) >= 0) {
					return; // Let input control handle the key
				}
			}

			switch (eventString) {
				case "right":
					if ($activeTd) {
						// Cell mode: move to neighbour (stop on right border)
						$td = findNeighbourTd(tree, $activeTd, eventString);
						if ($td) {
							tree.activateCell($td);
						}
					} else if (
						node &&
						!node.isExpanded() &&
						node.hasChildren() !== false
					) {
						// Row mode and current node can be expanded:
						// default handling will expand.
						break;
					} else {
						// Row mode: switch to cell-mode
						$td = $(node.tr).find(">td").first();
						tree.activateCell($td);
					}
					return false; // no default handling

				case "left":
				case "home":
				case "end":
				case "ctrl+home":
				case "ctrl+end":
				case "up":
				case "down":
					if ($activeTd) {
						// Cell mode: move to neighbour
						$td = findNeighbourTd(tree, $activeTd, eventString);
						// Note: $td may be null if we move outside bounds. In this case
						// we switch back to row-mode (i.e. call activateCell(null) ).
						if (!$td && "left right".indexOf(eventString) < 0) {
							// Only switch to row-mode if left/right hits the bounds
							return false;
						}
						if ($td || opts.cellFocus !== "force") {
							tree.activateCell($td);
						}
						return false;
					}
					break;

				case "esc":
					if ($activeTd && !tree.forceNavMode) {
						// Switch from cell-edit-mode to cell-nav-mode
						// $target.closest( "td" ).focus();
						tree.forceNavMode = true;
						tree.debug("Enter cell-nav-mode");
						tree.$container.toggleClass(
							clsFancytreeCellNavMode,
							!!tree.forceNavMode
						);
						return false;
					} else if ($activeTd && opts.cellFocus !== "force") {
						// Switch back from cell-mode to row-mode
						tree.activateCell(null);
						return false;
					}
					// tree.$container.toggleClass( clsFancytreeCellNavMode, !!tree.forceNavMode );
					break;

				case "return":
					// Let user override the default action.
					// This event is triggered in row-mode and cell-mode
					res = tree._triggerNodeEvent(
						"defaultGridAction",
						node,
						event,
						{
							activeTd: tree.$activeTd ? tree.$activeTd[0] : null,
							colIdx: colIdx,
							mode: getGridNavMode(tree),
						}
					);
					if (res === false) {
						return false;
					}
					// Implement default actions (for cell-mode only).
					if ($activeTd) {
						// Apply 'default action' for embedded cell control
						if (colIdx === this.nodeColumnIdx) {
							node.toggleExpanded();
						} else if (colIdx === this.checkboxColumnIdx) {
							// TODO: only in checkbox mode!
							node.toggleSelected();
						} else if ($embeddedCheckbox) {
							// Embedded checkboxes are always toggled (ignoring `autoFocusInput`)
							$embeddedCheckbox.prop(
								"checked",
								!$embeddedCheckbox.prop("checked")
							);
						} else if (tree.forceNavMode && $target.is(":input")) {
							tree.forceNavMode = false;
							tree.$container.removeClass(
								clsFancytreeCellNavMode
							);
							tree.debug("enable cell-edit-mode");
						} else if ($activeTd.find("a").length === 1) {
							activateEmbeddedLink($activeTd);
						}
					} else {
						// ENTER in row-mode: Switch from row-mode to cell-mode
						// TODO: it was also suggested to expand/collapse instead
						//    https://github.com/w3c/aria-practices/issues/132#issuecomment-407634891
						$td = $(node.tr).find(">td").nth(this.nodeColumnIdx);
						tree.activateCell($td);
					}
					return false; // no default handling

				case "space":
					if ($activeTd) {
						if (colIdx === this.checkboxColumnIdx) {
							node.toggleSelected();
						} else if ($embeddedCheckbox) {
							$embeddedCheckbox.prop(
								"checked",
								!$embeddedCheckbox.prop("checked")
							);
						}
						return false; // no default handling
					}
					break;

				default:
				// Allow to focus input by typing alphanum keys
			}
			return this._superApply(arguments);
		},
		treeSetOption: function (ctx, key, value) {
			var tree = ctx.tree,
				opts = tree.options.ariagrid;

			if (key === "ariagrid") {
				// User called `$().fancytree("option", "ariagrid.SUBKEY", VALUE)`
				if (value.cellFocus !== opts.cellFocus) {
					if ($.inArray(value.cellFocus, VALID_MODES) < 0) {
						$.error("Invalid `cellFocus` option");
					}
					// TODO: fix current focus and mode
				}
			}
			return this._superApply(arguments);
		},
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
