/*!
 * jquery.fancytree.columnview.js
 *
 * Render tree like a Mac Finder's column view.
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

// prevent duplicate loading
// if ( $.ui.fancytree && $.ui.fancytree.version ) {
//     $.ui.fancytree.warn("Fancytree: duplicate include");
//     return;
// }


/*******************************************************************************
 * Private functions and variables
 */
/*
function _assert(cond, msg){
	msg = msg || "";
	if(!cond){
		$.error("Assertion failed " + msg);
	}
}
*/

/*******************************************************************************
 * Private functions and variables
 */
$.ui.fancytree.registerExtension({
	name: "columnview",
	version: "2.22.5",
	// Default options for this extension.
	options: {
	},
	// Overide virtual methods for this extension.
	// `this`       : is this extension object
	// `this._base` : the Fancytree instance
	// `this._super`: the virtual function that was overriden (member of prev. extension or Fancytree)
	treeInit: function(ctx){
		var $tdFirst, $ul,
			tree = ctx.tree,
			$table = tree.widget.element;

		tree.tr = $("tbody tr", $table)[0];
		tree.columnCount = $(">td", tree.tr).length;
		// Perform default behavior
		this._superApply(arguments);
		// Standard Fancytree created a root <ul>. Now move this into first table cell
		$ul = $(tree.rootNode.ul);
		$tdFirst = $(">td", tree.tr).eq(0);

		$ul.removeClass("fancytree-container");
		$ul.removeAttr("tabindex");
		tree.$container = $table;
		$table.addClass("fancytree-container fancytree-ext-columnview");
		$table.attr("tabindex", "0");

		$tdFirst.empty();
		$ul.detach().appendTo($tdFirst);

		// Force some required options
		tree.widget.options.autoCollapse = true;
//      tree.widget.options.autoActivate = true;
		tree.widget.options.toggleEffect = false;
		tree.widget.options.clickFolderMode = 1;

		// Make sure that only active path is expanded when a node is activated:
		$table.bind("fancytreeactivate", function(event, data){
			var i, tdList,
				node = data.node,
				tree = data.tree,
				level = node.getLevel();

			tree._callHook("nodeCollapseSiblings", node);
			// Clear right neighbours
			if(level <= tree.columnCount){
				tdList = $(">td", tree.tr);
				for(i=level; i<tree.columnCount; i++){
					tdList.eq(i).empty();
				}
			}
			// Expand nodes on activate, so we populate the right neighbor cell
			if(!node.expanded && (node.children || node.lazy)) {
				node.setExpanded();
			}
		// Adjust keyboard behaviour:
		}).bind("fancytreekeydown", function(event, data){
			var next = null,
				node = data.node || data.tree.getFirstChild();
			switch(event.which){
			case $.ui.keyCode.DOWN:
				next = node.getNextSibling();
				if( next ){
					next.setFocus();
				}
				return false;
			case $.ui.keyCode.LEFT:
				next = node.getParent();
				if( next ){
					next.setFocus();
				}
				return false;
			case $.ui.keyCode.UP:
				next = node.getPrevSibling();
				if( next ){
					next.setFocus();
				}
				return false;
			}
		});
	},
	nodeRender: function(ctx, force, deep, collapsed, _recursive) {
		// Render standard nested <ul> - <li> hierarchy
		this._super(ctx, force, deep, collapsed, _recursive);
		// Remove expander and add a trailing triangle instead
		var level, $tdChild, $ul,
			tree = ctx.tree,
			node = ctx.node,
			$span = $(node.span);

		$span.find("span.fancytree-expander").remove();
		if(node.hasChildren() !== false && !$span.find("span.fancytree-cv-right").length){
			$span.append($("<span class='fancytree-icon fancytree-cv-right'>"));
		}
		// Move <ul> with children into the appropriate <td>
		if(node.ul){
			node.ul.style.display = ""; // might be hidden if RIGHT was pressed
			level = node.getLevel();
			if(level < tree.columnCount){
				$tdChild = $(">td", tree.tr).eq(level);
				$ul = $(node.ul).detach();
				$tdChild.empty().append($ul);
			}
		}
	}
});
}(jQuery, window, document));
