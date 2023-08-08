// Extending Fancytree
// ===================
//
// See also the [live demo](https://wwWendt.de/tech/fancytree/demo/sample-ext-childcounter.html) of this code.
//
// Every extension should have a comment header containing some information
// about the author, copyright and licensing. Also a pointer to the latest
// source code.
// Prefix with `/*!` so the comment is not removed by the minifier.

/*!
 * jquery.fancytree.childcounter.js
 *
 * Add a child counter bubble to tree nodes.
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

// To keep the global namespace clean, we wrap everything in a closure.
// The UMD wrapper pattern defines the dependencies on jQuery and the
// Fancytree core module, and makes sure that we can use the `require()`
// syntax with package loaders.

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
	// Consider to use [strict mode](http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/)
	"use strict";

	// The [coding guidelines](http://contribute.jquery.org/style-guide/js/)
	// require jshint /eslint compliance.
	// But for this sample, we want to allow unused variables for demonstration purpose.

	/*eslint-disable no-unused-vars */

	// Adding methods
	// --------------

	// New member functions can be added to the `Fancytree` class.
	// This function will be available for every tree instance:
	//
	//     var tree = $.ui.fancytree.getTree("#tree");
	//     tree.countSelected(false);

	$.ui.fancytree._FancytreeClass.prototype.countSelected = function (
		topOnly
	) {
		var tree = this,
			treeOptions = tree.options;

		return tree.getSelectedNodes(topOnly).length;
	};

	// The `FancytreeNode` class can also be easily extended. This would be called
	// like
	//     node.updateCounters();
	//
	// It is also good practice to add a docstring comment.
	/**
	 * [ext-childcounter] Update counter badges for `node` and its parents.
	 * May be called in the `loadChildren` event, to update parents of lazy loaded
	 * nodes.
	 * @alias FancytreeNode#updateCounters
	 * @requires jquery.fancytree.childcounters.js
	 */
	$.ui.fancytree._FancytreeNodeClass.prototype.updateCounters = function () {
		var node = this,
			$badge = $("span.fancytree-childcounter", node.span),
			extOpts = node.tree.options.childcounter,
			count = node.countChildren(extOpts.deep);

		node.data.childCounter = count;
		if (
			(count || !extOpts.hideZeros) &&
			(!node.isExpanded() || !extOpts.hideExpanded)
		) {
			if (!$badge.length) {
				$badge = $("<span class='fancytree-childcounter'/>").appendTo(
					$(
						"span.fancytree-icon,span.fancytree-custom-icon",
						node.span
					)
				);
			}
			$badge.text(count);
		} else {
			$badge.remove();
		}
		if (extOpts.deep && !node.isTopLevel() && !node.isRootNode()) {
			node.parent.updateCounters();
		}
	};

	// Finally, we can extend the widget API and create functions that are called
	// like so:
	//
	//     $("#tree").fancytree("widgetMethod1", "abc");

	$.ui.fancytree.prototype.widgetMethod1 = function (arg1) {
		var tree = this.tree;
		return arg1;
	};

	// Register a Fancytree extension
	// ------------------------------
	// A full blown extension, extension is available for all trees and can be
	// enabled like so (see also the [live demo](https://wwWendt.de/tech/fancytree/demo/sample-ext-childcounter.html)):
	//
	//    <script src="../src/jquery.fancytree.js"></script>
	//    <script src="../src/jquery.fancytree.childcounter.js"></script>
	//    ...
	//
	//     $("#tree").fancytree({
	//         extensions: ["childcounter"],
	//         childcounter: {
	//             hideExpanded: true
	//         },
	//         ...
	//     });
	//

	/* 'childcounter' extension */
	$.ui.fancytree.registerExtension({
		// Every extension must be registered by a unique name.
		name: "childcounter",
		// Version information should be compliant with [semver](http://semver.org)
		version: "2.38.3",

		// Extension specific options and their defaults.
		// This options will be available as `tree.options.childcounter.hideExpanded`

		options: {
			deep: true,
			hideZeros: true,
			hideExpanded: false,
		},

		// Attributes other than `options` (or functions) can be defined here, and
		// will be added to the tree.ext.EXTNAME namespace, in this case `tree.ext.childcounter.foo`.
		// They can also be accessed as `this._local.foo` from within the extension
		// methods.
		foo: 42,

		// Local functions are prefixed with an underscore '_'.
		// Callable as `this._local._appendCounter()`.

		_appendCounter: function (bar) {
			var tree = this;
		},

		// **Override virtual methods for this extension.**
		//
		// Fancytree implements a number of 'hook methods', prefixed by 'node...' or 'tree...'.
		// with a `ctx` argument (see [EventData](https://wwWendt.de/tech/fancytree/doc/jsdoc/global.html#EventData)
		// for details) and an extended calling context:<br>
		// `this`       : the Fancytree instance<br>
		// `this._local`: the namespace that contains extension attributes and private methods (same as this.ext.EXTNAME)<br>
		// `this._super`: the virtual function that was overridden (member of previous extension or Fancytree)
		//
		// See also the [complete list of available hook functions](https://wwWendt.de/tech/fancytree/doc/jsdoc/Fancytree_Hooks.html).

		/* Init */
		// `treeInit` is triggered when a tree is initalized. We can set up classes or
		// bind event handlers here...
		treeInit: function (ctx) {
			var tree = this, // same as ctx.tree,
				opts = ctx.options,
				extOpts = ctx.options.childcounter;
			// Optionally check for dependencies with other extensions
			/* this._requireExtension("glyph", false, false); */
			// Call the base implementation
			this._superApply(arguments);
			// Add a class to the tree container
			this.$container.addClass("fancytree-ext-childcounter");
		},

		// Destroy this tree instance (we only call the default implementation, so
		// this method could as well be omitted).

		treeDestroy: function (ctx) {
			this._superApply(arguments);
		},

		// Overload the `renderTitle` hook, to append a counter badge
		nodeRenderTitle: function (ctx, title) {
			var node = ctx.node,
				extOpts = ctx.options.childcounter,
				count =
					node.data.childCounter == null
						? node.countChildren(extOpts.deep)
						: +node.data.childCounter;
			// Let the base implementation render the title
			// We use `_super()` instead of `_superApply()` here, since it is a little bit
			// more performant when called often
			this._super(ctx, title);
			// Append a counter badge
			if (
				(count || !extOpts.hideZeros) &&
				(!node.isExpanded() || !extOpts.hideExpanded)
			) {
				$(
					"span.fancytree-icon,span.fancytree-custom-icon",
					node.span
				).append(
					$("<span class='fancytree-childcounter'/>").text(count)
				);
			}
		},
		// Overload the `setExpanded` hook, so the counters are updated
		nodeSetExpanded: function (ctx, flag, callOpts) {
			var tree = ctx.tree,
				node = ctx.node;
			// Let the base implementation expand/collapse the node, then redraw the title
			// after the animation has finished
			return this._superApply(arguments).always(function () {
				tree.nodeRenderTitle(ctx);
			});
		},

		// End of extension definition
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
