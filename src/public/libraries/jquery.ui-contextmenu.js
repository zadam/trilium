/*******************************************************************************
 * jquery.ui-contextmenu.js plugin.
 *
 * jQuery plugin that provides a context menu (based on the jQueryUI menu widget).
 *
 * @see https://github.com/mar10/jquery-ui-contextmenu
 *
 * Copyright (c) 2013-2017, Martin Wendt (http://wwWendt.de). Licensed MIT.
 */

(function( factory ) {
	"use strict";
	if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define([ "jquery", "jquery-ui/ui/widgets/menu" ], factory );
	} else {
		// Browser globals
		factory( jQuery );
	}
}(function( $ ) {

"use strict";

var supportSelectstart = "onselectstart" in document.createElement("div"),
	match = $.ui.menu.version.match(/^(\d)\.(\d+)/),
	uiVersion = {
		major: parseInt(match[1], 10),
		minor: parseInt(match[2], 10)
	},
	isLTE110 = ( uiVersion.major < 2 && uiVersion.minor <= 10 ),
	isLTE111 = ( uiVersion.major < 2 && uiVersion.minor <= 11 );

$.widget("moogle.contextmenu", {
	version: "@VERSION",
	options: {
		addClass: "ui-contextmenu",  // Add this class to the outer <ul>
		closeOnWindowBlur: true,     // Close menu when window loses focus
		autoFocus: false,     // Set keyboard focus to first entry on open
		autoTrigger: true,    // open menu on browser's `contextmenu` event
		delegate: null,       // selector
		hide: { effect: "fadeOut", duration: "fast" },
		ignoreParentSelect: true, // Don't trigger 'select' for sub-menu parents
		menu: null,           // selector or jQuery pointing to <UL>, or a definition hash
		position: null,       // popup positon
		preventContextMenuForPopup: false, // prevent opening the browser's system
										   // context menu on menu entries
		preventSelect: false, // disable text selection of target
		show: { effect: "slideDown", duration: "fast" },
		taphold: false,       // open menu on taphold events (requires external plugins)
		uiMenuOptions: {},	  // Additional options, used when UI Menu is created
		// Events:
		beforeOpen: $.noop,   // menu about to open; return `false` to prevent opening
		blur: $.noop,         // menu option lost focus
		close: $.noop,        // menu was closed
		create: $.noop,       // menu was initialized
		createMenu: $.noop,   // menu was initialized (original UI Menu)
		focus: $.noop,        // menu option got focus
		open: $.noop,         // menu was opened
		select: $.noop        // menu option was selected; return `false` to prevent closing
	},
	/** Constructor */
	_create: function() {
		var cssText, eventNames, targetId,
			opts = this.options;

		this.$headStyle = null;
		this.$menu = null;
		this.menuIsTemp = false;
		this.currentTarget = null;
		this.extraData = {};
		this.previousFocus = null;

		if (opts.delegate == null) {
			$.error("ui-contextmenu: Missing required option `delegate`.");
		}
		if (opts.preventSelect) {
			// Create a global style for all potential menu targets
			// If the contextmenu was bound to `document`, we apply the
			// selector relative to the <body> tag instead
			targetId = ($(this.element).is(document) ? $("body")
				: this.element).uniqueId().attr("id");
			cssText = "#" + targetId + " " + opts.delegate + " { " +
					"-webkit-user-select: none; " +
					"-khtml-user-select: none; " +
					"-moz-user-select: none; " +
					"-ms-user-select: none; " +
					"user-select: none; " +
					"}";
			this.$headStyle = $("<style class='moogle-contextmenu-style' />")
				.prop("type", "text/css")
				.appendTo("head");

			try {
				this.$headStyle.html(cssText);
			} catch ( e ) {
				// issue #47: fix for IE 6-8
				this.$headStyle[0].styleSheet.cssText = cssText;
			}
			// TODO: the selectstart is not supported by FF?
			if (supportSelectstart) {
				this.element.on("selectstart" + this.eventNamespace, opts.delegate,
									  function(event) {
					event.preventDefault();
				});
			}
		}
		this._createUiMenu(opts.menu);

		eventNames = "contextmenu" + this.eventNamespace;
		if (opts.taphold) {
			eventNames += " taphold" + this.eventNamespace;
		}
		this.element.on(eventNames, opts.delegate, $.proxy(this._openMenu, this));
	},
	/** Destructor, called on $().contextmenu("destroy"). */
	_destroy: function() {
		this.element.off(this.eventNamespace);

		this._createUiMenu(null);

		if (this.$headStyle) {
			this.$headStyle.remove();
			this.$headStyle = null;
		}
	},
	/** (Re)Create jQuery UI Menu. */
	_createUiMenu: function(menuDef) {
		var ct, ed,
			opts = this.options;

		// Remove temporary <ul> if any
		if (this.isOpen()) {
			// #58: 'replaceMenu' in beforeOpen causing select: to lose ui.target
			ct = this.currentTarget;
			ed = this.extraData;
			// close without animation, to force async mode
			this._closeMenu(true);
			this.currentTarget = ct;
			this.extraData = ed;
		}
		if (this.menuIsTemp) {
			this.$menu.remove(); // this will also destroy ui.menu
		} else if (this.$menu) {
			this.$menu
				.menu("destroy")
				.removeClass(this.options.addClass)
				.hide();
		}
		this.$menu = null;
		this.menuIsTemp = false;
		// If a menu definition array was passed, create a hidden <ul>
		// and generate the structure now
		if ( !menuDef ) {
			return;
		} else if ($.isArray(menuDef)) {
			this.$menu = $.moogle.contextmenu.createMenuMarkup(menuDef);
			this.menuIsTemp = true;
		}else if ( typeof menuDef === "string" ) {
			this.$menu = $(menuDef);
		} else {
			this.$menu = menuDef;
		}
		// Create - but hide - the jQuery UI Menu widget
		this.$menu
			.hide()
			.addClass(opts.addClass)
			// Create a menu instance that delegates events to our widget
			.menu($.extend(true, {}, opts.uiMenuOptions, {
				items: "> :not(.ui-widget-header)",
				blur: $.proxy(opts.blur, this),
				create: $.proxy(opts.createMenu, this),
				focus: $.proxy(opts.focus, this),
				select: $.proxy(function(event, ui) {
					// User selected a menu entry
					var retval,
						isParent = $.moogle.contextmenu.isMenu(ui.item),
						actionHandler = ui.item.data("actionHandler");

					ui.cmd = ui.item.attr("data-command");
					ui.target = $(this.currentTarget);
					ui.extraData = this.extraData;
					// ignore clicks, if they only open a sub-menu
					if ( !isParent || !opts.ignoreParentSelect) {
						retval = this._trigger.call(this, "select", event, ui);
						if ( actionHandler ) {
							retval = actionHandler.call(this, event, ui);
						}
						if ( retval !== false ) {
							this._closeMenu.call(this);
						}
						event.preventDefault();
					}
				}, this)
			}));
	},
	/** Open popup (called on 'contextmenu' event). */
	_openMenu: function(event, recursive) {
		var res, promise, ui,
			opts = this.options,
			posOption = opts.position,
			self = this,
			manualTrigger = !!event.isTrigger;

		if ( !opts.autoTrigger && !manualTrigger ) {
			// ignore browser's `contextmenu` events
			return;
		}
		// Prevent browser from opening the system context menu
		event.preventDefault();

		this.currentTarget = event.target;
		this.extraData = event._extraData || {};

		ui = { menu: this.$menu, target: $(this.currentTarget), extraData: this.extraData,
			   originalEvent: event, result: null };

		if ( !recursive ) {
			res = this._trigger("beforeOpen", event, ui);
			promise = (ui.result && $.isFunction(ui.result.promise)) ? ui.result : null;
			ui.result = null;
			if ( res === false ) {
				this.currentTarget = null;
				return false;
			} else if ( promise ) {
				// Handler returned a Deferred or Promise. Delay menu open until
				// the promise is resolved
				promise.done(function() {
					self._openMenu(event, true);
				});
				this.currentTarget = null;
				return false;
			}
			ui.menu = this.$menu; // Might have changed in beforeOpen
		}

		// Register global event handlers that close the dropdown-menu
		$(document).on("keydown" + this.eventNamespace, function(event) {
			if ( event.which === $.ui.keyCode.ESCAPE ) {
				self._closeMenu();
			}
		}).on("mousedown" + this.eventNamespace + " touchstart" + this.eventNamespace,
				function(event) {
			// Close menu when clicked outside menu
			if ( !$(event.target).closest(".ui-menu-item").length ) {
				self._closeMenu();
			}
		});
		$(window).on("blur" + this.eventNamespace, function(event) {
			if ( opts.closeOnWindowBlur ) {
				self._closeMenu();
			}
		});

		// required for custom positioning (issue #18 and #13).
		if ($.isFunction(posOption)) {
			posOption = posOption(event, ui);
		}
		posOption = $.extend({
			my: "left top",
			at: "left bottom",
			// if called by 'open' method, event does not have pageX/Y
			of: (event.pageX === undefined) ? event.target : event,
			collision: "fit"
		}, posOption);

		// Update entry statuses from callbacks
		this._updateEntries(this.$menu);

		// Finally display the popup
		this.$menu
			.show() // required to fix positioning error
			.css({
				position: "absolute",
				left: 0,
				top: 0
			}).position(posOption)
			.hide(); // hide again, so we can apply nice effects

		if ( opts.preventContextMenuForPopup ) {
			this.$menu.on("contextmenu" + this.eventNamespace, function(event) {
				event.preventDefault();
			});
		}
		this._show(this.$menu, opts.show, function() {
			var $first;

			// Set focus to first active menu entry
			if ( opts.autoFocus ) {
				self.previousFocus = $(event.target);
				// self.$menu.focus();
				$first = self.$menu
					.children("li.ui-menu-item")
					.not(".ui-state-disabled")
					.first();
				self.$menu.menu("focus", null, $first).focus();
			}
			self._trigger.call(self, "open", event, ui);
		});
	},
	/** Close popup. */
	_closeMenu: function(immediately) {
		var self = this,
			hideOpts = immediately ? false : this.options.hide,
			ui = { menu: this.$menu, target: $(this.currentTarget), extraData: this.extraData };

		// Note: we don't want to unbind the 'contextmenu' event
		$(document)
			.off("mousedown" + this.eventNamespace)
			.off("touchstart" + this.eventNamespace)
			.off("keydown" + this.eventNamespace);
		$(window)
			.off("blur" + this.eventNamespace);

		self.currentTarget = null; // issue #44 after hide animation is too late
		self.extraData = {};
		if ( this.$menu ) { // #88: widget might have been destroyed already
			this.$menu
				.off("contextmenu" + this.eventNamespace);
			this._hide(this.$menu, hideOpts, function() {
				if ( self.previousFocus ) {
					self.previousFocus.focus();
					self.previousFocus = null;
				}
				self._trigger("close", null, ui);
			});
		} else {
			self._trigger("close", null, ui);
		}
	},
	/** Handle $().contextmenu("option", key, value) calls. */
	_setOption: function(key, value) {
		switch (key) {
		case "menu":
			this.replaceMenu(value);
			break;
		}
		$.Widget.prototype._setOption.apply(this, arguments);
	},
	/** Return ui-menu entry (<LI> tag). */
	_getMenuEntry: function(cmd) {
		return this.$menu.find("li[data-command=" + cmd + "]");
	},
	/** Close context menu. */
	close: function() {
		if (this.isOpen()) {
			this._closeMenu();
		}
	},
	/* Apply status callbacks when menu is opened. */
	_updateEntries: function() {
		var self = this,
			ui = {
				menu: this.$menu, target: $(this.currentTarget), extraData: this.extraData };

		$.each(this.$menu.find(".ui-menu-item"), function(i, o) {
			var $entry = $(o),
				fn = $entry.data("disabledHandler"),
				res = fn ? fn({ type: "disabled" }, ui) : null;

			ui.item = $entry;
			ui.cmd = $entry.attr("data-command");
			// Evaluate `disabled()` callback
			if ( res != null ) {
				self.enableEntry(ui.cmd, !res);
				self.showEntry(ui.cmd, res !== "hide");
			}
			// Evaluate `title()` callback
			fn = $entry.data("titleHandler"),
			res = fn ? fn({ type: "title" }, ui) : null;
			if ( res != null ) {
				self.setTitle(ui.cmd, "" + res);
			}
			// Evaluate `tooltip()` callback
			fn = $entry.data("tooltipHandler"),
			res = fn ? fn({ type: "tooltip" }, ui) : null;
			if ( res != null ) {
				$entry.attr("title", "" + res);
			}
		});
	},
	/** Enable or disable the menu command. */
	enableEntry: function(cmd, flag) {
		this._getMenuEntry(cmd).toggleClass("ui-state-disabled", (flag === false));
	},
	/** Return ui-menu entry (LI tag) as jQuery object. */
	getEntry: function(cmd) {
		return this._getMenuEntry(cmd);
	},
	/** Return ui-menu entry wrapper as jQuery object.
		UI 1.10: this is the <a> tag inside the LI
		UI 1.11: this is the LI istself
		UI 1.12: this is the <div> tag inside the LI
	 */
	getEntryWrapper: function(cmd) {
		return this._getMenuEntry(cmd).find(">[role=menuitem]").addBack("[role=menuitem]");
	},
	/** Return Menu element (UL). */
	getMenu: function() {
		return this.$menu;
	},
	/** Return true if menu is open. */
	isOpen: function() {
//            return this.$menu && this.$menu.is(":visible");
		return !!this.$menu && !!this.currentTarget;
	},
	/** Open context menu on a specific target (must match options.delegate)
	 *  Optional `extraData` is passed to event handlers as `ui.extraData`.
	 */
	open: function(targetOrEvent, extraData) {
		// Fake a 'contextmenu' event
		extraData = extraData || {};

		var isEvent = (targetOrEvent && targetOrEvent.type && targetOrEvent.target),
			event =  isEvent ? targetOrEvent : {},
			target = isEvent ? targetOrEvent.target : targetOrEvent,
			e = jQuery.Event("contextmenu", {
				target: $(target).get(0),
				pageX: event.pageX,
				pageY: event.pageY,
				originalEvent: isEvent ? targetOrEvent : undefined,
				_extraData: extraData
			});
		return this.element.trigger(e);
	},
	/** Replace the menu altogether. */
	replaceMenu: function(data) {
		this._createUiMenu(data);
	},
	/** Redefine a whole menu entry. */
	setEntry: function(cmd, entry) {
		var $ul,
			$entryLi = this._getMenuEntry(cmd);

		if (typeof entry === "string") {
			window.console && window.console.warn(
				"setEntry(cmd, t) with a plain string title is deprecated since v1.18." +
				"Use setTitle(cmd, '" + entry + "') instead.");
			return this.setTitle(cmd, entry);
		}
		$entryLi.empty();
		entry.cmd = entry.cmd || cmd;
		$.moogle.contextmenu.createEntryMarkup(entry, $entryLi);
		if ($.isArray(entry.children)) {
			$ul = $("<ul/>").appendTo($entryLi);
			$.moogle.contextmenu.createMenuMarkup(entry.children, $ul);
		}
		// #110: jQuery UI 1.12: refresh only works when this class is not set:
		$entryLi.removeClass("ui-menu-item");
		this.getMenu().menu("refresh");
	},
	/** Set icon (pass null to remove). */
	setIcon: function(cmd, icon) {
		return this.updateEntry(cmd, { uiIcon: icon });
	},
	/** Set title. */
	setTitle: function(cmd, title) {
		return this.updateEntry(cmd, { title: title });
	},
	// /** Set tooltip (pass null to remove). */
	// setTooltip: function(cmd, tooltip) {
	// 	this._getMenuEntry(cmd).attr("title", tooltip);
	// },
	/** Show or hide the menu command. */
	showEntry: function(cmd, flag) {
		this._getMenuEntry(cmd).toggle(flag !== false);
	},
	/** Redefine selective attributes of a menu entry. */
	updateEntry: function(cmd, entry) {
		var $icon, $wrapper,
			$entryLi = this._getMenuEntry(cmd);

		if ( entry.title !== undefined ) {
			$.moogle.contextmenu.updateTitle($entryLi, "" + entry.title);
		}
		if ( entry.tooltip !== undefined ) {
			if ( entry.tooltip === null ) {
				$entryLi.removeAttr("title");
			} else {
				$entryLi.attr("title", entry.tooltip);
			}
		}
		if ( entry.uiIcon !== undefined ) {
			$wrapper = this.getEntryWrapper(cmd),
			$icon = $wrapper.find("span.ui-icon").not(".ui-menu-icon");
			$icon.remove();
			if ( entry.uiIcon ) {
				$wrapper.append($("<span class='ui-icon' />").addClass(entry.uiIcon));
			}
		}
		if ( entry.hide !== undefined ) {
			$entryLi.toggle(!entry.hide);
		} else if ( entry.show !== undefined ) {
			// Note: `show` is an undocumented variant. `hide: false` is preferred
			$entryLi.toggle(!!entry.show);
		}
		// if ( entry.isHeader !== undefined ) {
		// 	$entryLi.toggleClass("ui-widget-header", !!entry.isHeader);
		// }
		if ( entry.data !== undefined ) {
			$entryLi.data(entry.data);
		}

		// Set/clear class names, but handle ui-state-disabled separately
		if ( entry.disabled === undefined ) {
			entry.disabled = $entryLi.hasClass("ui-state-disabled");
		}
		if ( entry.setClass ) {
			if ( $entryLi.hasClass("ui-menu-item") ) {
				entry.setClass += " ui-menu-item";
			}
			$entryLi.removeClass();
			$entryLi.addClass(entry.setClass);
		} else if ( entry.addClass ) {
			$entryLi.addClass(entry.addClass);
		}
		$entryLi.toggleClass("ui-state-disabled", !!entry.disabled);
		// // #110: jQuery UI 1.12: refresh only works when this class is not set:
		// $entryLi.removeClass("ui-menu-item");
		// this.getMenu().menu("refresh");
	}
});

/*
 * Global functions
 */
$.extend($.moogle.contextmenu, {
	/** Convert a menu description into a into a <li> content. */
	createEntryMarkup: function(entry, $parentLi) {
		var $wrapper = null;

		$parentLi.attr("data-command", entry.cmd);

		if ( !/[^\-\u2014\u2013\s]/.test( entry.title ) ) {
			// hyphen, em dash, en dash: separator as defined by UI Menu 1.10
			$parentLi.text(entry.title);
		} else {
			if ( isLTE110 ) {
				// jQuery UI Menu 1.10 or before required an `<a>` tag
				$wrapper = $("<a/>", {
						html: "" + entry.title,
						href: "#"
					}).appendTo($parentLi);

			} else if ( isLTE111 ) {
				// jQuery UI Menu 1.11 preferes to avoid `<a>` tags or <div> wrapper
				$parentLi.html("" + entry.title);
				$wrapper = $parentLi;

			} else {
				// jQuery UI Menu 1.12 introduced `<div>` wrappers
				$wrapper = $("<div/>", {
						html: "" + entry.title
					}).appendTo($parentLi);
			}
			if ( entry.uiIcon ) {
				$wrapper.append($("<span class='ui-icon' />").addClass(entry.uiIcon));
			}
			// Store option callbacks in entry's data
			$.each( [ "action", "disabled", "title", "tooltip" ], function(i, attr) {
				if ( $.isFunction(entry[attr]) ) {
					$parentLi.data(attr + "Handler", entry[attr]);
				}
			});
			if ( entry.disabled === true ) {
				$parentLi.addClass("ui-state-disabled");
			}
			if ( entry.isHeader ) {
				$parentLi.addClass("ui-widget-header");
			}
			if ( entry.addClass ) {
				$parentLi.addClass(entry.addClass);
			}
			if ( $.isPlainObject(entry.data) ) {
				$parentLi.data(entry.data);
			}
			if ( typeof entry.tooltip === "string" ) {
				$parentLi.attr("title", entry.tooltip);
			}
		}
	},
	/** Convert a nested array of command objects into a <ul> structure. */
	createMenuMarkup: function(options, $parentUl) {
		var i, menu, $ul, $li;
		if ( $parentUl == null ) {
			$parentUl = $("<ul class='ui-helper-hidden' />").appendTo("body");
		}
		for (i = 0; i < options.length; i++) {
			menu = options[i];
			$li = $("<li/>").appendTo($parentUl);

			$.moogle.contextmenu.createEntryMarkup(menu, $li);

			if ( $.isArray(menu.children) ) {
				$ul = $("<ul/>").appendTo($li);
				$.moogle.contextmenu.createMenuMarkup(menu.children, $ul);
			}
		}
		return $parentUl;
	},
	/** Returns true if the menu item has child menu items */
	isMenu: function(item) {
		if ( isLTE110 ) {
			return item.has(">a[aria-haspopup='true']").length > 0;
		} else if ( isLTE111 ) {  // jQuery UI 1.11 used no tag wrappers
			return item.is("[aria-haspopup='true']");
		} else {
			return item.has(">div[aria-haspopup='true']").length > 0;
		}
	},
	/** Replace the title of elem', but retain icons andchild entries. */
	replaceFirstTextNodeChild: function(elem, html) {
		var $icons = elem.find(">span.ui-icon,>ul.ui-menu").detach();

		elem
			.empty()
			.html(html)
			.append($icons);
	},
	/** Updates the menu item's title */
	updateTitle: function(item, title) {
		if ( isLTE110 ) {  // jQuery UI 1.10 and before used <a> tags
			$.moogle.contextmenu.replaceFirstTextNodeChild($("a", item), title);
		} else if ( isLTE111 ) {  // jQuery UI 1.11 used no tag wrappers
			$.moogle.contextmenu.replaceFirstTextNodeChild(item, title);
		} else {  // jQuery UI 1.12+ introduced <div> tag wrappers
			$.moogle.contextmenu.replaceFirstTextNodeChild($("div", item), title);
		}
	}
});

}));
