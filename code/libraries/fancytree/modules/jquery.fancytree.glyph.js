/*!
 * jquery.fancytree.glyph.js
 *
 * Use glyph-fonts, ligature-fonts, or SVG icons instead of icon sprites.
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

	/******************************************************************************
	 * Private functions and variables
	 */

	var FT = $.ui.fancytree,
		PRESETS = {
			awesome3: {
				// Outdated!
				_addClass: "",
				checkbox: "icon-check-empty",
				checkboxSelected: "icon-check",
				checkboxUnknown: "icon-check icon-muted",
				dragHelper: "icon-caret-right",
				dropMarker: "icon-caret-right",
				error: "icon-exclamation-sign",
				expanderClosed: "icon-caret-right",
				expanderLazy: "icon-angle-right",
				expanderOpen: "icon-caret-down",
				loading: "icon-refresh icon-spin",
				nodata: "icon-meh",
				noExpander: "",
				radio: "icon-circle-blank",
				radioSelected: "icon-circle",
				// radioUnknown: "icon-circle icon-muted",
				// Default node icons.
				// (Use tree.options.icon callback to define custom icons based on node data)
				doc: "icon-file-alt",
				docOpen: "icon-file-alt",
				folder: "icon-folder-close-alt",
				folderOpen: "icon-folder-open-alt",
			},
			awesome4: {
				_addClass: "fa",
				checkbox: "fa-square-o",
				checkboxSelected: "fa-check-square-o",
				checkboxUnknown: "fa-square fancytree-helper-indeterminate-cb",
				dragHelper: "fa-arrow-right",
				dropMarker: "fa-long-arrow-right",
				error: "fa-warning",
				expanderClosed: "fa-caret-right",
				expanderLazy: "fa-angle-right",
				expanderOpen: "fa-caret-down",
				// We may prevent wobbling rotations on FF by creating a separate sub element:
				loading: { html: "<span class='fa fa-spinner fa-pulse' />" },
				nodata: "fa-meh-o",
				noExpander: "",
				radio: "fa-circle-thin", // "fa-circle-o"
				radioSelected: "fa-circle",
				// radioUnknown: "fa-dot-circle-o",
				// Default node icons.
				// (Use tree.options.icon callback to define custom icons based on node data)
				doc: "fa-file-o",
				docOpen: "fa-file-o",
				folder: "fa-folder-o",
				folderOpen: "fa-folder-open-o",
			},
			awesome5: {
				// fontawesome 5 have several different base classes
				// "far, fas, fal and fab" The rendered svg puts that prefix
				// in a different location so we have to keep them separate here
				_addClass: "",
				checkbox: "far fa-square",
				checkboxSelected: "far fa-check-square",
				// checkboxUnknown: "far fa-window-close",
				checkboxUnknown:
					"fas fa-square fancytree-helper-indeterminate-cb",
				radio: "far fa-circle",
				radioSelected: "fas fa-circle",
				radioUnknown: "far fa-dot-circle",
				dragHelper: "fas fa-arrow-right",
				dropMarker: "fas fa-long-arrow-alt-right",
				error: "fas fa-exclamation-triangle",
				expanderClosed: "fas fa-caret-right",
				expanderLazy: "fas fa-angle-right",
				expanderOpen: "fas fa-caret-down",
				loading: "fas fa-spinner fa-pulse",
				nodata: "far fa-meh",
				noExpander: "",
				// Default node icons.
				// (Use tree.options.icon callback to define custom icons based on node data)
				doc: "far fa-file",
				docOpen: "far fa-file",
				folder: "far fa-folder",
				folderOpen: "far fa-folder-open",
			},
			bootstrap3: {
				_addClass: "glyphicon",
				checkbox: "glyphicon-unchecked",
				checkboxSelected: "glyphicon-check",
				checkboxUnknown:
					"glyphicon-expand fancytree-helper-indeterminate-cb", // "glyphicon-share",
				dragHelper: "glyphicon-play",
				dropMarker: "glyphicon-arrow-right",
				error: "glyphicon-warning-sign",
				expanderClosed: "glyphicon-menu-right", // glyphicon-plus-sign
				expanderLazy: "glyphicon-menu-right", // glyphicon-plus-sign
				expanderOpen: "glyphicon-menu-down", // glyphicon-minus-sign
				loading: "glyphicon-refresh fancytree-helper-spin",
				nodata: "glyphicon-info-sign",
				noExpander: "",
				radio: "glyphicon-remove-circle", // "glyphicon-unchecked",
				radioSelected: "glyphicon-ok-circle", // "glyphicon-check",
				// radioUnknown: "glyphicon-ban-circle",
				// Default node icons.
				// (Use tree.options.icon callback to define custom icons based on node data)
				doc: "glyphicon-file",
				docOpen: "glyphicon-file",
				folder: "glyphicon-folder-close",
				folderOpen: "glyphicon-folder-open",
			},
			material: {
				_addClass: "material-icons",
				checkbox: { text: "check_box_outline_blank" },
				checkboxSelected: { text: "check_box" },
				checkboxUnknown: { text: "indeterminate_check_box" },
				dragHelper: { text: "play_arrow" },
				dropMarker: { text: "arrow-forward" },
				error: { text: "warning" },
				expanderClosed: { text: "chevron_right" },
				expanderLazy: { text: "last_page" },
				expanderOpen: { text: "expand_more" },
				loading: {
					text: "autorenew",
					addClass: "fancytree-helper-spin",
				},
				nodata: { text: "info" },
				noExpander: { text: "" },
				radio: { text: "radio_button_unchecked" },
				radioSelected: { text: "radio_button_checked" },
				// Default node icons.
				// (Use tree.options.icon callback to define custom icons based on node data)
				doc: { text: "insert_drive_file" },
				docOpen: { text: "insert_drive_file" },
				folder: { text: "folder" },
				folderOpen: { text: "folder_open" },
			},
		};

	function setIcon(node, span, baseClass, opts, type) {
		var map = opts.map,
			icon = map[type],
			$span = $(span),
			$counter = $span.find(".fancytree-childcounter"),
			setClass = baseClass + " " + (map._addClass || "");

		// #871 Allow a callback
		if (typeof icon === "function") {
			icon = icon.call(this, node, span, type);
		}
		// node.debug( "setIcon(" + baseClass + ", " + type + "): " + "oldIcon" + " -> " + icon );
		// #871: propsed this, but I am not sure how robust this is, e.g.
		// the prefix (fas, far) class changes are not considered?
		// if (span.tagName === "svg" && opts.preset === "awesome5") {
		// 	// fa5 script converts <i> to <svg> so call a specific handler.
		// 	var oldIcon = "fa-" + $span.data("icon");
		// 	// node.debug( "setIcon(" + baseClass + ", " + type + "): " + oldIcon + " -> " + icon );
		// 	if (typeof oldIcon === "string") {
		// 		$span.removeClass(oldIcon);
		// 	}
		// 	if (typeof icon === "string") {
		// 		$span.addClass(icon);
		// 	}
		// 	return;
		// }
		if (typeof icon === "string") {
			// #883: remove inner html that may be added by prev. mode
			span.innerHTML = "";
			$span.attr("class", setClass + " " + icon).append($counter);
		} else if (icon) {
			if (icon.text) {
				span.textContent = "" + icon.text;
			} else if (icon.html) {
				span.innerHTML = icon.html;
			} else {
				span.innerHTML = "";
			}
			$span
				.attr("class", setClass + " " + (icon.addClass || ""))
				.append($counter);
		}
	}

	$.ui.fancytree.registerExtension({
		name: "glyph",
		version: "2.38.3",
		// Default options for this extension.
		options: {
			preset: null, // 'awesome3', 'awesome4', 'bootstrap3', 'material'
			map: {},
		},

		treeInit: function (ctx) {
			var tree = ctx.tree,
				opts = ctx.options.glyph;

			if (opts.preset) {
				FT.assert(
					!!PRESETS[opts.preset],
					"Invalid value for `options.glyph.preset`: " + opts.preset
				);
				opts.map = $.extend({}, PRESETS[opts.preset], opts.map);
			} else {
				tree.warn("ext-glyph: missing `preset` option.");
			}
			this._superApply(arguments);
			tree.$container.addClass("fancytree-ext-glyph");
		},
		nodeRenderStatus: function (ctx) {
			var checkbox,
				icon,
				res,
				span,
				node = ctx.node,
				$span = $(node.span),
				opts = ctx.options.glyph;

			res = this._super(ctx);

			if (node.isRootNode()) {
				return res;
			}
			span = $span.children(".fancytree-expander").get(0);
			if (span) {
				// if( node.isLoading() ){
				// icon = "loading";
				if (node.expanded && node.hasChildren()) {
					icon = "expanderOpen";
				} else if (node.isUndefined()) {
					icon = "expanderLazy";
				} else if (node.hasChildren()) {
					icon = "expanderClosed";
				} else {
					icon = "noExpander";
				}
				// span.className = "fancytree-expander " + map[icon];
				setIcon(node, span, "fancytree-expander", opts, icon);
			}

			if (node.tr) {
				span = $("td", node.tr).find(".fancytree-checkbox").get(0);
			} else {
				span = $span.children(".fancytree-checkbox").get(0);
			}
			if (span) {
				checkbox = FT.evalOption("checkbox", node, node, opts, false);
				if (
					(node.parent && node.parent.radiogroup) ||
					checkbox === "radio"
				) {
					icon = node.selected ? "radioSelected" : "radio";
					setIcon(
						node,
						span,
						"fancytree-checkbox fancytree-radio",
						opts,
						icon
					);
				} else {
					// eslint-disable-next-line no-nested-ternary
					icon = node.selected
						? "checkboxSelected"
						: node.partsel
						? "checkboxUnknown"
						: "checkbox";
					// span.className = "fancytree-checkbox " + map[icon];
					setIcon(node, span, "fancytree-checkbox", opts, icon);
				}
			}

			// Standard icon (note that this does not match .fancytree-custom-icon,
			// that might be set by opts.icon callbacks)
			span = $span.children(".fancytree-icon").get(0);
			if (span) {
				if (node.statusNodeType) {
					icon = node.statusNodeType; // loading, error
				} else if (node.folder) {
					icon =
						node.expanded && node.hasChildren()
							? "folderOpen"
							: "folder";
				} else {
					icon = node.expanded ? "docOpen" : "doc";
				}
				setIcon(node, span, "fancytree-icon", opts, icon);
			}
			return res;
		},
		nodeSetStatus: function (ctx, status, message, details) {
			var res,
				span,
				opts = ctx.options.glyph,
				node = ctx.node;

			res = this._superApply(arguments);

			if (
				status === "error" ||
				status === "loading" ||
				status === "nodata"
			) {
				if (node.parent) {
					span = $(".fancytree-expander", node.span).get(0);
					if (span) {
						setIcon(node, span, "fancytree-expander", opts, status);
					}
				} else {
					//
					span = $(
						".fancytree-statusnode-" + status,
						node[this.nodeContainerAttrName]
					)
						.find(".fancytree-icon")
						.get(0);
					if (span) {
						setIcon(node, span, "fancytree-icon", opts, status);
					}
				}
			}
			return res;
		},
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
