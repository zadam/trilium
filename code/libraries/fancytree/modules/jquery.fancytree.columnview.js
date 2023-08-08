/*!
 * jquery.fancytree.columnview.js
 *
 * Render tree like a Mac Finder's column view.
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

	/*******************************************************************************
	 * Private functions and variables
	 */
	var _assert = $.ui.fancytree.assert,
		FT = $.ui.fancytree;

	/*******************************************************************************
	 * Private functions and variables
	 */
	$.ui.fancytree.registerExtension({
		name: "columnview",
		version: "2.38.3",
		// Default options for this extension.
		options: {},
		// Overide virtual methods for this extension.
		// `this`       : is this extension object
		// `this._base` : the Fancytree instance
		// `this._super`: the virtual function that was overriden (member of prev. extension or Fancytree)
		treeInit: function (ctx) {
			var $tdFirst,
				$ul,
				tree = ctx.tree,
				$table = tree.widget.element;

			tree.tr = $("tbody tr", $table)[0];
			tree.$tdList = $(">td", tree.tr);
			tree.columnCount = tree.$tdList.length;
			// Perform default behavior
			this._superApply(arguments);
			// Standard Fancytree created a root <ul>. Now move this into first table cell
			$ul = $(tree.rootNode.ul);
			$tdFirst = tree.$tdList.eq(0);

			_assert(
				$.inArray("table", this.options.extensions) < 0,
				"columnview extensions must not use ext-table"
			);
			_assert(
				tree.columnCount >= 2,
				"columnview target must be a table with at least two columns"
			);

			$ul.removeClass("fancytree-container").removeAttr("tabindex");
			tree.$container = $table;
			$table
				.addClass("fancytree-container fancytree-ext-columnview")
				.attr("tabindex", "0");

			$tdFirst.empty();
			$ul.detach().appendTo($tdFirst);

			// Force some required options
			tree.widget.options.autoCollapse = true;
			// tree.widget.options.autoActivate = true;
			tree.widget.options.toggleEffect = false;
			tree.widget.options.clickFolderMode = 1;

			$table
				// Make sure that only active path is expanded when a node is activated:
				.on("fancytreeactivate", function (event, data) {
					var node = data.node,
						tree = data.tree,
						level = node.getLevel();

					tree._callHook("nodeCollapseSiblings", node);
					// Clear right neighbours
					if (!node.expanded) {
						tree.$tdList.eq(level).nextAll().empty();
					}
					// Expand nodes on activate, so we populate the right neighbor cell
					if (!node.expanded && (node.children || node.lazy)) {
						node.setExpanded();
					}
				})
				// Adjust keyboard behaviour:
				.on("fancytreekeydown", function (event, data) {
					var next = null,
						handled = true,
						node = data.node || data.tree.getFirstChild();

					if (node.getLevel() >= tree.columnCount) {
						return;
					}
					switch (FT.eventToString(event)) {
						case "down":
							next = node.getNextSibling();
							break;
						case "left":
							if (!node.isTopLevel()) {
								next = node.getParent();
							}
							break;
						case "right":
							next = node.getFirstChild();
							if (!next) {
								// default processing: expand or ignore
								return;
							}
							// Prefer an expanded child if any
							next.visitSiblings(function (n) {
								if (n.expanded) {
									next = n;
									return false;
								}
							}, true);
							break;
						case "up":
							next = node.getPrevSibling();
							break;
						default:
							handled = false;
					}
					if (next) {
						next.setActive();
					}
					return !handled;
				});
		},
		nodeSetExpanded: function (ctx, flag, callOpts) {
			var $wait,
				node = ctx.node,
				tree = ctx.tree,
				level = node.getLevel();

			if (flag !== false && !node.expanded && node.isUndefined()) {
				$wait = $(
					"<span class='fancytree-icon fancytree-icon-loading'>"
				);
				tree.$tdList.eq(level).empty().append($wait);
			}
			return this._superApply(arguments);
		},
		nodeRemoveChildren: function (ctx) {
			// #899: node's children removed: remove child marker...
			$(ctx.node.span).find("span.fancytree-cv-right").remove();
			// ...and clear right columns
			ctx.tree.$tdList.eq(ctx.node.getLevel()).nextAll().empty();
			return this._superApply(arguments);
		},
		nodeRender: function (ctx, force, deep, collapsed, _recursive) {
			// Render standard nested <ul> - <li> hierarchy
			this._super(ctx, force, deep, collapsed, _recursive);
			// Remove expander and add a trailing triangle instead
			var level,
				$tdChild,
				$ul,
				tree = ctx.tree,
				node = ctx.node,
				$span = $(node.span);

			$span.find("span.fancytree-expander").remove();
			if (
				node.hasChildren() !== false &&
				!$span.find("span.fancytree-cv-right").length
			) {
				$span.append(
					$("<span class='fancytree-icon fancytree-cv-right'>")
				);
			}
			// Move <ul> with children into the appropriate <td>
			if (node.ul && node.expanded) {
				node.ul.style.display = ""; // might be hidden if RIGHT was pressed
				level = node.getLevel();
				if (level < tree.columnCount) {
					// only if we are not in the last column
					$tdChild = tree.$tdList.eq(level);
					$ul = $(node.ul).detach();
					$tdChild.empty().append($ul);
				}
			}
		},
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
