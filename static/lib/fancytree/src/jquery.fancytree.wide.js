/*!
 * jquery.fancytree.wide.js
 * Support for 100% wide selection bars.
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

var reNumUnit = /^([+-]?(?:\d+|\d*\.\d+))([a-z]*|%)$/; // split "1.5em" to ["1.5", "em"]

/*******************************************************************************
 * Private functions and variables
 */
// var _assert = $.ui.fancytree.assert;

/* Calculate inner width without scrollbar */
// function realInnerWidth($el) {
// 	// http://blog.jquery.com/2012/08/16/jquery-1-8-box-sizing-width-csswidth-and-outerwidth/
// //	inst.contWidth = parseFloat(this.$container.css("width"), 10);
// 	// 'Client width without scrollbar' - 'padding'
// 	return $el[0].clientWidth - ($el.innerWidth() -  parseFloat($el.css("width"), 10));
// }

/* Create a global embedded CSS style for the tree. */
function defineHeadStyleElement(id, cssText) {
	id = "fancytree-style-" + id;
	var $headStyle = $("#" + id);

	if( !cssText ) {
		$headStyle.remove();
		return null;
	}
	if( !$headStyle.length ) {
		$headStyle = $("<style />")
			.attr("id", id)
			.addClass("fancytree-style")
			.prop("type", "text/css")
			.appendTo("head");
	}
	try {
		$headStyle.html(cssText);
	} catch ( e ) {
		// fix for IE 6-8
		$headStyle[0].styleSheet.cssText = cssText;
	}
	return $headStyle;
}

/* Calculate the CSS rules that indent title spans. */
function renderLevelCss(containerId, depth, levelOfs, lineOfs, labelOfs, measureUnit)
{
	var i,
		prefix = "#" + containerId + " span.fancytree-level-",
		rules = [];

	for(i = 0; i < depth; i++) {
		rules.push(prefix + (i + 1) + " span.fancytree-title { padding-left: " +
			(i * levelOfs + lineOfs) + measureUnit + "; }");
	}
	// Some UI animations wrap the UL inside a DIV and set position:relative on both.
	// This breaks the left:0 and padding-left:nn settings of the title
	rules.push(
		"#" + containerId + " div.ui-effects-wrapper ul li span.fancytree-title, " +
		"#" + containerId + " ul.fancytree-animating span.fancytree-title " +  // #716
		"{ padding-left: " + labelOfs + measureUnit + "; position: static; width: auto; }");
	return rules.join("\n");
}


// /**
//  * [ext-wide] Recalculate the width of the selection bar after the tree container
//  * was resized.<br>
//  * May be called explicitly on container resize, since there is no resize event
//  * for DIV tags.
//  *
//  * @alias Fancytree#wideUpdate
//  * @requires jquery.fancytree.wide.js
//  */
// $.ui.fancytree._FancytreeClass.prototype.wideUpdate = function(){
// 	var inst = this.ext.wide,
// 		prevCw = inst.contWidth,
// 		prevLo = inst.lineOfs;

// 	inst.contWidth = realInnerWidth(this.$container);
// 	// Each title is precceeded by 2 or 3 icons (16px + 3 margin)
// 	//     + 1px title border and 3px title padding
// 	// TODO: use code from treeInit() below
// 	inst.lineOfs = (this.options.checkbox ? 3 : 2) * 19;
// 	if( prevCw !== inst.contWidth || prevLo !== inst.lineOfs ) {
// 		this.debug("wideUpdate: " + inst.contWidth);
// 		this.visit(function(node){
// 			node.tree._callHook("nodeRenderTitle", node);
// 		});
// 	}
// };

/*******************************************************************************
 * Extension code
 */
$.ui.fancytree.registerExtension({
	name: "wide",
	version: "2.22.5",
	// Default options for this extension.
	options: {
		iconWidth: null,     // Adjust this if @fancy-icon-width != "16px"
		iconSpacing: null,   // Adjust this if @fancy-icon-spacing != "3px"
		labelSpacing: null,  // Adjust this if padding between icon and label != "3px"
		levelOfs: null       // Adjust this if ul padding != "16px"
	},

	treeCreate: function(ctx){
		this._superApply(arguments);
		this.$container.addClass("fancytree-ext-wide");

		var containerId, cssText, iconSpacingUnit, labelSpacingUnit, iconWidthUnit, levelOfsUnit,
			instOpts = ctx.options.wide,
			// css sniffing
			$dummyLI = $("<li id='fancytreeTemp'><span class='fancytree-node'><span class='fancytree-icon' /><span class='fancytree-title' /></span><ul />")
				.appendTo(ctx.tree.$container),
			$dummyIcon = $dummyLI.find(".fancytree-icon"),
			$dummyUL = $dummyLI.find("ul"),
			// $dummyTitle = $dummyLI.find(".fancytree-title"),
			iconSpacing = instOpts.iconSpacing || $dummyIcon.css("margin-left"),
			iconWidth = instOpts.iconWidth || $dummyIcon.css("width"),
			labelSpacing = instOpts.labelSpacing || "3px",
			levelOfs = instOpts.levelOfs || $dummyUL.css("padding-left");

		$dummyLI.remove();

		iconSpacingUnit = iconSpacing.match(reNumUnit)[2];
		iconSpacing = parseFloat(iconSpacing, 10);
		labelSpacingUnit = labelSpacing.match(reNumUnit)[2];
		labelSpacing = parseFloat(labelSpacing, 10);
		iconWidthUnit = iconWidth.match(reNumUnit)[2];
		iconWidth = parseFloat(iconWidth, 10);
		levelOfsUnit = levelOfs.match(reNumUnit)[2];
		if( iconSpacingUnit !== iconWidthUnit || levelOfsUnit !== iconWidthUnit || labelSpacingUnit !== iconWidthUnit ) {
			$.error("iconWidth, iconSpacing, and levelOfs must have the same css measure unit");
		}
		this._local.measureUnit = iconWidthUnit;
		this._local.levelOfs = parseFloat(levelOfs);
		this._local.lineOfs = (1 + (ctx.options.checkbox ? 1 : 0) +
				(ctx.options.icon === false ? 0 : 1)) * (iconWidth + iconSpacing) +
				iconSpacing;
		this._local.labelOfs = labelSpacing;
		this._local.maxDepth = 10;

		// Get/Set a unique Id on the container (if not already exists)
		containerId = this.$container.uniqueId().attr("id");
		// Generated css rules for some levels (extended on demand)
		cssText = renderLevelCss(containerId, this._local.maxDepth,
			this._local.levelOfs, this._local.lineOfs, this._local.labelOfs,
			this._local.measureUnit);
		defineHeadStyleElement(containerId, cssText);
	},
	treeDestroy: function(ctx){
		// Remove generated css rules
		defineHeadStyleElement(this.$container.attr("id"), null);
		return this._superApply(arguments);
	},
	nodeRenderStatus: function(ctx) {
		var containerId, cssText, res,
			node = ctx.node,
			level = node.getLevel();

		res = this._super(ctx);
		// Generate some more level-n rules if required
		if( level > this._local.maxDepth ) {
			containerId = this.$container.attr("id");
			this._local.maxDepth *= 2;
			node.debug("Define global ext-wide css up to level " + this._local.maxDepth);
			cssText = renderLevelCss(containerId, this._local.maxDepth,
				this._local.levelOfs, this._local.lineOfs, this._local.labelSpacing,
				this._local.measureUnit);
			defineHeadStyleElement(containerId, cssText);
		}
		// Add level-n class to apply indentation padding.
		// (Setting element style would not work, since it cannot easily be
		// overriden while animations run)
		$(node.span).addClass("fancytree-level-" + level);
		return res;
	}
});
}(jQuery, window, document));
