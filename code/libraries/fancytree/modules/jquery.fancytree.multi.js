/*!
 * jquery.fancytree.multi.js
 *
 * Allow multiple selection of nodes  by mouse or keyboard.
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

	// var isMac = /Mac/.test(navigator.platform);

	/*******************************************************************************
	 * Extension code
	 */
	$.ui.fancytree.registerExtension({
		name: "multi",
		version: "2.38.3",
		// Default options for this extension.
		options: {
			allowNoSelect: false, //
			mode: "sameParent", //
			// Events:
			// beforeSelect: $.noop  // Return false to prevent cancel/save (data.input is available)
		},

		treeInit: function (ctx) {
			this._superApply(arguments);
			this.$container.addClass("fancytree-ext-multi");
			if (ctx.options.selectMode === 1) {
				$.error(
					"Fancytree ext-multi: selectMode: 1 (single) is not compatible."
				);
			}
		},
		nodeClick: function (ctx) {
			var //pluginOpts = ctx.options.multi,
				tree = ctx.tree,
				node = ctx.node,
				activeNode = tree.getActiveNode() || tree.getFirstChild(),
				isCbClick = ctx.targetType === "checkbox",
				isExpanderClick = ctx.targetType === "expander",
				eventStr = $.ui.fancytree.eventToString(ctx.originalEvent);

			switch (eventStr) {
				case "click":
					if (isExpanderClick) {
						break;
					} // Default handler will expand/collapse
					if (!isCbClick) {
						tree.selectAll(false);
						// Select clicked node (radio-button  mode)
						node.setSelected();
					}
					// Default handler will toggle checkbox clicks and activate
					break;
				case "shift+click":
					// node.debug("click")
					tree.visitRows(
						function (n) {
							// n.debug("click2", n===node, node)
							n.setSelected();
							if (n === node) {
								return false;
							}
						},
						{
							start: activeNode,
							reverse: activeNode.isBelowOf(node),
						}
					);
					break;
				case "ctrl+click":
				case "meta+click": // Mac: [Command]
					node.toggleSelected();
					return;
			}
			return this._superApply(arguments);
		},
		nodeKeydown: function (ctx) {
			var tree = ctx.tree,
				node = ctx.node,
				event = ctx.originalEvent,
				eventStr = $.ui.fancytree.eventToString(event);

			switch (eventStr) {
				case "up":
				case "down":
					tree.selectAll(false);
					node.navigate(event.which, true);
					tree.getActiveNode().setSelected();
					break;
				case "shift+up":
				case "shift+down":
					node.navigate(event.which, true);
					tree.getActiveNode().setSelected();
					break;
			}
			return this._superApply(arguments);
		},
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
