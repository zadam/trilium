/*!
 * jquery.fancytree.select.js
 *
 * Configurable support for hierarchical selection.
 * (Extension module for jquery.fancytree.js: https://github.com/mar10/fancytree/)
 *
 * Copyright (c) 2008-2017, Martin Wendt (http://wwWendt.de)
 *
 * Released under the MIT license
 * https://github.com/mar10/fancytree/wiki/LicenseInfo
 *
 * @version 2.23.0
 * @date 2017-05-27T20:09:38Z
 */

;(function($, window, document, undefined) {

"use strict";


/*******************************************************************************
 * Private functions and variables
 */

// var escapeHtml = $.ui.fancytree.escapeHtml;


/*******************************************************************************
 * Extension code
 */
$.ui.fancytree.registerExtension({
	name: "select",
	version: "2.23.0",
	// Default options for this extension.
	options: {
		checkboxIcon: true   // bool | "radio" | function
	},
	treeInit: function(ctx){
		// gridnav requires the table extension to be loaded before itself
		// this._requireExtension("table", true, true);
		this._superApply(arguments);

		this.$container.addClass("fancytree-ext-select");
	},
	nodeLoadChildren: function(ctx, source) {
		return this._superApply(arguments).done(function() {
			// TODO
		});
	},
	nodeSetSelected: function(ctx, flag, callOpts) {
		return this._superApply(arguments);
	}
});
}(jQuery, window, document));
