/*!
 * jquery.fancytree.js
 * Tree view control with support for lazy loading and much more.
 * https://github.com/mar10/fancytree/
 *
 * Copyright (c) 2008-2023, Martin Wendt (https://wwWendt.de)
 * Released under the MIT license
 * https://github.com/mar10/fancytree/wiki/LicenseInfo
 *
 * @version 2.38.3
 * @date 2023-02-01T20:52:50Z
 */

/** Core Fancytree module.
 */

// UMD wrapper for the Fancytree core module
(function (factory) {
	if (typeof define === "function" && define.amd) {
		// AMD. Register as an anonymous module.
		define(["jquery", "./jquery.fancytree.ui-deps"], factory);
	} else if (typeof module === "object" && module.exports) {
		// Node/CommonJS
		require("./jquery.fancytree.ui-deps");
		module.exports = factory(require("jquery"));
	} else {
		// Browser globals
		factory(jQuery);
	}
})(function ($) {
	"use strict";

	// prevent duplicate loading
	if ($.ui && $.ui.fancytree) {
		$.ui.fancytree.warn("Fancytree: ignored duplicate include");
		return;
	}

	/******************************************************************************
	 * Private functions and variables
	 */

	var i,
		attr,
		FT = null, // initialized below
		TEST_IMG = new RegExp(/\.|\//), // strings are considered image urls if they contain '.' or '/'
		REX_HTML = /[&<>"'/]/g, // Escape those characters
		REX_TOOLTIP = /[<>"'/]/g, // Don't escape `&` in tooltips
		RECURSIVE_REQUEST_ERROR = "$recursive_request",
		INVALID_REQUEST_TARGET_ERROR = "$request_target_invalid",
		ENTITY_MAP = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
			"/": "&#x2F;",
		},
		IGNORE_KEYCODES = { 16: true, 17: true, 18: true },
		SPECIAL_KEYCODES = {
			8: "backspace",
			9: "tab",
			10: "return",
			13: "return",
			// 16: null, 17: null, 18: null,  // ignore shift, ctrl, alt
			19: "pause",
			20: "capslock",
			27: "esc",
			32: "space",
			33: "pageup",
			34: "pagedown",
			35: "end",
			36: "home",
			37: "left",
			38: "up",
			39: "right",
			40: "down",
			45: "insert",
			46: "del",
			59: ";",
			61: "=",
			// 91: null, 93: null,  // ignore left and right meta
			96: "0",
			97: "1",
			98: "2",
			99: "3",
			100: "4",
			101: "5",
			102: "6",
			103: "7",
			104: "8",
			105: "9",
			106: "*",
			107: "+",
			109: "-",
			110: ".",
			111: "/",
			112: "f1",
			113: "f2",
			114: "f3",
			115: "f4",
			116: "f5",
			117: "f6",
			118: "f7",
			119: "f8",
			120: "f9",
			121: "f10",
			122: "f11",
			123: "f12",
			144: "numlock",
			145: "scroll",
			173: "-",
			186: ";",
			187: "=",
			188: ",",
			189: "-",
			190: ".",
			191: "/",
			192: "`",
			219: "[",
			220: "\\",
			221: "]",
			222: "'",
		},
		MODIFIERS = {
			16: "shift",
			17: "ctrl",
			18: "alt",
			91: "meta",
			93: "meta",
		},
		MOUSE_BUTTONS = { 0: "", 1: "left", 2: "middle", 3: "right" },
		// Boolean attributes that can be set with equivalent class names in the LI tags
		// Note: v2.23: checkbox and hideCheckbox are *not* in this list
		CLASS_ATTRS =
			"active expanded focus folder lazy radiogroup selected unselectable unselectableIgnore".split(
				" "
			),
		CLASS_ATTR_MAP = {},
		// Top-level Fancytree attributes, that can be set by dict
		TREE_ATTRS = "columns types".split(" "),
		// TREE_ATTR_MAP = {},
		// Top-level FancytreeNode attributes, that can be set by dict
		NODE_ATTRS =
			"checkbox expanded extraClasses folder icon iconTooltip key lazy partsel radiogroup refKey selected statusNodeType title tooltip type unselectable unselectableIgnore unselectableStatus".split(
				" "
			),
		NODE_ATTR_MAP = {},
		// Mapping of lowercase -> real name (because HTML5 data-... attribute only supports lowercase)
		NODE_ATTR_LOWERCASE_MAP = {},
		// Attribute names that should NOT be added to node.data
		NONE_NODE_DATA_MAP = {
			active: true,
			children: true,
			data: true,
			focus: true,
		};

	for (i = 0; i < CLASS_ATTRS.length; i++) {
		CLASS_ATTR_MAP[CLASS_ATTRS[i]] = true;
	}
	for (i = 0; i < NODE_ATTRS.length; i++) {
		attr = NODE_ATTRS[i];
		NODE_ATTR_MAP[attr] = true;
		if (attr !== attr.toLowerCase()) {
			NODE_ATTR_LOWERCASE_MAP[attr.toLowerCase()] = attr;
		}
	}
	// for(i=0; i<TREE_ATTRS.length; i++) {
	// 	TREE_ATTR_MAP[TREE_ATTRS[i]] = true;
	// }

	function _assert(cond, msg) {
		// TODO: see qunit.js extractStacktrace()
		if (!cond) {
			msg = msg ? ": " + msg : "";
			msg = "Fancytree assertion failed" + msg;

			// consoleApply("assert", [!!cond, msg]);

			// #1041: Raised exceptions may not be visible in the browser
			// console if inside promise chains, so we also print directly:
			$.ui.fancytree.error(msg);

			// Throw exception:
			$.error(msg);
		}
	}

	function _hasProp(object, property) {
		return Object.prototype.hasOwnProperty.call(object, property);
	}

	/* Replacement for the deprecated `jQuery.isFunction()`. */
	function _isFunction(obj) {
		return typeof obj === "function";
	}

	/* Replacement for the deprecated `jQuery.trim()`. */
	function _trim(text) {
		return text == null ? "" : text.trim();
	}

	/* Replacement for the deprecated `jQuery.isArray()`. */
	var _isArray = Array.isArray;

	_assert($.ui, "Fancytree requires jQuery UI (http://jqueryui.com)");

	function consoleApply(method, args) {
		var i,
			s,
			fn = window.console ? window.console[method] : null;

		if (fn) {
			try {
				fn.apply(window.console, args);
			} catch (e) {
				// IE 8?
				s = "";
				for (i = 0; i < args.length; i++) {
					s += args[i];
				}
				fn(s);
			}
		}
	}

	/* support: IE8 Polyfil for Date.now() */
	if (!Date.now) {
		Date.now = function now() {
			return new Date().getTime();
		};
	}

	/*Return true if x is a FancytreeNode.*/
	function _isNode(x) {
		return !!(x.tree && x.statusNodeType !== undefined);
	}

	/** Return true if dotted version string is equal or higher than requested version.
	 *
	 * See http://jsfiddle.net/mar10/FjSAN/
	 */
	function isVersionAtLeast(dottedVersion, major, minor, patch) {
		var i,
			v,
			t,
			verParts = $.map(_trim(dottedVersion).split("."), function (e) {
				return parseInt(e, 10);
			}),
			testParts = $.map(
				Array.prototype.slice.call(arguments, 1),
				function (e) {
					return parseInt(e, 10);
				}
			);

		for (i = 0; i < testParts.length; i++) {
			v = verParts[i] || 0;
			t = testParts[i] || 0;
			if (v !== t) {
				return v > t;
			}
		}
		return true;
	}

	/**
	 * Deep-merge a list of objects (but replace array-type options).
	 *
	 * jQuery's $.extend(true, ...) method does a deep merge, that also merges Arrays.
	 * This variant is used to merge extension defaults with user options, and should
	 * merge objects, but override arrays (for example the `triggerStart: [...]` option
	 * of ext-edit). Also `null` values are copied over and not skipped.
	 *
	 * See issue #876
	 *
	 * Example:
	 * _simpleDeepMerge({}, o1, o2);
	 */
	function _simpleDeepMerge() {
		var options,
			name,
			src,
			copy,
			clone,
			target = arguments[0] || {},
			i = 1,
			length = arguments.length;

		// Handle case when target is a string or something (possible in deep copy)
		if (typeof target !== "object" && !_isFunction(target)) {
			target = {};
		}
		if (i === length) {
			throw Error("need at least two args");
		}
		for (; i < length; i++) {
			// Only deal with non-null/undefined values
			if ((options = arguments[i]) != null) {
				// Extend the base object
				for (name in options) {
					if (_hasProp(options, name)) {
						src = target[name];
						copy = options[name];
						// Prevent never-ending loop
						if (target === copy) {
							continue;
						}
						// Recurse if we're merging plain objects
						// (NOTE: unlike $.extend, we don't merge arrays, but replace them)
						if (copy && $.isPlainObject(copy)) {
							clone = src && $.isPlainObject(src) ? src : {};
							// Never move original objects, clone them
							target[name] = _simpleDeepMerge(clone, copy);
							// Don't bring in undefined values
						} else if (copy !== undefined) {
							target[name] = copy;
						}
					}
				}
			}
		}
		// Return the modified object
		return target;
	}

	/** Return a wrapper that calls sub.methodName() and exposes
	 *  this             : tree
	 *  this._local      : tree.ext.EXTNAME
	 *  this._super      : base.methodName.call()
	 *  this._superApply : base.methodName.apply()
	 */
	function _makeVirtualFunction(methodName, tree, base, extension, extName) {
		// $.ui.fancytree.debug("_makeVirtualFunction", methodName, tree, base, extension, extName);
		// if(rexTestSuper && !rexTestSuper.test(func)){
		//     // extension.methodName() doesn't call _super(), so no wrapper required
		//     return func;
		// }
		// Use an immediate function as closure
		var proxy = (function () {
			var prevFunc = tree[methodName], // org. tree method or prev. proxy
				baseFunc = extension[methodName], //
				_local = tree.ext[extName],
				_super = function () {
					return prevFunc.apply(tree, arguments);
				},
				_superApply = function (args) {
					return prevFunc.apply(tree, args);
				};

			// Return the wrapper function
			return function () {
				var prevLocal = tree._local,
					prevSuper = tree._super,
					prevSuperApply = tree._superApply;

				try {
					tree._local = _local;
					tree._super = _super;
					tree._superApply = _superApply;
					return baseFunc.apply(tree, arguments);
				} finally {
					tree._local = prevLocal;
					tree._super = prevSuper;
					tree._superApply = prevSuperApply;
				}
			};
		})(); // end of Immediate Function
		return proxy;
	}

	/**
	 * Subclass `base` by creating proxy functions
	 */
	function _subclassObject(tree, base, extension, extName) {
		// $.ui.fancytree.debug("_subclassObject", tree, base, extension, extName);
		for (var attrName in extension) {
			if (typeof extension[attrName] === "function") {
				if (typeof tree[attrName] === "function") {
					// override existing method
					tree[attrName] = _makeVirtualFunction(
						attrName,
						tree,
						base,
						extension,
						extName
					);
				} else if (attrName.charAt(0) === "_") {
					// Create private methods in tree.ext.EXTENSION namespace
					tree.ext[extName][attrName] = _makeVirtualFunction(
						attrName,
						tree,
						base,
						extension,
						extName
					);
				} else {
					$.error(
						"Could not override tree." +
							attrName +
							". Use prefix '_' to create tree." +
							extName +
							"._" +
							attrName
					);
				}
			} else {
				// Create member variables in tree.ext.EXTENSION namespace
				if (attrName !== "options") {
					tree.ext[extName][attrName] = extension[attrName];
				}
			}
		}
	}

	function _getResolvedPromise(context, argArray) {
		if (context === undefined) {
			return $.Deferred(function () {
				this.resolve();
			}).promise();
		}
		return $.Deferred(function () {
			this.resolveWith(context, argArray);
		}).promise();
	}

	function _getRejectedPromise(context, argArray) {
		if (context === undefined) {
			return $.Deferred(function () {
				this.reject();
			}).promise();
		}
		return $.Deferred(function () {
			this.rejectWith(context, argArray);
		}).promise();
	}

	function _makeResolveFunc(deferred, context) {
		return function () {
			deferred.resolveWith(context);
		};
	}

	function _getElementDataAsDict($el) {
		// Evaluate 'data-NAME' attributes with special treatment for 'data-json'.
		var d = $.extend({}, $el.data()),
			json = d.json;

		delete d.fancytree; // added to container by widget factory (old jQuery UI)
		delete d.uiFancytree; // added to container by widget factory

		if (json) {
			delete d.json;
			// <li data-json='...'> is already returned as object (http://api.jquery.com/data/#data-html5)
			d = $.extend(d, json);
		}
		return d;
	}

	function _escapeTooltip(s) {
		return ("" + s).replace(REX_TOOLTIP, function (s) {
			return ENTITY_MAP[s];
		});
	}

	// TODO: use currying
	function _makeNodeTitleMatcher(s) {
		s = s.toLowerCase();
		return function (node) {
			return node.title.toLowerCase().indexOf(s) >= 0;
		};
	}

	function _makeNodeTitleStartMatcher(s) {
		var reMatch = new RegExp("^" + s, "i");
		return function (node) {
			return reMatch.test(node.title);
		};
	}

	/******************************************************************************
	 * FancytreeNode
	 */

	/**
	 * Creates a new FancytreeNode
	 *
	 * @class FancytreeNode
	 * @classdesc A FancytreeNode represents the hierarchical data model and operations.
	 *
	 * @param {FancytreeNode} parent
	 * @param {NodeData} obj
	 *
	 * @property {Fancytree} tree The tree instance
	 * @property {FancytreeNode} parent The parent node
	 * @property {string} key Node id (must be unique inside the tree)
	 * @property {string} title Display name (may contain HTML)
	 * @property {object} data Contains all extra data that was passed on node creation
	 * @property {FancytreeNode[] | null | undefined} children Array of child nodes.<br>
	 *     For lazy nodes, null or undefined means 'not yet loaded'. Use an empty array
	 *     to define a node that has no children.
	 * @property {boolean} expanded Use isExpanded(), setExpanded() to access this property.
	 * @property {string} extraClasses Additional CSS classes, added to the node's `<span>`.<br>
	 *     Note: use `node.add/remove/toggleClass()` to modify.
	 * @property {boolean} folder Folder nodes have different default icons and click behavior.<br>
	 *     Note: Also non-folders may have children.
	 * @property {string} statusNodeType null for standard nodes. Otherwise type of special system node: 'error', 'loading', 'nodata', or 'paging'.
	 * @property {boolean} lazy True if this node is loaded on demand, i.e. on first expansion.
	 * @property {boolean} selected Use isSelected(), setSelected() to access this property.
	 * @property {string} tooltip Alternative description used as hover popup
	 * @property {string} iconTooltip Description used as hover popup for icon. @since 2.27
	 * @property {string} type Node type, used with tree.types map. @since 2.27
	 */
	function FancytreeNode(parent, obj) {
		var i, l, name, cl;

		this.parent = parent;
		this.tree = parent.tree;
		this.ul = null;
		this.li = null; // <li id='key' ftnode=this> tag
		this.statusNodeType = null; // if this is a temp. node to display the status of its parent
		this._isLoading = false; // if this node itself is loading
		this._error = null; // {message: '...'} if a load error occurred
		this.data = {};

		// TODO: merge this code with node.toDict()
		// copy attributes from obj object
		for (i = 0, l = NODE_ATTRS.length; i < l; i++) {
			name = NODE_ATTRS[i];
			this[name] = obj[name];
		}
		// unselectableIgnore and unselectableStatus imply unselectable
		if (
			this.unselectableIgnore != null ||
			this.unselectableStatus != null
		) {
			this.unselectable = true;
		}
		if (obj.hideCheckbox) {
			$.error(
				"'hideCheckbox' node option was removed in v2.23.0: use 'checkbox: false'"
			);
		}
		// node.data += obj.data
		if (obj.data) {
			$.extend(this.data, obj.data);
		}
		// Copy all other attributes to this.data.NAME
		for (name in obj) {
			if (
				!NODE_ATTR_MAP[name] &&
				(this.tree.options.copyFunctionsToData ||
					!_isFunction(obj[name])) &&
				!NONE_NODE_DATA_MAP[name]
			) {
				// node.data.NAME = obj.NAME
				this.data[name] = obj[name];
			}
		}

		// Fix missing key
		if (this.key == null) {
			// test for null OR undefined
			if (this.tree.options.defaultKey) {
				this.key = "" + this.tree.options.defaultKey(this);
				_assert(this.key, "defaultKey() must return a unique key");
			} else {
				this.key = "_" + FT._nextNodeKey++;
			}
		} else {
			this.key = "" + this.key; // Convert to string (#217)
		}

		// Fix tree.activeNode
		// TODO: not elegant: we use obj.active as marker to set tree.activeNode
		// when loading from a dictionary.
		if (obj.active) {
			_assert(
				this.tree.activeNode === null,
				"only one active node allowed"
			);
			this.tree.activeNode = this;
		}
		if (obj.selected) {
			// #186
			this.tree.lastSelectedNode = this;
		}
		// TODO: handle obj.focus = true

		// Create child nodes
		cl = obj.children;
		if (cl) {
			if (cl.length) {
				this._setChildren(cl);
			} else {
				// if an empty array was passed for a lazy node, keep it, in order to mark it 'loaded'
				this.children = this.lazy ? [] : null;
			}
		} else {
			this.children = null;
		}
		// Add to key/ref map (except for root node)
		//	if( parent ) {
		this.tree._callHook("treeRegisterNode", this.tree, true, this);
		//	}
	}

	FancytreeNode.prototype = /** @lends FancytreeNode# */ {
		/* Return the direct child FancytreeNode with a given key, index. */
		_findDirectChild: function (ptr) {
			var i,
				l,
				cl = this.children;

			if (cl) {
				if (typeof ptr === "string") {
					for (i = 0, l = cl.length; i < l; i++) {
						if (cl[i].key === ptr) {
							return cl[i];
						}
					}
				} else if (typeof ptr === "number") {
					return this.children[ptr];
				} else if (ptr.parent === this) {
					return ptr;
				}
			}
			return null;
		},
		// TODO: activate()
		// TODO: activateSilently()
		/* Internal helper called in recursive addChildren sequence.*/
		_setChildren: function (children) {
			_assert(
				children && (!this.children || this.children.length === 0),
				"only init supported"
			);
			this.children = [];
			for (var i = 0, l = children.length; i < l; i++) {
				this.children.push(new FancytreeNode(this, children[i]));
			}
			this.tree._callHook(
				"treeStructureChanged",
				this.tree,
				"setChildren"
			);
		},
		/**
		 * Append (or insert) a list of child nodes.
		 *
		 * @param {NodeData[]} children array of child node definitions (also single child accepted)
		 * @param {FancytreeNode | string | Integer} [insertBefore] child node (or key or index of such).
		 *     If omitted, the new children are appended.
		 * @returns {FancytreeNode} first child added
		 *
		 * @see FancytreeNode#applyPatch
		 */
		addChildren: function (children, insertBefore) {
			var i,
				l,
				pos,
				origFirstChild = this.getFirstChild(),
				origLastChild = this.getLastChild(),
				firstNode = null,
				nodeList = [];

			if ($.isPlainObject(children)) {
				children = [children];
			}
			if (!this.children) {
				this.children = [];
			}
			for (i = 0, l = children.length; i < l; i++) {
				nodeList.push(new FancytreeNode(this, children[i]));
			}
			firstNode = nodeList[0];
			if (insertBefore == null) {
				this.children = this.children.concat(nodeList);
			} else {
				// Returns null if insertBefore is not a direct child:
				insertBefore = this._findDirectChild(insertBefore);
				pos = $.inArray(insertBefore, this.children);
				_assert(pos >= 0, "insertBefore must be an existing child");
				// insert nodeList after children[pos]
				this.children.splice.apply(
					this.children,
					[pos, 0].concat(nodeList)
				);
			}
			if (origFirstChild && !insertBefore) {
				// #708: Fast path -- don't render every child of root, just the new ones!
				// #723, #729: but only if it's appended to an existing child list
				for (i = 0, l = nodeList.length; i < l; i++) {
					nodeList[i].render(); // New nodes were never rendered before
				}
				// Adjust classes where status may have changed
				// Has a first child
				if (origFirstChild !== this.getFirstChild()) {
					// Different first child -- recompute classes
					origFirstChild.renderStatus();
				}
				if (origLastChild !== this.getLastChild()) {
					// Different last child -- recompute classes
					origLastChild.renderStatus();
				}
			} else if (!this.parent || this.parent.ul || this.tr) {
				// render if the parent was rendered (or this is a root node)
				this.render();
			}
			if (this.tree.options.selectMode === 3) {
				this.fixSelection3FromEndNodes();
			}
			this.triggerModifyChild(
				"add",
				nodeList.length === 1 ? nodeList[0] : null
			);
			return firstNode;
		},
		/**
		 * Add class to node's span tag and to .extraClasses.
		 *
		 * @param {string} className class name
		 *
		 * @since 2.17
		 */
		addClass: function (className) {
			return this.toggleClass(className, true);
		},
		/**
		 * Append or prepend a node, or append a child node.
		 *
		 * This a convenience function that calls addChildren()
		 *
		 * @param {NodeData} node node definition
		 * @param {string} [mode=child] 'before', 'after', 'firstChild', or 'child' ('over' is a synonym for 'child')
		 * @returns {FancytreeNode} new node
		 */
		addNode: function (node, mode) {
			if (mode === undefined || mode === "over") {
				mode = "child";
			}
			switch (mode) {
				case "after":
					return this.getParent().addChildren(
						node,
						this.getNextSibling()
					);
				case "before":
					return this.getParent().addChildren(node, this);
				case "firstChild":
					// Insert before the first child if any
					var insertBefore = this.children ? this.children[0] : null;
					return this.addChildren(node, insertBefore);
				case "child":
				case "over":
					return this.addChildren(node);
			}
			_assert(false, "Invalid mode: " + mode);
		},
		/**Add child status nodes that indicate 'More...', etc.
		 *
		 * This also maintains the node's `partload` property.
		 * @param {boolean|object} node optional node definition. Pass `false` to remove all paging nodes.
		 * @param {string} [mode='child'] 'child'|firstChild'
		 * @since 2.15
		 */
		addPagingNode: function (node, mode) {
			var i, n;

			mode = mode || "child";
			if (node === false) {
				for (i = this.children.length - 1; i >= 0; i--) {
					n = this.children[i];
					if (n.statusNodeType === "paging") {
						this.removeChild(n);
					}
				}
				this.partload = false;
				return;
			}
			node = $.extend(
				{
					title: this.tree.options.strings.moreData,
					statusNodeType: "paging",
					icon: false,
				},
				node
			);
			this.partload = true;
			return this.addNode(node, mode);
		},
		/**
		 * Append new node after this.
		 *
		 * This a convenience function that calls addNode(node, 'after')
		 *
		 * @param {NodeData} node node definition
		 * @returns {FancytreeNode} new node
		 */
		appendSibling: function (node) {
			return this.addNode(node, "after");
		},
		/**
		 * (experimental) Apply a modification (or navigation) operation.
		 *
		 * @param {string} cmd
		 * @param {object} [opts]
		 * @see Fancytree#applyCommand
		 * @since 2.32
		 */
		applyCommand: function (cmd, opts) {
			return this.tree.applyCommand(cmd, this, opts);
		},
		/**
		 * Modify existing child nodes.
		 *
		 * @param {NodePatch} patch
		 * @returns {$.Promise}
		 * @see FancytreeNode#addChildren
		 */
		applyPatch: function (patch) {
			// patch [key, null] means 'remove'
			if (patch === null) {
				this.remove();
				return _getResolvedPromise(this);
			}
			// TODO: make sure that root node is not collapsed or modified
			// copy (most) attributes to node.ATTR or node.data.ATTR
			var name,
				promise,
				v,
				IGNORE_MAP = { children: true, expanded: true, parent: true }; // TODO: should be global

			for (name in patch) {
				if (_hasProp(patch, name)) {
					v = patch[name];
					if (!IGNORE_MAP[name] && !_isFunction(v)) {
						if (NODE_ATTR_MAP[name]) {
							this[name] = v;
						} else {
							this.data[name] = v;
						}
					}
				}
			}
			// Remove and/or create children
			if (_hasProp(patch, "children")) {
				this.removeChildren();
				if (patch.children) {
					// only if not null and not empty list
					// TODO: addChildren instead?
					this._setChildren(patch.children);
				}
				// TODO: how can we APPEND or INSERT child nodes?
			}
			if (this.isVisible()) {
				this.renderTitle();
				this.renderStatus();
			}
			// Expand collapse (final step, since this may be async)
			if (_hasProp(patch, "expanded")) {
				promise = this.setExpanded(patch.expanded);
			} else {
				promise = _getResolvedPromise(this);
			}
			return promise;
		},
		/** Collapse all sibling nodes.
		 * @returns {$.Promise}
		 */
		collapseSiblings: function () {
			return this.tree._callHook("nodeCollapseSiblings", this);
		},
		/** Copy this node as sibling or child of `node`.
		 *
		 * @param {FancytreeNode} node source node
		 * @param {string} [mode=child] 'before' | 'after' | 'child'
		 * @param {Function} [map] callback function(NodeData, FancytreeNode) that could modify the new node
		 * @returns {FancytreeNode} new
		 */
		copyTo: function (node, mode, map) {
			return node.addNode(this.toDict(true, map), mode);
		},
		/** Count direct and indirect children.
		 *
		 * @param {boolean} [deep=true] pass 'false' to only count direct children
		 * @returns {int} number of child nodes
		 */
		countChildren: function (deep) {
			var cl = this.children,
				i,
				l,
				n;
			if (!cl) {
				return 0;
			}
			n = cl.length;
			if (deep !== false) {
				for (i = 0, l = n; i < l; i++) {
					n += cl[i].countChildren();
				}
			}
			return n;
		},
		// TODO: deactivate()
		/** Write to browser console if debugLevel >= 4 (prepending node info)
		 *
		 * @param {*} msg string or object or array of such
		 */
		debug: function (msg) {
			if (this.tree.options.debugLevel >= 4) {
				Array.prototype.unshift.call(arguments, this.toString());
				consoleApply("log", arguments);
			}
		},
		/** Deprecated.
		 * @deprecated since 2014-02-16. Use resetLazy() instead.
		 */
		discard: function () {
			this.warn(
				"FancytreeNode.discard() is deprecated since 2014-02-16. Use .resetLazy() instead."
			);
			return this.resetLazy();
		},
		/** Remove DOM elements for all descendents. May be called on .collapse event
		 * to keep the DOM small.
		 * @param {boolean} [includeSelf=false]
		 */
		discardMarkup: function (includeSelf) {
			var fn = includeSelf ? "nodeRemoveMarkup" : "nodeRemoveChildMarkup";
			this.tree._callHook(fn, this);
		},
		/** Write error to browser console if debugLevel >= 1 (prepending tree info)
		 *
		 * @param {*} msg string or object or array of such
		 */
		error: function (msg) {
			if (this.tree.options.debugLevel >= 1) {
				Array.prototype.unshift.call(arguments, this.toString());
				consoleApply("error", arguments);
			}
		},
		/**Find all nodes that match condition (excluding self).
		 *
		 * @param {string | function(node)} match title string to search for, or a
		 *     callback function that returns `true` if a node is matched.
		 * @returns {FancytreeNode[]} array of nodes (may be empty)
		 */
		findAll: function (match) {
			match = _isFunction(match) ? match : _makeNodeTitleMatcher(match);
			var res = [];
			this.visit(function (n) {
				if (match(n)) {
					res.push(n);
				}
			});
			return res;
		},
		/**Find first node that matches condition (excluding self).
		 *
		 * @param {string | function(node)} match title string to search for, or a
		 *     callback function that returns `true` if a node is matched.
		 * @returns {FancytreeNode} matching node or null
		 * @see FancytreeNode#findAll
		 */
		findFirst: function (match) {
			match = _isFunction(match) ? match : _makeNodeTitleMatcher(match);
			var res = null;
			this.visit(function (n) {
				if (match(n)) {
					res = n;
					return false;
				}
			});
			return res;
		},
		/** Find a node relative to self.
		 *
		 * @param {number|string} where The keyCode that would normally trigger this move,
		 *		or a keyword ('down', 'first', 'last', 'left', 'parent', 'right', 'up').
		 * @returns {FancytreeNode}
		 * @since v2.31
		 */
		findRelatedNode: function (where, includeHidden) {
			return this.tree.findRelatedNode(this, where, includeHidden);
		},
		/* Apply selection state (internal use only) */
		_changeSelectStatusAttrs: function (state) {
			var changed = false,
				opts = this.tree.options,
				unselectable = FT.evalOption(
					"unselectable",
					this,
					this,
					opts,
					false
				),
				unselectableStatus = FT.evalOption(
					"unselectableStatus",
					this,
					this,
					opts,
					undefined
				);

			if (unselectable && unselectableStatus != null) {
				state = unselectableStatus;
			}
			switch (state) {
				case false:
					changed = this.selected || this.partsel;
					this.selected = false;
					this.partsel = false;
					break;
				case true:
					changed = !this.selected || !this.partsel;
					this.selected = true;
					this.partsel = true;
					break;
				case undefined:
					changed = this.selected || !this.partsel;
					this.selected = false;
					this.partsel = true;
					break;
				default:
					_assert(false, "invalid state: " + state);
			}
			// this.debug("fixSelection3AfterLoad() _changeSelectStatusAttrs()", state, changed);
			if (changed) {
				this.renderStatus();
			}
			return changed;
		},
		/**
		 * Fix selection status, after this node was (de)selected in multi-hier mode.
		 * This includes (de)selecting all children.
		 */
		fixSelection3AfterClick: function (callOpts) {
			var flag = this.isSelected();

			// this.debug("fixSelection3AfterClick()");

			this.visit(function (node) {
				node._changeSelectStatusAttrs(flag);
				if (node.radiogroup) {
					// #931: don't (de)select this branch
					return "skip";
				}
			});
			this.fixSelection3FromEndNodes(callOpts);
		},
		/**
		 * Fix selection status for multi-hier mode.
		 * Only end-nodes are considered to update the descendants branch and parents.
		 * Should be called after this node has loaded new children or after
		 * children have been modified using the API.
		 */
		fixSelection3FromEndNodes: function (callOpts) {
			var opts = this.tree.options;

			// this.debug("fixSelection3FromEndNodes()");
			_assert(opts.selectMode === 3, "expected selectMode 3");

			// Visit all end nodes and adjust their parent's `selected` and `partsel`
			// attributes. Return selection state true, false, or undefined.
			function _walk(node) {
				var i,
					l,
					child,
					s,
					state,
					allSelected,
					someSelected,
					unselIgnore,
					unselState,
					children = node.children;

				if (children && children.length) {
					// check all children recursively
					allSelected = true;
					someSelected = false;

					for (i = 0, l = children.length; i < l; i++) {
						child = children[i];
						// the selection state of a node is not relevant; we need the end-nodes
						s = _walk(child);
						// if( !child.unselectableIgnore ) {
						unselIgnore = FT.evalOption(
							"unselectableIgnore",
							child,
							child,
							opts,
							false
						);
						if (!unselIgnore) {
							if (s !== false) {
								someSelected = true;
							}
							if (s !== true) {
								allSelected = false;
							}
						}
					}
					// eslint-disable-next-line no-nested-ternary
					state = allSelected
						? true
						: someSelected
						? undefined
						: false;
				} else {
					// This is an end-node: simply report the status
					unselState = FT.evalOption(
						"unselectableStatus",
						node,
						node,
						opts,
						undefined
					);
					state = unselState == null ? !!node.selected : !!unselState;
				}
				// #939: Keep a `partsel` flag that was explicitly set on a lazy node
				if (
					node.partsel &&
					!node.selected &&
					node.lazy &&
					node.children == null
				) {
					state = undefined;
				}
				node._changeSelectStatusAttrs(state);
				return state;
			}
			_walk(this);

			// Update parent's state
			this.visitParents(function (node) {
				var i,
					l,
					child,
					state,
					unselIgnore,
					unselState,
					children = node.children,
					allSelected = true,
					someSelected = false;

				for (i = 0, l = children.length; i < l; i++) {
					child = children[i];
					unselIgnore = FT.evalOption(
						"unselectableIgnore",
						child,
						child,
						opts,
						false
					);
					if (!unselIgnore) {
						unselState = FT.evalOption(
							"unselectableStatus",
							child,
							child,
							opts,
							undefined
						);
						state =
							unselState == null
								? !!child.selected
								: !!unselState;
						// When fixing the parents, we trust the sibling status (i.e.
						// we don't recurse)
						if (state || child.partsel) {
							someSelected = true;
						}
						if (!state) {
							allSelected = false;
						}
					}
				}
				// eslint-disable-next-line no-nested-ternary
				state = allSelected ? true : someSelected ? undefined : false;
				node._changeSelectStatusAttrs(state);
			});
		},
		// TODO: focus()
		/**
		 * Update node data. If dict contains 'children', then also replace
		 * the hole sub tree.
		 * @param {NodeData} dict
		 *
		 * @see FancytreeNode#addChildren
		 * @see FancytreeNode#applyPatch
		 */
		fromDict: function (dict) {
			// copy all other attributes to this.data.xxx
			for (var name in dict) {
				if (NODE_ATTR_MAP[name]) {
					// node.NAME = dict.NAME
					this[name] = dict[name];
				} else if (name === "data") {
					// node.data += dict.data
					$.extend(this.data, dict.data);
				} else if (
					!_isFunction(dict[name]) &&
					!NONE_NODE_DATA_MAP[name]
				) {
					// node.data.NAME = dict.NAME
					this.data[name] = dict[name];
				}
			}
			if (dict.children) {
				// recursively set children and render
				this.removeChildren();
				this.addChildren(dict.children);
			}
			this.renderTitle();
			/*
			var children = dict.children;
			if(children === undefined){
				this.data = $.extend(this.data, dict);
				this.render();
				return;
			}
			dict = $.extend({}, dict);
			dict.children = undefined;
			this.data = $.extend(this.data, dict);
			this.removeChildren();
			this.addChild(children);
			*/
		},
		/** Return the list of child nodes (undefined for unexpanded lazy nodes).
		 * @returns {FancytreeNode[] | undefined}
		 */
		getChildren: function () {
			if (this.hasChildren() === undefined) {
				// TODO: only required for lazy nodes?
				return undefined; // Lazy node: unloaded, currently loading, or load error
			}
			return this.children;
		},
		/** Return the first child node or null.
		 * @returns {FancytreeNode | null}
		 */
		getFirstChild: function () {
			return this.children ? this.children[0] : null;
		},
		/** Return the 0-based child index.
		 * @returns {int}
		 */
		getIndex: function () {
			// return this.parent.children.indexOf(this);
			return $.inArray(this, this.parent.children); // indexOf doesn't work in IE7
		},
		/** Return the hierarchical child index (1-based, e.g. '3.2.4').
		 * @param {string} [separator="."]
		 * @param {int} [digits=1]
		 * @returns {string}
		 */
		getIndexHier: function (separator, digits) {
			separator = separator || ".";
			var s,
				res = [];
			$.each(this.getParentList(false, true), function (i, o) {
				s = "" + (o.getIndex() + 1);
				if (digits) {
					// prepend leading zeroes
					s = ("0000000" + s).substr(-digits);
				}
				res.push(s);
			});
			return res.join(separator);
		},
		/** Return the parent keys separated by options.keyPathSeparator, e.g. "/id_1/id_17/id_32".
		 *
		 * (Unlike `node.getPath()`, this method prepends a "/" and inverts the first argument.)
		 *
		 * @see FancytreeNode#getPath
		 * @param {boolean} [excludeSelf=false]
		 * @returns {string}
		 */
		getKeyPath: function (excludeSelf) {
			var sep = this.tree.options.keyPathSeparator;

			return sep + this.getPath(!excludeSelf, "key", sep);
		},
		/** Return the last child of this node or null.
		 * @returns {FancytreeNode | null}
		 */
		getLastChild: function () {
			return this.children
				? this.children[this.children.length - 1]
				: null;
		},
		/** Return node depth. 0: System root node, 1: visible top-level node, 2: first sub-level, ... .
		 * @returns {int}
		 */
		getLevel: function () {
			var level = 0,
				dtn = this.parent;
			while (dtn) {
				level++;
				dtn = dtn.parent;
			}
			return level;
		},
		/** Return the successor node (under the same parent) or null.
		 * @returns {FancytreeNode | null}
		 */
		getNextSibling: function () {
			// TODO: use indexOf, if available: (not in IE6)
			if (this.parent) {
				var i,
					l,
					ac = this.parent.children;

				for (i = 0, l = ac.length - 1; i < l; i++) {
					// up to length-2, so next(last) = null
					if (ac[i] === this) {
						return ac[i + 1];
					}
				}
			}
			return null;
		},
		/** Return the parent node (null for the system root node).
		 * @returns {FancytreeNode | null}
		 */
		getParent: function () {
			// TODO: return null for top-level nodes?
			return this.parent;
		},
		/** Return an array of all parent nodes (top-down).
		 * @param {boolean} [includeRoot=false] Include the invisible system root node.
		 * @param {boolean} [includeSelf=false] Include the node itself.
		 * @returns {FancytreeNode[]}
		 */
		getParentList: function (includeRoot, includeSelf) {
			var l = [],
				dtn = includeSelf ? this : this.parent;
			while (dtn) {
				if (includeRoot || dtn.parent) {
					l.unshift(dtn);
				}
				dtn = dtn.parent;
			}
			return l;
		},
		/** Return a string representing the hierachical node path, e.g. "a/b/c".
		 * @param {boolean} [includeSelf=true]
		 * @param {string | function} [part="title"] node property name or callback
		 * @param {string} [separator="/"]
		 * @returns {string}
		 * @since v2.31
		 */
		getPath: function (includeSelf, part, separator) {
			includeSelf = includeSelf !== false;
			part = part || "title";
			separator = separator || "/";

			var val,
				path = [],
				isFunc = _isFunction(part);

			this.visitParents(function (n) {
				if (n.parent) {
					val = isFunc ? part(n) : n[part];
					path.unshift(val);
				}
			}, includeSelf);
			return path.join(separator);
		},
		/** Return the predecessor node (under the same parent) or null.
		 * @returns {FancytreeNode | null}
		 */
		getPrevSibling: function () {
			if (this.parent) {
				var i,
					l,
					ac = this.parent.children;

				for (i = 1, l = ac.length; i < l; i++) {
					// start with 1, so prev(first) = null
					if (ac[i] === this) {
						return ac[i - 1];
					}
				}
			}
			return null;
		},
		/**
		 * Return an array of selected descendant nodes.
		 * @param {boolean} [stopOnParents=false] only return the topmost selected
		 *     node (useful with selectMode 3)
		 * @returns {FancytreeNode[]}
		 */
		getSelectedNodes: function (stopOnParents) {
			var nodeList = [];
			this.visit(function (node) {
				if (node.selected) {
					nodeList.push(node);
					if (stopOnParents === true) {
						return "skip"; // stop processing this branch
					}
				}
			});
			return nodeList;
		},
		/** Return true if node has children. Return undefined if not sure, i.e. the node is lazy and not yet loaded).
		 * @returns {boolean | undefined}
		 */
		hasChildren: function () {
			if (this.lazy) {
				if (this.children == null) {
					// null or undefined: Not yet loaded
					return undefined;
				} else if (this.children.length === 0) {
					// Loaded, but response was empty
					return false;
				} else if (
					this.children.length === 1 &&
					this.children[0].isStatusNode()
				) {
					// Currently loading or load error
					return undefined;
				}
				return true;
			}
			return !!(this.children && this.children.length);
		},
		/**
		 * Return true if node has `className` defined in .extraClasses.
		 *
		 * @param {string} className class name (separate multiple classes by space)
		 * @returns {boolean}
		 *
		 * @since 2.32
		 */
		hasClass: function (className) {
			return (
				(" " + (this.extraClasses || "") + " ").indexOf(
					" " + className + " "
				) >= 0
			);
		},
		/** Return true if node has keyboard focus.
		 * @returns {boolean}
		 */
		hasFocus: function () {
			return this.tree.hasFocus() && this.tree.focusNode === this;
		},
		/** Write to browser console if debugLevel >= 3 (prepending node info)
		 *
		 * @param {*} msg string or object or array of such
		 */
		info: function (msg) {
			if (this.tree.options.debugLevel >= 3) {
				Array.prototype.unshift.call(arguments, this.toString());
				consoleApply("info", arguments);
			}
		},
		/** Return true if node is active (see also FancytreeNode#isSelected).
		 * @returns {boolean}
		 */
		isActive: function () {
			return this.tree.activeNode === this;
		},
		/** Return true if node is vertically below `otherNode`, i.e. rendered in a subsequent row.
		 * @param {FancytreeNode} otherNode
		 * @returns {boolean}
		 * @since 2.28
		 */
		isBelowOf: function (otherNode) {
			return this.getIndexHier(".", 5) > otherNode.getIndexHier(".", 5);
		},
		/** Return true if node is a direct child of otherNode.
		 * @param {FancytreeNode} otherNode
		 * @returns {boolean}
		 */
		isChildOf: function (otherNode) {
			return this.parent && this.parent === otherNode;
		},
		/** Return true, if node is a direct or indirect sub node of otherNode.
		 * @param {FancytreeNode} otherNode
		 * @returns {boolean}
		 */
		isDescendantOf: function (otherNode) {
			if (!otherNode || otherNode.tree !== this.tree) {
				return false;
			}
			var p = this.parent;
			while (p) {
				if (p === otherNode) {
					return true;
				}
				if (p === p.parent) {
					$.error("Recursive parent link: " + p);
				}
				p = p.parent;
			}
			return false;
		},
		/** Return true if node is expanded.
		 * @returns {boolean}
		 */
		isExpanded: function () {
			return !!this.expanded;
		},
		/** Return true if node is the first node of its parent's children.
		 * @returns {boolean}
		 */
		isFirstSibling: function () {
			var p = this.parent;
			return !p || p.children[0] === this;
		},
		/** Return true if node is a folder, i.e. has the node.folder attribute set.
		 * @returns {boolean}
		 */
		isFolder: function () {
			return !!this.folder;
		},
		/** Return true if node is the last node of its parent's children.
		 * @returns {boolean}
		 */
		isLastSibling: function () {
			var p = this.parent;
			return !p || p.children[p.children.length - 1] === this;
		},
		/** Return true if node is lazy (even if data was already loaded)
		 * @returns {boolean}
		 */
		isLazy: function () {
			return !!this.lazy;
		},
		/** Return true if node is lazy and loaded. For non-lazy nodes always return true.
		 * @returns {boolean}
		 */
		isLoaded: function () {
			return !this.lazy || this.hasChildren() !== undefined; // Also checks if the only child is a status node
		},
		/** Return true if children are currently beeing loaded, i.e. a Ajax request is pending.
		 * @returns {boolean}
		 */
		isLoading: function () {
			return !!this._isLoading;
		},
		/*
		 * @deprecated since v2.4.0:  Use isRootNode() instead
		 */
		isRoot: function () {
			return this.isRootNode();
		},
		/** Return true if node is partially selected (tri-state).
		 * @returns {boolean}
		 * @since 2.23
		 */
		isPartsel: function () {
			return !this.selected && !!this.partsel;
		},
		/** (experimental) Return true if this is partially loaded.
		 * @returns {boolean}
		 * @since 2.15
		 */
		isPartload: function () {
			return !!this.partload;
		},
		/** Return true if this is the (invisible) system root node.
		 * @returns {boolean}
		 * @since 2.4
		 */
		isRootNode: function () {
			return this.tree.rootNode === this;
		},
		/** Return true if node is selected, i.e. has a checkmark set (see also FancytreeNode#isActive).
		 * @returns {boolean}
		 */
		isSelected: function () {
			return !!this.selected;
		},
		/** Return true if this node is a temporarily generated system node like
		 * 'loading', 'paging', or 'error' (node.statusNodeType contains the type).
		 * @returns {boolean}
		 */
		isStatusNode: function () {
			return !!this.statusNodeType;
		},
		/** Return true if this node is a status node of type 'paging'.
		 * @returns {boolean}
		 * @since 2.15
		 */
		isPagingNode: function () {
			return this.statusNodeType === "paging";
		},
		/** Return true if this a top level node, i.e. a direct child of the (invisible) system root node.
		 * @returns {boolean}
		 * @since 2.4
		 */
		isTopLevel: function () {
			return this.tree.rootNode === this.parent;
		},
		/** Return true if node is lazy and not yet loaded. For non-lazy nodes always return false.
		 * @returns {boolean}
		 */
		isUndefined: function () {
			return this.hasChildren() === undefined; // also checks if the only child is a status node
		},
		/** Return true if all parent nodes are expanded. Note: this does not check
		 * whether the node is scrolled into the visible part of the screen.
		 * @returns {boolean}
		 */
		isVisible: function () {
			var i,
				l,
				n,
				hasFilter = this.tree.enableFilter,
				parents = this.getParentList(false, false);

			// TODO: check $(n.span).is(":visible")
			// i.e. return false for nodes (but not parents) that are hidden
			// by a filter
			if (hasFilter && !this.match && !this.subMatchCount) {
				// this.debug( "isVisible: HIDDEN (" + hasFilter + ", " + this.match + ", " + this.match + ")" );
				return false;
			}

			for (i = 0, l = parents.length; i < l; i++) {
				n = parents[i];

				if (!n.expanded) {
					// this.debug("isVisible: HIDDEN (parent collapsed)");
					return false;
				}
				// if (hasFilter && !n.match && !n.subMatchCount) {
				// 	this.debug("isVisible: HIDDEN (" + hasFilter + ", " + this.match + ", " + this.match + ")");
				// 	return false;
				// }
			}
			// this.debug("isVisible: VISIBLE");
			return true;
		},
		/** Deprecated.
		 * @deprecated since 2014-02-16: use load() instead.
		 */
		lazyLoad: function (discard) {
			$.error(
				"FancytreeNode.lazyLoad() is deprecated since 2014-02-16. Use .load() instead."
			);
		},
		/**
		 * Load all children of a lazy node if neccessary. The <i>expanded</i> state is maintained.
		 * @param {boolean} [forceReload=false] Pass true to discard any existing nodes before. Otherwise this method does nothing if the node was already loaded.
		 * @returns {$.Promise}
		 */
		load: function (forceReload) {
			var res,
				source,
				self = this,
				wasExpanded = this.isExpanded();

			_assert(this.isLazy(), "load() requires a lazy node");
			// _assert( forceReload || this.isUndefined(), "Pass forceReload=true to re-load a lazy node" );
			if (!forceReload && !this.isUndefined()) {
				return _getResolvedPromise(this);
			}
			if (this.isLoaded()) {
				this.resetLazy(); // also collapses
			}
			// This method is also called by setExpanded() and loadKeyPath(), so we
			// have to avoid recursion.
			source = this.tree._triggerNodeEvent("lazyLoad", this);
			if (source === false) {
				// #69
				return _getResolvedPromise(this);
			}
			_assert(
				typeof source !== "boolean",
				"lazyLoad event must return source in data.result"
			);
			res = this.tree._callHook("nodeLoadChildren", this, source);
			if (wasExpanded) {
				this.expanded = true;
				res.always(function () {
					self.render();
				});
			} else {
				res.always(function () {
					self.renderStatus(); // fix expander icon to 'loaded'
				});
			}
			return res;
		},
		/** Expand all parents and optionally scroll into visible area as neccessary.
		 * Promise is resolved, when lazy loading and animations are done.
		 * @param {object} [opts] passed to `setExpanded()`.
		 *     Defaults to {noAnimation: false, noEvents: false, scrollIntoView: true}
		 * @returns {$.Promise}
		 */
		makeVisible: function (opts) {
			var i,
				self = this,
				deferreds = [],
				dfd = new $.Deferred(),
				parents = this.getParentList(false, false),
				len = parents.length,
				effects = !(opts && opts.noAnimation === true),
				scroll = !(opts && opts.scrollIntoView === false);

			// Expand bottom-up, so only the top node is animated
			for (i = len - 1; i >= 0; i--) {
				// self.debug("pushexpand" + parents[i]);
				deferreds.push(parents[i].setExpanded(true, opts));
			}
			$.when.apply($, deferreds).done(function () {
				// All expands have finished
				// self.debug("expand DONE", scroll);
				if (scroll) {
					self.scrollIntoView(effects).done(function () {
						// self.debug("scroll DONE");
						dfd.resolve();
					});
				} else {
					dfd.resolve();
				}
			});
			return dfd.promise();
		},
		/** Move this node to targetNode.
		 *  @param {FancytreeNode} targetNode
		 *  @param {string} mode <pre>
		 *      'child': append this node as last child of targetNode.
		 *               This is the default. To be compatble with the D'n'd
		 *               hitMode, we also accept 'over'.
		 *      'firstChild': add this node as first child of targetNode.
		 *      'before': add this node as sibling before targetNode.
		 *      'after': add this node as sibling after targetNode.</pre>
		 *  @param {function} [map] optional callback(FancytreeNode) to allow modifcations
		 */
		moveTo: function (targetNode, mode, map) {
			if (mode === undefined || mode === "over") {
				mode = "child";
			} else if (mode === "firstChild") {
				if (targetNode.children && targetNode.children.length) {
					mode = "before";
					targetNode = targetNode.children[0];
				} else {
					mode = "child";
				}
			}
			var pos,
				tree = this.tree,
				prevParent = this.parent,
				targetParent =
					mode === "child" ? targetNode : targetNode.parent;

			if (this === targetNode) {
				return;
			} else if (!this.parent) {
				$.error("Cannot move system root");
			} else if (targetParent.isDescendantOf(this)) {
				$.error("Cannot move a node to its own descendant");
			}
			if (targetParent !== prevParent) {
				prevParent.triggerModifyChild("remove", this);
			}
			// Unlink this node from current parent
			if (this.parent.children.length === 1) {
				if (this.parent === targetParent) {
					return; // #258
				}
				this.parent.children = this.parent.lazy ? [] : null;
				this.parent.expanded = false;
			} else {
				pos = $.inArray(this, this.parent.children);
				_assert(pos >= 0, "invalid source parent");
				this.parent.children.splice(pos, 1);
			}
			// Remove from source DOM parent
			// if(this.parent.ul){
			// 	this.parent.ul.removeChild(this.li);
			// }

			// Insert this node to target parent's child list
			this.parent = targetParent;
			if (targetParent.hasChildren()) {
				switch (mode) {
					case "child":
						// Append to existing target children
						targetParent.children.push(this);
						break;
					case "before":
						// Insert this node before target node
						pos = $.inArray(targetNode, targetParent.children);
						_assert(pos >= 0, "invalid target parent");
						targetParent.children.splice(pos, 0, this);
						break;
					case "after":
						// Insert this node after target node
						pos = $.inArray(targetNode, targetParent.children);
						_assert(pos >= 0, "invalid target parent");
						targetParent.children.splice(pos + 1, 0, this);
						break;
					default:
						$.error("Invalid mode " + mode);
				}
			} else {
				targetParent.children = [this];
			}
			// Parent has no <ul> tag yet:
			// if( !targetParent.ul ) {
			// 	// This is the parent's first child: create UL tag
			// 	// (Hidden, because it will be
			// 	targetParent.ul = document.createElement("ul");
			// 	targetParent.ul.style.display = "none";
			// 	targetParent.li.appendChild(targetParent.ul);
			// }
			// // Issue 319: Add to target DOM parent (only if node was already rendered(expanded))
			// if(this.li){
			// 	targetParent.ul.appendChild(this.li);
			// }

			// Let caller modify the nodes
			if (map) {
				targetNode.visit(map, true);
			}
			if (targetParent === prevParent) {
				targetParent.triggerModifyChild("move", this);
			} else {
				// prevParent.triggerModifyChild("remove", this);
				targetParent.triggerModifyChild("add", this);
			}
			// Handle cross-tree moves
			if (tree !== targetNode.tree) {
				// Fix node.tree for all source nodes
				// 	_assert(false, "Cross-tree move is not yet implemented.");
				this.warn("Cross-tree moveTo is experimental!");
				this.visit(function (n) {
					// TODO: fix selection state and activation, ...
					n.tree = targetNode.tree;
				}, true);
			}

			// A collaposed node won't re-render children, so we have to remove it manually
			// if( !targetParent.expanded ){
			//   prevParent.ul.removeChild(this.li);
			// }
			tree._callHook("treeStructureChanged", tree, "moveTo");

			// Update HTML markup
			if (!prevParent.isDescendantOf(targetParent)) {
				prevParent.render();
			}
			if (
				!targetParent.isDescendantOf(prevParent) &&
				targetParent !== prevParent
			) {
				targetParent.render();
			}
			// TODO: fix selection state
			// TODO: fix active state

			/*
			var tree = this.tree;
			var opts = tree.options;
			var pers = tree.persistence;

			// Always expand, if it's below minExpandLevel
			// tree.logDebug ("%s._addChildNode(%o), l=%o", this, ftnode, ftnode.getLevel());
			if ( opts.minExpandLevel >= ftnode.getLevel() ) {
				// tree.logDebug ("Force expand for %o", ftnode);
				this.bExpanded = true;
			}

			// In multi-hier mode, update the parents selection state
			// DT issue #82: only if not initializing, because the children may not exist yet
			// if( !ftnode.data.isStatusNode() && opts.selectMode==3 && !isInitializing )
			// 	ftnode._fixSelectionState();

			// In multi-hier mode, update the parents selection state
			if( ftnode.bSelected && opts.selectMode==3 ) {
				var p = this;
				while( p ) {
					if( !p.hasSubSel )
						p._setSubSel(true);
					p = p.parent;
				}
			}
			// render this node and the new child
			if ( tree.bEnableUpdate )
				this.render();
			return ftnode;
			*/
		},
		/** Set focus relative to this node and optionally activate.
		 *
		 * 'left' collapses the node if it is expanded, or move to the parent
		 * otherwise.
		 * 'right' expands the node if it is collapsed, or move to the first
		 * child otherwise.
		 *
		 * @param {string|number} where 'down', 'first', 'last', 'left', 'parent', 'right', or 'up'.
		 *   (Alternatively the keyCode that would normally trigger this move,
		 *   e.g. `$.ui.keyCode.LEFT` = 'left'.
		 * @param {boolean} [activate=true]
		 * @returns {$.Promise}
		 */
		navigate: function (where, activate) {
			var node,
				KC = $.ui.keyCode;

			// Handle optional expand/collapse action for LEFT/RIGHT
			switch (where) {
				case "left":
				case KC.LEFT:
					if (this.expanded) {
						return this.setExpanded(false);
					}
					break;
				case "right":
				case KC.RIGHT:
					if (!this.expanded && (this.children || this.lazy)) {
						return this.setExpanded();
					}
					break;
			}
			// Otherwise activate or focus the related node
			node = this.findRelatedNode(where);
			if (node) {
				// setFocus/setActive will scroll later (if autoScroll is specified)
				try {
					node.makeVisible({ scrollIntoView: false });
				} catch (e) {} // #272
				if (activate === false) {
					node.setFocus();
					return _getResolvedPromise();
				}
				return node.setActive();
			}
			this.warn("Could not find related node '" + where + "'.");
			return _getResolvedPromise();
		},
		/**
		 * Remove this node (not allowed for system root).
		 */
		remove: function () {
			return this.parent.removeChild(this);
		},
		/**
		 * Remove childNode from list of direct children.
		 * @param {FancytreeNode} childNode
		 */
		removeChild: function (childNode) {
			return this.tree._callHook("nodeRemoveChild", this, childNode);
		},
		/**
		 * Remove all child nodes and descendents. This converts the node into a leaf.<br>
		 * If this was a lazy node, it is still considered 'loaded'; call node.resetLazy()
		 * in order to trigger lazyLoad on next expand.
		 */
		removeChildren: function () {
			return this.tree._callHook("nodeRemoveChildren", this);
		},
		/**
		 * Remove class from node's span tag and .extraClasses.
		 *
		 * @param {string} className class name
		 *
		 * @since 2.17
		 */
		removeClass: function (className) {
			return this.toggleClass(className, false);
		},
		/**
		 * This method renders and updates all HTML markup that is required
		 * to display this node in its current state.<br>
		 * Note:
		 * <ul>
		 * <li>It should only be neccessary to call this method after the node object
		 *     was modified by direct access to its properties, because the common
		 *     API methods (node.setTitle(), moveTo(), addChildren(), remove(), ...)
		 *     already handle this.
		 * <li> {@link FancytreeNode#renderTitle} and {@link FancytreeNode#renderStatus}
		 *     are implied. If changes are more local, calling only renderTitle() or
		 *     renderStatus() may be sufficient and faster.
		 * </ul>
		 *
		 * @param {boolean} [force=false] re-render, even if html markup was already created
		 * @param {boolean} [deep=false] also render all descendants, even if parent is collapsed
		 */
		render: function (force, deep) {
			return this.tree._callHook("nodeRender", this, force, deep);
		},
		/** Create HTML markup for the node's outer `<span>` (expander, checkbox, icon, and title).
		 * Implies {@link FancytreeNode#renderStatus}.
		 * @see Fancytree_Hooks#nodeRenderTitle
		 */
		renderTitle: function () {
			return this.tree._callHook("nodeRenderTitle", this);
		},
		/** Update element's CSS classes according to node state.
		 * @see Fancytree_Hooks#nodeRenderStatus
		 */
		renderStatus: function () {
			return this.tree._callHook("nodeRenderStatus", this);
		},
		/**
		 * (experimental) Replace this node with `source`.
		 * (Currently only available for paging nodes.)
		 * @param {NodeData[]} source List of child node definitions
		 * @since 2.15
		 */
		replaceWith: function (source) {
			var res,
				parent = this.parent,
				pos = $.inArray(this, parent.children),
				self = this;

			_assert(
				this.isPagingNode(),
				"replaceWith() currently requires a paging status node"
			);

			res = this.tree._callHook("nodeLoadChildren", this, source);
			res.done(function (data) {
				// New nodes are currently children of `this`.
				var children = self.children;
				// Prepend newly loaded child nodes to `this`
				// Move new children after self
				for (i = 0; i < children.length; i++) {
					children[i].parent = parent;
				}
				parent.children.splice.apply(
					parent.children,
					[pos + 1, 0].concat(children)
				);

				// Remove self
				self.children = null;
				self.remove();
				// Redraw new nodes
				parent.render();
				// TODO: set node.partload = false if this was tha last paging node?
				// parent.addPagingNode(false);
			}).fail(function () {
				self.setExpanded();
			});
			return res;
			// $.error("Not implemented: replaceWith()");
		},
		/**
		 * Remove all children, collapse, and set the lazy-flag, so that the lazyLoad
		 * event is triggered on next expand.
		 */
		resetLazy: function () {
			this.removeChildren();
			this.expanded = false;
			this.lazy = true;
			this.children = undefined;
			this.renderStatus();
		},
		/** Schedule activity for delayed execution (cancel any pending request).
		 *  scheduleAction('cancel') will only cancel a pending request (if any).
		 * @param {string} mode
		 * @param {number} ms
		 */
		scheduleAction: function (mode, ms) {
			if (this.tree.timer) {
				clearTimeout(this.tree.timer);
				this.tree.debug("clearTimeout(%o)", this.tree.timer);
			}
			this.tree.timer = null;
			var self = this; // required for closures
			switch (mode) {
				case "cancel":
					// Simply made sure that timer was cleared
					break;
				case "expand":
					this.tree.timer = setTimeout(function () {
						self.tree.debug("setTimeout: trigger expand");
						self.setExpanded(true);
					}, ms);
					break;
				case "activate":
					this.tree.timer = setTimeout(function () {
						self.tree.debug("setTimeout: trigger activate");
						self.setActive(true);
					}, ms);
					break;
				default:
					$.error("Invalid mode " + mode);
			}
			// this.tree.debug("setTimeout(%s, %s): %s", mode, ms, this.tree.timer);
		},
		/**
		 *
		 * @param {boolean | PlainObject} [effects=false] animation options.
		 * @param {object} [options=null] {topNode: null, effects: ..., parent: ...} this node will remain visible in
		 *     any case, even if `this` is outside the scroll pane.
		 * @returns {$.Promise}
		 */
		scrollIntoView: function (effects, options) {
			if (options !== undefined && _isNode(options)) {
				throw Error(
					"scrollIntoView() with 'topNode' option is deprecated since 2014-05-08. Use 'options.topNode' instead."
				);
			}
			// The scroll parent is typically the plain tree's <UL> container.
			// For ext-table, we choose the nearest parent that has `position: relative`
			// and `overflow` set.
			// (This default can be overridden by the local or global `scrollParent` option.)
			var opts = $.extend(
					{
						effects:
							effects === true
								? { duration: 200, queue: false }
								: effects,
						scrollOfs: this.tree.options.scrollOfs,
						scrollParent: this.tree.options.scrollParent,
						topNode: null,
					},
					options
				),
				$scrollParent = opts.scrollParent,
				$container = this.tree.$container,
				overflowY = $container.css("overflow-y");

			if (!$scrollParent) {
				if (this.tree.tbody) {
					$scrollParent = $container.scrollParent();
				} else if (overflowY === "scroll" || overflowY === "auto") {
					$scrollParent = $container;
				} else {
					// #922 plain tree in a non-fixed-sized UL scrolls inside its parent
					$scrollParent = $container.scrollParent();
				}
			} else if (!$scrollParent.jquery) {
				// Make sure we have a jQuery object
				$scrollParent = $($scrollParent);
			}
			if (
				$scrollParent[0] === document ||
				$scrollParent[0] === document.body
			) {
				// `document` may be returned by $().scrollParent(), if nothing is found,
				// but would not work: (see #894)
				this.debug(
					"scrollIntoView(): normalizing scrollParent to 'window':",
					$scrollParent[0]
				);
				$scrollParent = $(window);
			}
			// eslint-disable-next-line one-var
			var topNodeY,
				nodeY,
				horzScrollbarHeight,
				containerOffsetTop,
				dfd = new $.Deferred(),
				self = this,
				nodeHeight = $(this.span).height(),
				topOfs = opts.scrollOfs.top || 0,
				bottomOfs = opts.scrollOfs.bottom || 0,
				containerHeight = $scrollParent.height(),
				scrollTop = $scrollParent.scrollTop(),
				$animateTarget = $scrollParent,
				isParentWindow = $scrollParent[0] === window,
				topNode = opts.topNode || null,
				newScrollTop = null;

			// this.debug("scrollIntoView(), scrollTop=" + scrollTop, opts.scrollOfs);
			// _assert($(this.span).is(":visible"), "scrollIntoView node is invisible"); // otherwise we cannot calc offsets
			if (this.isRootNode() || !this.isVisible()) {
				// We cannot calc offsets for hidden elements
				this.info("scrollIntoView(): node is invisible.");
				return _getResolvedPromise();
			}
			if (isParentWindow) {
				nodeY = $(this.span).offset().top;
				topNodeY =
					topNode && topNode.span ? $(topNode.span).offset().top : 0;
				$animateTarget = $("html,body");
			} else {
				_assert(
					$scrollParent[0] !== document &&
						$scrollParent[0] !== document.body,
					"scrollParent should be a simple element or `window`, not document or body."
				);

				containerOffsetTop = $scrollParent.offset().top;
				nodeY =
					$(this.span).offset().top - containerOffsetTop + scrollTop; // relative to scroll parent
				topNodeY = topNode
					? $(topNode.span).offset().top -
					  containerOffsetTop +
					  scrollTop
					: 0;
				horzScrollbarHeight = Math.max(
					0,
					$scrollParent.innerHeight() - $scrollParent[0].clientHeight
				);
				containerHeight -= horzScrollbarHeight;
			}

			// this.debug("    scrollIntoView(), nodeY=" + nodeY + ", containerHeight=" + containerHeight);
			if (nodeY < scrollTop + topOfs) {
				// Node is above visible container area
				newScrollTop = nodeY - topOfs;
				// this.debug("    scrollIntoView(), UPPER newScrollTop=" + newScrollTop);
			} else if (
				nodeY + nodeHeight >
				scrollTop + containerHeight - bottomOfs
			) {
				newScrollTop = nodeY + nodeHeight - containerHeight + bottomOfs;
				// this.debug("    scrollIntoView(), LOWER newScrollTop=" + newScrollTop);
				// If a topNode was passed, make sure that it is never scrolled
				// outside the upper border
				if (topNode) {
					_assert(
						topNode.isRootNode() || topNode.isVisible(),
						"topNode must be visible"
					);
					if (topNodeY < newScrollTop) {
						newScrollTop = topNodeY - topOfs;
						// this.debug("    scrollIntoView(), TOP newScrollTop=" + newScrollTop);
					}
				}
			}

			if (newScrollTop === null) {
				dfd.resolveWith(this);
			} else {
				// this.debug("    scrollIntoView(), SET newScrollTop=" + newScrollTop);
				if (opts.effects) {
					opts.effects.complete = function () {
						dfd.resolveWith(self);
					};
					$animateTarget.stop(true).animate(
						{
							scrollTop: newScrollTop,
						},
						opts.effects
					);
				} else {
					$animateTarget[0].scrollTop = newScrollTop;
					dfd.resolveWith(this);
				}
			}
			return dfd.promise();
		},

		/**Activate this node.
		 *
		 * The `cell` option requires the ext-table and ext-ariagrid extensions.
		 *
		 * @param {boolean} [flag=true] pass false to deactivate
		 * @param {object} [opts] additional options. Defaults to {noEvents: false, noFocus: false, cell: null}
		 * @returns {$.Promise}
		 */
		setActive: function (flag, opts) {
			return this.tree._callHook("nodeSetActive", this, flag, opts);
		},
		/**Expand or collapse this node. Promise is resolved, when lazy loading and animations are done.
		 * @param {boolean} [flag=true] pass false to collapse
		 * @param {object} [opts] additional options. Defaults to {noAnimation: false, noEvents: false}
		 * @returns {$.Promise}
		 */
		setExpanded: function (flag, opts) {
			return this.tree._callHook("nodeSetExpanded", this, flag, opts);
		},
		/**Set keyboard focus to this node.
		 * @param {boolean} [flag=true] pass false to blur
		 * @see Fancytree#setFocus
		 */
		setFocus: function (flag) {
			return this.tree._callHook("nodeSetFocus", this, flag);
		},
		/**Select this node, i.e. check the checkbox.
		 * @param {boolean} [flag=true] pass false to deselect
		 * @param {object} [opts] additional options. Defaults to {noEvents: false, p
		 *     propagateDown: null, propagateUp: null, callback: null }
		 */
		setSelected: function (flag, opts) {
			return this.tree._callHook("nodeSetSelected", this, flag, opts);
		},
		/**Mark a lazy node as 'error', 'loading', 'nodata', or 'ok'.
		 * @param {string} status 'error'|'loading'|'nodata'|'ok'
		 * @param {string} [message]
		 * @param {string} [details]
		 */
		setStatus: function (status, message, details) {
			return this.tree._callHook(
				"nodeSetStatus",
				this,
				status,
				message,
				details
			);
		},
		/**Rename this node.
		 * @param {string} title
		 */
		setTitle: function (title) {
			this.title = title;
			this.renderTitle();
			this.triggerModify("rename");
		},
		/**Sort child list by title.
		 * @param {function} [cmp] custom compare function(a, b) that returns -1, 0, or 1 (defaults to sort by title).
		 * @param {boolean} [deep=false] pass true to sort all descendant nodes
		 */
		sortChildren: function (cmp, deep) {
			var i,
				l,
				cl = this.children;

			if (!cl) {
				return;
			}
			cmp =
				cmp ||
				function (a, b) {
					var x = a.title.toLowerCase(),
						y = b.title.toLowerCase();

					// eslint-disable-next-line no-nested-ternary
					return x === y ? 0 : x > y ? 1 : -1;
				};
			cl.sort(cmp);
			if (deep) {
				for (i = 0, l = cl.length; i < l; i++) {
					if (cl[i].children) {
						cl[i].sortChildren(cmp, "$norender$");
					}
				}
			}
			if (deep !== "$norender$") {
				this.render();
			}
			this.triggerModifyChild("sort");
		},
		/** Convert node (or whole branch) into a plain object.
		 *
		 * The result is compatible with node.addChildren().
		 *
		 * @param {boolean} [recursive=false] include child nodes
		 * @param {function} [callback] callback(dict, node) is called for every node, in order to allow modifications.
		 *     Return `false` to ignore this node or `"skip"` to include this node without its children.
		 * @returns {NodeData}
		 */
		toDict: function (recursive, callback) {
			var i,
				l,
				node,
				res,
				dict = {},
				self = this;

			$.each(NODE_ATTRS, function (i, a) {
				if (self[a] || self[a] === false) {
					dict[a] = self[a];
				}
			});
			if (!$.isEmptyObject(this.data)) {
				dict.data = $.extend({}, this.data);
				if ($.isEmptyObject(dict.data)) {
					delete dict.data;
				}
			}
			if (callback) {
				res = callback(dict, self);
				if (res === false) {
					return false; // Don't include this node nor its children
				}
				if (res === "skip") {
					recursive = false; // Include this node, but not the children
				}
			}
			if (recursive) {
				if (_isArray(this.children)) {
					dict.children = [];
					for (i = 0, l = this.children.length; i < l; i++) {
						node = this.children[i];
						if (!node.isStatusNode()) {
							res = node.toDict(true, callback);
							if (res !== false) {
								dict.children.push(res);
							}
						}
					}
				}
			}
			return dict;
		},
		/**
		 * Set, clear, or toggle class of node's span tag and .extraClasses.
		 *
		 * @param {string} className class name (separate multiple classes by space)
		 * @param {boolean} [flag] true/false to add/remove class. If omitted, class is toggled.
		 * @returns {boolean} true if a class was added
		 *
		 * @since 2.17
		 */
		toggleClass: function (value, flag) {
			var className,
				hasClass,
				rnotwhite = /\S+/g,
				classNames = value.match(rnotwhite) || [],
				i = 0,
				wasAdded = false,
				statusElem = this[this.tree.statusClassPropName],
				curClasses = " " + (this.extraClasses || "") + " ";

			// this.info("toggleClass('" + value + "', " + flag + ")", curClasses);
			// Modify DOM element directly if it already exists
			if (statusElem) {
				$(statusElem).toggleClass(value, flag);
			}
			// Modify node.extraClasses to make this change persistent
			// Toggle if flag was not passed
			while ((className = classNames[i++])) {
				hasClass = curClasses.indexOf(" " + className + " ") >= 0;
				flag = flag === undefined ? !hasClass : !!flag;
				if (flag) {
					if (!hasClass) {
						curClasses += className + " ";
						wasAdded = true;
					}
				} else {
					while (curClasses.indexOf(" " + className + " ") > -1) {
						curClasses = curClasses.replace(
							" " + className + " ",
							" "
						);
					}
				}
			}
			this.extraClasses = _trim(curClasses);
			// this.info("-> toggleClass('" + value + "', " + flag + "): '" + this.extraClasses + "'");
			return wasAdded;
		},
		/** Flip expanded status. */
		toggleExpanded: function () {
			return this.tree._callHook("nodeToggleExpanded", this);
		},
		/** Flip selection status. */
		toggleSelected: function () {
			return this.tree._callHook("nodeToggleSelected", this);
		},
		toString: function () {
			return "FancytreeNode@" + this.key + "[title='" + this.title + "']";
			// return "<FancytreeNode(#" + this.key + ", '" + this.title + "')>";
		},
		/**
		 * Trigger `modifyChild` event on a parent to signal that a child was modified.
		 * @param {string} operation Type of change: 'add', 'remove', 'rename', 'move', 'data', ...
		 * @param {FancytreeNode} [childNode]
		 * @param {object} [extra]
		 */
		triggerModifyChild: function (operation, childNode, extra) {
			var data,
				modifyChild = this.tree.options.modifyChild;

			if (modifyChild) {
				if (childNode && childNode.parent !== this) {
					$.error(
						"childNode " + childNode + " is not a child of " + this
					);
				}
				data = {
					node: this,
					tree: this.tree,
					operation: operation,
					childNode: childNode || null,
				};
				if (extra) {
					$.extend(data, extra);
				}
				modifyChild({ type: "modifyChild" }, data);
			}
		},
		/**
		 * Trigger `modifyChild` event on node.parent(!).
		 * @param {string} operation Type of change: 'add', 'remove', 'rename', 'move', 'data', ...
		 * @param {object} [extra]
		 */
		triggerModify: function (operation, extra) {
			this.parent.triggerModifyChild(operation, this, extra);
		},
		/** Call fn(node) for all child nodes in hierarchical order (depth-first).<br>
		 * Stop iteration, if fn() returns false. Skip current branch, if fn() returns "skip".<br>
		 * Return false if iteration was stopped.
		 *
		 * @param {function} fn the callback function.
		 *     Return false to stop iteration, return "skip" to skip this node and
		 *     its children only.
		 * @param {boolean} [includeSelf=false]
		 * @returns {boolean}
		 */
		visit: function (fn, includeSelf) {
			var i,
				l,
				res = true,
				children = this.children;

			if (includeSelf === true) {
				res = fn(this);
				if (res === false || res === "skip") {
					return res;
				}
			}
			if (children) {
				for (i = 0, l = children.length; i < l; i++) {
					res = children[i].visit(fn, true);
					if (res === false) {
						break;
					}
				}
			}
			return res;
		},
		/** Call fn(node) for all child nodes and recursively load lazy children.<br>
		 * <b>Note:</b> If you need this method, you probably should consider to review
		 * your architecture! Recursivley loading nodes is a perfect way for lazy
		 * programmers to flood the server with requests ;-)
		 *
		 * @param {function} [fn] optional callback function.
		 *     Return false to stop iteration, return "skip" to skip this node and
		 *     its children only.
		 * @param {boolean} [includeSelf=false]
		 * @returns {$.Promise}
		 * @since 2.4
		 */
		visitAndLoad: function (fn, includeSelf, _recursion) {
			var dfd,
				res,
				loaders,
				node = this;

			// node.debug("visitAndLoad");
			if (fn && includeSelf === true) {
				res = fn(node);
				if (res === false || res === "skip") {
					return _recursion ? res : _getResolvedPromise();
				}
			}
			if (!node.children && !node.lazy) {
				return _getResolvedPromise();
			}
			dfd = new $.Deferred();
			loaders = [];
			// node.debug("load()...");
			node.load().done(function () {
				// node.debug("load()... done.");
				for (var i = 0, l = node.children.length; i < l; i++) {
					res = node.children[i].visitAndLoad(fn, true, true);
					if (res === false) {
						dfd.reject();
						break;
					} else if (res !== "skip") {
						loaders.push(res); // Add promise to the list
					}
				}
				$.when.apply(this, loaders).then(function () {
					dfd.resolve();
				});
			});
			return dfd.promise();
		},
		/** Call fn(node) for all parent nodes, bottom-up, including invisible system root.<br>
		 * Stop iteration, if fn() returns false.<br>
		 * Return false if iteration was stopped.
		 *
		 * @param {function} fn the callback function.
		 *     Return false to stop iteration, return "skip" to skip this node and children only.
		 * @param {boolean} [includeSelf=false]
		 * @returns {boolean}
		 */
		visitParents: function (fn, includeSelf) {
			// Visit parent nodes (bottom up)
			if (includeSelf && fn(this) === false) {
				return false;
			}
			var p = this.parent;
			while (p) {
				if (fn(p) === false) {
					return false;
				}
				p = p.parent;
			}
			return true;
		},
		/** Call fn(node) for all sibling nodes.<br>
		 * Stop iteration, if fn() returns false.<br>
		 * Return false if iteration was stopped.
		 *
		 * @param {function} fn the callback function.
		 *     Return false to stop iteration.
		 * @param {boolean} [includeSelf=false]
		 * @returns {boolean}
		 */
		visitSiblings: function (fn, includeSelf) {
			var i,
				l,
				n,
				ac = this.parent.children;

			for (i = 0, l = ac.length; i < l; i++) {
				n = ac[i];
				if (includeSelf || n !== this) {
					if (fn(n) === false) {
						return false;
					}
				}
			}
			return true;
		},
		/** Write warning to browser console if debugLevel >= 2 (prepending node info)
		 *
		 * @param {*} msg string or object or array of such
		 */
		warn: function (msg) {
			if (this.tree.options.debugLevel >= 2) {
				Array.prototype.unshift.call(arguments, this.toString());
				consoleApply("warn", arguments);
			}
		},
	};

	/******************************************************************************
	 * Fancytree
	 */
	/**
	 * Construct a new tree object.
	 *
	 * @class Fancytree
	 * @classdesc The controller behind a fancytree.
	 * This class also contains 'hook methods': see {@link Fancytree_Hooks}.
	 *
	 * @param {Widget} widget
	 *
	 * @property {string} _id Automatically generated unique tree instance ID, e.g. "1".
	 * @property {string} _ns Automatically generated unique tree namespace, e.g. ".fancytree-1".
	 * @property {FancytreeNode} activeNode Currently active node or null.
	 * @property {string} ariaPropName Property name of FancytreeNode that contains the element which will receive the aria attributes.
	 *     Typically "li", but "tr" for table extension.
	 * @property {jQueryObject} $container Outer `<ul>` element (or `<table>` element for ext-table).
	 * @property {jQueryObject} $div A jQuery object containing the element used to instantiate the tree widget (`widget.element`)
	 * @property {object|array} columns Recommended place to store shared column meta data. @since 2.27
	 * @property {object} data Metadata, i.e. properties that may be passed to `source` in addition to a children array.
	 * @property {object} ext Hash of all active plugin instances.
	 * @property {FancytreeNode} focusNode Currently focused node or null.
	 * @property {FancytreeNode} lastSelectedNode Used to implement selectMode 1 (single select)
	 * @property {string} nodeContainerAttrName Property name of FancytreeNode that contains the outer element of single nodes.
	 *     Typically "li", but "tr" for table extension.
	 * @property {FancytreeOptions} options Current options, i.e. default options + options passed to constructor.
	 * @property {FancytreeNode} rootNode Invisible system root node.
	 * @property {string} statusClassPropName Property name of FancytreeNode that contains the element which will receive the status classes.
	 *     Typically "span", but "tr" for table extension.
	 * @property {object} types Map for shared type specific meta data, used with node.type attribute. @since 2.27
	 * @property {object} viewport See ext-vieport. @since v2.31
	 * @property {object} widget Base widget instance.
	 */
	function Fancytree(widget) {
		this.widget = widget;
		this.$div = widget.element;
		this.options = widget.options;
		if (this.options) {
			if (this.options.lazyload !== undefined) {
				$.error(
					"The 'lazyload' event is deprecated since 2014-02-25. Use 'lazyLoad' (with uppercase L) instead."
				);
			}
			if (this.options.loaderror !== undefined) {
				$.error(
					"The 'loaderror' event was renamed since 2014-07-03. Use 'loadError' (with uppercase E) instead."
				);
			}
			if (this.options.fx !== undefined) {
				$.error(
					"The 'fx' option was replaced by 'toggleEffect' since 2014-11-30."
				);
			}
			if (this.options.removeNode !== undefined) {
				$.error(
					"The 'removeNode' event was replaced by 'modifyChild' since 2.20 (2016-09-10)."
				);
			}
		}
		this.ext = {}; // Active extension instances
		this.types = {};
		this.columns = {};
		// allow to init tree.data.foo from <div data-foo=''>
		this.data = _getElementDataAsDict(this.$div);
		// TODO: use widget.uuid instead?
		this._id = "" + (this.options.treeId || $.ui.fancytree._nextId++);
		// TODO: use widget.eventNamespace instead?
		this._ns = ".fancytree-" + this._id; // append for namespaced events
		this.activeNode = null;
		this.focusNode = null;
		this._hasFocus = null;
		this._tempCache = {};
		this._lastMousedownNode = null;
		this._enableUpdate = true;
		this.lastSelectedNode = null;
		this.systemFocusElement = null;
		this.lastQuicksearchTerm = "";
		this.lastQuicksearchTime = 0;
		this.viewport = null; // ext-grid

		this.statusClassPropName = "span";
		this.ariaPropName = "li";
		this.nodeContainerAttrName = "li";

		// Remove previous markup if any
		this.$div.find(">ul.fancytree-container").remove();

		// Create a node without parent.
		var fakeParent = { tree: this },
			$ul;
		this.rootNode = new FancytreeNode(fakeParent, {
			title: "root",
			key: "root_" + this._id,
			children: null,
			expanded: true,
		});
		this.rootNode.parent = null;

		// Create root markup
		$ul = $("<ul>", {
			id: "ft-id-" + this._id,
			class: "ui-fancytree fancytree-container fancytree-plain",
		}).appendTo(this.$div);
		this.$container = $ul;
		this.rootNode.ul = $ul[0];

		if (this.options.debugLevel == null) {
			this.options.debugLevel = FT.debugLevel;
		}
		// // Add container to the TAB chain
		// // See http://www.w3.org/TR/wai-aria-practices/#focus_activedescendant
		// // #577: Allow to set tabindex to "0", "-1" and ""
		// this.$container.attr("tabindex", this.options.tabindex);

		// if( this.options.rtl ) {
		// 	this.$container.attr("DIR", "RTL").addClass("fancytree-rtl");
		// // }else{
		// //	this.$container.attr("DIR", null).removeClass("fancytree-rtl");
		// }
		// if(this.options.aria){
		// 	this.$container.attr("role", "tree");
		// 	if( this.options.selectMode !== 1 ) {
		// 		this.$container.attr("aria-multiselectable", true);
		// 	}
		// }
	}

	Fancytree.prototype = /** @lends Fancytree# */ {
		/* Return a context object that can be re-used for _callHook().
		 * @param {Fancytree | FancytreeNode | EventData} obj
		 * @param {Event} originalEvent
		 * @param {Object} extra
		 * @returns {EventData}
		 */
		_makeHookContext: function (obj, originalEvent, extra) {
			var ctx, tree;
			if (obj.node !== undefined) {
				// obj is already a context object
				if (originalEvent && obj.originalEvent !== originalEvent) {
					$.error("invalid args");
				}
				ctx = obj;
			} else if (obj.tree) {
				// obj is a FancytreeNode
				tree = obj.tree;
				ctx = {
					node: obj,
					tree: tree,
					widget: tree.widget,
					options: tree.widget.options,
					originalEvent: originalEvent,
					typeInfo: tree.types[obj.type] || {},
				};
			} else if (obj.widget) {
				// obj is a Fancytree
				ctx = {
					node: null,
					tree: obj,
					widget: obj.widget,
					options: obj.widget.options,
					originalEvent: originalEvent,
				};
			} else {
				$.error("invalid args");
			}
			if (extra) {
				$.extend(ctx, extra);
			}
			return ctx;
		},
		/* Trigger a hook function: funcName(ctx, [...]).
		 *
		 * @param {string} funcName
		 * @param {Fancytree|FancytreeNode|EventData} contextObject
		 * @param {any}  [_extraArgs] optional additional arguments
		 * @returns {any}
		 */
		_callHook: function (funcName, contextObject, _extraArgs) {
			var ctx = this._makeHookContext(contextObject),
				fn = this[funcName],
				args = Array.prototype.slice.call(arguments, 2);
			if (!_isFunction(fn)) {
				$.error("_callHook('" + funcName + "') is not a function");
			}
			args.unshift(ctx);
			// this.debug("_hook", funcName, ctx.node && ctx.node.toString() || ctx.tree.toString(), args);
			return fn.apply(this, args);
		},
		_setExpiringValue: function (key, value, ms) {
			this._tempCache[key] = {
				value: value,
				expire: Date.now() + (+ms || 50),
			};
		},
		_getExpiringValue: function (key) {
			var entry = this._tempCache[key];
			if (entry && entry.expire > Date.now()) {
				return entry.value;
			}
			delete this._tempCache[key];
			return null;
		},
		/* Check if this tree has extension `name` enabled.
		 *
		 * @param {string} name name of the required extension
		 */
		_usesExtension: function (name) {
			return $.inArray(name, this.options.extensions) >= 0;
		},
		/* Check if current extensions dependencies are met and throw an error if not.
		 *
		 * This method may be called inside the `treeInit` hook for custom extensions.
		 *
		 * @param {string} name name of the required extension
		 * @param {boolean} [required=true] pass `false` if the extension is optional, but we want to check for order if it is present
		 * @param {boolean} [before] `true` if `name` must be included before this, `false` otherwise (use `null` if order doesn't matter)
		 * @param {string} [message] optional error message (defaults to a descriptve error message)
		 */
		_requireExtension: function (name, required, before, message) {
			if (before != null) {
				before = !!before;
			}
			var thisName = this._local.name,
				extList = this.options.extensions,
				isBefore =
					$.inArray(name, extList) < $.inArray(thisName, extList),
				isMissing = required && this.ext[name] == null,
				badOrder = !isMissing && before != null && before !== isBefore;

			_assert(
				thisName && thisName !== name,
				"invalid or same name '" + thisName + "' (require yourself?)"
			);

			if (isMissing || badOrder) {
				if (!message) {
					if (isMissing || required) {
						message =
							"'" +
							thisName +
							"' extension requires '" +
							name +
							"'";
						if (badOrder) {
							message +=
								" to be registered " +
								(before ? "before" : "after") +
								" itself";
						}
					} else {
						message =
							"If used together, `" +
							name +
							"` must be registered " +
							(before ? "before" : "after") +
							" `" +
							thisName +
							"`";
					}
				}
				$.error(message);
				return false;
			}
			return true;
		},
		/** Activate node with a given key and fire focus and activate events.
		 *
		 * A previously activated node will be deactivated.
		 * If activeVisible option is set, all parents will be expanded as necessary.
		 * Pass key = false, to deactivate the current node only.
		 * @param {string} key
		 * @param {object} [opts] additional options. Defaults to {noEvents: false, noFocus: false}
		 * @returns {FancytreeNode} activated node (null, if not found)
		 */
		activateKey: function (key, opts) {
			var node = this.getNodeByKey(key);
			if (node) {
				node.setActive(true, opts);
			} else if (this.activeNode) {
				this.activeNode.setActive(false, opts);
			}
			return node;
		},
		/** (experimental) Add child status nodes that indicate 'More...', ....
		 * @param {boolean|object} node optional node definition. Pass `false` to remove all paging nodes.
		 * @param {string} [mode='append'] 'child'|firstChild'
		 * @since 2.15
		 */
		addPagingNode: function (node, mode) {
			return this.rootNode.addPagingNode(node, mode);
		},
		/**
		 * (experimental) Apply a modification (or navigation) operation.
		 *
		 * Valid commands:
		 *   - 'moveUp', 'moveDown'
		 *   - 'indent', 'outdent'
		 *   - 'remove'
		 *   - 'edit', 'addChild', 'addSibling': (reqires ext-edit extension)
		 *   - 'cut', 'copy', 'paste': (use an internal singleton 'clipboard')
		 *   - 'down', 'first', 'last', 'left', 'parent', 'right', 'up': navigate
		 *
		 * @param {string} cmd
		 * @param {FancytreeNode} [node=active_node]
		 * @param {object} [opts] Currently unused
		 *
		 * @since 2.32
		 */
		applyCommand: function (cmd, node, opts_) {
			var // clipboard,
				refNode;
			// opts = $.extend(
			// 	{ setActive: true, clipboard: CLIPBOARD },
			// 	opts_
			// );

			node = node || this.getActiveNode();
			// clipboard = opts.clipboard;

			switch (cmd) {
				// Sorting and indentation:
				case "moveUp":
					refNode = node.getPrevSibling();
					if (refNode) {
						node.moveTo(refNode, "before");
						node.setActive();
					}
					break;
				case "moveDown":
					refNode = node.getNextSibling();
					if (refNode) {
						node.moveTo(refNode, "after");
						node.setActive();
					}
					break;
				case "indent":
					refNode = node.getPrevSibling();
					if (refNode) {
						node.moveTo(refNode, "child");
						refNode.setExpanded();
						node.setActive();
					}
					break;
				case "outdent":
					if (!node.isTopLevel()) {
						node.moveTo(node.getParent(), "after");
						node.setActive();
					}
					break;
				// Remove:
				case "remove":
					refNode = node.getPrevSibling() || node.getParent();
					node.remove();
					if (refNode) {
						refNode.setActive();
					}
					break;
				// Add, edit (requires ext-edit):
				case "addChild":
					node.editCreateNode("child", "");
					break;
				case "addSibling":
					node.editCreateNode("after", "");
					break;
				case "rename":
					node.editStart();
					break;
				// Simple clipboard simulation:
				// case "cut":
				// 	clipboard = { mode: cmd, data: node };
				// 	break;
				// case "copy":
				// 	clipboard = {
				// 		mode: cmd,
				// 		data: node.toDict(function(d, n) {
				// 			delete d.key;
				// 		}),
				// 	};
				// 	break;
				// case "clear":
				// 	clipboard = null;
				// 	break;
				// case "paste":
				// 	if (clipboard.mode === "cut") {
				// 		// refNode = node.getPrevSibling();
				// 		clipboard.data.moveTo(node, "child");
				// 		clipboard.data.setActive();
				// 	} else if (clipboard.mode === "copy") {
				// 		node.addChildren(clipboard.data).setActive();
				// 	}
				// 	break;
				// Navigation commands:
				case "down":
				case "first":
				case "last":
				case "left":
				case "parent":
				case "right":
				case "up":
					return node.navigate(cmd);
				default:
					$.error("Unhandled command: '" + cmd + "'");
			}
		},
		/** (experimental) Modify existing data model.
		 *
		 * @param {Array} patchList array of [key, NodePatch] arrays
		 * @returns {$.Promise} resolved, when all patches have been applied
		 * @see TreePatch
		 */
		applyPatch: function (patchList) {
			var dfd,
				i,
				p2,
				key,
				patch,
				node,
				patchCount = patchList.length,
				deferredList = [];

			for (i = 0; i < patchCount; i++) {
				p2 = patchList[i];
				_assert(
					p2.length === 2,
					"patchList must be an array of length-2-arrays"
				);
				key = p2[0];
				patch = p2[1];
				node = key === null ? this.rootNode : this.getNodeByKey(key);
				if (node) {
					dfd = new $.Deferred();
					deferredList.push(dfd);
					node.applyPatch(patch).always(_makeResolveFunc(dfd, node));
				} else {
					this.warn("could not find node with key '" + key + "'");
				}
			}
			// Return a promise that is resolved, when ALL patches were applied
			return $.when.apply($, deferredList).promise();
		},
		/* TODO: implement in dnd extension
		cancelDrag: function() {
				var dd = $.ui.ddmanager.current;
				if(dd){
					dd.cancel();
				}
			},
		*/
		/** Remove all nodes.
		 * @since 2.14
		 */
		clear: function (source) {
			this._callHook("treeClear", this);
		},
		/** Return the number of nodes.
		 * @returns {integer}
		 */
		count: function () {
			return this.rootNode.countChildren();
		},
		/** Write to browser console if debugLevel >= 4 (prepending tree name)
		 *
		 * @param {*} msg string or object or array of such
		 */
		debug: function (msg) {
			if (this.options.debugLevel >= 4) {
				Array.prototype.unshift.call(arguments, this.toString());
				consoleApply("log", arguments);
			}
		},
		/** Destroy this widget, restore previous markup and cleanup resources.
		 *
		 * @since 2.34
		 */
		destroy: function () {
			this.widget.destroy();
		},
		/** Enable (or disable) the tree control.
		 *
		 * @param {boolean} [flag=true] pass false to disable
		 * @since 2.30
		 */
		enable: function (flag) {
			if (flag === false) {
				this.widget.disable();
			} else {
				this.widget.enable();
			}
		},
		/** Temporarily suppress rendering to improve performance on bulk-updates.
		 *
		 * @param {boolean} flag
		 * @returns {boolean} previous status
		 * @since 2.19
		 */
		enableUpdate: function (flag) {
			flag = flag !== false;
			if (!!this._enableUpdate === !!flag) {
				return flag;
			}
			this._enableUpdate = flag;
			if (flag) {
				this.debug("enableUpdate(true): redraw "); //, this._dirtyRoots);
				this._callHook("treeStructureChanged", this, "enableUpdate");
				this.render();
			} else {
				// 	this._dirtyRoots = null;
				this.debug("enableUpdate(false)...");
			}
			return !flag; // return previous value
		},
		/** Write error to browser console if debugLevel >= 1 (prepending tree info)
		 *
		 * @param {*} msg string or object or array of such
		 */
		error: function (msg) {
			if (this.options.debugLevel >= 1) {
				Array.prototype.unshift.call(arguments, this.toString());
				consoleApply("error", arguments);
			}
		},
		/** Expand (or collapse) all parent nodes.
		 *
		 * This convenience method uses `tree.visit()` and `tree.setExpanded()`
		 * internally.
		 *
		 * @param {boolean} [flag=true] pass false to collapse
		 * @param {object} [opts] passed to setExpanded()
		 * @since 2.30
		 */
		expandAll: function (flag, opts) {
			var prev = this.enableUpdate(false);

			flag = flag !== false;
			this.visit(function (node) {
				if (
					node.hasChildren() !== false &&
					node.isExpanded() !== flag
				) {
					node.setExpanded(flag, opts);
				}
			});
			this.enableUpdate(prev);
		},
		/**Find all nodes that matches condition.
		 *
		 * @param {string | function(node)} match title string to search for, or a
		 *     callback function that returns `true` if a node is matched.
		 * @returns {FancytreeNode[]} array of nodes (may be empty)
		 * @see FancytreeNode#findAll
		 * @since 2.12
		 */
		findAll: function (match) {
			return this.rootNode.findAll(match);
		},
		/**Find first node that matches condition.
		 *
		 * @param {string | function(node)} match title string to search for, or a
		 *     callback function that returns `true` if a node is matched.
		 * @returns {FancytreeNode} matching node or null
		 * @see FancytreeNode#findFirst
		 * @since 2.12
		 */
		findFirst: function (match) {
			return this.rootNode.findFirst(match);
		},
		/** Find the next visible node that starts with `match`, starting at `startNode`
		 * and wrap-around at the end.
		 *
		 * @param {string|function} match
		 * @param {FancytreeNode} [startNode] defaults to first node
		 * @returns {FancytreeNode} matching node or null
		 */
		findNextNode: function (match, startNode) {
			//, visibleOnly) {
			var res = null,
				firstNode = this.getFirstChild();

			match =
				typeof match === "string"
					? _makeNodeTitleStartMatcher(match)
					: match;
			startNode = startNode || firstNode;

			function _checkNode(n) {
				// console.log("_check " + n)
				if (match(n)) {
					res = n;
				}
				if (res || n === startNode) {
					return false;
				}
			}
			this.visitRows(_checkNode, {
				start: startNode,
				includeSelf: false,
			});
			// Wrap around search
			if (!res && startNode !== firstNode) {
				this.visitRows(_checkNode, {
					start: firstNode,
					includeSelf: true,
				});
			}
			return res;
		},
		/** Find a node relative to another node.
		 *
		 * @param {FancytreeNode} node
		 * @param {string|number} where 'down', 'first', 'last', 'left', 'parent', 'right', or 'up'.
		 *   (Alternatively the keyCode that would normally trigger this move,
		 *   e.g. `$.ui.keyCode.LEFT` = 'left'.
		 * @param {boolean} [includeHidden=false] Not yet implemented
		 * @returns {FancytreeNode|null}
		 * @since v2.31
		 */
		findRelatedNode: function (node, where, includeHidden) {
			var res = null,
				KC = $.ui.keyCode;

			switch (where) {
				case "parent":
				case KC.BACKSPACE:
					if (node.parent && node.parent.parent) {
						res = node.parent;
					}
					break;
				case "first":
				case KC.HOME:
					// First visible node
					this.visit(function (n) {
						if (n.isVisible()) {
							res = n;
							return false;
						}
					});
					break;
				case "last":
				case KC.END:
					this.visit(function (n) {
						// last visible node
						if (n.isVisible()) {
							res = n;
						}
					});
					break;
				case "left":
				case KC.LEFT:
					if (node.expanded) {
						node.setExpanded(false);
					} else if (node.parent && node.parent.parent) {
						res = node.parent;
					}
					break;
				case "right":
				case KC.RIGHT:
					if (!node.expanded && (node.children || node.lazy)) {
						node.setExpanded();
						res = node;
					} else if (node.children && node.children.length) {
						res = node.children[0];
					}
					break;
				case "up":
				case KC.UP:
					this.visitRows(
						function (n) {
							res = n;
							return false;
						},
						{ start: node, reverse: true, includeSelf: false }
					);
					break;
				case "down":
				case KC.DOWN:
					this.visitRows(
						function (n) {
							res = n;
							return false;
						},
						{ start: node, includeSelf: false }
					);
					break;
				default:
					this.tree.warn("Unknown relation '" + where + "'.");
			}
			return res;
		},
		// TODO: fromDict
		/**
		 * Generate INPUT elements that can be submitted with html forms.
		 *
		 * In selectMode 3 only the topmost selected nodes are considered, unless
		 * `opts.stopOnParents: false` is passed.
		 *
		 * @example
		 * // Generate input elements for active and selected nodes
		 * tree.generateFormElements();
		 * // Generate input elements selected nodes, using a custom `name` attribute
		 * tree.generateFormElements("cust_sel", false);
		 * // Generate input elements using a custom filter
		 * tree.generateFormElements(true, true, { filter: function(node) {
		 *     return node.isSelected() && node.data.yes;
		 * }});
		 *
		 * @param {boolean | string} [selected=true] Pass false to disable, pass a string to override the field name (default: 'ft_ID[]')
		 * @param {boolean | string} [active=true] Pass false to disable, pass a string to override the field name (default: 'ft_ID_active')
		 * @param {object} [opts] default { filter: null, stopOnParents: true }
		 */
		generateFormElements: function (selected, active, opts) {
			opts = opts || {};

			var nodeList,
				selectedName =
					typeof selected === "string"
						? selected
						: "ft_" + this._id + "[]",
				activeName =
					typeof active === "string"
						? active
						: "ft_" + this._id + "_active",
				id = "fancytree_result_" + this._id,
				$result = $("#" + id),
				stopOnParents =
					this.options.selectMode === 3 &&
					opts.stopOnParents !== false;

			if ($result.length) {
				$result.empty();
			} else {
				$result = $("<div>", {
					id: id,
				})
					.hide()
					.insertAfter(this.$container);
			}
			if (active !== false && this.activeNode) {
				$result.append(
					$("<input>", {
						type: "radio",
						name: activeName,
						value: this.activeNode.key,
						checked: true,
					})
				);
			}
			function _appender(node) {
				$result.append(
					$("<input>", {
						type: "checkbox",
						name: selectedName,
						value: node.key,
						checked: true,
					})
				);
			}
			if (opts.filter) {
				this.visit(function (node) {
					var res = opts.filter(node);
					if (res === "skip") {
						return res;
					}
					if (res !== false) {
						_appender(node);
					}
				});
			} else if (selected !== false) {
				nodeList = this.getSelectedNodes(stopOnParents);
				$.each(nodeList, function (idx, node) {
					_appender(node);
				});
			}
		},
		/**
		 * Return the currently active node or null.
		 * @returns {FancytreeNode}
		 */
		getActiveNode: function () {
			return this.activeNode;
		},
		/** Return the first top level node if any (not the invisible root node).
		 * @returns {FancytreeNode | null}
		 */
		getFirstChild: function () {
			return this.rootNode.getFirstChild();
		},
		/**
		 * Return node that has keyboard focus or null.
		 * @returns {FancytreeNode}
		 */
		getFocusNode: function () {
			return this.focusNode;
		},
		/**
		 * Return current option value.
		 * (Note: this is the preferred variant of `$().fancytree("option", "KEY")`)
		 *
		 * @param {string} name option name (may contain '.')
		 * @returns {any}
		 */
		getOption: function (optionName) {
			return this.widget.option(optionName);
		},
		/**
		 * Return node with a given key or null if not found.
		 *
		 * @param {string} key
		 * @param {FancytreeNode} [searchRoot] only search below this node
		 * @returns {FancytreeNode | null}
		 */
		getNodeByKey: function (key, searchRoot) {
			// Search the DOM by element ID (assuming this is faster than traversing all nodes).
			var el, match;
			// TODO: use tree.keyMap if available
			// TODO: check opts.generateIds === true
			if (!searchRoot) {
				el = document.getElementById(this.options.idPrefix + key);
				if (el) {
					return el.ftnode ? el.ftnode : null;
				}
			}
			// Not found in the DOM, but still may be in an unrendered part of tree
			searchRoot = searchRoot || this.rootNode;
			match = null;
			key = "" + key; // Convert to string (#1005)
			searchRoot.visit(function (node) {
				if (node.key === key) {
					match = node;
					return false; // Stop iteration
				}
			}, true);
			return match;
		},
		/** Return the invisible system root node.
		 * @returns {FancytreeNode}
		 */
		getRootNode: function () {
			return this.rootNode;
		},
		/**
		 * Return an array of selected nodes.
		 *
		 * Note: you cannot send this result via Ajax directly. Instead the
		 * node object need to be converted to plain objects, for example
		 * by using `$.map()` and `node.toDict()`.
		 * @param {boolean} [stopOnParents=false] only return the topmost selected
		 *     node (useful with selectMode 3)
		 * @returns {FancytreeNode[]}
		 */
		getSelectedNodes: function (stopOnParents) {
			return this.rootNode.getSelectedNodes(stopOnParents);
		},
		/** Return true if the tree control has keyboard focus
		 * @returns {boolean}
		 */
		hasFocus: function () {
			// var ae = document.activeElement,
			// 	hasFocus = !!(
			// 		ae && $(ae).closest(".fancytree-container").length
			// 	);

			// if (hasFocus !== !!this._hasFocus) {
			// 	this.warn(
			// 		"hasFocus(): fix inconsistent container state, now: " +
			// 			hasFocus
			// 	);
			// 	this._hasFocus = hasFocus;
			// 	this.$container.toggleClass("fancytree-treefocus", hasFocus);
			// }
			// return hasFocus;
			return !!this._hasFocus;
		},
		/** Write to browser console if debugLevel >= 3 (prepending tree name)
		 * @param {*} msg string or object or array of such
		 */
		info: function (msg) {
			if (this.options.debugLevel >= 3) {
				Array.prototype.unshift.call(arguments, this.toString());
				consoleApply("info", arguments);
			}
		},
		/** Return true if any node is currently beeing loaded, i.e. a Ajax request is pending.
		 * @returns {boolean}
		 * @since 2.32
		 */
		isLoading: function () {
			var res = false;

			this.rootNode.visit(function (n) {
				// also visit rootNode
				if (n._isLoading || n._requestId) {
					res = true;
					return false;
				}
			}, true);
			return res;
		},
		/*
		TODO: isInitializing: function() {
			return ( this.phase=="init" || this.phase=="postInit" );
		},
		TODO: isReloading: function() {
			return ( this.phase=="init" || this.phase=="postInit" ) && this.options.persist && this.persistence.cookiesFound;
		},
		TODO: isUserEvent: function() {
			return ( this.phase=="userEvent" );
		},
		*/

		/**
		 * Make sure that a node with a given ID is loaded, by traversing - and
		 * loading - its parents. This method is meant for lazy hierarchies.
		 * A callback is executed for every node as we go.
		 * @example
		 * // Resolve using node.key:
		 * tree.loadKeyPath("/_3/_23/_26/_27", function(node, status){
		 *   if(status === "loaded") {
		 *     console.log("loaded intermediate node " + node);
		 *   }else if(status === "ok") {
		 *     node.activate();
		 *   }
		 * });
		 * // Use deferred promise:
		 * tree.loadKeyPath("/_3/_23/_26/_27").progress(function(data){
		 *   if(data.status === "loaded") {
		 *     console.log("loaded intermediate node " + data.node);
		 *   }else if(data.status === "ok") {
		 *     node.activate();
		 *   }
		 * }).done(function(){
		 *    ...
		 * });
		 * // Custom path segment resolver:
		 * tree.loadKeyPath("/321/431/21/2", {
		 *   matchKey: function(node, key){
		 *     return node.data.refKey === key;
		 *   },
		 *   callback: function(node, status){
		 *     if(status === "loaded") {
		 *       console.log("loaded intermediate node " + node);
		 *     }else if(status === "ok") {
		 *       node.activate();
		 *     }
		 *   }
		 * });
		 * @param {string | string[]} keyPathList one or more key paths (e.g. '/3/2_1/7')
		 * @param {function | object} optsOrCallback callback(node, status) is called for every visited node ('loading', 'loaded', 'ok', 'error').
		 *     Pass an object to define custom key matchers for the path segments: {callback: function, matchKey: function}.
		 * @returns {$.Promise}
		 */
		loadKeyPath: function (keyPathList, optsOrCallback) {
			var callback,
				i,
				path,
				self = this,
				dfd = new $.Deferred(),
				parent = this.getRootNode(),
				sep = this.options.keyPathSeparator,
				pathSegList = [],
				opts = $.extend({}, optsOrCallback);

			// Prepare options
			if (typeof optsOrCallback === "function") {
				callback = optsOrCallback;
			} else if (optsOrCallback && optsOrCallback.callback) {
				callback = optsOrCallback.callback;
			}
			opts.callback = function (ctx, node, status) {
				if (callback) {
					callback.call(ctx, node, status);
				}
				dfd.notifyWith(ctx, [{ node: node, status: status }]);
			};
			if (opts.matchKey == null) {
				opts.matchKey = function (node, key) {
					return node.key === key;
				};
			}
			// Convert array of path strings to array of segment arrays
			if (!_isArray(keyPathList)) {
				keyPathList = [keyPathList];
			}
			for (i = 0; i < keyPathList.length; i++) {
				path = keyPathList[i];
				// strip leading slash
				if (path.charAt(0) === sep) {
					path = path.substr(1);
				}
				// segListMap[path] = { parent: parent, segList: path.split(sep) };
				pathSegList.push(path.split(sep));
				// targetList.push({ parent: parent, segList: path.split(sep)/* , path: path*/});
			}
			// The timeout forces async behavior always (even if nodes are all loaded)
			// This way a potential progress() event will fire.
			setTimeout(function () {
				self._loadKeyPathImpl(dfd, opts, parent, pathSegList).done(
					function () {
						dfd.resolve();
					}
				);
			}, 0);
			return dfd.promise();
		},
		/*
		 * Resolve a list of paths, relative to one parent node.
		 */
		_loadKeyPathImpl: function (dfd, opts, parent, pathSegList) {
			var deferredList,
				i,
				key,
				node,
				nodeKey,
				remain,
				remainMap,
				tmpParent,
				segList,
				subDfd,
				self = this;

			function __findChild(parent, key) {
				// console.log("__findChild", key, parent);
				var i,
					l,
					cl = parent.children;

				if (cl) {
					for (i = 0, l = cl.length; i < l; i++) {
						if (opts.matchKey(cl[i], key)) {
							return cl[i];
						}
					}
				}
				return null;
			}

			// console.log("_loadKeyPathImpl, parent=", parent, ", pathSegList=", pathSegList);

			// Pass 1:
			// Handle all path segments for nodes that are already loaded.
			// Collect distinct top-most lazy nodes in a map.
			// Note that we can use node.key to de-dupe entries, even if a custom matcher would
			// look for other node attributes.
			// map[node.key] => {node: node, pathList: [list of remaining rest-paths]}
			remainMap = {};

			for (i = 0; i < pathSegList.length; i++) {
				segList = pathSegList[i];
				// target = targetList[i];

				// Traverse and pop path segments (i.e. keys), until we hit a lazy, unloaded node
				tmpParent = parent;
				while (segList.length) {
					key = segList.shift();
					node = __findChild(tmpParent, key);
					if (!node) {
						this.warn(
							"loadKeyPath: key not found: " +
								key +
								" (parent: " +
								tmpParent +
								")"
						);
						opts.callback(this, key, "error");
						break;
					} else if (segList.length === 0) {
						opts.callback(this, node, "ok");
						break;
					} else if (!node.lazy || node.hasChildren() !== undefined) {
						opts.callback(this, node, "loaded");
						tmpParent = node;
					} else {
						opts.callback(this, node, "loaded");
						key = node.key; //target.segList.join(sep);
						if (remainMap[key]) {
							remainMap[key].pathSegList.push(segList);
						} else {
							remainMap[key] = {
								parent: node,
								pathSegList: [segList],
							};
						}
						break;
					}
				}
			}
			// console.log("_loadKeyPathImpl AFTER pass 1, remainMap=", remainMap);

			// Now load all lazy nodes and continue iteration for remaining paths
			deferredList = [];

			// Avoid jshint warning 'Don't make functions within a loop.':
			function __lazyload(dfd, parent, pathSegList) {
				// console.log("__lazyload", parent, "pathSegList=", pathSegList);
				opts.callback(self, parent, "loading");
				parent
					.load()
					.done(function () {
						self._loadKeyPathImpl
							.call(self, dfd, opts, parent, pathSegList)
							.always(_makeResolveFunc(dfd, self));
					})
					.fail(function (errMsg) {
						self.warn("loadKeyPath: error loading lazy " + parent);
						opts.callback(self, node, "error");
						dfd.rejectWith(self);
					});
			}
			// remainMap contains parent nodes, each with a list of relative sub-paths.
			// We start loading all of them now, and pass the the list to each loader.
			for (nodeKey in remainMap) {
				if (_hasProp(remainMap, nodeKey)) {
					remain = remainMap[nodeKey];
					// console.log("for(): remain=", remain, "remainMap=", remainMap);
					// key = remain.segList.shift();
					// node = __findChild(remain.parent, key);
					// if (node == null) {  // #576
					// 	// Issue #576, refactored for v2.27:
					// 	// The root cause was, that sometimes the wrong parent was used here
					// 	// to find the next segment.
					// 	// Falling back to getNodeByKey() was a hack that no longer works if a custom
					// 	// matcher is used, because we cannot assume that a single segment-key is unique
					// 	// throughout the tree.
					// 	self.error("loadKeyPath: error loading child by key '" + key + "' (parent: " + target.parent + ")", target);
					// 	// 	node = self.getNodeByKey(key);
					// 	continue;
					// }
					subDfd = new $.Deferred();
					deferredList.push(subDfd);
					__lazyload(subDfd, remain.parent, remain.pathSegList);
				}
			}
			// Return a promise that is resolved, when ALL paths were loaded
			return $.when.apply($, deferredList).promise();
		},
		/** Re-fire beforeActivate, activate, and (optional) focus events.
		 * Calling this method in the `init` event, will activate the node that
		 * was marked 'active' in the source data, and optionally set the keyboard
		 * focus.
		 * @param [setFocus=false]
		 */
		reactivate: function (setFocus) {
			var res,
				node = this.activeNode;

			if (!node) {
				return _getResolvedPromise();
			}
			this.activeNode = null; // Force re-activating
			res = node.setActive(true, { noFocus: true });
			if (setFocus) {
				node.setFocus();
			}
			return res;
		},
		/** Reload tree from source and return a promise.
		 * @param [source] optional new source (defaults to initial source data)
		 * @returns {$.Promise}
		 */
		reload: function (source) {
			this._callHook("treeClear", this);
			return this._callHook("treeLoad", this, source);
		},
		/**Render tree (i.e. create DOM elements for all top-level nodes).
		 * @param {boolean} [force=false] create DOM elemnts, even if parent is collapsed
		 * @param {boolean} [deep=false]
		 */
		render: function (force, deep) {
			return this.rootNode.render(force, deep);
		},
		/**(De)select all nodes.
		 * @param {boolean} [flag=true]
		 * @since 2.28
		 */
		selectAll: function (flag) {
			this.visit(function (node) {
				node.setSelected(flag);
			});
		},
		// TODO: selectKey: function(key, select)
		// TODO: serializeArray: function(stopOnParents)
		/**
		 * @param {boolean} [flag=true]
		 */
		setFocus: function (flag) {
			return this._callHook("treeSetFocus", this, flag);
		},
		/**
		 * Set current option value.
		 * (Note: this is the preferred variant of `$().fancytree("option", "KEY", VALUE)`)
		 * @param {string} name option name (may contain '.')
		 * @param {any} new value
		 */
		setOption: function (optionName, value) {
			return this.widget.option(optionName, value);
		},
		/**
		 * Call console.time() when in debug mode (verbose >= 4).
		 *
		 * @param {string} label
		 */
		debugTime: function (label) {
			if (this.options.debugLevel >= 4) {
				window.console.time(this + " - " + label);
			}
		},
		/**
		 * Call console.timeEnd() when in debug mode (verbose >= 4).
		 *
		 * @param {string} label
		 */
		debugTimeEnd: function (label) {
			if (this.options.debugLevel >= 4) {
				window.console.timeEnd(this + " - " + label);
			}
		},
		/**
		 * Return all nodes as nested list of {@link NodeData}.
		 *
		 * @param {boolean} [includeRoot=false] Returns the hidden system root node (and its children)
		 * @param {function} [callback] callback(dict, node) is called for every node, in order to allow modifications.
		 *     Return `false` to ignore this node or "skip" to include this node without its children.
		 * @returns {Array | object}
		 * @see FancytreeNode#toDict
		 */
		toDict: function (includeRoot, callback) {
			var res = this.rootNode.toDict(true, callback);
			return includeRoot ? res : res.children;
		},
		/* Implicitly called for string conversions.
		 * @returns {string}
		 */
		toString: function () {
			return "Fancytree@" + this._id;
			// return "<Fancytree(#" + this._id + ")>";
		},
		/* _trigger a widget event with additional node ctx.
		 * @see EventData
		 */
		_triggerNodeEvent: function (type, node, originalEvent, extra) {
			// this.debug("_trigger(" + type + "): '" + ctx.node.title + "'", ctx);
			var ctx = this._makeHookContext(node, originalEvent, extra),
				res = this.widget._trigger(type, originalEvent, ctx);
			if (res !== false && ctx.result !== undefined) {
				return ctx.result;
			}
			return res;
		},
		/* _trigger a widget event with additional tree data. */
		_triggerTreeEvent: function (type, originalEvent, extra) {
			// this.debug("_trigger(" + type + ")", ctx);
			var ctx = this._makeHookContext(this, originalEvent, extra),
				res = this.widget._trigger(type, originalEvent, ctx);

			if (res !== false && ctx.result !== undefined) {
				return ctx.result;
			}
			return res;
		},
		/** Call fn(node) for all nodes in hierarchical order (depth-first).
		 *
		 * @param {function} fn the callback function.
		 *     Return false to stop iteration, return "skip" to skip this node and children only.
		 * @returns {boolean} false, if the iterator was stopped.
		 */
		visit: function (fn) {
			return this.rootNode.visit(fn, false);
		},
		/** Call fn(node) for all nodes in vertical order, top down (or bottom up).<br>
		 * Stop iteration, if fn() returns false.<br>
		 * Return false if iteration was stopped.
		 *
		 * @param {function} fn the callback function.
		 *     Return false to stop iteration, return "skip" to skip this node and children only.
		 * @param {object} [options]
		 *     Defaults:
		 *     {start: First top node, reverse: false, includeSelf: true, includeHidden: false}
		 * @returns {boolean} false if iteration was cancelled
		 * @since 2.28
		 */
		visitRows: function (fn, opts) {
			if (!this.rootNode.hasChildren()) {
				return false;
			}
			if (opts && opts.reverse) {
				delete opts.reverse;
				return this._visitRowsUp(fn, opts);
			}
			opts = opts || {};

			var i,
				nextIdx,
				parent,
				res,
				siblings,
				siblingOfs = 0,
				skipFirstNode = opts.includeSelf === false,
				includeHidden = !!opts.includeHidden,
				checkFilter = !includeHidden && this.enableFilter,
				node = opts.start || this.rootNode.children[0];

			parent = node.parent;
			while (parent) {
				// visit siblings
				siblings = parent.children;
				nextIdx = siblings.indexOf(node) + siblingOfs;
				_assert(
					nextIdx >= 0,
					"Could not find " +
						node +
						" in parent's children: " +
						parent
				);

				for (i = nextIdx; i < siblings.length; i++) {
					node = siblings[i];
					if (checkFilter && !node.match && !node.subMatchCount) {
						continue;
					}
					if (!skipFirstNode && fn(node) === false) {
						return false;
					}
					skipFirstNode = false;
					// Dive into node's child nodes
					if (
						node.children &&
						node.children.length &&
						(includeHidden || node.expanded)
					) {
						// Disable warning: Functions declared within loops referencing an outer
						// scoped variable may lead to confusing semantics:
						/*jshint -W083 */
						res = node.visit(function (n) {
							if (checkFilter && !n.match && !n.subMatchCount) {
								return "skip";
							}
							if (fn(n) === false) {
								return false;
							}
							if (!includeHidden && n.children && !n.expanded) {
								return "skip";
							}
						}, false);
						/*jshint +W083 */
						if (res === false) {
							return false;
						}
					}
				}
				// Visit parent nodes (bottom up)
				node = parent;
				parent = parent.parent;
				siblingOfs = 1; //
			}
			return true;
		},
		/* Call fn(node) for all nodes in vertical order, bottom up.
		 */
		_visitRowsUp: function (fn, opts) {
			var children,
				idx,
				parent,
				includeHidden = !!opts.includeHidden,
				node = opts.start || this.rootNode.children[0];

			while (true) {
				parent = node.parent;
				children = parent.children;

				if (children[0] === node) {
					// If this is already the first sibling, goto parent
					node = parent;
					if (!node.parent) {
						break; // first node of the tree
					}
					children = parent.children;
				} else {
					// Otherwise, goto prev. sibling
					idx = children.indexOf(node);
					node = children[idx - 1];
					// If the prev. sibling has children, follow down to last descendant
					while (
						// See: https://github.com/eslint/eslint/issues/11302
						// eslint-disable-next-line no-unmodified-loop-condition
						(includeHidden || node.expanded) &&
						node.children &&
						node.children.length
					) {
						children = node.children;
						parent = node;
						node = children[children.length - 1];
					}
				}
				// Skip invisible
				if (!includeHidden && !node.isVisible()) {
					continue;
				}
				if (fn(node) === false) {
					return false;
				}
			}
		},
		/** Write warning to browser console if debugLevel >= 2 (prepending tree info)
		 *
		 * @param {*} msg string or object or array of such
		 */
		warn: function (msg) {
			if (this.options.debugLevel >= 2) {
				Array.prototype.unshift.call(arguments, this.toString());
				consoleApply("warn", arguments);
			}
		},
	};

	/**
	 * These additional methods of the {@link Fancytree} class are 'hook functions'
	 * that can be used and overloaded by extensions.
	 *
	 * @see [writing extensions](https://github.com/mar10/fancytree/wiki/TutorialExtensions)
	 * @mixin Fancytree_Hooks
	 */
	$.extend(
		Fancytree.prototype,
		/** @lends Fancytree_Hooks# */
		{
			/** Default handling for mouse click events.
			 *
			 * @param {EventData} ctx
			 */
			nodeClick: function (ctx) {
				var activate,
					expand,
					// event = ctx.originalEvent,
					targetType = ctx.targetType,
					node = ctx.node;

				// this.debug("ftnode.onClick(" + event.type + "): ftnode:" + this + ", button:" + event.button + ", which: " + event.which, ctx);
				// TODO: use switch
				// TODO: make sure clicks on embedded <input> doesn't steal focus (see table sample)
				if (targetType === "expander") {
					if (node.isLoading()) {
						// #495: we probably got a click event while a lazy load is pending.
						// The 'expanded' state is not yet set, so 'toggle' would expand
						// and trigger lazyLoad again.
						// It would be better to allow to collapse/expand the status node
						// while loading (instead of ignoring), but that would require some
						// more work.
						node.debug("Got 2nd click while loading: ignored");
						return;
					}
					// Clicking the expander icon always expands/collapses
					this._callHook("nodeToggleExpanded", ctx);
				} else if (targetType === "checkbox") {
					// Clicking the checkbox always (de)selects
					this._callHook("nodeToggleSelected", ctx);
					if (ctx.options.focusOnSelect) {
						// #358
						this._callHook("nodeSetFocus", ctx, true);
					}
				} else {
					// Honor `clickFolderMode` for
					expand = false;
					activate = true;
					if (node.folder) {
						switch (ctx.options.clickFolderMode) {
							case 2: // expand only
								expand = true;
								activate = false;
								break;
							case 3: // expand and activate
								activate = true;
								expand = true; //!node.isExpanded();
								break;
							// else 1 or 4: just activate
						}
					}
					if (activate) {
						this.nodeSetFocus(ctx);
						this._callHook("nodeSetActive", ctx, true);
					}
					if (expand) {
						if (!activate) {
							// this._callHook("nodeSetFocus", ctx);
						}
						// this._callHook("nodeSetExpanded", ctx, true);
						this._callHook("nodeToggleExpanded", ctx);
					}
				}
				// Make sure that clicks stop, otherwise <a href='#'> jumps to the top
				// if(event.target.localName === "a" && event.target.className === "fancytree-title"){
				// 	event.preventDefault();
				// }
				// TODO: return promise?
			},
			/** Collapse all other  children of same parent.
			 *
			 * @param {EventData} ctx
			 * @param {object} callOpts
			 */
			nodeCollapseSiblings: function (ctx, callOpts) {
				// TODO: return promise?
				var ac,
					i,
					l,
					node = ctx.node;

				if (node.parent) {
					ac = node.parent.children;
					for (i = 0, l = ac.length; i < l; i++) {
						if (ac[i] !== node && ac[i].expanded) {
							this._callHook(
								"nodeSetExpanded",
								ac[i],
								false,
								callOpts
							);
						}
					}
				}
			},
			/** Default handling for mouse douleclick events.
			 * @param {EventData} ctx
			 */
			nodeDblclick: function (ctx) {
				// TODO: return promise?
				if (
					ctx.targetType === "title" &&
					ctx.options.clickFolderMode === 4
				) {
					// this.nodeSetFocus(ctx);
					// this._callHook("nodeSetActive", ctx, true);
					this._callHook("nodeToggleExpanded", ctx);
				}
				// TODO: prevent text selection on dblclicks
				if (ctx.targetType === "title") {
					ctx.originalEvent.preventDefault();
				}
			},
			/** Default handling for mouse keydown events.
			 *
			 * NOTE: this may be called with node == null if tree (but no node) has focus.
			 * @param {EventData} ctx
			 */
			nodeKeydown: function (ctx) {
				// TODO: return promise?
				var matchNode,
					stamp,
					_res,
					focusNode,
					event = ctx.originalEvent,
					node = ctx.node,
					tree = ctx.tree,
					opts = ctx.options,
					which = event.which,
					// #909: Use event.key, to get unicode characters.
					// We can't use `/\w/.test(key)`, because that would
					// only detect plain ascii alpha-numerics. But we still need
					// to ignore modifier-only, whitespace, cursor-keys, etc.
					key = event.key || String.fromCharCode(which),
					specialModifiers = !!(
						event.altKey ||
						event.ctrlKey ||
						event.metaKey
					),
					isAlnum =
						!MODIFIERS[which] &&
						!SPECIAL_KEYCODES[which] &&
						!specialModifiers,
					$target = $(event.target),
					handled = true,
					activate = !(event.ctrlKey || !opts.autoActivate);

				// (node || FT).debug("ftnode.nodeKeydown(" + event.type + "): ftnode:" + this + ", charCode:" + event.charCode + ", keyCode: " + event.keyCode + ", which: " + event.which);
				// FT.debug( "eventToString(): " + FT.eventToString(event) + ", key='" + key + "', isAlnum: " + isAlnum );

				// Set focus to active (or first node) if no other node has the focus yet
				if (!node) {
					focusNode = this.getActiveNode() || this.getFirstChild();
					if (focusNode) {
						focusNode.setFocus();
						node = ctx.node = this.focusNode;
						node.debug("Keydown force focus on active node");
					}
				}

				if (
					opts.quicksearch &&
					isAlnum &&
					!$target.is(":input:enabled")
				) {
					// Allow to search for longer streaks if typed in quickly
					stamp = Date.now();
					if (stamp - tree.lastQuicksearchTime > 500) {
						tree.lastQuicksearchTerm = "";
					}
					tree.lastQuicksearchTime = stamp;
					tree.lastQuicksearchTerm += key;
					// tree.debug("quicksearch find", tree.lastQuicksearchTerm);
					matchNode = tree.findNextNode(
						tree.lastQuicksearchTerm,
						tree.getActiveNode()
					);
					if (matchNode) {
						matchNode.setActive();
					}
					event.preventDefault();
					return;
				}
				switch (FT.eventToString(event)) {
					case "+":
					case "=": // 187: '+' @ Chrome, Safari
						tree.nodeSetExpanded(ctx, true);
						break;
					case "-":
						tree.nodeSetExpanded(ctx, false);
						break;
					case "space":
						if (node.isPagingNode()) {
							tree._triggerNodeEvent("clickPaging", ctx, event);
						} else if (
							FT.evalOption("checkbox", node, node, opts, false)
						) {
							// #768
							tree.nodeToggleSelected(ctx);
						} else {
							tree.nodeSetActive(ctx, true);
						}
						break;
					case "return":
						tree.nodeSetActive(ctx, true);
						break;
					case "home":
					case "end":
					case "backspace":
					case "left":
					case "right":
					case "up":
					case "down":
						_res = node.navigate(event.which, activate);
						break;
					default:
						handled = false;
				}
				if (handled) {
					event.preventDefault();
				}
			},

			// /** Default handling for mouse keypress events. */
			// nodeKeypress: function(ctx) {
			//     var event = ctx.originalEvent;
			// },

			// /** Trigger lazyLoad event (async). */
			// nodeLazyLoad: function(ctx) {
			//     var node = ctx.node;
			//     if(this._triggerNodeEvent())
			// },
			/** Load child nodes (async).
			 *
			 * @param {EventData} ctx
			 * @param {object[]|object|string|$.Promise|function} source
			 * @returns {$.Promise} The deferred will be resolved as soon as the (ajax)
			 *     data was rendered.
			 */
			nodeLoadChildren: function (ctx, source) {
				var ajax,
					delay,
					ajaxDfd = null,
					resultDfd,
					isAsync = true,
					tree = ctx.tree,
					node = ctx.node,
					nodePrevParent = node.parent,
					tag = "nodeLoadChildren",
					requestId = Date.now();

				// `source` is a callback: use the returned result instead:
				if (_isFunction(source)) {
					source = source.call(tree, { type: "source" }, ctx);
					_assert(
						!_isFunction(source),
						"source callback must not return another function"
					);
				}
				// `source` is already a promise:
				if (_isFunction(source.then)) {
					// _assert(_isFunction(source.always), "Expected jQuery?");
					ajaxDfd = source;
				} else if (source.url) {
					// `source` is an Ajax options object
					ajax = $.extend({}, ctx.options.ajax, source);
					if (ajax.debugDelay) {
						// Simulate a slow server
						delay = ajax.debugDelay;
						delete ajax.debugDelay; // remove debug option
						if (_isArray(delay)) {
							// random delay range [min..max]
							delay =
								delay[0] +
								Math.random() * (delay[1] - delay[0]);
						}
						node.warn(
							"nodeLoadChildren waiting debugDelay " +
								Math.round(delay) +
								" ms ..."
						);
						ajaxDfd = $.Deferred(function (ajaxDfd) {
							setTimeout(function () {
								$.ajax(ajax)
									.done(function () {
										ajaxDfd.resolveWith(this, arguments);
									})
									.fail(function () {
										ajaxDfd.rejectWith(this, arguments);
									});
							}, delay);
						});
					} else {
						ajaxDfd = $.ajax(ajax);
					}
				} else if ($.isPlainObject(source) || _isArray(source)) {
					// `source` is already a constant dict or list, but we convert
					// to a thenable for unified processing.
					// 2020-01-03: refactored.
					// `ajaxDfd = $.when(source)` would do the trick, but the returned
					// promise will resolve async, which broke some tests and
					// would probably also break current implementations out there.
					// So we mock-up a thenable that resolves synchronously:
					ajaxDfd = {
						then: function (resolve, reject) {
							resolve(source, null, null);
						},
					};
					isAsync = false;
				} else {
					$.error("Invalid source type: " + source);
				}

				// Check for overlapping requests
				if (node._requestId) {
					node.warn(
						"Recursive load request #" +
							requestId +
							" while #" +
							node._requestId +
							" is pending."
					);
					node._requestId = requestId;
					// 	node.debug("Send load request #" + requestId);
				}

				if (isAsync) {
					tree.debugTime(tag);
					tree.nodeSetStatus(ctx, "loading");
				}

				// The async Ajax request has now started...
				// Defer the deferred:
				// we want to be able to reject invalid responses, even if
				// the raw HTTP Ajax XHR resolved as Ok.
				// We use the ajaxDfd.then() syntax here, which is compatible with
				// jQuery and ECMA6.
				// However resultDfd is a jQuery deferred, which is currently the
				// expected result type of nodeLoadChildren()
				resultDfd = new $.Deferred();
				ajaxDfd.then(
					function (data, textStatus, jqXHR) {
						// ajaxDfd was resolved, but we reject or resolve resultDfd
						// depending on the response data
						var errorObj, res;

						if (
							(source.dataType === "json" ||
								source.dataType === "jsonp") &&
							typeof data === "string"
						) {
							$.error(
								"Ajax request returned a string (did you get the JSON dataType wrong?)."
							);
						}
						if (node._requestId && node._requestId > requestId) {
							// The expected request time stamp is later than `requestId`
							// (which was kept as as closure variable to this handler function)
							// node.warn("Ignored load response for obsolete request #" + requestId + " (expected #" + node._requestId + ")");
							resultDfd.rejectWith(this, [
								RECURSIVE_REQUEST_ERROR,
							]);
							return;
							// } else {
							// 	node.debug("Response returned for load request #" + requestId);
						}
						if (node.parent === null && nodePrevParent !== null) {
							resultDfd.rejectWith(this, [
								INVALID_REQUEST_TARGET_ERROR,
							]);
							return;
						}
						// Allow to adjust the received response data in the `postProcess` event.
						if (ctx.options.postProcess) {
							// The handler may either
							//   - modify `ctx.response` in-place (and leave `ctx.result` undefined)
							//     => res = undefined
							//   - return a replacement in `ctx.result`
							//     => res = <new data>
							//   If res contains an `error` property, an error status is displayed
							try {
								res = tree._triggerNodeEvent(
									"postProcess",
									ctx,
									ctx.originalEvent,
									{
										response: data,
										error: null,
										dataType: source.dataType,
									}
								);
								if (res.error) {
									tree.warn(
										"postProcess returned error:",
										res
									);
								}
							} catch (e) {
								res = {
									error: e,
									message: "" + e,
									details: "postProcess failed",
								};
							}
							if (res.error) {
								// Either postProcess failed with an exception, or the returned
								// result object has an 'error' property attached:
								errorObj = $.isPlainObject(res.error)
									? res.error
									: { message: res.error };
								errorObj = tree._makeHookContext(
									node,
									null,
									errorObj
								);
								resultDfd.rejectWith(this, [errorObj]);
								return;
							}
							if (
								_isArray(res) ||
								($.isPlainObject(res) && _isArray(res.children))
							) {
								// Use `ctx.result` if valid
								// (otherwise use existing data, which may have been modified in-place)
								data = res;
							}
						} else if (
							data &&
							_hasProp(data, "d") &&
							ctx.options.enableAspx
						) {
							// Process ASPX WebMethod JSON object inside "d" property
							// (only if no postProcess event was defined)
							if (ctx.options.enableAspx === 42) {
								tree.warn(
									"The default for enableAspx will change to `false` in the fututure. " +
										"Pass `enableAspx: true` or implement postProcess to silence this warning."
								);
							}
							data =
								typeof data.d === "string"
									? $.parseJSON(data.d)
									: data.d;
						}
						resultDfd.resolveWith(this, [data]);
					},
					function (jqXHR, textStatus, errorThrown) {
						// ajaxDfd was rejected, so we reject resultDfd as well
						var errorObj = tree._makeHookContext(node, null, {
							error: jqXHR,
							args: Array.prototype.slice.call(arguments),
							message: errorThrown,
							details: jqXHR.status + ": " + errorThrown,
						});
						resultDfd.rejectWith(this, [errorObj]);
					}
				);

				// The async Ajax request has now started.
				// resultDfd will be resolved/rejected after the response arrived,
				// was postProcessed, and checked.
				// Now we implement the UI update and add the data to the tree.
				// We also return this promise to the caller.
				resultDfd
					.done(function (data) {
						tree.nodeSetStatus(ctx, "ok");
						var children, metaData, noDataRes;

						if ($.isPlainObject(data)) {
							// We got {foo: 'abc', children: [...]}
							// Copy extra properties to tree.data.foo
							_assert(
								node.isRootNode(),
								"source may only be an object for root nodes (expecting an array of child objects otherwise)"
							);
							_assert(
								_isArray(data.children),
								"if an object is passed as source, it must contain a 'children' array (all other properties are added to 'tree.data')"
							);
							metaData = data;
							children = data.children;
							delete metaData.children;
							// Copy some attributes to tree.data
							$.each(TREE_ATTRS, function (i, attr) {
								if (metaData[attr] !== undefined) {
									tree[attr] = metaData[attr];
									delete metaData[attr];
								}
							});
							// Copy all other attributes to tree.data.NAME
							$.extend(tree.data, metaData);
						} else {
							children = data;
						}
						_assert(
							_isArray(children),
							"expected array of children"
						);
						node._setChildren(children);

						if (tree.options.nodata && children.length === 0) {
							if (_isFunction(tree.options.nodata)) {
								noDataRes = tree.options.nodata.call(
									tree,
									{ type: "nodata" },
									ctx
								);
							} else if (
								tree.options.nodata === true &&
								node.isRootNode()
							) {
								noDataRes = tree.options.strings.noData;
							} else if (
								typeof tree.options.nodata === "string" &&
								node.isRootNode()
							) {
								noDataRes = tree.options.nodata;
							}
							if (noDataRes) {
								node.setStatus("nodata", noDataRes);
							}
						}
						// trigger fancytreeloadchildren
						tree._triggerNodeEvent("loadChildren", node);
					})
					.fail(function (error) {
						var ctxErr;

						if (error === RECURSIVE_REQUEST_ERROR) {
							node.warn(
								"Ignored response for obsolete load request #" +
									requestId +
									" (expected #" +
									node._requestId +
									")"
							);
							return;
						} else if (error === INVALID_REQUEST_TARGET_ERROR) {
							node.warn(
								"Lazy parent node was removed while loading: discarding response."
							);
							return;
						} else if (error.node && error.error && error.message) {
							// error is already a context object
							ctxErr = error;
						} else {
							ctxErr = tree._makeHookContext(node, null, {
								error: error, // it can be jqXHR or any custom error
								args: Array.prototype.slice.call(arguments),
								message: error
									? error.message || error.toString()
									: "",
							});
							if (ctxErr.message === "[object Object]") {
								ctxErr.message = "";
							}
						}
						node.warn(
							"Load children failed (" + ctxErr.message + ")",
							ctxErr
						);
						if (
							tree._triggerNodeEvent(
								"loadError",
								ctxErr,
								null
							) !== false
						) {
							tree.nodeSetStatus(
								ctx,
								"error",
								ctxErr.message,
								ctxErr.details
							);
						}
					})
					.always(function () {
						node._requestId = null;
						if (isAsync) {
							tree.debugTimeEnd(tag);
						}
					});

				return resultDfd.promise();
			},
			/** [Not Implemented]  */
			nodeLoadKeyPath: function (ctx, keyPathList) {
				// TODO: implement and improve
				// http://code.google.com/p/dynatree/issues/detail?id=222
			},
			/**
			 * Remove a single direct child of ctx.node.
			 * @param {EventData} ctx
			 * @param {FancytreeNode} childNode dircect child of ctx.node
			 */
			nodeRemoveChild: function (ctx, childNode) {
				var idx,
					node = ctx.node,
					// opts = ctx.options,
					subCtx = $.extend({}, ctx, { node: childNode }),
					children = node.children;

				// FT.debug("nodeRemoveChild()", node.toString(), childNode.toString());

				if (children.length === 1) {
					_assert(childNode === children[0], "invalid single child");
					return this.nodeRemoveChildren(ctx);
				}
				if (
					this.activeNode &&
					(childNode === this.activeNode ||
						this.activeNode.isDescendantOf(childNode))
				) {
					this.activeNode.setActive(false); // TODO: don't fire events
				}
				if (
					this.focusNode &&
					(childNode === this.focusNode ||
						this.focusNode.isDescendantOf(childNode))
				) {
					this.focusNode = null;
				}
				// TODO: persist must take care to clear select and expand cookies
				this.nodeRemoveMarkup(subCtx);
				this.nodeRemoveChildren(subCtx);
				idx = $.inArray(childNode, children);
				_assert(idx >= 0, "invalid child");
				// Notify listeners
				node.triggerModifyChild("remove", childNode);
				// Unlink to support GC
				childNode.visit(function (n) {
					n.parent = null;
				}, true);
				this._callHook("treeRegisterNode", this, false, childNode);
				// remove from child list
				children.splice(idx, 1);
			},
			/**Remove HTML markup for all descendents of ctx.node.
			 * @param {EventData} ctx
			 */
			nodeRemoveChildMarkup: function (ctx) {
				var node = ctx.node;

				// FT.debug("nodeRemoveChildMarkup()", node.toString());
				// TODO: Unlink attr.ftnode to support GC
				if (node.ul) {
					if (node.isRootNode()) {
						$(node.ul).empty();
					} else {
						$(node.ul).remove();
						node.ul = null;
					}
					node.visit(function (n) {
						n.li = n.ul = null;
					});
				}
			},
			/**Remove all descendants of ctx.node.
			 * @param {EventData} ctx
			 */
			nodeRemoveChildren: function (ctx) {
				var //subCtx,
					tree = ctx.tree,
					node = ctx.node,
					children = node.children;
				// opts = ctx.options;

				// FT.debug("nodeRemoveChildren()", node.toString());
				if (!children) {
					return;
				}
				if (this.activeNode && this.activeNode.isDescendantOf(node)) {
					this.activeNode.setActive(false); // TODO: don't fire events
				}
				if (this.focusNode && this.focusNode.isDescendantOf(node)) {
					this.focusNode = null;
				}
				// TODO: persist must take care to clear select and expand cookies
				this.nodeRemoveChildMarkup(ctx);
				// Unlink children to support GC
				// TODO: also delete this.children (not possible using visit())
				// subCtx = $.extend({}, ctx);
				node.triggerModifyChild("remove", null);
				node.visit(function (n) {
					n.parent = null;
					tree._callHook("treeRegisterNode", tree, false, n);
				});
				if (node.lazy) {
					// 'undefined' would be interpreted as 'not yet loaded' for lazy nodes
					node.children = [];
				} else {
					node.children = null;
				}
				if (!node.isRootNode()) {
					node.expanded = false; // #449, #459
				}
				this.nodeRenderStatus(ctx);
			},
			/**Remove HTML markup for ctx.node and all its descendents.
			 * @param {EventData} ctx
			 */
			nodeRemoveMarkup: function (ctx) {
				var node = ctx.node;
				// FT.debug("nodeRemoveMarkup()", node.toString());
				// TODO: Unlink attr.ftnode to support GC
				if (node.li) {
					$(node.li).remove();
					node.li = null;
				}
				this.nodeRemoveChildMarkup(ctx);
			},
			/**
			 * Create `<li><span>..</span> .. </li>` tags for this node.
			 *
			 * This method takes care that all HTML markup is created that is required
			 * to display this node in its current state.
			 *
			 * Call this method to create new nodes, or after the strucuture
			 * was changed (e.g. after moving this node or adding/removing children)
			 * nodeRenderTitle() and nodeRenderStatus() are implied.
			 *
			 * ```html
			 * <li id='KEY' ftnode=NODE>
			 *     <span class='fancytree-node fancytree-expanded fancytree-has-children fancytree-lastsib fancytree-exp-el fancytree-ico-e'>
			 *         <span class="fancytree-expander"></span>
			 *         <span class="fancytree-checkbox"></span> // only present in checkbox mode
			 *         <span class="fancytree-icon"></span>
			 *         <a href="#" class="fancytree-title"> Node 1 </a>
			 *     </span>
			 *     <ul> // only present if node has children
			 *         <li id='KEY' ftnode=NODE> child1 ... </li>
			 *         <li id='KEY' ftnode=NODE> child2 ... </li>
			 *     </ul>
			 * </li>
			 * ```
			 *
			 * @param {EventData} ctx
			 * @param {boolean} [force=false] re-render, even if html markup was already created
			 * @param {boolean} [deep=false] also render all descendants, even if parent is collapsed
			 * @param {boolean} [collapsed=false] force root node to be collapsed, so we can apply animated expand later
			 */
			nodeRender: function (ctx, force, deep, collapsed, _recursive) {
				/* This method must take care of all cases where the current data mode
				 * (i.e. node hierarchy) does not match the current markup.
				 *
				 * - node was not yet rendered:
				 *   create markup
				 * - node was rendered: exit fast
				 * - children have been added
				 * - children have been removed
				 */
				var childLI,
					childNode1,
					childNode2,
					i,
					l,
					next,
					subCtx,
					node = ctx.node,
					tree = ctx.tree,
					opts = ctx.options,
					aria = opts.aria,
					firstTime = false,
					parent = node.parent,
					isRootNode = !parent,
					children = node.children,
					successorLi = null;
				// FT.debug("nodeRender(" + !!force + ", " + !!deep + ")", node.toString());

				if (tree._enableUpdate === false) {
					// tree.debug("no render", tree._enableUpdate);
					return;
				}
				if (!isRootNode && !parent.ul) {
					// Calling node.collapse on a deep, unrendered node
					return;
				}
				_assert(isRootNode || parent.ul, "parent UL must exist");

				// Render the node
				if (!isRootNode) {
					// Discard markup on force-mode, or if it is not linked to parent <ul>
					if (
						node.li &&
						(force || node.li.parentNode !== node.parent.ul)
					) {
						if (node.li.parentNode === node.parent.ul) {
							// #486: store following node, so we can insert the new markup there later
							successorLi = node.li.nextSibling;
						} else {
							// May happen, when a top-level node was dropped over another
							this.debug(
								"Unlinking " +
									node +
									" (must be child of " +
									node.parent +
									")"
							);
						}
						//	            this.debug("nodeRemoveMarkup...");
						this.nodeRemoveMarkup(ctx);
					}
					// Create <li><span /> </li>
					// node.debug("render...");
					if (node.li) {
						// this.nodeRenderTitle(ctx);
						this.nodeRenderStatus(ctx);
					} else {
						// node.debug("render... really");
						firstTime = true;
						node.li = document.createElement("li");
						node.li.ftnode = node;

						if (node.key && opts.generateIds) {
							node.li.id = opts.idPrefix + node.key;
						}
						node.span = document.createElement("span");
						node.span.className = "fancytree-node";
						if (aria && !node.tr) {
							$(node.li).attr("role", "treeitem");
						}
						node.li.appendChild(node.span);

						// Create inner HTML for the <span> (expander, checkbox, icon, and title)
						this.nodeRenderTitle(ctx);

						// Allow tweaking and binding, after node was created for the first time
						if (opts.createNode) {
							opts.createNode.call(
								tree,
								{ type: "createNode" },
								ctx
							);
						}
					}
					// Allow tweaking after node state was rendered
					if (opts.renderNode) {
						opts.renderNode.call(tree, { type: "renderNode" }, ctx);
					}
				}

				// Visit child nodes
				if (children) {
					if (isRootNode || node.expanded || deep === true) {
						// Create a UL to hold the children
						if (!node.ul) {
							node.ul = document.createElement("ul");
							if (
								(collapsed === true && !_recursive) ||
								!node.expanded
							) {
								// hide top UL, so we can use an animation to show it later
								node.ul.style.display = "none";
							}
							if (aria) {
								$(node.ul).attr("role", "group");
							}
							if (node.li) {
								// issue #67
								node.li.appendChild(node.ul);
							} else {
								node.tree.$div.append(node.ul);
							}
						}
						// Add child markup
						for (i = 0, l = children.length; i < l; i++) {
							subCtx = $.extend({}, ctx, { node: children[i] });
							this.nodeRender(subCtx, force, deep, false, true);
						}
						// Remove <li> if nodes have moved to another parent
						childLI = node.ul.firstChild;
						while (childLI) {
							childNode2 = childLI.ftnode;
							if (childNode2 && childNode2.parent !== node) {
								node.debug(
									"_fixParent: remove missing " + childNode2,
									childLI
								);
								next = childLI.nextSibling;
								childLI.parentNode.removeChild(childLI);
								childLI = next;
							} else {
								childLI = childLI.nextSibling;
							}
						}
						// Make sure, that <li> order matches node.children order.
						childLI = node.ul.firstChild;
						for (i = 0, l = children.length - 1; i < l; i++) {
							childNode1 = children[i];
							childNode2 = childLI.ftnode;
							if (childNode1 === childNode2) {
								childLI = childLI.nextSibling;
							} else {
								// node.debug("_fixOrder: mismatch at index " + i + ": " + childNode1 + " != " + childNode2);
								node.ul.insertBefore(
									childNode1.li,
									childNode2.li
								);
							}
						}
					}
				} else {
					// No children: remove markup if any
					if (node.ul) {
						// alert("remove child markup for " + node);
						this.warn("remove child markup for " + node);
						this.nodeRemoveChildMarkup(ctx);
					}
				}
				if (!isRootNode) {
					// Update element classes according to node state
					// this.nodeRenderStatus(ctx);
					// Finally add the whole structure to the DOM, so the browser can render
					if (firstTime) {
						// #486: successorLi is set, if we re-rendered (i.e. discarded)
						// existing markup, which  we want to insert at the same position.
						// (null is equivalent to append)
						// 		parent.ul.appendChild(node.li);
						parent.ul.insertBefore(node.li, successorLi);
					}
				}
			},
			/** Create HTML inside the node's outer `<span>` (i.e. expander, checkbox,
			 * icon, and title).
			 *
			 * nodeRenderStatus() is implied.
			 * @param {EventData} ctx
			 * @param {string} [title] optinal new title
			 */
			nodeRenderTitle: function (ctx, title) {
				// set node connector images, links and text
				var checkbox,
					className,
					icon,
					nodeTitle,
					role,
					tabindex,
					tooltip,
					iconTooltip,
					node = ctx.node,
					tree = ctx.tree,
					opts = ctx.options,
					aria = opts.aria,
					level = node.getLevel(),
					ares = [];

				if (title !== undefined) {
					node.title = title;
				}
				if (!node.span || tree._enableUpdate === false) {
					// Silently bail out if node was not rendered yet, assuming
					// node.render() will be called as the node becomes visible
					return;
				}
				// Connector (expanded, expandable or simple)
				role =
					aria && node.hasChildren() !== false
						? " role='button'"
						: "";
				if (level < opts.minExpandLevel) {
					if (!node.lazy) {
						node.expanded = true;
					}
					if (level > 1) {
						ares.push(
							"<span " +
								role +
								" class='fancytree-expander fancytree-expander-fixed'></span>"
						);
					}
					// .. else (i.e. for root level) skip expander/connector alltogether
				} else {
					ares.push(
						"<span " + role + " class='fancytree-expander'></span>"
					);
				}
				// Checkbox mode
				checkbox = FT.evalOption("checkbox", node, node, opts, false);

				if (checkbox && !node.isStatusNode()) {
					role = aria ? " role='checkbox'" : "";
					className = "fancytree-checkbox";
					if (
						checkbox === "radio" ||
						(node.parent && node.parent.radiogroup)
					) {
						className += " fancytree-radio";
					}
					ares.push(
						"<span " + role + " class='" + className + "'></span>"
					);
				}
				// Folder or doctype icon
				if (node.data.iconClass !== undefined) {
					// 2015-11-16
					// Handle / warn about backward compatibility
					if (node.icon) {
						$.error(
							"'iconClass' node option is deprecated since v2.14.0: use 'icon' only instead"
						);
					} else {
						node.warn(
							"'iconClass' node option is deprecated since v2.14.0: use 'icon' instead"
						);
						node.icon = node.data.iconClass;
					}
				}
				// If opts.icon is a callback and returns something other than undefined, use that
				// else if node.icon is a boolean or string, use that
				// else if opts.icon is a boolean or string, use that
				// else show standard icon (which may be different for folders or documents)
				icon = FT.evalOption("icon", node, node, opts, true);
				// if( typeof icon !== "boolean" ) {
				// 	// icon is defined, but not true/false: must be a string
				// 	icon = "" + icon;
				// }
				if (icon !== false) {
					role = aria ? " role='presentation'" : "";

					iconTooltip = FT.evalOption(
						"iconTooltip",
						node,
						node,
						opts,
						null
					);
					iconTooltip = iconTooltip
						? " title='" + _escapeTooltip(iconTooltip) + "'"
						: "";

					if (typeof icon === "string") {
						if (TEST_IMG.test(icon)) {
							// node.icon is an image url. Prepend imagePath
							icon =
								icon.charAt(0) === "/"
									? icon
									: (opts.imagePath || "") + icon;
							ares.push(
								"<img src='" +
									icon +
									"' class='fancytree-icon'" +
									iconTooltip +
									" alt='' />"
							);
						} else {
							ares.push(
								"<span " +
									role +
									" class='fancytree-custom-icon " +
									icon +
									"'" +
									iconTooltip +
									"></span>"
							);
						}
					} else if (icon.text) {
						ares.push(
							"<span " +
								role +
								" class='fancytree-custom-icon " +
								(icon.addClass || "") +
								"'" +
								iconTooltip +
								">" +
								FT.escapeHtml(icon.text) +
								"</span>"
						);
					} else if (icon.html) {
						ares.push(
							"<span " +
								role +
								" class='fancytree-custom-icon " +
								(icon.addClass || "") +
								"'" +
								iconTooltip +
								">" +
								icon.html +
								"</span>"
						);
					} else {
						// standard icon: theme css will take care of this
						ares.push(
							"<span " +
								role +
								" class='fancytree-icon'" +
								iconTooltip +
								"></span>"
						);
					}
				}
				// Node title
				nodeTitle = "";
				if (opts.renderTitle) {
					nodeTitle =
						opts.renderTitle.call(
							tree,
							{ type: "renderTitle" },
							ctx
						) || "";
				}
				if (!nodeTitle) {
					tooltip = FT.evalOption("tooltip", node, node, opts, null);
					if (tooltip === true) {
						tooltip = node.title;
					}
					// if( node.tooltip ) {
					// 	tooltip = node.tooltip;
					// } else if ( opts.tooltip ) {
					// 	tooltip = opts.tooltip === true ? node.title : opts.tooltip.call(tree, node);
					// }
					tooltip = tooltip
						? " title='" + _escapeTooltip(tooltip) + "'"
						: "";
					tabindex = opts.titlesTabbable ? " tabindex='0'" : "";

					nodeTitle =
						"<span class='fancytree-title'" +
						tooltip +
						tabindex +
						">" +
						(opts.escapeTitles
							? FT.escapeHtml(node.title)
							: node.title) +
						"</span>";
				}
				ares.push(nodeTitle);
				// Note: this will trigger focusout, if node had the focus
				//$(node.span).html(ares.join("")); // it will cleanup the jQuery data currently associated with SPAN (if any), but it executes more slowly
				node.span.innerHTML = ares.join("");
				// Update CSS classes
				this.nodeRenderStatus(ctx);
				if (opts.enhanceTitle) {
					ctx.$title = $(">span.fancytree-title", node.span);
					nodeTitle =
						opts.enhanceTitle.call(
							tree,
							{ type: "enhanceTitle" },
							ctx
						) || "";
				}
			},
			/** Update element classes according to node state.
			 * @param {EventData} ctx
			 */
			nodeRenderStatus: function (ctx) {
				// Set classes for current status
				var $ariaElem,
					node = ctx.node,
					tree = ctx.tree,
					opts = ctx.options,
					// 	nodeContainer = node[tree.nodeContainerAttrName],
					hasChildren = node.hasChildren(),
					isLastSib = node.isLastSibling(),
					aria = opts.aria,
					cn = opts._classNames,
					cnList = [],
					statusElem = node[tree.statusClassPropName];

				if (!statusElem || tree._enableUpdate === false) {
					// if this function is called for an unrendered node, ignore it (will be updated on nect render anyway)
					return;
				}
				if (aria) {
					$ariaElem = $(node.tr || node.li);
				}
				// Build a list of class names that we will add to the node <span>
				cnList.push(cn.node);
				if (tree.activeNode === node) {
					cnList.push(cn.active);
					// 		$(">span.fancytree-title", statusElem).attr("tabindex", "0");
					// 		tree.$container.removeAttr("tabindex");
					// }else{
					// 		$(">span.fancytree-title", statusElem).removeAttr("tabindex");
					// 		tree.$container.attr("tabindex", "0");
				}
				if (tree.focusNode === node) {
					cnList.push(cn.focused);
				}
				if (node.expanded) {
					cnList.push(cn.expanded);
				}
				if (aria) {
					if (hasChildren === false) {
						$ariaElem.removeAttr("aria-expanded");
					} else {
						$ariaElem.attr("aria-expanded", Boolean(node.expanded));
					}
				}
				if (node.folder) {
					cnList.push(cn.folder);
				}
				if (hasChildren !== false) {
					cnList.push(cn.hasChildren);
				}
				// TODO: required?
				if (isLastSib) {
					cnList.push(cn.lastsib);
				}
				if (node.lazy && node.children == null) {
					cnList.push(cn.lazy);
				}
				if (node.partload) {
					cnList.push(cn.partload);
				}
				if (node.partsel) {
					cnList.push(cn.partsel);
				}
				if (FT.evalOption("unselectable", node, node, opts, false)) {
					cnList.push(cn.unselectable);
				}
				if (node._isLoading) {
					cnList.push(cn.loading);
				}
				if (node._error) {
					cnList.push(cn.error);
				}
				if (node.statusNodeType) {
					cnList.push(cn.statusNodePrefix + node.statusNodeType);
				}
				if (node.selected) {
					cnList.push(cn.selected);
					if (aria) {
						$ariaElem.attr("aria-selected", true);
					}
				} else if (aria) {
					$ariaElem.attr("aria-selected", false);
				}
				if (node.extraClasses) {
					cnList.push(node.extraClasses);
				}
				// IE6 doesn't correctly evaluate multiple class names,
				// so we create combined class names that can be used in the CSS
				if (hasChildren === false) {
					cnList.push(
						cn.combinedExpanderPrefix + "n" + (isLastSib ? "l" : "")
					);
				} else {
					cnList.push(
						cn.combinedExpanderPrefix +
							(node.expanded ? "e" : "c") +
							(node.lazy && node.children == null ? "d" : "") +
							(isLastSib ? "l" : "")
					);
				}
				cnList.push(
					cn.combinedIconPrefix +
						(node.expanded ? "e" : "c") +
						(node.folder ? "f" : "")
				);
				// node.span.className = cnList.join(" ");
				statusElem.className = cnList.join(" ");

				// TODO: we should not set this in the <span> tag also, if we set it here:
				// Maybe most (all) of the classes should be set in LI instead of SPAN?
				if (node.li) {
					// #719: we have to consider that there may be already other classes:
					$(node.li).toggleClass(cn.lastsib, isLastSib);
				}
			},
			/** Activate node.
			 * flag defaults to true.
			 * If flag is true, the node is activated (must be a synchronous operation)
			 * If flag is false, the node is deactivated (must be a synchronous operation)
			 * @param {EventData} ctx
			 * @param {boolean} [flag=true]
			 * @param {object} [opts] additional options. Defaults to {noEvents: false, noFocus: false}
			 * @returns {$.Promise}
			 */
			nodeSetActive: function (ctx, flag, callOpts) {
				// Handle user click / [space] / [enter], according to clickFolderMode.
				callOpts = callOpts || {};
				var subCtx,
					node = ctx.node,
					tree = ctx.tree,
					opts = ctx.options,
					noEvents = callOpts.noEvents === true,
					noFocus = callOpts.noFocus === true,
					scroll = callOpts.scrollIntoView !== false,
					isActive = node === tree.activeNode;

				// flag defaults to true
				flag = flag !== false;
				// node.debug("nodeSetActive", flag);

				if (isActive === flag) {
					// Nothing to do
					return _getResolvedPromise(node);
				}
				// #1042: don't scroll between mousedown/-up when clicking an embedded link
				if (
					scroll &&
					ctx.originalEvent &&
					$(ctx.originalEvent.target).is("a,:checkbox")
				) {
					node.info("Not scrolling while clicking an embedded link.");
					scroll = false;
				}
				if (
					flag &&
					!noEvents &&
					this._triggerNodeEvent(
						"beforeActivate",
						node,
						ctx.originalEvent
					) === false
				) {
					// Callback returned false
					return _getRejectedPromise(node, ["rejected"]);
				}
				if (flag) {
					if (tree.activeNode) {
						_assert(
							tree.activeNode !== node,
							"node was active (inconsistency)"
						);
						subCtx = $.extend({}, ctx, { node: tree.activeNode });
						tree.nodeSetActive(subCtx, false);
						_assert(
							tree.activeNode === null,
							"deactivate was out of sync?"
						);
					}

					if (opts.activeVisible) {
						// If no focus is set (noFocus: true) and there is no focused node, this node is made visible.
						// scroll = noFocus && tree.focusNode == null;
						// #863: scroll by default (unless `scrollIntoView: false` was passed)
						node.makeVisible({ scrollIntoView: scroll });
					}
					tree.activeNode = node;
					tree.nodeRenderStatus(ctx);
					if (!noFocus) {
						tree.nodeSetFocus(ctx);
					}
					if (!noEvents) {
						tree._triggerNodeEvent(
							"activate",
							node,
							ctx.originalEvent
						);
					}
				} else {
					_assert(
						tree.activeNode === node,
						"node was not active (inconsistency)"
					);
					tree.activeNode = null;
					this.nodeRenderStatus(ctx);
					if (!noEvents) {
						ctx.tree._triggerNodeEvent(
							"deactivate",
							node,
							ctx.originalEvent
						);
					}
				}
				return _getResolvedPromise(node);
			},
			/** Expand or collapse node, return Deferred.promise.
			 *
			 * @param {EventData} ctx
			 * @param {boolean} [flag=true]
			 * @param {object} [opts] additional options. Defaults to `{noAnimation: false, noEvents: false}`
			 * @returns {$.Promise} The deferred will be resolved as soon as the (lazy)
			 *     data was retrieved, rendered, and the expand animation finished.
			 */
			nodeSetExpanded: function (ctx, flag, callOpts) {
				callOpts = callOpts || {};
				var _afterLoad,
					dfd,
					i,
					l,
					parents,
					prevAC,
					node = ctx.node,
					tree = ctx.tree,
					opts = ctx.options,
					noAnimation = callOpts.noAnimation === true,
					noEvents = callOpts.noEvents === true;

				// flag defaults to true
				flag = flag !== false;

				// node.debug("nodeSetExpanded(" + flag + ")");

				if ($(node.li).hasClass(opts._classNames.animating)) {
					node.warn(
						"setExpanded(" + flag + ") while animating: ignored."
					);
					return _getRejectedPromise(node, ["recursion"]);
				}

				if ((node.expanded && flag) || (!node.expanded && !flag)) {
					// Nothing to do
					// node.debug("nodeSetExpanded(" + flag + "): nothing to do");
					return _getResolvedPromise(node);
				} else if (flag && !node.lazy && !node.hasChildren()) {
					// Prevent expanding of empty nodes
					// return _getRejectedPromise(node, ["empty"]);
					return _getResolvedPromise(node);
				} else if (!flag && node.getLevel() < opts.minExpandLevel) {
					// Prevent collapsing locked levels
					return _getRejectedPromise(node, ["locked"]);
				} else if (
					!noEvents &&
					this._triggerNodeEvent(
						"beforeExpand",
						node,
						ctx.originalEvent
					) === false
				) {
					// Callback returned false
					return _getRejectedPromise(node, ["rejected"]);
				}
				// If this node inside a collpased node, no animation and scrolling is needed
				if (!noAnimation && !node.isVisible()) {
					noAnimation = callOpts.noAnimation = true;
				}

				dfd = new $.Deferred();

				// Auto-collapse mode: collapse all siblings
				if (flag && !node.expanded && opts.autoCollapse) {
					parents = node.getParentList(false, true);
					prevAC = opts.autoCollapse;
					try {
						opts.autoCollapse = false;
						for (i = 0, l = parents.length; i < l; i++) {
							// TODO: should return promise?
							this._callHook(
								"nodeCollapseSiblings",
								parents[i],
								callOpts
							);
						}
					} finally {
						opts.autoCollapse = prevAC;
					}
				}
				// Trigger expand/collapse after expanding
				dfd.done(function () {
					var lastChild = node.getLastChild();

					if (
						flag &&
						opts.autoScroll &&
						!noAnimation &&
						lastChild &&
						tree._enableUpdate
					) {
						// Scroll down to last child, but keep current node visible
						lastChild
							.scrollIntoView(true, { topNode: node })
							.always(function () {
								if (!noEvents) {
									ctx.tree._triggerNodeEvent(
										flag ? "expand" : "collapse",
										ctx
									);
								}
							});
					} else {
						if (!noEvents) {
							ctx.tree._triggerNodeEvent(
								flag ? "expand" : "collapse",
								ctx
							);
						}
					}
				});
				// vvv Code below is executed after loading finished:
				_afterLoad = function (callback) {
					var cn = opts._classNames,
						isVisible,
						isExpanded,
						effect = opts.toggleEffect;

					node.expanded = flag;
					tree._callHook(
						"treeStructureChanged",
						ctx,
						flag ? "expand" : "collapse"
					);
					// Create required markup, but make sure the top UL is hidden, so we
					// can animate later
					tree._callHook("nodeRender", ctx, false, false, true);

					// Hide children, if node is collapsed
					if (node.ul) {
						isVisible = node.ul.style.display !== "none";
						isExpanded = !!node.expanded;
						if (isVisible === isExpanded) {
							node.warn(
								"nodeSetExpanded: UL.style.display already set"
							);
						} else if (!effect || noAnimation) {
							node.ul.style.display =
								node.expanded || !parent ? "" : "none";
						} else {
							// The UI toggle() effect works with the ext-wide extension,
							// while jQuery.animate() has problems when the title span
							// has position: absolute.
							// Since jQuery UI 1.12, the blind effect requires the parent
							// element to have 'position: relative'.
							// See #716, #717
							$(node.li).addClass(cn.animating); // #717

							if (_isFunction($(node.ul)[effect.effect])) {
								// tree.debug( "use jquery." + effect.effect + " method" );
								$(node.ul)[effect.effect]({
									duration: effect.duration,
									always: function () {
										// node.debug("fancytree-animating end: " + node.li.className);
										$(this).removeClass(cn.animating); // #716
										$(node.li).removeClass(cn.animating); // #717
										callback();
									},
								});
							} else {
								// The UI toggle() effect works with the ext-wide extension,
								// while jQuery.animate() has problems when the title span
								// has positon: absolute.
								// Since jQuery UI 1.12, the blind effect requires the parent
								// element to have 'position: relative'.
								// See #716, #717
								// tree.debug("use specified effect (" + effect.effect + ") with the jqueryui.toggle method");

								// try to stop an animation that might be already in progress
								$(node.ul).stop(true, true); //< does not work after resetLazy has been called for a node whose animation wasn't complete and effect was "blind"

								// dirty fix to remove a defunct animation (effect: "blind") after resetLazy has been called
								$(node.ul)
									.parent()
									.find(".ui-effects-placeholder")
									.remove();

								$(node.ul).toggle(
									effect.effect,
									effect.options,
									effect.duration,
									function () {
										// node.debug("fancytree-animating end: " + node.li.className);
										$(this).removeClass(cn.animating); // #716
										$(node.li).removeClass(cn.animating); // #717
										callback();
									}
								);
							}
							return;
						}
					}
					callback();
				};
				// ^^^ Code above is executed after loading finshed.

				// Load lazy nodes, if any. Then continue with _afterLoad()
				if (flag && node.lazy && node.hasChildren() === undefined) {
					// node.debug("nodeSetExpanded: load start...");
					node.load()
						.done(function () {
							// node.debug("nodeSetExpanded: load done");
							if (dfd.notifyWith) {
								// requires jQuery 1.6+
								dfd.notifyWith(node, ["loaded"]);
							}
							_afterLoad(function () {
								dfd.resolveWith(node);
							});
						})
						.fail(function (errMsg) {
							_afterLoad(function () {
								dfd.rejectWith(node, [
									"load failed (" + errMsg + ")",
								]);
							});
						});
					/*
					var source = tree._triggerNodeEvent("lazyLoad", node, ctx.originalEvent);
					_assert(typeof source !== "boolean", "lazyLoad event must return source in data.result");
					node.debug("nodeSetExpanded: load start...");
					this._callHook("nodeLoadChildren", ctx, source).done(function(){
						node.debug("nodeSetExpanded: load done");
						if(dfd.notifyWith){ // requires jQuery 1.6+
							dfd.notifyWith(node, ["loaded"]);
						}
						_afterLoad.call(tree);
					}).fail(function(errMsg){
						dfd.rejectWith(node, ["load failed (" + errMsg + ")"]);
					});
					*/
				} else {
					_afterLoad(function () {
						dfd.resolveWith(node);
					});
				}
				// node.debug("nodeSetExpanded: returns");
				return dfd.promise();
			},
			/** Focus or blur this node.
			 * @param {EventData} ctx
			 * @param {boolean} [flag=true]
			 */
			nodeSetFocus: function (ctx, flag) {
				// ctx.node.debug("nodeSetFocus(" + flag + ")");
				var ctx2,
					tree = ctx.tree,
					node = ctx.node,
					opts = tree.options,
					// et = ctx.originalEvent && ctx.originalEvent.type,
					isInput = ctx.originalEvent
						? $(ctx.originalEvent.target).is(":input")
						: false;

				flag = flag !== false;

				// (node || tree).debug("nodeSetFocus(" + flag + "), event: " + et + ", isInput: "+ isInput);
				// Blur previous node if any
				if (tree.focusNode) {
					if (tree.focusNode === node && flag) {
						// node.debug("nodeSetFocus(" + flag + "): nothing to do");
						return;
					}
					ctx2 = $.extend({}, ctx, { node: tree.focusNode });
					tree.focusNode = null;
					this._triggerNodeEvent("blur", ctx2);
					this._callHook("nodeRenderStatus", ctx2);
				}
				// Set focus to container and node
				if (flag) {
					if (!this.hasFocus()) {
						node.debug("nodeSetFocus: forcing container focus");
						this._callHook("treeSetFocus", ctx, true, {
							calledByNode: true,
						});
					}
					node.makeVisible({ scrollIntoView: false });
					tree.focusNode = node;
					if (opts.titlesTabbable) {
						if (!isInput) {
							// #621
							$(node.span).find(".fancytree-title").focus();
						}
					}
					if (opts.aria) {
						// Set active descendant to node's span ID (create one, if needed)
						$(tree.$container).attr(
							"aria-activedescendant",
							$(node.tr || node.li)
								.uniqueId()
								.attr("id")
						);
						// "ftal_" + opts.idPrefix + node.key);
					}
					// $(node.span).find(".fancytree-title").focus();
					this._triggerNodeEvent("focus", ctx);

					// determine if we have focus on or inside tree container
					var hasFancytreeFocus =
						document.activeElement === tree.$container.get(0) ||
						$(document.activeElement, tree.$container).length >= 1;

					if (!hasFancytreeFocus) {
						// We cannot set KB focus to a node, so use the tree container
						// #563, #570: IE scrolls on every call to .focus(), if the container
						// is partially outside the viewport. So do it only, when absolutely
						// necessary.
						$(tree.$container).focus();
					}

					// if( opts.autoActivate ){
					// 	tree.nodeSetActive(ctx, true);
					// }
					if (opts.autoScroll) {
						node.scrollIntoView();
					}
					this._callHook("nodeRenderStatus", ctx);
				}
			},
			/** (De)Select node, return new status (sync).
			 *
			 * @param {EventData} ctx
			 * @param {boolean} [flag=true]
			 * @param {object} [opts] additional options. Defaults to {noEvents: false,
			 *     propagateDown: null, propagateUp: null,
			 *     callback: null,
			 *     }
			 * @returns {boolean} previous status
			 */
			nodeSetSelected: function (ctx, flag, callOpts) {
				callOpts = callOpts || {};
				var node = ctx.node,
					tree = ctx.tree,
					opts = ctx.options,
					noEvents = callOpts.noEvents === true,
					parent = node.parent;

				// flag defaults to true
				flag = flag !== false;

				// node.debug("nodeSetSelected(" + flag + ")", ctx);

				// Cannot (de)select unselectable nodes directly (only by propagation or
				// by setting the `.selected` property)
				if (FT.evalOption("unselectable", node, node, opts, false)) {
					return;
				}

				// Remember the user's intent, in case down -> up propagation prevents
				// applying it to node.selected
				node._lastSelectIntent = flag; // Confusing use of '!'

				// Nothing to do?
				if (!!node.selected === flag) {
					if (opts.selectMode === 3 && node.partsel && !flag) {
						// If propagation prevented selecting this node last time, we still
						// want to allow to apply setSelected(false) now
					} else {
						return flag;
					}
				}

				if (
					!noEvents &&
					this._triggerNodeEvent(
						"beforeSelect",
						node,
						ctx.originalEvent
					) === false
				) {
					return !!node.selected;
				}
				if (flag && opts.selectMode === 1) {
					// single selection mode (we don't uncheck all tree nodes, for performance reasons)
					if (tree.lastSelectedNode) {
						tree.lastSelectedNode.setSelected(false);
					}
					node.selected = flag;
				} else if (
					opts.selectMode === 3 &&
					parent &&
					!parent.radiogroup &&
					!node.radiogroup
				) {
					// multi-hierarchical selection mode
					node.selected = flag;
					node.fixSelection3AfterClick(callOpts);
				} else if (parent && parent.radiogroup) {
					node.visitSiblings(function (n) {
						n._changeSelectStatusAttrs(flag && n === node);
					}, true);
				} else {
					// default: selectMode: 2, multi selection mode
					node.selected = flag;
				}
				this.nodeRenderStatus(ctx);
				tree.lastSelectedNode = flag ? node : null;
				if (!noEvents) {
					tree._triggerNodeEvent("select", ctx);
				}
			},
			/** Show node status (ok, loading, error, nodata) using styles and a dummy child node.
			 *
			 * @param {EventData} ctx
			 * @param status
			 * @param message
			 * @param details
			 * @since 2.3
			 */
			nodeSetStatus: function (ctx, status, message, details) {
				var node = ctx.node,
					tree = ctx.tree;

				function _clearStatusNode() {
					// Remove dedicated dummy node, if any
					var firstChild = node.children ? node.children[0] : null;
					if (firstChild && firstChild.isStatusNode()) {
						try {
							// I've seen exceptions here with loadKeyPath...
							if (node.ul) {
								node.ul.removeChild(firstChild.li);
								firstChild.li = null; // avoid leaks (DT issue 215)
							}
						} catch (e) {}
						if (node.children.length === 1) {
							node.children = [];
						} else {
							node.children.shift();
						}
						tree._callHook(
							"treeStructureChanged",
							ctx,
							"clearStatusNode"
						);
					}
				}
				function _setStatusNode(data, type) {
					// Create/modify the dedicated dummy node for 'loading...' or
					// 'error!' status. (only called for direct child of the invisible
					// system root)
					var firstChild = node.children ? node.children[0] : null;
					if (firstChild && firstChild.isStatusNode()) {
						$.extend(firstChild, data);
						firstChild.statusNodeType = type;
						tree._callHook("nodeRenderTitle", firstChild);
					} else {
						node._setChildren([data]);
						tree._callHook(
							"treeStructureChanged",
							ctx,
							"setStatusNode"
						);
						node.children[0].statusNodeType = type;
						tree.render();
					}
					return node.children[0];
				}

				switch (status) {
					case "ok":
						_clearStatusNode();
						node._isLoading = false;
						node._error = null;
						node.renderStatus();
						break;
					case "loading":
						if (!node.parent) {
							_setStatusNode(
								{
									title:
										tree.options.strings.loading +
										(message ? " (" + message + ")" : ""),
									// icon: true,  // needed for 'loding' icon
									checkbox: false,
									tooltip: details,
								},
								status
							);
						}
						node._isLoading = true;
						node._error = null;
						node.renderStatus();
						break;
					case "error":
						_setStatusNode(
							{
								title:
									tree.options.strings.loadError +
									(message ? " (" + message + ")" : ""),
								// icon: false,
								checkbox: false,
								tooltip: details,
							},
							status
						);
						node._isLoading = false;
						node._error = { message: message, details: details };
						node.renderStatus();
						break;
					case "nodata":
						_setStatusNode(
							{
								title: message || tree.options.strings.noData,
								// icon: false,
								checkbox: false,
								tooltip: details,
							},
							status
						);
						node._isLoading = false;
						node._error = null;
						node.renderStatus();
						break;
					default:
						$.error("invalid node status " + status);
				}
			},
			/**
			 *
			 * @param {EventData} ctx
			 */
			nodeToggleExpanded: function (ctx) {
				return this.nodeSetExpanded(ctx, !ctx.node.expanded);
			},
			/**
			 * @param {EventData} ctx
			 */
			nodeToggleSelected: function (ctx) {
				var node = ctx.node,
					flag = !node.selected;

				// In selectMode: 3 this node may be unselected+partsel, even if
				// setSelected(true) was called before, due to `unselectable` children.
				// In this case, we now toggle as `setSelected(false)`
				if (
					node.partsel &&
					!node.selected &&
					node._lastSelectIntent === true
				) {
					flag = false;
					node.selected = true; // so it is not considered 'nothing to do'
				}
				node._lastSelectIntent = flag;
				return this.nodeSetSelected(ctx, flag);
			},
			/** Remove all nodes.
			 * @param {EventData} ctx
			 */
			treeClear: function (ctx) {
				var tree = ctx.tree;
				tree.activeNode = null;
				tree.focusNode = null;
				tree.$div.find(">ul.fancytree-container").empty();
				// TODO: call destructors and remove reference loops
				tree.rootNode.children = null;
				tree._callHook("treeStructureChanged", ctx, "clear");
			},
			/** Widget was created (called only once, even it re-initialized).
			 * @param {EventData} ctx
			 */
			treeCreate: function (ctx) {},
			/** Widget was destroyed.
			 * @param {EventData} ctx
			 */
			treeDestroy: function (ctx) {
				this.$div.find(">ul.fancytree-container").remove();
				if (this.$source) {
					this.$source.removeClass("fancytree-helper-hidden");
				}
			},
			/** Widget was (re-)initialized.
			 * @param {EventData} ctx
			 */
			treeInit: function (ctx) {
				var tree = ctx.tree,
					opts = tree.options;

				//this.debug("Fancytree.treeInit()");
				// Add container to the TAB chain
				// See http://www.w3.org/TR/wai-aria-practices/#focus_activedescendant
				// #577: Allow to set tabindex to "0", "-1" and ""
				tree.$container.attr("tabindex", opts.tabindex);

				// Copy some attributes to tree.data
				$.each(TREE_ATTRS, function (i, attr) {
					if (opts[attr] !== undefined) {
						tree.info("Move option " + attr + " to tree");
						tree[attr] = opts[attr];
						delete opts[attr];
					}
				});

				if (opts.checkboxAutoHide) {
					tree.$container.addClass("fancytree-checkbox-auto-hide");
				}
				if (opts.rtl) {
					tree.$container
						.attr("DIR", "RTL")
						.addClass("fancytree-rtl");
				} else {
					tree.$container
						.removeAttr("DIR")
						.removeClass("fancytree-rtl");
				}
				if (opts.aria) {
					tree.$container.attr("role", "tree");
					if (opts.selectMode !== 1) {
						tree.$container.attr("aria-multiselectable", true);
					}
				}
				this.treeLoad(ctx);
			},
			/** Parse Fancytree from source, as configured in the options.
			 * @param {EventData} ctx
			 * @param {object} [source] optional new source (use last data otherwise)
			 */
			treeLoad: function (ctx, source) {
				var metaData,
					type,
					$ul,
					tree = ctx.tree,
					$container = ctx.widget.element,
					dfd,
					// calling context for root node
					rootCtx = $.extend({}, ctx, { node: this.rootNode });

				if (tree.rootNode.children) {
					this.treeClear(ctx);
				}
				source = source || this.options.source;

				if (!source) {
					type = $container.data("type") || "html";
					switch (type) {
						case "html":
							// There should be an embedded `<ul>` with initial nodes,
							// but another `<ul class='fancytree-container'>` is appended
							// to the tree's <div> on startup anyway.
							$ul = $container
								.find(">ul")
								.not(".fancytree-container")
								.first();

							if ($ul.length) {
								$ul.addClass(
									"ui-fancytree-source fancytree-helper-hidden"
								);
								source = $.ui.fancytree.parseHtml($ul);
								// allow to init tree.data.foo from <ul data-foo=''>
								this.data = $.extend(
									this.data,
									_getElementDataAsDict($ul)
								);
							} else {
								FT.warn(
									"No `source` option was passed and container does not contain `<ul>`: assuming `source: []`."
								);
								source = [];
							}
							break;
						case "json":
							source = $.parseJSON($container.text());
							// $container already contains the <ul>, but we remove the plain (json) text
							// $container.empty();
							$container
								.contents()
								.filter(function () {
									return this.nodeType === 3;
								})
								.remove();
							if ($.isPlainObject(source)) {
								// We got {foo: 'abc', children: [...]}
								_assert(
									_isArray(source.children),
									"if an object is passed as source, it must contain a 'children' array (all other properties are added to 'tree.data')"
								);
								metaData = source;
								source = source.children;
								delete metaData.children;
								// Copy some attributes to tree.data
								$.each(TREE_ATTRS, function (i, attr) {
									if (metaData[attr] !== undefined) {
										tree[attr] = metaData[attr];
										delete metaData[attr];
									}
								});
								// Copy extra properties to tree.data.foo
								$.extend(tree.data, metaData);
							}
							break;
						default:
							$.error("Invalid data-type: " + type);
					}
				} else if (typeof source === "string") {
					// TODO: source is an element ID
					$.error("Not implemented");
				}

				// preInit is fired when the widget markup is created, but nodes
				// not yet loaded
				tree._triggerTreeEvent("preInit", null);

				// Trigger fancytreeinit after nodes have been loaded
				dfd = this.nodeLoadChildren(rootCtx, source)
					.done(function () {
						tree._callHook(
							"treeStructureChanged",
							ctx,
							"loadChildren"
						);
						tree.render();
						if (ctx.options.selectMode === 3) {
							tree.rootNode.fixSelection3FromEndNodes();
						}
						if (tree.activeNode && tree.options.activeVisible) {
							tree.activeNode.makeVisible();
						}
						tree._triggerTreeEvent("init", null, { status: true });
					})
					.fail(function () {
						tree.render();
						tree._triggerTreeEvent("init", null, { status: false });
					});
				return dfd;
			},
			/** Node was inserted into or removed from the tree.
			 * @param {EventData} ctx
			 * @param {boolean} add
			 * @param {FancytreeNode} node
			 */
			treeRegisterNode: function (ctx, add, node) {
				ctx.tree._callHook(
					"treeStructureChanged",
					ctx,
					add ? "addNode" : "removeNode"
				);
			},
			/** Widget got focus.
			 * @param {EventData} ctx
			 * @param {boolean} [flag=true]
			 */
			treeSetFocus: function (ctx, flag, callOpts) {
				var targetNode;

				flag = flag !== false;

				// this.debug("treeSetFocus(" + flag + "), callOpts: ", callOpts, this.hasFocus());
				// this.debug("    focusNode: " + this.focusNode);
				// this.debug("    activeNode: " + this.activeNode);
				if (flag !== this.hasFocus()) {
					this._hasFocus = flag;
					if (!flag && this.focusNode) {
						// Node also looses focus if widget blurs
						this.focusNode.setFocus(false);
					} else if (flag && (!callOpts || !callOpts.calledByNode)) {
						$(this.$container).focus();
					}
					this.$container.toggleClass("fancytree-treefocus", flag);
					this._triggerTreeEvent(flag ? "focusTree" : "blurTree");
					if (flag && !this.activeNode) {
						// #712: Use last mousedowned node ('click' event fires after focusin)
						targetNode =
							this._lastMousedownNode || this.getFirstChild();
						if (targetNode) {
							targetNode.setFocus();
						}
					}
				}
			},
			/** Widget option was set using `$().fancytree("option", "KEY", VALUE)`.
			 *
			 * Note: `key` may reference a nested option, e.g. 'dnd5.scroll'.
			 * In this case `value`contains the complete, modified `dnd5` option hash.
			 * We can check for changed values like
			 *     if( value.scroll !== tree.options.dnd5.scroll ) {...}
			 *
			 * @param {EventData} ctx
			 * @param {string} key option name
			 * @param {any} value option value
			 */
			treeSetOption: function (ctx, key, value) {
				var tree = ctx.tree,
					callDefault = true,
					callCreate = false,
					callRender = false;

				switch (key) {
					case "aria":
					case "checkbox":
					case "icon":
					case "minExpandLevel":
					case "tabindex":
						// tree._callHook("treeCreate", tree);
						callCreate = true;
						callRender = true;
						break;
					case "checkboxAutoHide":
						tree.$container.toggleClass(
							"fancytree-checkbox-auto-hide",
							!!value
						);
						break;
					case "escapeTitles":
					case "tooltip":
						callRender = true;
						break;
					case "rtl":
						if (value === false) {
							tree.$container
								.removeAttr("DIR")
								.removeClass("fancytree-rtl");
						} else {
							tree.$container
								.attr("DIR", "RTL")
								.addClass("fancytree-rtl");
						}
						callRender = true;
						break;
					case "source":
						callDefault = false;
						tree._callHook("treeLoad", tree, value);
						callRender = true;
						break;
				}
				tree.debug(
					"set option " +
						key +
						"=" +
						value +
						" <" +
						typeof value +
						">"
				);
				if (callDefault) {
					if (this.widget._super) {
						// jQuery UI 1.9+
						this.widget._super.call(this.widget, key, value);
					} else {
						// jQuery UI <= 1.8, we have to manually invoke the _setOption method from the base widget
						$.Widget.prototype._setOption.call(
							this.widget,
							key,
							value
						);
					}
				}
				if (callCreate) {
					tree._callHook("treeCreate", tree);
				}
				if (callRender) {
					tree.render(true, false); // force, not-deep
				}
			},
			/** A Node was added, removed, moved, or it's visibility changed.
			 * @param {EventData} ctx
			 */
			treeStructureChanged: function (ctx, type) {},
		}
	);

	/*******************************************************************************
	 * jQuery UI widget boilerplate
	 */

	/**
	 * The plugin (derrived from [jQuery.Widget](http://api.jqueryui.com/jQuery.widget/)).
	 *
	 * **Note:**
	 * These methods implement the standard jQuery UI widget API.
	 * It is recommended to use methods of the {Fancytree} instance instead
	 *
	 * @example
	 * // DEPRECATED: Access jQuery UI widget methods and members:
	 * var tree = $("#tree").fancytree("getTree");
	 * var node = $("#tree").fancytree("getActiveNode");
	 *
	 * // RECOMMENDED: Use the Fancytree object API
	 * var tree = $.ui.fancytree.getTree("#tree");
	 * var node = tree.getActiveNode();
	 *
	 * // or you may already have stored the tree instance upon creation:
	 * import {createTree, version} from 'jquery.fancytree'
	 * const tree = createTree('#tree', { ... });
	 * var node = tree.getActiveNode();
	 *
	 * @see {Fancytree_Static#getTree}
	 * @deprecated Use methods of the {Fancytree} instance instead
	 * @mixin Fancytree_Widget
	 */

	$.widget(
		"ui.fancytree",
		/** @lends Fancytree_Widget# */
		{
			/**These options will be used as defaults
			 * @type {FancytreeOptions}
			 */
			options: {
				activeVisible: true,
				ajax: {
					type: "GET",
					cache: false, // false: Append random '_' argument to the request url to prevent caching.
					// timeout: 0, // >0: Make sure we get an ajax error if server is unreachable
					dataType: "json", // Expect json format and pass json object to callbacks.
				},
				aria: true,
				autoActivate: true,
				autoCollapse: false,
				autoScroll: false,
				checkbox: false,
				clickFolderMode: 4,
				copyFunctionsToData: false,
				debugLevel: null, // 0..4 (null: use global setting $.ui.fancytree.debugLevel)
				disabled: false, // TODO: required anymore?
				enableAspx: 42, // TODO: this is truethy, but distinguishable from true: default will change to false in the future
				escapeTitles: false,
				extensions: [],
				focusOnSelect: false,
				generateIds: false,
				icon: true,
				idPrefix: "ft_",
				keyboard: true,
				keyPathSeparator: "/",
				minExpandLevel: 1,
				nodata: true, // (bool, string, or callback) display message, when no data available
				quicksearch: false,
				rtl: false,
				scrollOfs: { top: 0, bottom: 0 },
				scrollParent: null,
				selectMode: 2,
				strings: {
					loading: "Loading...", // &#8230; would be escaped when escapeTitles is true
					loadError: "Load error!",
					moreData: "More...",
					noData: "No data.",
				},
				tabindex: "0",
				titlesTabbable: false,
				toggleEffect: { effect: "slideToggle", duration: 200 }, //< "toggle" or "slideToggle" to use jQuery instead of jQueryUI for toggleEffect animation
				tooltip: false,
				treeId: null,
				_classNames: {
					active: "fancytree-active",
					animating: "fancytree-animating",
					combinedExpanderPrefix: "fancytree-exp-",
					combinedIconPrefix: "fancytree-ico-",
					error: "fancytree-error",
					expanded: "fancytree-expanded",
					focused: "fancytree-focused",
					folder: "fancytree-folder",
					hasChildren: "fancytree-has-children",
					lastsib: "fancytree-lastsib",
					lazy: "fancytree-lazy",
					loading: "fancytree-loading",
					node: "fancytree-node",
					partload: "fancytree-partload",
					partsel: "fancytree-partsel",
					radio: "fancytree-radio",
					selected: "fancytree-selected",
					statusNodePrefix: "fancytree-statusnode-",
					unselectable: "fancytree-unselectable",
				},
				// events
				lazyLoad: null,
				postProcess: null,
			},
			_deprecationWarning: function (name) {
				var tree = this.tree;

				if (tree && tree.options.debugLevel >= 3) {
					tree.warn(
						"$().fancytree('" +
							name +
							"') is deprecated (see https://wwwendt.de/tech/fancytree/doc/jsdoc/Fancytree_Widget.html"
					);
				}
			},
			/* Set up the widget, Called on first $().fancytree() */
			_create: function () {
				this.tree = new Fancytree(this);

				this.$source =
					this.source || this.element.data("type") === "json"
						? this.element
						: this.element.find(">ul").first();
				// Subclass Fancytree instance with all enabled extensions
				var extension,
					extName,
					i,
					opts = this.options,
					extensions = opts.extensions,
					base = this.tree;

				for (i = 0; i < extensions.length; i++) {
					extName = extensions[i];
					extension = $.ui.fancytree._extensions[extName];
					if (!extension) {
						$.error(
							"Could not apply extension '" +
								extName +
								"' (it is not registered, did you forget to include it?)"
						);
					}
					// Add extension options as tree.options.EXTENSION
					// 	_assert(!this.tree.options[extName], "Extension name must not exist as option name: " + extName);

					// console.info("extend " + extName, extension.options, this.tree.options[extName])
					// issue #876: we want to replace custom array-options, not merge them
					this.tree.options[extName] = _simpleDeepMerge(
						{},
						extension.options,
						this.tree.options[extName]
					);
					// this.tree.options[extName] = $.extend(true, {}, extension.options, this.tree.options[extName]);

					// console.info("extend " + extName + " =>", this.tree.options[extName])
					// console.info("extend " + extName + " org default =>", extension.options)

					// Add a namespace tree.ext.EXTENSION, to hold instance data
					_assert(
						this.tree.ext[extName] === undefined,
						"Extension name must not exist as Fancytree.ext attribute: '" +
							extName +
							"'"
					);
					// this.tree[extName] = extension;
					this.tree.ext[extName] = {};
					// Subclass Fancytree methods using proxies.
					_subclassObject(this.tree, base, extension, extName);
					// current extension becomes base for the next extension
					base = extension;
				}
				//
				if (opts.icons !== undefined) {
					// 2015-11-16
					if (opts.icon === true) {
						this.tree.warn(
							"'icons' tree option is deprecated since v2.14.0: use 'icon' instead"
						);
						opts.icon = opts.icons;
					} else {
						$.error(
							"'icons' tree option is deprecated since v2.14.0: use 'icon' only instead"
						);
					}
				}
				if (opts.iconClass !== undefined) {
					// 2015-11-16
					if (opts.icon) {
						$.error(
							"'iconClass' tree option is deprecated since v2.14.0: use 'icon' only instead"
						);
					} else {
						this.tree.warn(
							"'iconClass' tree option is deprecated since v2.14.0: use 'icon' instead"
						);
						opts.icon = opts.iconClass;
					}
				}
				if (opts.tabbable !== undefined) {
					// 2016-04-04
					opts.tabindex = opts.tabbable ? "0" : "-1";
					this.tree.warn(
						"'tabbable' tree option is deprecated since v2.17.0: use 'tabindex='" +
							opts.tabindex +
							"' instead"
					);
				}
				//
				this.tree._callHook("treeCreate", this.tree);
				// Note: 'fancytreecreate' event is fired by widget base class
				//        this.tree._triggerTreeEvent("create");
			},

			/* Called on every $().fancytree() */
			_init: function () {
				this.tree._callHook("treeInit", this.tree);
				// TODO: currently we call bind after treeInit, because treeInit
				// might change tree.$container.
				// It would be better, to move event binding into hooks altogether
				this._bind();
			},

			/* Use the _setOption method to respond to changes to options. */
			_setOption: function (key, value) {
				return this.tree._callHook(
					"treeSetOption",
					this.tree,
					key,
					value
				);
			},

			/** Use the destroy method to clean up any modifications your widget has made to the DOM */
			_destroy: function () {
				this._unbind();
				this.tree._callHook("treeDestroy", this.tree);
				// In jQuery UI 1.8, you must invoke the destroy method from the base widget
				// $.Widget.prototype.destroy.call(this);
				// TODO: delete tree and nodes to make garbage collect easier?
				// TODO: In jQuery UI 1.9 and above, you would define _destroy instead of destroy and not call the base method
			},

			// -------------------------------------------------------------------------

			/* Remove all event handlers for our namespace */
			_unbind: function () {
				var ns = this.tree._ns;
				this.element.off(ns);
				this.tree.$container.off(ns);
				$(document).off(ns);
			},
			/* Add mouse and kyboard handlers to the container */
			_bind: function () {
				var self = this,
					opts = this.options,
					tree = this.tree,
					ns = tree._ns;
				// selstartEvent = ( $.support.selectstart ? "selectstart" : "mousedown" )

				// Remove all previuous handlers for this tree
				this._unbind();

				//alert("keydown" + ns + "foc=" + tree.hasFocus() + tree.$container);
				// tree.debug("bind events; container: ", tree.$container);
				tree.$container
					.on("focusin" + ns + " focusout" + ns, function (event) {
						var node = FT.getNode(event),
							flag = event.type === "focusin";

						if (!flag && node && $(event.target).is("a")) {
							// #764
							node.debug(
								"Ignored focusout on embedded <a> element."
							);
							return;
						}
						// tree.treeOnFocusInOut.call(tree, event);
						// tree.debug("Tree container got event " + event.type, node, event, FT.getEventTarget(event));
						if (flag) {
							if (tree._getExpiringValue("focusin")) {
								// #789: IE 11 may send duplicate focusin events
								tree.debug("Ignored double focusin.");
								return;
							}
							tree._setExpiringValue("focusin", true, 50);

							if (!node) {
								// #789: IE 11 may send focusin before mousdown(?)
								node = tree._getExpiringValue("mouseDownNode");
								if (node) {
									tree.debug(
										"Reconstruct mouse target for focusin from recent event."
									);
								}
							}
						}
						if (node) {
							// For example clicking into an <input> that is part of a node
							tree._callHook(
								"nodeSetFocus",
								tree._makeHookContext(node, event),
								flag
							);
						} else {
							if (
								tree.tbody &&
								$(event.target).parents(
									"table.fancytree-container > thead"
								).length
							) {
								// #767: ignore events in the table's header
								tree.debug(
									"Ignore focus event outside table body.",
									event
								);
							} else {
								tree._callHook("treeSetFocus", tree, flag);
							}
						}
					})
					.on(
						"selectstart" + ns,
						"span.fancytree-title",
						function (event) {
							// prevent mouse-drags to select text ranges
							// tree.debug("<span title> got event " + event.type);
							event.preventDefault();
						}
					)
					.on("keydown" + ns, function (event) {
						// TODO: also bind keyup and keypress
						// tree.debug("got event " + event.type + ", hasFocus:" + tree.hasFocus());
						// if(opts.disabled || opts.keyboard === false || !tree.hasFocus() ){
						if (opts.disabled || opts.keyboard === false) {
							return true;
						}
						var res,
							node = tree.focusNode, // node may be null
							ctx = tree._makeHookContext(node || tree, event),
							prevPhase = tree.phase;

						try {
							tree.phase = "userEvent";
							// If a 'fancytreekeydown' handler returns false, skip the default
							// handling (implemented by tree.nodeKeydown()).
							if (node) {
								res = tree._triggerNodeEvent(
									"keydown",
									node,
									event
								);
							} else {
								res = tree._triggerTreeEvent("keydown", event);
							}
							if (res === "preventNav") {
								res = true; // prevent keyboard navigation, but don't prevent default handling of embedded input controls
							} else if (res !== false) {
								res = tree._callHook("nodeKeydown", ctx);
							}
							return res;
						} finally {
							tree.phase = prevPhase;
						}
					})
					.on("mousedown" + ns, function (event) {
						var et = FT.getEventTarget(event);
						// self.tree.debug("event(" + event.type + "): node: ", et.node);
						// #712: Store the clicked node, so we can use it when we get a focusin event
						//       ('click' event fires after focusin)
						// tree.debug("event(" + event.type + "): node: ", et.node);
						tree._lastMousedownNode = et ? et.node : null;
						// #789: Store the node also for a short period, so we can use it
						// in a *resulting* focusin event
						tree._setExpiringValue(
							"mouseDownNode",
							tree._lastMousedownNode
						);
					})
					.on("click" + ns + " dblclick" + ns, function (event) {
						if (opts.disabled) {
							return true;
						}
						var ctx,
							et = FT.getEventTarget(event),
							node = et.node,
							tree = self.tree,
							prevPhase = tree.phase;

						// self.tree.debug("event(" + event.type + "): node: ", node);
						if (!node) {
							return true; // Allow bubbling of other events
						}
						ctx = tree._makeHookContext(node, event);
						// self.tree.debug("event(" + event.type + "): node: ", node);
						try {
							tree.phase = "userEvent";
							switch (event.type) {
								case "click":
									ctx.targetType = et.type;
									if (node.isPagingNode()) {
										return (
											tree._triggerNodeEvent(
												"clickPaging",
												ctx,
												event
											) === true
										);
									}
									return tree._triggerNodeEvent(
										"click",
										ctx,
										event
									) === false
										? false
										: tree._callHook("nodeClick", ctx);
								case "dblclick":
									ctx.targetType = et.type;
									return tree._triggerNodeEvent(
										"dblclick",
										ctx,
										event
									) === false
										? false
										: tree._callHook("nodeDblclick", ctx);
							}
						} finally {
							tree.phase = prevPhase;
						}
					});
			},
			/** Return the active node or null.
			 * @returns {FancytreeNode}
			 * @deprecated Use methods of the Fancytree instance instead (<a href="Fancytree_Widget.html">example above</a>).
			 */
			getActiveNode: function () {
				this._deprecationWarning("getActiveNode");
				return this.tree.activeNode;
			},
			/** Return the matching node or null.
			 * @param {string} key
			 * @returns {FancytreeNode}
			 * @deprecated Use methods of the Fancytree instance instead (<a href="Fancytree_Widget.html">example above</a>).
			 */
			getNodeByKey: function (key) {
				this._deprecationWarning("getNodeByKey");
				return this.tree.getNodeByKey(key);
			},
			/** Return the invisible system root node.
			 * @returns {FancytreeNode}
			 * @deprecated Use methods of the Fancytree instance instead (<a href="Fancytree_Widget.html">example above</a>).
			 */
			getRootNode: function () {
				this._deprecationWarning("getRootNode");
				return this.tree.rootNode;
			},
			/** Return the current tree instance.
			 * @returns {Fancytree}
			 * @deprecated Use `$.ui.fancytree.getTree()` instead (<a href="Fancytree_Widget.html">example above</a>).
			 */
			getTree: function () {
				this._deprecationWarning("getTree");
				return this.tree;
			},
		}
	);

	// $.ui.fancytree was created by the widget factory. Create a local shortcut:
	FT = $.ui.fancytree;

	/**
	 * Static members in the `$.ui.fancytree` namespace.
	 * This properties and methods can be accessed without instantiating a concrete
	 * Fancytree instance.
	 *
	 * @example
	 * // Access static members:
	 * var node = $.ui.fancytree.getNode(element);
	 * alert($.ui.fancytree.version);
	 *
	 * @mixin Fancytree_Static
	 */
	$.extend(
		$.ui.fancytree,
		/** @lends Fancytree_Static# */
		{
			/** Version number `"MAJOR.MINOR.PATCH"`
			 * @type {string} */
			version: "2.38.3", // Set to semver by 'grunt release'
			/** @type {string}
			 * @description `"production" for release builds` */
			buildType: "production", // Set to 'production' by 'grunt build'
			/** @type {int}
			 * @description 0: silent .. 5: verbose (default: 3 for release builds). */
			debugLevel: 3, // Set to 3 by 'grunt build'
			// Used by $.ui.fancytree.debug() and as default for tree.options.debugLevel

			_nextId: 1,
			_nextNodeKey: 1,
			_extensions: {},
			// focusTree: null,

			/** Expose class object as `$.ui.fancytree._FancytreeClass`.
			 * Useful to extend `$.ui.fancytree._FancytreeClass.prototype`.
			 * @type {Fancytree}
			 */
			_FancytreeClass: Fancytree,
			/** Expose class object as $.ui.fancytree._FancytreeNodeClass
			 * Useful to extend `$.ui.fancytree._FancytreeNodeClass.prototype`.
			 * @type {FancytreeNode}
			 */
			_FancytreeNodeClass: FancytreeNode,
			/* Feature checks to provide backwards compatibility */
			jquerySupports: {
				// http://jqueryui.com/upgrade-guide/1.9/#deprecated-offset-option-merged-into-my-and-at
				positionMyOfs: isVersionAtLeast($.ui.version, 1, 9),
			},
			/** Throw an error if condition fails (debug method).
			 * @param {boolean} cond
			 * @param {string} msg
			 */
			assert: function (cond, msg) {
				return _assert(cond, msg);
			},
			/** Create a new Fancytree instance on a target element.
			 *
			 * @param {Element | jQueryObject | string} el Target DOM element or selector
			 * @param {FancytreeOptions} [opts] Fancytree options
			 * @returns {Fancytree} new tree instance
			 * @example
			 * var tree = $.ui.fancytree.createTree("#tree", {
			 *     source: {url: "my/webservice"}
			 * }); // Create tree for this matching element
			 *
			 * @since 2.25
			 */
			createTree: function (el, opts) {
				var $tree = $(el).fancytree(opts);
				return FT.getTree($tree);
			},
			/** Return a function that executes *fn* at most every *timeout* ms.
			 * @param {integer} timeout
			 * @param {function} fn
			 * @param {boolean} [invokeAsap=false]
			 * @param {any} [ctx]
			 */
			debounce: function (timeout, fn, invokeAsap, ctx) {
				var timer;
				if (arguments.length === 3 && typeof invokeAsap !== "boolean") {
					ctx = invokeAsap;
					invokeAsap = false;
				}
				return function () {
					var args = arguments;
					ctx = ctx || this;
					// eslint-disable-next-line no-unused-expressions
					invokeAsap && !timer && fn.apply(ctx, args);
					clearTimeout(timer);
					timer = setTimeout(function () {
						// eslint-disable-next-line no-unused-expressions
						invokeAsap || fn.apply(ctx, args);
						timer = null;
					}, timeout);
				};
			},
			/** Write message to console if debugLevel >= 4
			 * @param {string} msg
			 */
			debug: function (msg) {
				if ($.ui.fancytree.debugLevel >= 4) {
					consoleApply("log", arguments);
				}
			},
			/** Write error message to console if debugLevel >= 1.
			 * @param {string} msg
			 */
			error: function (msg) {
				if ($.ui.fancytree.debugLevel >= 1) {
					consoleApply("error", arguments);
				}
			},
			/** Convert `<`, `>`, `&`, `"`, `'`, and `/` to the equivalent entities.
			 *
			 * @param {string} s
			 * @returns {string}
			 */
			escapeHtml: function (s) {
				return ("" + s).replace(REX_HTML, function (s) {
					return ENTITY_MAP[s];
				});
			},
			/** Make jQuery.position() arguments backwards compatible, i.e. if
			 * jQuery UI version <= 1.8, convert
			 *   { my: "left+3 center", at: "left bottom", of: $target }
			 * to
			 *   { my: "left center", at: "left bottom", of: $target, offset: "3  0" }
			 *
			 * See http://jqueryui.com/upgrade-guide/1.9/#deprecated-offset-option-merged-into-my-and-at
			 * and http://jsfiddle.net/mar10/6xtu9a4e/
			 *
			 * @param {object} opts
			 * @returns {object} the (potentially modified) original opts hash object
			 */
			fixPositionOptions: function (opts) {
				if (opts.offset || ("" + opts.my + opts.at).indexOf("%") >= 0) {
					$.error(
						"expected new position syntax (but '%' is not supported)"
					);
				}
				if (!$.ui.fancytree.jquerySupports.positionMyOfs) {
					var // parse 'left+3 center' into ['left+3 center', 'left', '+3', 'center', undefined]
						myParts = /(\w+)([+-]?\d+)?\s+(\w+)([+-]?\d+)?/.exec(
							opts.my
						),
						atParts = /(\w+)([+-]?\d+)?\s+(\w+)([+-]?\d+)?/.exec(
							opts.at
						),
						// convert to numbers
						dx =
							(myParts[2] ? +myParts[2] : 0) +
							(atParts[2] ? +atParts[2] : 0),
						dy =
							(myParts[4] ? +myParts[4] : 0) +
							(atParts[4] ? +atParts[4] : 0);

					opts = $.extend({}, opts, {
						// make a copy and overwrite
						my: myParts[1] + " " + myParts[3],
						at: atParts[1] + " " + atParts[3],
					});
					if (dx || dy) {
						opts.offset = "" + dx + " " + dy;
					}
				}
				return opts;
			},
			/** Return a {node: FancytreeNode, type: TYPE} object for a mouse event.
			 *
			 * @param {Event} event Mouse event, e.g. click, ...
			 * @returns {object} Return a {node: FancytreeNode, type: TYPE} object
			 *     TYPE: 'title' | 'prefix' | 'expander' | 'checkbox' | 'icon' | undefined
			 */
			getEventTarget: function (event) {
				var $target,
					tree,
					tcn = event && event.target ? event.target.className : "",
					res = { node: this.getNode(event.target), type: undefined };
				// We use a fast version of $(res.node).hasClass()
				// See http://jsperf.com/test-for-classname/2
				if (/\bfancytree-title\b/.test(tcn)) {
					res.type = "title";
				} else if (/\bfancytree-expander\b/.test(tcn)) {
					res.type =
						res.node.hasChildren() === false
							? "prefix"
							: "expander";
					// }else if( /\bfancytree-checkbox\b/.test(tcn) || /\bfancytree-radio\b/.test(tcn) ){
				} else if (/\bfancytree-checkbox\b/.test(tcn)) {
					res.type = "checkbox";
				} else if (/\bfancytree(-custom)?-icon\b/.test(tcn)) {
					res.type = "icon";
				} else if (/\bfancytree-node\b/.test(tcn)) {
					// Somewhere near the title
					res.type = "title";
				} else if (event && event.target) {
					$target = $(event.target);
					if ($target.is("ul[role=group]")) {
						// #nnn: Clicking right to a node may hit the surrounding UL
						tree = res.node && res.node.tree;
						(tree || FT).debug("Ignoring click on outer UL.");
						res.node = null;
					} else if ($target.closest(".fancytree-title").length) {
						// #228: clicking an embedded element inside a title
						res.type = "title";
					} else if ($target.closest(".fancytree-checkbox").length) {
						// E.g. <svg> inside checkbox span
						res.type = "checkbox";
					} else if ($target.closest(".fancytree-expander").length) {
						res.type = "expander";
					}
				}
				return res;
			},
			/** Return a string describing the affected node region for a mouse event.
			 *
			 * @param {Event} event Mouse event, e.g. click, mousemove, ...
			 * @returns {string} 'title' | 'prefix' | 'expander' | 'checkbox' | 'icon' | undefined
			 */
			getEventTargetType: function (event) {
				return this.getEventTarget(event).type;
			},
			/** Return a FancytreeNode instance from element, event, or jQuery object.
			 *
			 * @param {Element | jQueryObject | Event} el
			 * @returns {FancytreeNode} matching node or null
			 */
			getNode: function (el) {
				if (el instanceof FancytreeNode) {
					return el; // el already was a FancytreeNode
				} else if (el instanceof $) {
					el = el[0]; // el was a jQuery object: use the DOM element
				} else if (el.originalEvent !== undefined) {
					el = el.target; // el was an Event
				}
				while (el) {
					if (el.ftnode) {
						return el.ftnode;
					}
					el = el.parentNode;
				}
				return null;
			},
			/** Return a Fancytree instance, from element, index, event, or jQueryObject.
			 *
			 * @param {Element | jQueryObject | Event | integer | string} [el]
			 * @returns {Fancytree} matching tree or null
			 * @example
			 * $.ui.fancytree.getTree();  // Get first Fancytree instance on page
			 * $.ui.fancytree.getTree(1);  // Get second Fancytree instance on page
			 * $.ui.fancytree.getTree(event);  // Get tree for this mouse- or keyboard event
			 * $.ui.fancytree.getTree("foo");  // Get tree for this `opts.treeId`
			 * $.ui.fancytree.getTree("#tree");  // Get tree for this matching element
			 *
			 * @since 2.13
			 */
			getTree: function (el) {
				var widget,
					orgEl = el;

				if (el instanceof Fancytree) {
					return el; // el already was a Fancytree
				}
				if (el === undefined) {
					el = 0; // get first tree
				}
				if (typeof el === "number") {
					el = $(".fancytree-container").eq(el); // el was an integer: return nth instance
				} else if (typeof el === "string") {
					// `el` may be a treeId or a selector:
					el = $("#ft-id-" + orgEl).eq(0);
					if (!el.length) {
						el = $(orgEl).eq(0); // el was a selector: use first match
					}
				} else if (
					el instanceof Element ||
					el instanceof HTMLDocument
				) {
					el = $(el);
				} else if (el instanceof $) {
					el = el.eq(0); // el was a jQuery object: use the first
				} else if (el.originalEvent !== undefined) {
					el = $(el.target); // el was an Event
				}
				// el is a jQuery object wit one element here
				el = el.closest(":ui-fancytree");
				widget = el.data("ui-fancytree") || el.data("fancytree"); // the latter is required by jQuery <= 1.8
				return widget ? widget.tree : null;
			},
			/** Return an option value that has a default, but may be overridden by a
			 * callback or a node instance attribute.
			 *
			 * Evaluation sequence:
			 *
			 * If `tree.options.<optionName>` is a callback that returns something, use that.
			 * Else if `node.<optionName>` is defined, use that.
			 * Else if `tree.options.<optionName>` is a value, use that.
			 * Else use `defaultValue`.
			 *
			 * @param {string} optionName name of the option property (on node and tree)
			 * @param {FancytreeNode} node passed to the callback
			 * @param {object} nodeObject where to look for the local option property, e.g. `node` or `node.data`
			 * @param {object} treeOption where to look for the tree option, e.g. `tree.options` or `tree.options.dnd5`
			 * @param {any} [defaultValue]
			 * @returns {any}
			 *
			 * @example
			 * // Check for node.foo, tree,options.foo(), and tree.options.foo:
			 * $.ui.fancytree.evalOption("foo", node, node, tree.options);
			 * // Check for node.data.bar, tree,options.qux.bar(), and tree.options.qux.bar:
			 * $.ui.fancytree.evalOption("bar", node, node.data, tree.options.qux);
			 *
			 * @since 2.22
			 */
			evalOption: function (
				optionName,
				node,
				nodeObject,
				treeOptions,
				defaultValue
			) {
				var ctx,
					res,
					tree = node.tree,
					treeOpt = treeOptions[optionName],
					nodeOpt = nodeObject[optionName];

				if (_isFunction(treeOpt)) {
					ctx = {
						node: node,
						tree: tree,
						widget: tree.widget,
						options: tree.widget.options,
						typeInfo: tree.types[node.type] || {},
					};
					res = treeOpt.call(tree, { type: optionName }, ctx);
					if (res == null) {
						res = nodeOpt;
					}
				} else {
					res = nodeOpt == null ? treeOpt : nodeOpt;
				}
				if (res == null) {
					res = defaultValue; // no option set at all: return default
				}
				return res;
			},
			/** Set expander, checkbox, or node icon, supporting string and object format.
			 *
			 * @param {Element | jQueryObject} span
			 * @param {string} baseClass
			 * @param {string | object} icon
			 * @since 2.27
			 */
			setSpanIcon: function (span, baseClass, icon) {
				var $span = $(span);

				if (typeof icon === "string") {
					$span.attr("class", baseClass + " " + icon);
				} else {
					// support object syntax: { text: ligature, addClasse: classname }
					if (icon.text) {
						$span.text("" + icon.text);
					} else if (icon.html) {
						span.innerHTML = icon.html;
					}
					$span.attr(
						"class",
						baseClass + " " + (icon.addClass || "")
					);
				}
			},
			/** Convert a keydown or mouse event to a canonical string like 'ctrl+a',
			 * 'ctrl+shift+f2', 'shift+leftdblclick'.
			 *
			 * This is especially handy for switch-statements in event handlers.
			 *
			 * @param {event}
			 * @returns {string}
			 *
			 * @example

			switch( $.ui.fancytree.eventToString(event) ) {
				case "-":
					tree.nodeSetExpanded(ctx, false);
					break;
				case "shift+return":
					tree.nodeSetActive(ctx, true);
					break;
				case "down":
					res = node.navigate(event.which, activate);
					break;
				default:
					handled = false;
			}
			if( handled ){
				event.preventDefault();
			}
			*/
			eventToString: function (event) {
				// Poor-man's hotkeys. See here for a complete implementation:
				//   https://github.com/jeresig/jquery.hotkeys
				var which = event.which,
					et = event.type,
					s = [];

				if (event.altKey) {
					s.push("alt");
				}
				if (event.ctrlKey) {
					s.push("ctrl");
				}
				if (event.metaKey) {
					s.push("meta");
				}
				if (event.shiftKey) {
					s.push("shift");
				}

				if (et === "click" || et === "dblclick") {
					s.push(MOUSE_BUTTONS[event.button] + et);
				} else if (et === "wheel") {
					s.push(et);
				} else if (!IGNORE_KEYCODES[which]) {
					s.push(
						SPECIAL_KEYCODES[which] ||
							String.fromCharCode(which).toLowerCase()
					);
				}
				return s.join("+");
			},
			/** Write message to console if debugLevel >= 3
			 * @param {string} msg
			 */
			info: function (msg) {
				if ($.ui.fancytree.debugLevel >= 3) {
					consoleApply("info", arguments);
				}
			},
			/* @deprecated: use eventToString(event) instead.
			 */
			keyEventToString: function (event) {
				this.warn(
					"keyEventToString() is deprecated: use eventToString()"
				);
				return this.eventToString(event);
			},
			/** Return a wrapped handler method, that provides `this._super`.
			 *
			 * @example
				// Implement `opts.createNode` event to add the 'draggable' attribute
				$.ui.fancytree.overrideMethod(ctx.options, "createNode", function(event, data) {
					// Default processing if any
					this._super.apply(this, arguments);
					// Add 'draggable' attribute
					data.node.span.draggable = true;
				});
			 *
			 * @param {object} instance
			 * @param {string} methodName
			 * @param {function} handler
			 * @param {object} [context] optional context
			 */
			overrideMethod: function (instance, methodName, handler, context) {
				var prevSuper,
					_super = instance[methodName] || $.noop;

				instance[methodName] = function () {
					var self = context || this;

					try {
						prevSuper = self._super;
						self._super = _super;
						return handler.apply(self, arguments);
					} finally {
						self._super = prevSuper;
					}
				};
			},
			/**
			 * Parse tree data from HTML <ul> markup
			 *
			 * @param {jQueryObject} $ul
			 * @returns {NodeData[]}
			 */
			parseHtml: function ($ul) {
				var classes,
					className,
					extraClasses,
					i,
					iPos,
					l,
					tmp,
					tmp2,
					$children = $ul.find(">li"),
					children = [];

				$children.each(function () {
					var allData,
						lowerCaseAttr,
						$li = $(this),
						$liSpan = $li.find(">span", this).first(),
						$liA = $liSpan.length ? null : $li.find(">a").first(),
						d = { tooltip: null, data: {} };

					if ($liSpan.length) {
						d.title = $liSpan.html();
					} else if ($liA && $liA.length) {
						// If a <li><a> tag is specified, use it literally and extract href/target.
						d.title = $liA.html();
						d.data.href = $liA.attr("href");
						d.data.target = $liA.attr("target");
						d.tooltip = $liA.attr("title");
					} else {
						// If only a <li> tag is specified, use the trimmed string up to
						// the next child <ul> tag.
						d.title = $li.html();
						iPos = d.title.search(/<ul/i);
						if (iPos >= 0) {
							d.title = d.title.substring(0, iPos);
						}
					}
					d.title = _trim(d.title);

					// Make sure all fields exist
					for (i = 0, l = CLASS_ATTRS.length; i < l; i++) {
						d[CLASS_ATTRS[i]] = undefined;
					}
					// Initialize to `true`, if class is set and collect extraClasses
					classes = this.className.split(" ");
					extraClasses = [];
					for (i = 0, l = classes.length; i < l; i++) {
						className = classes[i];
						if (CLASS_ATTR_MAP[className]) {
							d[className] = true;
						} else {
							extraClasses.push(className);
						}
					}
					d.extraClasses = extraClasses.join(" ");

					// Parse node options from ID, title and class attributes
					tmp = $li.attr("title");
					if (tmp) {
						d.tooltip = tmp; // overrides <a title='...'>
					}
					tmp = $li.attr("id");
					if (tmp) {
						d.key = tmp;
					}
					// Translate hideCheckbox -> checkbox:false
					if ($li.attr("hideCheckbox")) {
						d.checkbox = false;
					}
					// Add <li data-NAME='...'> as node.data.NAME
					allData = _getElementDataAsDict($li);
					if (allData && !$.isEmptyObject(allData)) {
						// #507: convert data-hidecheckbox (lower case) to hideCheckbox
						for (lowerCaseAttr in NODE_ATTR_LOWERCASE_MAP) {
							if (_hasProp(allData, lowerCaseAttr)) {
								allData[
									NODE_ATTR_LOWERCASE_MAP[lowerCaseAttr]
								] = allData[lowerCaseAttr];
								delete allData[lowerCaseAttr];
							}
						}
						// #56: Allow to set special node.attributes from data-...
						for (i = 0, l = NODE_ATTRS.length; i < l; i++) {
							tmp = NODE_ATTRS[i];
							tmp2 = allData[tmp];
							if (tmp2 != null) {
								delete allData[tmp];
								d[tmp] = tmp2;
							}
						}
						// All other data-... goes to node.data...
						$.extend(d.data, allData);
					}
					// Recursive reading of child nodes, if LI tag contains an UL tag
					$ul = $li.find(">ul").first();
					if ($ul.length) {
						d.children = $.ui.fancytree.parseHtml($ul);
					} else {
						d.children = d.lazy ? undefined : null;
					}
					children.push(d);
					// FT.debug("parse ", d, children);
				});
				return children;
			},
			/** Add Fancytree extension definition to the list of globally available extensions.
			 *
			 * @param {object} definition
			 */
			registerExtension: function (definition) {
				_assert(
					definition.name != null,
					"extensions must have a `name` property."
				);
				_assert(
					definition.version != null,
					"extensions must have a `version` property."
				);
				$.ui.fancytree._extensions[definition.name] = definition;
			},
			/** Replacement for the deprecated `jQuery.trim()`.
			 *
			 * @param {string} text
			 */
			trim: _trim,
			/** Inverse of escapeHtml().
			 *
			 * @param {string} s
			 * @returns {string}
			 */
			unescapeHtml: function (s) {
				var e = document.createElement("div");
				e.innerHTML = s;
				return e.childNodes.length === 0
					? ""
					: e.childNodes[0].nodeValue;
			},
			/** Write warning message to console if debugLevel >= 2.
			 * @param {string} msg
			 */
			warn: function (msg) {
				if ($.ui.fancytree.debugLevel >= 2) {
					consoleApply("warn", arguments);
				}
			},
		}
	);

	// Value returned by `require('jquery.fancytree')`
	return $.ui.fancytree;
}); // End of closure
