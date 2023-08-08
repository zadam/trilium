/*!
 * jquery.fancytree.menu.js
 *
 * Enable jQuery UI Menu as context menu for tree nodes.
 * (Extension module for jquery.fancytree.js: https://github.com/mar10/fancytree/)
 *
 * @see http://api.jqueryui.com/menu/
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

	$.ui.fancytree.registerExtension({
		name: "menu",
		version: "2.38.3",
		// Default options for this extension.
		options: {
			enable: true,
			selector: null, //
			position: {}, //
			// Events:
			create: $.noop, //
			beforeOpen: $.noop, //
			open: $.noop, //
			focus: $.noop, //
			select: $.noop, //
			close: $.noop, //
		},
		// Override virtual methods for this extension.
		// `this`       : is this extension object
		// `this._base` : the Fancytree instance
		// `this._super`: the virtual function that was overridden (member of prev. extension or Fancytree)
		treeInit: function (ctx) {
			var opts = ctx.options,
				tree = ctx.tree;

			this._superApply(arguments);

			// Prepare an object that will be passed with menu events
			tree.ext.menu.data = {
				tree: tree,
				node: null,
				$menu: null,
				menuId: null,
			};

			//        tree.$container[0].oncontextmenu = function() {return false;};
			// Replace the standard browser context menu with out own
			tree.$container.on(
				"contextmenu",
				"span.fancytree-node",
				function (event) {
					var node = $.ui.fancytree.getNode(event),
						ctx = {
							node: node,
							tree: node.tree,
							originalEvent: event,
							options: tree.options,
						};
					tree.ext.menu._openMenu(ctx);
					return false;
				}
			);

			// Use jquery.ui.menu
			$(opts.menu.selector)
				.menu({
					create: function (event, ui) {
						tree.ext.menu.data.$menu = $(this).menu("widget");
						var data = $.extend({}, tree.ext.menu.data);
						opts.menu.create.call(tree, event, data);
					},
					focus: function (event, ui) {
						var data = $.extend({}, tree.ext.menu.data, {
							menuItem: ui.item,
							menuId: ui.item.find(">a").attr("href"),
						});
						opts.menu.focus.call(tree, event, data);
					},
					select: function (event, ui) {
						var data = $.extend({}, tree.ext.menu.data, {
							menuItem: ui.item,
							menuId: ui.item.find(">a").attr("href"),
						});
						if (
							opts.menu.select.call(tree, event, data) !== false
						) {
							tree.ext.menu._closeMenu(ctx);
						}
					},
				})
				.hide();
		},
		treeDestroy: function (ctx) {
			this._superApply(arguments);
		},
		_openMenu: function (ctx) {
			var data,
				tree = ctx.tree,
				opts = ctx.options,
				$menu = $(opts.menu.selector);

			tree.ext.menu.data.node = ctx.node;
			data = $.extend({}, tree.ext.menu.data);

			if (
				opts.menu.beforeOpen.call(tree, ctx.originalEvent, data) ===
				false
			) {
				return;
			}

			$(document)
				.on("keydown.fancytree", function (event) {
					if (event.which === $.ui.keyCode.ESCAPE) {
						tree.ext.menu._closeMenu(ctx);
					}
				})
				.on("mousedown.fancytree", function (event) {
					// Close menu when clicked outside menu
					if ($(event.target).closest(".ui-menu-item").length === 0) {
						tree.ext.menu._closeMenu(ctx);
					}
				});
			//        $menu.position($.extend({my: "left top", at: "left bottom", of: event}, opts.menu.position));
			$menu
				.css("position", "absolute")
				.show()
				.position({
					my: "left top",
					at: "right top",
					of: ctx.originalEvent,
					collision: "fit",
				})
				.focus();

			opts.menu.open.call(tree, ctx.originalEvent, data);
		},
		_closeMenu: function (ctx) {
			var $menu,
				tree = ctx.tree,
				opts = ctx.options,
				data = $.extend({}, tree.ext.menu.data);
			if (opts.menu.close.call(tree, ctx.originalEvent, data) === false) {
				return;
			}
			$menu = $(opts.menu.selector);
			$(document).off("keydown.fancytree, mousedown.fancytree");
			$menu.hide();
			tree.ext.menu.data.node = null;
		},
		//	,
		//	nodeClick: function(ctx) {
		//		var event = ctx.originalEvent;
		//		if(event.which === 2 || (event.which === 1 && event.ctrlKey)){
		//			event.preventDefault();
		//			ctx.tree.ext.menu._openMenu(ctx);
		//			return false;
		//		}
		//		this._superApply(arguments);
		//	}
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
