/*!
 * jquery.fancytree.persist.js
 *
 * Persist tree status in cookiesRemove or highlight tree nodes, based on a filter.
 * (Extension module for jquery.fancytree.js: https://github.com/mar10/fancytree/)
 *
 * @depends: js-cookie or jquery-cookie
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
	/* global Cookies:false */

	/*******************************************************************************
	 * Private functions and variables
	 */
	var cookieStore = null,
		localStorageStore = null,
		sessionStorageStore = null,
		_assert = $.ui.fancytree.assert,
		ACTIVE = "active",
		EXPANDED = "expanded",
		FOCUS = "focus",
		SELECTED = "selected";

	// Accessing window.xxxStorage may raise security exceptions (see #1022)
	try {
		_assert(window.localStorage && window.localStorage.getItem);
		localStorageStore = {
			get: function (key) {
				return window.localStorage.getItem(key);
			},
			set: function (key, value) {
				window.localStorage.setItem(key, value);
			},
			remove: function (key) {
				window.localStorage.removeItem(key);
			},
		};
	} catch (e) {
		$.ui.fancytree.warn("Could not access window.localStorage", e);
	}

	try {
		_assert(window.sessionStorage && window.sessionStorage.getItem);
		sessionStorageStore = {
			get: function (key) {
				return window.sessionStorage.getItem(key);
			},
			set: function (key, value) {
				window.sessionStorage.setItem(key, value);
			},
			remove: function (key) {
				window.sessionStorage.removeItem(key);
			},
		};
	} catch (e) {
		$.ui.fancytree.warn("Could not access window.sessionStorage", e);
	}

	if (typeof Cookies === "function") {
		// Assume https://github.com/js-cookie/js-cookie
		cookieStore = {
			get: Cookies.get,
			set: function (key, value) {
				Cookies.set(key, value, this.options.persist.cookie);
			},
			remove: Cookies.remove,
		};
	} else if ($ && typeof $.cookie === "function") {
		// Fall back to https://github.com/carhartl/jquery-cookie
		cookieStore = {
			get: $.cookie,
			set: function (key, value) {
				$.cookie(key, value, this.options.persist.cookie);
			},
			remove: $.removeCookie,
		};
	}

	/* Recursively load lazy nodes
	 * @param {string} mode 'load', 'expand', false
	 */
	function _loadLazyNodes(tree, local, keyList, mode, dfd) {
		var i,
			key,
			l,
			node,
			foundOne = false,
			expandOpts = tree.options.persist.expandOpts,
			deferredList = [],
			missingKeyList = [];

		keyList = keyList || [];
		dfd = dfd || $.Deferred();

		for (i = 0, l = keyList.length; i < l; i++) {
			key = keyList[i];
			node = tree.getNodeByKey(key);
			if (node) {
				if (mode && node.isUndefined()) {
					foundOne = true;
					tree.debug(
						"_loadLazyNodes: " + node + " is lazy: loading..."
					);
					if (mode === "expand") {
						deferredList.push(node.setExpanded(true, expandOpts));
					} else {
						deferredList.push(node.load());
					}
				} else {
					tree.debug("_loadLazyNodes: " + node + " already loaded.");
					node.setExpanded(true, expandOpts);
				}
			} else {
				missingKeyList.push(key);
				tree.debug("_loadLazyNodes: " + node + " was not yet found.");
			}
		}

		$.when.apply($, deferredList).always(function () {
			// All lazy-expands have finished
			if (foundOne && missingKeyList.length > 0) {
				// If we read new nodes from server, try to resolve yet-missing keys
				_loadLazyNodes(tree, local, missingKeyList, mode, dfd);
			} else {
				if (missingKeyList.length) {
					tree.warn(
						"_loadLazyNodes: could not load those keys: ",
						missingKeyList
					);
					for (i = 0, l = missingKeyList.length; i < l; i++) {
						key = keyList[i];
						local._appendKey(EXPANDED, keyList[i], false);
					}
				}
				dfd.resolve();
			}
		});
		return dfd;
	}

	/**
	 * [ext-persist] Remove persistence data of the given type(s).
	 * Called like
	 *     $.ui.fancytree.getTree("#tree").clearCookies("active expanded focus selected");
	 *
	 * @alias Fancytree#clearPersistData
	 * @requires jquery.fancytree.persist.js
	 */
	$.ui.fancytree._FancytreeClass.prototype.clearPersistData = function (
		types
	) {
		var local = this.ext.persist,
			prefix = local.cookiePrefix;

		types = types || "active expanded focus selected";
		if (types.indexOf(ACTIVE) >= 0) {
			local._data(prefix + ACTIVE, null);
		}
		if (types.indexOf(EXPANDED) >= 0) {
			local._data(prefix + EXPANDED, null);
		}
		if (types.indexOf(FOCUS) >= 0) {
			local._data(prefix + FOCUS, null);
		}
		if (types.indexOf(SELECTED) >= 0) {
			local._data(prefix + SELECTED, null);
		}
	};

	$.ui.fancytree._FancytreeClass.prototype.clearCookies = function (types) {
		this.warn(
			"'tree.clearCookies()' is deprecated since v2.27.0: use 'clearPersistData()' instead."
		);
		return this.clearPersistData(types);
	};

	/**
	 * [ext-persist] Return persistence information from cookies
	 *
	 * Called like
	 *     $.ui.fancytree.getTree("#tree").getPersistData();
	 *
	 * @alias Fancytree#getPersistData
	 * @requires jquery.fancytree.persist.js
	 */
	$.ui.fancytree._FancytreeClass.prototype.getPersistData = function () {
		var local = this.ext.persist,
			prefix = local.cookiePrefix,
			delim = local.cookieDelimiter,
			res = {};

		res[ACTIVE] = local._data(prefix + ACTIVE);
		res[EXPANDED] = (local._data(prefix + EXPANDED) || "").split(delim);
		res[SELECTED] = (local._data(prefix + SELECTED) || "").split(delim);
		res[FOCUS] = local._data(prefix + FOCUS);
		return res;
	};

	/******************************************************************************
	 * Extension code
	 */
	$.ui.fancytree.registerExtension({
		name: "persist",
		version: "2.38.3",
		// Default options for this extension.
		options: {
			cookieDelimiter: "~",
			cookiePrefix: undefined, // 'fancytree-<treeId>-' by default
			cookie: {
				raw: false,
				expires: "",
				path: "",
				domain: "",
				secure: false,
			},
			expandLazy: false, // true: recursively expand and load lazy nodes
			expandOpts: undefined, // optional `opts` argument passed to setExpanded()
			fireActivate: true, // false: suppress `activate` event after active node was restored
			overrideSource: true, // true: cookie takes precedence over `source` data attributes.
			store: "auto", // 'cookie': force cookie, 'local': force localStore, 'session': force sessionStore
			types: "active expanded focus selected",
		},

		/* Generic read/write string data to cookie, sessionStorage or localStorage. */
		_data: function (key, value) {
			var store = this._local.store;

			if (value === undefined) {
				return store.get.call(this, key);
			} else if (value === null) {
				store.remove.call(this, key);
			} else {
				store.set.call(this, key, value);
			}
		},

		/* Append `key` to a cookie. */
		_appendKey: function (type, key, flag) {
			key = "" + key; // #90
			var local = this._local,
				instOpts = this.options.persist,
				delim = instOpts.cookieDelimiter,
				cookieName = local.cookiePrefix + type,
				data = local._data(cookieName),
				keyList = data ? data.split(delim) : [],
				idx = $.inArray(key, keyList);
			// Remove, even if we add a key,  so the key is always the last entry
			if (idx >= 0) {
				keyList.splice(idx, 1);
			}
			// Append key to cookie
			if (flag) {
				keyList.push(key);
			}
			local._data(cookieName, keyList.join(delim));
		},

		treeInit: function (ctx) {
			var tree = ctx.tree,
				opts = ctx.options,
				local = this._local,
				instOpts = this.options.persist;

			// // For 'auto' or 'cookie' mode, the cookie plugin must be available
			// _assert((instOpts.store !== "auto" && instOpts.store !== "cookie") || cookieStore,
			// 	"Missing required plugin for 'persist' extension: js.cookie.js or jquery.cookie.js");

			local.cookiePrefix =
				instOpts.cookiePrefix || "fancytree-" + tree._id + "-";
			local.storeActive = instOpts.types.indexOf(ACTIVE) >= 0;
			local.storeExpanded = instOpts.types.indexOf(EXPANDED) >= 0;
			local.storeSelected = instOpts.types.indexOf(SELECTED) >= 0;
			local.storeFocus = instOpts.types.indexOf(FOCUS) >= 0;
			local.store = null;

			if (instOpts.store === "auto") {
				instOpts.store = localStorageStore ? "local" : "cookie";
			}
			if ($.isPlainObject(instOpts.store)) {
				local.store = instOpts.store;
			} else if (instOpts.store === "cookie") {
				local.store = cookieStore;
			} else if (instOpts.store === "local") {
				local.store =
					instOpts.store === "local"
						? localStorageStore
						: sessionStorageStore;
			} else if (instOpts.store === "session") {
				local.store =
					instOpts.store === "local"
						? localStorageStore
						: sessionStorageStore;
			}
			_assert(local.store, "Need a valid store.");

			// Bind init-handler to apply cookie state
			tree.$div.on("fancytreeinit", function (event) {
				if (
					tree._triggerTreeEvent("beforeRestore", null, {}) === false
				) {
					return;
				}

				var cookie,
					dfd,
					i,
					keyList,
					node,
					prevFocus = local._data(local.cookiePrefix + FOCUS), // record this before node.setActive() overrides it;
					noEvents = instOpts.fireActivate === false;

				// tree.debug("document.cookie:", document.cookie);

				cookie = local._data(local.cookiePrefix + EXPANDED);
				keyList = cookie && cookie.split(instOpts.cookieDelimiter);

				if (local.storeExpanded) {
					// Recursively load nested lazy nodes if expandLazy is 'expand' or 'load'
					// Also remove expand-cookies for unmatched nodes
					dfd = _loadLazyNodes(
						tree,
						local,
						keyList,
						instOpts.expandLazy ? "expand" : false,
						null
					);
				} else {
					// nothing to do
					dfd = new $.Deferred().resolve();
				}

				dfd.done(function () {
					if (local.storeSelected) {
						cookie = local._data(local.cookiePrefix + SELECTED);
						if (cookie) {
							keyList = cookie.split(instOpts.cookieDelimiter);
							for (i = 0; i < keyList.length; i++) {
								node = tree.getNodeByKey(keyList[i]);
								if (node) {
									if (
										node.selected === undefined ||
										(instOpts.overrideSource &&
											node.selected === false)
									) {
										//									node.setSelected();
										node.selected = true;
										node.renderStatus();
									}
								} else {
									// node is no longer member of the tree: remove from cookie also
									local._appendKey(
										SELECTED,
										keyList[i],
										false
									);
								}
							}
						}
						// In selectMode 3 we have to fix the child nodes, since we
						// only stored the selected *top* nodes
						if (tree.options.selectMode === 3) {
							tree.visit(function (n) {
								if (n.selected) {
									n.fixSelection3AfterClick();
									return "skip";
								}
							});
						}
					}
					if (local.storeActive) {
						cookie = local._data(local.cookiePrefix + ACTIVE);
						if (
							cookie &&
							(opts.persist.overrideSource || !tree.activeNode)
						) {
							node = tree.getNodeByKey(cookie);
							if (node) {
								node.debug("persist: set active", cookie);
								// We only want to set the focus if the container
								// had the keyboard focus before
								node.setActive(true, {
									noFocus: true,
									noEvents: noEvents,
								});
							}
						}
					}
					if (local.storeFocus && prevFocus) {
						node = tree.getNodeByKey(prevFocus);
						if (node) {
							// node.debug("persist: set focus", cookie);
							if (tree.options.titlesTabbable) {
								$(node.span).find(".fancytree-title").focus();
							} else {
								$(tree.$container).focus();
							}
							// node.setFocus();
						}
					}
					tree._triggerTreeEvent("restore", null, {});
				});
			});
			// Init the tree
			return this._superApply(arguments);
		},
		nodeSetActive: function (ctx, flag, callOpts) {
			var res,
				local = this._local;

			flag = flag !== false;
			res = this._superApply(arguments);

			if (local.storeActive) {
				local._data(
					local.cookiePrefix + ACTIVE,
					this.activeNode ? this.activeNode.key : null
				);
			}
			return res;
		},
		nodeSetExpanded: function (ctx, flag, callOpts) {
			var res,
				node = ctx.node,
				local = this._local;

			flag = flag !== false;
			res = this._superApply(arguments);

			if (local.storeExpanded) {
				local._appendKey(EXPANDED, node.key, flag);
			}
			return res;
		},
		nodeSetFocus: function (ctx, flag) {
			var res,
				local = this._local;

			flag = flag !== false;
			res = this._superApply(arguments);

			if (local.storeFocus) {
				local._data(
					local.cookiePrefix + FOCUS,
					this.focusNode ? this.focusNode.key : null
				);
			}
			return res;
		},
		nodeSetSelected: function (ctx, flag, callOpts) {
			var res,
				selNodes,
				tree = ctx.tree,
				node = ctx.node,
				local = this._local;

			flag = flag !== false;
			res = this._superApply(arguments);

			if (local.storeSelected) {
				if (tree.options.selectMode === 3) {
					// In selectMode 3 we only store the the selected *top* nodes.
					// De-selecting a node may also de-select some parents, so we
					// calculate the current status again
					selNodes = $.map(tree.getSelectedNodes(true), function (n) {
						return n.key;
					});
					selNodes = selNodes.join(
						ctx.options.persist.cookieDelimiter
					);
					local._data(local.cookiePrefix + SELECTED, selNodes);
				} else {
					// beforeSelect can prevent the change - flag doesn't reflect the node.selected state
					local._appendKey(SELECTED, node.key, node.selected);
				}
			}
			return res;
		},
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
