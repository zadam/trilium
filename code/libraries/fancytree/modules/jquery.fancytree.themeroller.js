/*!
 * jquery.fancytree.themeroller.js
 *
 * Enable jQuery UI ThemeRoller styles.
 * (Extension module for jquery.fancytree.js: https://github.com/mar10/fancytree/)
 *
 * @see http://jqueryui.com/themeroller/
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
	 * Extension code
	 */
	$.ui.fancytree.registerExtension({
		name: "themeroller",
		version: "2.38.3",
		// Default options for this extension.
		options: {
			activeClass: "ui-state-active", // Class added to active node
			// activeClass: "ui-state-highlight",
			addClass: "ui-corner-all", // Class added to all nodes
			focusClass: "ui-state-focus", // Class added to focused node
			hoverClass: "ui-state-hover", // Class added to hovered node
			selectedClass: "ui-state-highlight", // Class added to selected nodes
			// selectedClass: "ui-state-active"
		},

		treeInit: function (ctx) {
			var $el = ctx.widget.element,
				opts = ctx.options.themeroller;

			this._superApply(arguments);

			if ($el[0].nodeName === "TABLE") {
				$el.addClass("ui-widget ui-corner-all");
				$el.find(">thead tr").addClass("ui-widget-header");
				$el.find(">tbody").addClass("ui-widget-conent");
			} else {
				$el.addClass("ui-widget ui-widget-content ui-corner-all");
			}

			$el.on(
				"mouseenter mouseleave",
				".fancytree-node",
				function (event) {
					var node = $.ui.fancytree.getNode(event.target),
						flag = event.type === "mouseenter";

					$(node.tr ? node.tr : node.span).toggleClass(
						opts.hoverClass + " " + opts.addClass,
						flag
					);
				}
			);
		},
		treeDestroy: function (ctx) {
			this._superApply(arguments);
			ctx.widget.element.removeClass(
				"ui-widget ui-widget-content ui-corner-all"
			);
		},
		nodeRenderStatus: function (ctx) {
			var classes = {},
				node = ctx.node,
				$el = $(node.tr ? node.tr : node.span),
				opts = ctx.options.themeroller;

			this._super(ctx);
			/*
		.ui-state-highlight: Class to be applied to highlighted or selected elements. Applies "highlight" container styles to an element and its child text, links, and icons.
		.ui-state-error: Class to be applied to error messaging container elements. Applies "error" container styles to an element and its child text, links, and icons.
		.ui-state-error-text: An additional class that applies just the error text color without background. Can be used on form labels for instance. Also applies error icon color to child icons.

		.ui-state-default: Class to be applied to clickable button-like elements. Applies "clickable default" container styles to an element and its child text, links, and icons.
		.ui-state-hover: Class to be applied on mouseover to clickable button-like elements. Applies "clickable hover" container styles to an element and its child text, links, and icons.
		.ui-state-focus: Class to be applied on keyboard focus to clickable button-like elements. Applies "clickable hover" container styles to an element and its child text, links, and icons.
		.ui-state-active: Class to be applied on mousedown to clickable button-like elements. Applies "clickable active" container styles to an element and its child text, links, and icons.
*/
			// Set ui-state-* class (handle the case that the same class is assigned
			// to different states)
			classes[opts.activeClass] = false;
			classes[opts.focusClass] = false;
			classes[opts.selectedClass] = false;
			if (node.isActive()) {
				classes[opts.activeClass] = true;
			}
			if (node.hasFocus()) {
				classes[opts.focusClass] = true;
			}
			// activeClass takes precedence before selectedClass:
			if (node.isSelected() && !node.isActive()) {
				classes[opts.selectedClass] = true;
			}
			$el.toggleClass(opts.activeClass, classes[opts.activeClass]);
			$el.toggleClass(opts.focusClass, classes[opts.focusClass]);
			$el.toggleClass(opts.selectedClass, classes[opts.selectedClass]);
			// Additional classes (e.g. 'ui-corner-all')
			$el.addClass(opts.addClass);
		},
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
