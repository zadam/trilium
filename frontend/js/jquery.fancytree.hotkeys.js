/**!
 * jquery.fancytree.hotkeys.js
 *
 * Integrate the 'jQuery.Hotkeys' plugin as Fancytree extension:
 * https://github.com/jeresig/jquery.hotkeys/
 *
 * Copyright (c) 2008-2017, Martin Wendt (http://wwWendt.de)
 * Released under the MIT license
 * https://github.com/mar10/fancytree/wiki/LicenseInfo
 */
(function($, document) {
	"use strict";

	var initHotkeys = function(tree, data) {
		$.each(data, function(event, keys) {
			$.each(keys, function(key, handler) {
				$(tree.$container).on(event, null, key, function(evt) {
					var node = tree.getActiveNode();
					return handler(node, evt);
                    // return false from the handler will stop default handling.
				});
			});
		});
	};

	$.ui.fancytree.registerExtension({
		name: "hotkeys",
		version: "@VERSION",
		hotkeys: { },
		treeInit: function(ctx) {
			this._superApply(arguments);
			initHotkeys(this, ctx.options.hotkeys);
		}
	});
}(jQuery, document));
