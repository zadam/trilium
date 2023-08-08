/*!
 * jquery.fancytree.logger.js
 *
 * Miscellaneous debug extensions.
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
	var i,
		FT = $.ui.fancytree,
		PREFIX = "ft-logger: ",
		logLine = window.console.log,
		// HOOK_NAMES = "nodeClick nodeCollapseSiblings".split(" "),
		TREE_EVENT_NAMES =
			"beforeRestore beforeUpdateViewport blurTree create init focusTree preInit restore updateViewport".split(
				" "
			),
		NODE_EVENT_NAMES =
			"activate activateCell beforeActivate beforeExpand beforeSelect blur click collapse createNode dblclick deactivate defaultGridAction expand enhanceTitle focus keydown keypress lazyLoad loadChildren loadError modifyChild postProcess renderNode renderTitle select".split(
				" "
			),
		EVENT_NAMES = TREE_EVENT_NAMES.concat(NODE_EVENT_NAMES),
		// HOOK_NAME_MAP = {},
		EVENT_NAME_MAP = {};

	/*
	 */
	// for (i = 0; i < HOOK_NAMES.length; i++) {
	// 	HOOK_NAME_MAP[HOOK_NAMES[i]] = true;
	// }
	for (i = 0; i < EVENT_NAMES.length; i++) {
		EVENT_NAME_MAP[EVENT_NAMES[i]] = true;
	}

	function getBrowserInfo() {
		var n = navigator.appName,
			ua = navigator.userAgent,
			tem,
			m = ua.match(
				/(opera|chrome|safari|firefox|msie)\/?\s*(\.?\d+(\.\d+)*)/i
			);

		if (m && (tem = ua.match(/version\/([.\d]+)/i)) !== null) {
			m[2] = tem[1];
		}
		m = m ? [m[1], m[2]] : [n, navigator.appVersion, "-?"];
		return m.join(", ");
	}

	function logEvent(event, data) {
		var res,
			self = this,
			// logName = PREFIX + "event." + event.type,
			opts = data.options.logger,
			tree = data.tree,
			// widget = data.widget,
			obj = data.node || tree,
			logName = PREFIX + "event." + event.type + " (" + obj + ")";

		if (
			!opts.traceEvents ||
			(opts.traceEvents !== true && $.inArray(name, opts.traceEvents) < 0)
		) {
			return self._super.apply(self, arguments);
		}
		if (
			(self._super && opts.timings === true) ||
			(opts.timings && $.inArray(name, opts.timings) >= 0)
		) {
			// if( name === "nodeRender" ) { logName += obj; }  // allow timing for recursive calls
			// logName += " (" + obj + ")";
			window.console.time(logName);
			res = self._super.apply(self, arguments);
			window.console.timeEnd(logName);
		} else {
			// obj.info(logName, data);
			logLine(logName, event, data);
			res = self._super.apply(self, arguments);
		}
		return res;
	}

	function logHook(name, this_, args, extra) {
		var res,
			ctx = args[0],
			opts = ctx.options.logger,
			obj = ctx.node || ctx.tree,
			logName = PREFIX + "hook." + name + " (" + obj + ")";

		if (
			!opts.traceHooks ||
			(opts.traceHooks !== true && $.inArray(name, opts.traceHooks) < 0)
		) {
			return this_._superApply.call(this_, args);
		}
		if (
			opts.timings === true ||
			(opts.timings && $.inArray(name, opts.timings) >= 0)
		) {
			// if( name === "nodeRender" ) { logName += obj; }  // allow timing for recursive calls
			// logName += " (" + obj + ")";
			window.console.time(logName);
			res = this_._superApply.call(this_, args);
			window.console.timeEnd(logName);
		} else {
			if (extra) {
				// obj.info(logName, extra, ctx);
				logLine(logName, extra, ctx);
			} else {
				// obj.info(logName, ctx);
				logLine(logName, ctx);
			}
			res = this_._superApply.call(this_, args);
		}
		return res;
	}

	/******************************************************************************
	 * Extension code
	 */
	$.ui.fancytree.registerExtension({
		name: "logger",
		version: "2.38.3",
		// Default options for this extension.
		options: {
			logTarget: null, // optional redirect logging to this <div> tag
			traceEvents: true, // `true`or list of hook names
			traceUnhandledEvents: false,
			traceHooks: false, // `true`or list of event names
			timings: false, // `true`or list of event names
		},
		// Overide virtual methods for this extension.
		// `this`       : is this Fancytree object
		// `this._super`: the virtual function that was overridden (member of prev. extension or Fancytree)
		treeCreate: function (ctx) {
			var tree = ctx.tree,
				opts = ctx.options;

			if (
				this.options.extensions[this.options.extensions.length - 1] !==
				"logger"
			) {
				throw Error(
					"Fancytree 'logger' extension must be listed as last entry."
				);
			}
			tree.warn(
				"Fancytree logger extension is enabled (this may be slow).",
				opts.logger
			);

			tree.debug(
				"Fancytree v" +
					$.ui.fancytree.version +
					", buildType='" +
					$.ui.fancytree.buildType +
					"'"
			);
			tree.debug(
				"jQuery UI " +
					jQuery.ui.version +
					" (uiBackCompat=" +
					$.uiBackCompat +
					")"
			);
			tree.debug("jQuery " + jQuery.fn.jquery);
			tree.debug("Browser: " + getBrowserInfo());

			function _log(event, data) {
				logLine(
					PREFIX + "event." + event.type + " (unhandled)",
					event,
					data
				);
			}
			$.each(EVENT_NAMES, function (i, name) {
				if (typeof opts[name] === "function") {
					// tree.info(PREFIX + "override '" + name + "' event");
					$.ui.fancytree.overrideMethod(
						opts,
						name,
						logEvent,
						ctx.widget
					);
				} else if (opts.logger.traceUnhandledEvents) {
					opts[name] = _log;
				}
			});

			return logHook("treeCreate", this, arguments);
		},
		nodeClick: function (ctx) {
			return logHook(
				"nodeClick",
				this,
				arguments,
				FT.eventToString(ctx.originalEvent)
			);
		},
		nodeCollapseSiblings: function (ctx) {
			return logHook("nodeCollapseSiblings", this, arguments);
		},
		nodeDblclick: function (ctx) {
			return logHook("nodeDblclick", this, arguments);
		},
		nodeKeydown: function (ctx) {
			return logHook(
				"nodeKeydown",
				this,
				arguments,
				FT.eventToString(ctx.originalEvent)
			);
		},
		nodeLoadChildren: function (ctx, source) {
			return logHook("nodeLoadChildren", this, arguments);
		},
		nodeRemoveChildMarkup: function (ctx) {
			return logHook("nodeRemoveChildMarkup", this, arguments);
		},
		nodeRemoveMarkup: function (ctx) {
			return logHook("nodeRemoveMarkup", this, arguments);
		},
		nodeRender: function (ctx, force, deep, collapsed, _recursive) {
			return logHook("nodeRender", this, arguments);
		},
		nodeRenderStatus: function (ctx) {
			return logHook("nodeRenderStatus", this, arguments);
		},
		nodeRenderTitle: function (ctx, title) {
			return logHook("nodeRenderTitle", this, arguments);
		},
		nodeSetActive: function (ctx, flag, callOpts) {
			return logHook("nodeSetActive", this, arguments);
		},
		nodeSetExpanded: function (ctx, flag, callOpts) {
			return logHook("nodeSetExpanded", this, arguments);
		},
		nodeSetFocus: function (ctx) {
			return logHook("nodeSetFocus", this, arguments);
		},
		nodeSetSelected: function (ctx, flag, callOpts) {
			return logHook("nodeSetSelected", this, arguments);
		},
		nodeSetStatus: function (ctx, status, message, details) {
			return logHook("nodeSetStatus", this, arguments);
		},
		nodeToggleExpanded: function (ctx) {
			return logHook("nodeToggleExpanded", this, arguments);
		},
		nodeToggleSelected: function (ctx) {
			return logHook("nodeToggleSelected", this, arguments);
		},
		treeClear: function (ctx) {
			return logHook("treeClear", this, arguments);
		},
		// treeCreate: function(ctx) {
		// 	return logHook("treeCreate", this, arguments);
		// },
		treeDestroy: function (ctx) {
			return logHook("treeDestroy", this, arguments);
		},
		treeInit: function (ctx) {
			return logHook("treeInit", this, arguments);
		},
		treeLoad: function (ctx, source) {
			return logHook("treeLoad", this, arguments);
		},
		treeRegisterNode: function (ctx, add, node) {
			return logHook("treeRegisterNode", this, arguments);
		},
		treeSetFocus: function (ctx, flag, callOpts) {
			return logHook("treeSetFocus", this, arguments);
		},
		treeSetOption: function (ctx, key, value) {
			return logHook("treeSetOption", this, arguments);
		},
		treeStructureChanged: function (ctx, type) {
			return logHook("treeStructureChanged", this, arguments);
		},
	});

	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
