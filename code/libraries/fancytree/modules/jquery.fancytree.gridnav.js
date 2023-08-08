/*!
 * jquery.fancytree.gridnav.js
 *
 * Support keyboard navigation for trees with embedded input controls.
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

	var KC = $.ui.keyCode,
		// which keys are *not* handled by embedded control, but passed to tree
		// navigation handler:
		NAV_KEYS = {
			text: [KC.UP, KC.DOWN],
			checkbox: [KC.UP, KC.DOWN, KC.LEFT, KC.RIGHT],
			link: [KC.UP, KC.DOWN, KC.LEFT, KC.RIGHT],
			radiobutton: [KC.UP, KC.DOWN, KC.LEFT, KC.RIGHT],
			"select-one": [KC.LEFT, KC.RIGHT],
			"select-multiple": [KC.LEFT, KC.RIGHT],
		};

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
	function findNeighbourTd($target, keyCode) {
		var $tr,
			colIdx,
			$td = $target.closest("td"),
			$tdNext = null;

		switch (keyCode) {
			case KC.LEFT:
				$tdNext = $td.prev();
				break;
			case KC.RIGHT:
				$tdNext = $td.next();
				break;
			case KC.UP:
			case KC.DOWN:
				$tr = $td.parent();
				colIdx = getColIdx($tr, $td);
				while (true) {
					$tr = keyCode === KC.UP ? $tr.prev() : $tr.next();
					if (!$tr.length) {
						break;
					}
					// Skip hidden rows
					if ($tr.is(":hidden")) {
						continue;
					}
					// Find adjacent cell in the same column
					$tdNext = findTdAtColIdx($tr, colIdx);
					// Skip cells that don't conatain a focusable element
					if ($tdNext && $tdNext.find(":input,a").length) {
						break;
					}
				}
				break;
		}
		return $tdNext;
	}

	/*******************************************************************************
	 * Extension code
	 */
	$.ui.fancytree.registerExtension({
		name: "gridnav",
		version: "2.38.3",
		// Default options for this extension.
		options: {
			autofocusInput: false, // Focus first embedded input if node gets activated
			handleCursorKeys: true, // Allow UP/DOWN in inputs to move to prev/next node
		},

		treeInit: function (ctx) {
			// gridnav requires the table extension to be loaded before itself
			this._requireExtension("table", true, true);
			this._superApply(arguments);

			this.$container.addClass("fancytree-ext-gridnav");

			// Activate node if embedded input gets focus (due to a click)
			this.$container.on("focusin", function (event) {
				var ctx2,
					node = $.ui.fancytree.getNode(event.target);

				if (node && !node.isActive()) {
					// Call node.setActive(), but also pass the event
					ctx2 = ctx.tree._makeHookContext(node, event);
					ctx.tree._callHook("nodeSetActive", ctx2, true);
				}
			});
		},
		nodeSetActive: function (ctx, flag, callOpts) {
			var $outer,
				opts = ctx.options.gridnav,
				node = ctx.node,
				event = ctx.originalEvent || {},
				triggeredByInput = $(event.target).is(":input");

			flag = flag !== false;

			this._superApply(arguments);

			if (flag) {
				if (ctx.options.titlesTabbable) {
					if (!triggeredByInput) {
						$(node.span).find("span.fancytree-title").focus();
						node.setFocus();
					}
					// If one node is tabbable, the container no longer needs to be
					ctx.tree.$container.attr("tabindex", "-1");
					// ctx.tree.$container.removeAttr("tabindex");
				} else if (opts.autofocusInput && !triggeredByInput) {
					// Set focus to input sub input (if node was clicked, but not
					// when TAB was pressed )
					$outer = $(node.tr || node.span);
					$outer.find(":input:enabled").first().focus();
				}
			}
		},
		nodeKeydown: function (ctx) {
			var inputType,
				handleKeys,
				$td,
				opts = ctx.options.gridnav,
				event = ctx.originalEvent,
				$target = $(event.target);

			if ($target.is(":input:enabled")) {
				inputType = $target.prop("type");
			} else if ($target.is("a")) {
				inputType = "link";
			}
			// ctx.tree.debug("ext-gridnav nodeKeydown", event, inputType);

			if (inputType && opts.handleCursorKeys) {
				handleKeys = NAV_KEYS[inputType];
				if (handleKeys && $.inArray(event.which, handleKeys) >= 0) {
					$td = findNeighbourTd($target, event.which);
					if ($td && $td.length) {
						// ctx.node.debug("ignore keydown in input", event.which, handleKeys);
						$td.find(":input:enabled,a").focus();
						// Prevent Fancytree default navigation
						return false;
					}
				}
				return true;
			}
			// ctx.tree.debug("ext-gridnav NOT HANDLED", event, inputType);
			return this._superApply(arguments);
		},
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
