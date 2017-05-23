/*!
 * jquery.fancytree.glyph.js
 *
 * Use glyph fonts as instead of icon sprites.
 * (Extension module for jquery.fancytree.js: https://github.com/mar10/fancytree/)
 *
 * Copyright (c) 2008-2017, Martin Wendt (http://wwWendt.de)
 *
 * Released under the MIT license
 * https://github.com/mar10/fancytree/wiki/LicenseInfo
 *
 * @version 2.22.5
 * @date 2017-05-11T17:01:53Z
 */

;(function($, window, document, undefined) {

"use strict";

/* *****************************************************************************
 * Private functions and variables
 */

function _getIcon(opts, type){
	return opts.map[type];
}

$.ui.fancytree.registerExtension({
	name: "glyph",
	version: "2.22.5",
	// Default options for this extension.
	options: {
		map: {
			// Samples from Font Awesome 3.2
			//   http://fortawesome.github.io/Font-Awesome/3.2.1/icons/
			// See here for alternatives:
			//   http://fortawesome.github.io/Font-Awesome/icons/
			//   http://getbootstrap.com/components/
			checkbox: "icon-check-empty",
			checkboxSelected: "icon-check",
			checkboxUnknown: "icon-check icon-muted",
			error: "icon-exclamation-sign",
			expanderClosed: "icon-caret-right",
			expanderLazy: "icon-angle-right",
			expanderOpen: "icon-caret-down",
			nodata: "icon-meh",
			noExpander: "",
			dragHelper: "icon-caret-right",
			dropMarker: "icon-caret-right",
			// Default node icons.
			// (Use tree.options.icon callback to define custom icons
			// based on node data)
			doc: "icon-file-alt",
			docOpen: "icon-file-alt",
			loading: "icon-refresh icon-spin",
			folder: "icon-folder-close-alt",
			folderOpen: "icon-folder-open-alt"
		}
	},

	treeInit: function(ctx){
		var tree = ctx.tree;
		this._superApply(arguments);
		tree.$container.addClass("fancytree-ext-glyph");
	},
	nodeRenderStatus: function(ctx) {
		var icon, res, span,
			node = ctx.node,
			$span = $(node.span),
			opts = ctx.options.glyph,
			map = opts.map;

		res = this._super(ctx);

		if( node.isRoot() ){
			return res;
		}
		span = $span.children("span.fancytree-expander").get(0);
		if( span ){
			// if( node.isLoading() ){
				// icon = "loading";
			if( node.expanded && node.hasChildren() ){
				icon = "expanderOpen";
			}else if( node.isUndefined() ){
				icon = "expanderLazy";
			}else if( node.hasChildren() ){
				icon = "expanderClosed";
			}else{
				icon = "noExpander";
			}
			span.className = "fancytree-expander " + map[icon];
		}

		if( node.tr ){
			span = $("td", node.tr).find("span.fancytree-checkbox").get(0);
		}else{
			span = $span.children("span.fancytree-checkbox").get(0);
		}
		if( span ){
			icon = node.selected ? "checkboxSelected" : (node.partsel ? "checkboxUnknown" : "checkbox");
			span.className = "fancytree-checkbox " + map[icon];
		}

		// Standard icon (note that this does not match .fancytree-custom-icon,
		// that might be set by opts.icon callbacks)
		span = $span.children("span.fancytree-icon").get(0);
		if( span ){
			if( node.statusNodeType ){
				icon = _getIcon(opts, node.statusNodeType); // loading, error
			}else if( node.folder ){
				icon = node.expanded && node.hasChildren() ? _getIcon(opts, "folderOpen") : _getIcon(opts, "folder");
			}else{
				icon = node.expanded ? _getIcon(opts, "docOpen") : _getIcon(opts, "doc");
			}
			span.className = "fancytree-icon " + icon;
		}
		return res;
	},
	nodeSetStatus: function(ctx, status, message, details) {
		var res, span,
			opts = ctx.options.glyph,
			node = ctx.node;

		res = this._superApply(arguments);

		if( status === "error" || status === "loading" || status === "nodata" ){
			if(node.parent){
				span = $("span.fancytree-expander", node.span).get(0);
				if( span ) {
					span.className = "fancytree-expander " + _getIcon(opts, status);
				}
			}else{ //
				span = $(".fancytree-statusnode-" + status, node[this.nodeContainerAttrName])
					.find("span.fancytree-icon").get(0);
				if( span ) {
					span.className = "fancytree-icon " + _getIcon(opts, status);
				}
			}
		}
		return res;
	}
});
}(jQuery, window, document));
