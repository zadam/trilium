/*!
 * jquery.fancytree.fixed.js
 *
 * Add fixed colums and headers to ext.table.
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

// Allow to use multiple var statements inside a function

(function (factory) {
	if (typeof define === "function" && define.amd) {
		// AMD. Register as an anonymous module.
		define([
			"jquery",
			"./jquery.fancytree",
			"./jquery.fancytree.table",
		], factory);
	} else if (typeof module === "object" && module.exports) {
		// Node/CommonJS
		require("./jquery.fancytree.table"); // core + table
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

	$.ui.fancytree.registerExtension({
		name: "fixed",
		version: "0.0.1",
		// Default options for this extension.
		options: {
			fixCol: 1,
			fixColWidths: null,
			fixRows: true,
			scrollSpeed: 50,
			resizable: true,
			classNames: {
				table: "fancytree-ext-fixed",
				wrapper: "fancytree-ext-fixed-wrapper",
				topLeft: "fancytree-ext-fixed-wrapper-tl",
				topRight: "fancytree-ext-fixed-wrapper-tr",
				bottomLeft: "fancytree-ext-fixed-wrapper-bl",
				bottomRight: "fancytree-ext-fixed-wrapper-br",
				hidden: "fancytree-ext-fixed-hidden",
				counterpart: "fancytree-ext-fixed-node-counterpart",
				scrollBorderBottom: "fancytree-ext-fixed-scroll-border-bottom",
				scrollBorderRight: "fancytree-ext-fixed-scroll-border-right",
				hover: "fancytree-ext-fixed-hover",
			},
		},
		// Overide virtual methods for this extension.
		// `this`	   : is this extension object
		// `this._super`: the virtual function that was overriden (member of prev. extension or Fancytree)
		treeInit: function (ctx) {
			this._requireExtension("table", true, true);
			// 'fixed' requires the table extension to be loaded before itself

			var res = this._superApply(arguments),
				tree = ctx.tree,
				options = this.options.fixed,
				fcn = this.options.fixed.classNames,
				$table = tree.widget.element,
				fixedColCount = options.fixCols,
				fixedRowCount = options.fixRows,
				$tableWrapper = $table.parent(),
				$topLeftWrapper = $("<div>").addClass(fcn.topLeft),
				$topRightWrapper = $("<div>").addClass(fcn.topRight),
				$bottomLeftWrapper = $("<div>").addClass(fcn.bottomLeft),
				$bottomRightWrapper = $("<div>").addClass(fcn.bottomRight),
				tableStyle = $table.attr("style"),
				tableClass = $table.attr("class"),
				$topLeftTable = $("<table>")
					.attr("style", tableStyle)
					.attr("class", tableClass),
				$topRightTable = $("<table>")
					.attr("style", tableStyle)
					.attr("class", tableClass),
				$bottomLeftTable = $table,
				$bottomRightTable = $("<table>")
					.attr("style", tableStyle)
					.attr("class", tableClass),
				$head = $table.find("thead"),
				$colgroup = $table.find("colgroup"),
				headRowCount = $head.find("tr").length;

			this.$fixedWrapper = $tableWrapper;
			$table.addClass(fcn.table);
			$tableWrapper.addClass(fcn.wrapper);
			$bottomRightTable.append($("<tbody>"));

			if ($colgroup.length) {
				$colgroup.remove();
			}

			if (typeof fixedRowCount === "boolean") {
				fixedRowCount = fixedRowCount ? headRowCount : 0;
			} else {
				fixedRowCount = Math.max(
					0,
					Math.min(fixedRowCount, headRowCount)
				);
			}

			if (fixedRowCount) {
				$topLeftTable.append($head.clone(true));
				$topRightTable.append($head.clone(true));
				$head.remove();
			}

			$topLeftTable.find("tr").each(function (idx) {
				$(this).find("th").slice(fixedColCount).remove();
			});

			$topRightTable.find("tr").each(function (idx) {
				$(this).find("th").slice(0, fixedColCount).remove();
			});

			this.$fixedWrapper = $tableWrapper;

			$tableWrapper.append(
				$topLeftWrapper.append($topLeftTable),
				$topRightWrapper.append($topRightTable),
				$bottomLeftWrapper.append($bottomLeftTable),
				$bottomRightWrapper.append($bottomRightTable)
			);

			$bottomRightTable.on("keydown", function (evt) {
				var node = tree.focusNode,
					ctx = tree._makeHookContext(node || tree, evt),
					res = tree._callHook("nodeKeydown", ctx);
				return res;
			});

			$bottomRightTable.on("click dblclick", "tr", function (evt) {
				var $trLeft = $(this),
					$trRight = $trLeft.data(fcn.counterpart),
					node = $.ui.fancytree.getNode($trRight),
					ctx = tree._makeHookContext(node, evt),
					et = $.ui.fancytree.getEventTarget(evt),
					prevPhase = tree.phase;

				try {
					tree.phase = "userEvent";
					switch (evt.type) {
						case "click":
							ctx.targetType = et.type;
							if (node.isPagingNode()) {
								return (
									tree._triggerNodeEvent(
										"clickPaging",
										ctx,
										evt
									) === true
								);
							}
							return tree._triggerNodeEvent("click", ctx, evt) ===
								false
								? false
								: tree._callHook("nodeClick", ctx);
						case "dblclick":
							ctx.targetType = et.type;
							return tree._triggerNodeEvent(
								"dblclick",
								ctx,
								evt
							) === false
								? false
								: tree._callHook("nodeDblclick", ctx);
					}
				} finally {
					tree.phase = prevPhase;
				}
			});

			$tableWrapper
				.on(
					"mouseenter",
					"." +
						fcn.bottomRight +
						" table tr, ." +
						fcn.bottomLeft +
						" table tr",
					function (evt) {
						var $tr = $(this),
							$trOther = $tr.data(fcn.counterpart);
						$tr.addClass(fcn.hover);
						$trOther.addClass(fcn.hover);
					}
				)
				.on(
					"mouseleave",
					"." +
						fcn.bottomRight +
						" table tr, ." +
						fcn.bottomLeft +
						" table tr",
					function (evt) {
						var $tr = $(this),
							$trOther = $tr.data(fcn.counterpart);
						$tr.removeClass(fcn.hover);
						$trOther.removeClass(fcn.hover);
					}
				);

			$bottomLeftWrapper.on(
				"mousewheel DOMMouseScroll",
				function (event) {
					var $this = $(this),
						newScroll = $this.scrollTop(),
						scrollUp =
							event.originalEvent.wheelDelta > 0 ||
							event.originalEvent.detail < 0;

					newScroll += scrollUp
						? -options.scrollSpeed
						: options.scrollSpeed;
					$this.scrollTop(newScroll);
					$bottomRightWrapper.scrollTop(newScroll);
					event.preventDefault();
				}
			);

			$bottomRightWrapper.scroll(function () {
				var $this = $(this),
					scrollLeft = $this.scrollLeft(),
					scrollTop = $this.scrollTop();

				$topLeftWrapper
					.toggleClass(fcn.scrollBorderBottom, scrollTop > 0)
					.toggleClass(fcn.scrollBorderRight, scrollLeft > 0);
				$topRightWrapper
					.toggleClass(fcn.scrollBorderBottom, scrollTop > 0)
					.scrollLeft(scrollLeft);
				$bottomLeftWrapper
					.toggleClass(fcn.scrollBorderRight, scrollLeft > 0)
					.scrollTop(scrollTop);
			});

			$.ui.fancytree.overrideMethod(
				$.ui.fancytree._FancytreeNodeClass.prototype,
				"scrollIntoView",
				function (effects, options) {
					var $prevContainer = tree.$container;
					tree.$container = $bottomRightWrapper;
					return this._super
						.apply(this, arguments)
						.always(function () {
							tree.$container = $prevContainer;
						});
				}
			);
			return res;
		},

		treeLoad: function (ctx) {
			var self = this,
				res = this._superApply(arguments);

			res.done(function () {
				self.ext.fixed._adjustLayout.call(self);
				if (self.options.fixed.resizable) {
					self.ext.fixed._makeTableResizable();
				}
			});
			return res;
		},

		_makeTableResizable: function () {
			var $wrapper = this.$fixedWrapper,
				fcn = this.options.fixed.classNames,
				$topLeftWrapper = $wrapper.find("div." + fcn.topLeft),
				$topRightWrapper = $wrapper.find("div." + fcn.topRight),
				$bottomLeftWrapper = $wrapper.find("div." + fcn.bottomLeft),
				$bottomRightWrapper = $wrapper.find("div." + fcn.bottomRight);

			function _makeResizable($table) {
				$table.resizable({
					handles: "e",
					resize: function (evt, ui) {
						var width = Math.max($table.width(), ui.size.width);
						$bottomLeftWrapper.css("width", width);
						$topLeftWrapper.css("width", width);
						$bottomRightWrapper.css("left", width);
						$topRightWrapper.css("left", width);
					},
					stop: function () {
						$table.css("width", "100%");
					},
				});
			}

			_makeResizable($topLeftWrapper.find("table"));
			_makeResizable($bottomLeftWrapper.find("table"));
		},

		/* Called by nodeRender to sync node order with tag order.*/
		//	nodeFixOrder: function(ctx) {
		//	},

		nodeLoadChildren: function (ctx, source) {
			return this._superApply(arguments);
		},

		nodeRemoveChildMarkup: function (ctx) {
			var node = ctx.node;

			function _removeChild(elem) {
				var i,
					child,
					children = elem.children;
				if (children) {
					for (i = 0; i < children.length; i++) {
						child = children[i];
						if (child.trRight) {
							$(child.trRight).remove();
						}
						_removeChild(child);
					}
				}
			}

			_removeChild(node);
			return this._superApply(arguments);
		},

		nodeRemoveMarkup: function (ctx) {
			var node = ctx.node;

			if (node.trRight) {
				$(node.trRight).remove();
			}
			return this._superApply(arguments);
		},

		nodeSetActive: function (ctx, flag, callOpts) {
			var node = ctx.node,
				cn = this.options._classNames;

			if (node.trRight) {
				$(node.trRight)
					.toggleClass(cn.active, flag)
					.toggleClass(cn.focused, flag);
			}
			return this._superApply(arguments);
		},

		nodeKeydown: function (ctx) {
			return this._superApply(arguments);
		},

		nodeSetFocus: function (ctx, flag) {
			var node = ctx.node,
				cn = this.options._classNames;

			if (node.trRight) {
				$(node.trRight).toggleClass(cn.focused, flag);
			}
			return this._superApply(arguments);
		},

		nodeRender: function (ctx, force, deep, collapsed, _recursive) {
			var res = this._superApply(arguments),
				node = ctx.node,
				isRootNode = !node.parent;

			if (!isRootNode && this.$fixedWrapper) {
				var $trLeft = $(node.tr),
					fcn = this.options.fixed.classNames,
					$trRight = $trLeft.data(fcn.counterpart);

				if (!$trRight && $trLeft.length) {
					var idx = $trLeft.index(),
						fixedColCount = this.options.fixed.fixCols,
						$blTableBody = this.$fixedWrapper.find(
							"div." + fcn.bottomLeft + " table tbody"
						),
						$brTableBody = this.$fixedWrapper.find(
							"div." + fcn.bottomRight + " table tbody"
						),
						$prevLeftNode = $blTableBody
							.find("tr")
							.eq(Math.max(idx + 1, 0)),
						prevRightNode = $prevLeftNode.data(fcn.counterpart);

					$trRight = $trLeft.clone(true);
					var trRight = $trRight.get(0);

					if (prevRightNode) {
						$(prevRightNode).before($trRight);
					} else {
						$brTableBody.append($trRight);
					}
					$trRight.show();
					trRight.ftnode = node;
					node.trRight = trRight;

					$trLeft.find("td").slice(fixedColCount).remove();
					$trRight.find("td").slice(0, fixedColCount).remove();
					$trLeft.data(fcn.counterpart, $trRight);
					$trRight.data(fcn.counterpart, $trLeft);
				}
			}

			return res;
		},

		nodeRenderTitle: function (ctx, title) {
			return this._superApply(arguments);
		},

		nodeRenderStatus: function (ctx) {
			var res = this._superApply(arguments),
				node = ctx.node;

			if (node.trRight) {
				var $trRight = $(node.trRight),
					$trLeft = $(node.tr),
					fcn = this.options.fixed.classNames,
					hovering = $trRight.hasClass(fcn.hover),
					trClasses = $trLeft.attr("class");

				$trRight.attr("class", trClasses);
				if (hovering) {
					$trRight.addClass(fcn.hover);
					$trLeft.addClass(fcn.hover);
				}
			}
			return res;
		},

		nodeSetExpanded: function (ctx, flag, callOpts) {
			var res,
				self = this,
				node = ctx.node,
				$leftTr = $(node.tr),
				fcn = this.options.fixed.classNames,
				cn = this.options._classNames,
				$rightTr = $leftTr.data(fcn.counterpart);

			flag = typeof flag === "undefined" ? true : flag;

			if (!$rightTr) {
				return this._superApply(arguments);
			}
			$rightTr.toggleClass(cn.expanded, !!flag);
			if (flag && !node.isExpanded()) {
				res = this._superApply(arguments);
				res.done(function () {
					node.visit(function (child) {
						var $trLeft = $(child.tr),
							$trRight = $trLeft.data(fcn.counterpart);

						self.ext.fixed._adjustRowHeight($trLeft, $trRight);
						if (!child.expanded) {
							return "skip";
						}
					});

					self.ext.fixed._adjustColWidths();
					self.ext.fixed._adjustWrapperLayout();
				});
			} else if (!flag && node.isExpanded()) {
				node.visit(function (child) {
					var $trLeft = $(child.tr),
						$trRight = $trLeft.data(fcn.counterpart);
					if ($trRight) {
						if (!child.expanded) {
							return "skip";
						}
					}
				});

				self.ext.fixed._adjustColWidths();
				self.ext.fixed._adjustWrapperLayout();
				res = this._superApply(arguments);
			} else {
				res = this._superApply(arguments);
			}
			return res;
		},

		nodeSetStatus: function (ctx, status, message, details) {
			return this._superApply(arguments);
		},

		treeClear: function (ctx) {
			var tree = ctx.tree,
				$table = tree.widget.element,
				$wrapper = this.$fixedWrapper,
				fcn = this.options.fixed.classNames;

			$table.find("tr, td, th, thead").removeClass(fcn.hidden).css({
				"min-width": "auto",
				height: "auto",
			});
			$wrapper.empty().append($table);
			return this._superApply(arguments);
		},

		treeRegisterNode: function (ctx, add, node) {
			return this._superApply(arguments);
		},

		treeDestroy: function (ctx) {
			var tree = ctx.tree,
				$table = tree.widget.element,
				$wrapper = this.$fixedWrapper,
				fcn = this.options.fixed.classNames;

			$table.find("tr, td, th, thead").removeClass(fcn.hidden).css({
				"min-width": "auto",
				height: "auto",
			});
			$wrapper.empty().append($table);
			return this._superApply(arguments);
		},

		_adjustColWidths: function () {
			if (this.options.fixed.adjustColWidths) {
				this.options.fixed.adjustColWidths.call(this);
				return;
			}

			var $wrapper = this.$fixedWrapper,
				fcn = this.options.fixed.classNames,
				$tlWrapper = $wrapper.find("div." + fcn.topLeft),
				$blWrapper = $wrapper.find("div." + fcn.bottomLeft),
				$trWrapper = $wrapper.find("div." + fcn.topRight),
				$brWrapper = $wrapper.find("div." + fcn.bottomRight);

			function _adjust($topWrapper, $bottomWrapper) {
				var $trTop = $topWrapper.find("thead tr").first(),
					$trBottom = $bottomWrapper.find("tbody tr").first();

				$trTop.find("th").each(function (idx) {
					var $thTop = $(this),
						$tdBottom = $trBottom.find("td").eq(idx),
						thTopWidth = $thTop.width(),
						thTopOuterWidth = $thTop.outerWidth(),
						tdBottomWidth = $tdBottom.width(),
						tdBottomOuterWidth = $tdBottom.outerWidth(),
						newWidth = Math.max(
							thTopOuterWidth,
							tdBottomOuterWidth
						);

					$thTop.css(
						"min-width",
						newWidth - (thTopOuterWidth - thTopWidth)
					);
					$tdBottom.css(
						"min-width",
						newWidth - (tdBottomOuterWidth - tdBottomWidth)
					);
				});
			}

			_adjust($tlWrapper, $blWrapper);
			_adjust($trWrapper, $brWrapper);
		},

		_adjustRowHeight: function ($tr1, $tr2) {
			var fcn = this.options.fixed.classNames;
			if (!$tr2) {
				$tr2 = $tr1.data(fcn.counterpart);
			}
			$tr1.css("height", "auto");
			$tr2.css("height", "auto");
			var row1Height = $tr1.outerHeight(),
				row2Height = $tr2.outerHeight(),
				newHeight = Math.max(row1Height, row2Height);
			$tr1.css("height", newHeight + 1);
			$tr2.css("height", newHeight + 1);
		},

		_adjustWrapperLayout: function () {
			var $wrapper = this.$fixedWrapper,
				fcn = this.options.fixed.classNames,
				$topLeftWrapper = $wrapper.find("div." + fcn.topLeft),
				$topRightWrapper = $wrapper.find("div." + fcn.topRight),
				$bottomLeftWrapper = $wrapper.find("div." + fcn.bottomLeft),
				$bottomRightWrapper = $wrapper.find("div." + fcn.bottomRight),
				$topLeftTable = $topLeftWrapper.find("table"),
				$topRightTable = $topRightWrapper.find("table"),
				//			$bottomLeftTable = $bottomLeftWrapper.find("table"),
				wrapperWidth = $wrapper.width(),
				wrapperHeight = $wrapper.height(),
				fixedWidth = Math.min(wrapperWidth, $topLeftTable.width()),
				fixedHeight = Math.min(
					wrapperHeight,
					Math.max($topLeftTable.height(), $topRightTable.height())
				);
			//			vScrollbar = $bottomRightWrapper.get(0).scrollHeight > (wrapperHeight - fixedHeight),
			//			hScrollbar = $bottomRightWrapper.get(0).scrollWidth > (wrapperWidth - fixedWidth);

			$topLeftWrapper.css({
				width: fixedWidth,
				height: fixedHeight,
			});
			$topRightWrapper.css({
				//			width: wrapperWidth - fixedWidth - (vScrollbar ? 17 : 0),
				//			width: "calc(100% - " + (fixedWidth + (vScrollbar ? 17 : 0)) + "px)",
				width: "calc(100% - " + (fixedWidth + 17) + "px)",
				height: fixedHeight,
				left: fixedWidth,
			});
			$bottomLeftWrapper.css({
				width: fixedWidth,
				//			height: vScrollbar ? wrapperHeight - fixedHeight - (hScrollbar ? 17 : 0) : "auto",
				//			height: vScrollbar ? ("calc(100% - " + (fixedHeight + (hScrollbar ? 17 : 0)) + "px)") : "auto",
				//			height: vScrollbar ? ("calc(100% - " + (fixedHeight + 17) + "px)") : "auto",
				height: "calc(100% - " + (fixedHeight + 17) + "px)",
				top: fixedHeight,
			});
			$bottomRightWrapper.css({
				//			width: wrapperWidth - fixedWidth,
				//			height: vScrollbar ? wrapperHeight - fixedHeight : "auto",
				width: "calc(100% - " + fixedWidth + "px)",
				//			height: vScrollbar ? ("calc(100% - " + fixedHeight + "px)") : "auto",
				height: "calc(100% - " + fixedHeight + "px)",
				top: fixedHeight,
				left: fixedWidth,
			});
		},

		_adjustLayout: function () {
			var self = this,
				$wrapper = this.$fixedWrapper,
				fcn = this.options.fixed.classNames,
				$topLeftWrapper = $wrapper.find("div." + fcn.topLeft),
				$topRightWrapper = $wrapper.find("div." + fcn.topRight),
				$bottomLeftWrapper = $wrapper.find("div." + fcn.bottomLeft);
			// $bottomRightWrapper = $wrapper.find("div." + fcn.bottomRight)

			$topLeftWrapper.find("table tr").each(function (idx) {
				var $trRight = $topRightWrapper.find("tr").eq(idx);
				self.ext.fixed._adjustRowHeight($(this), $trRight);
			});

			$bottomLeftWrapper
				.find("table tbody")
				.find("tr")
				.each(function (idx) {
					// var $trRight = $bottomRightWrapper.find("tbody").find("tr").eq(idx);
					self.ext.fixed._adjustRowHeight($(this));
				});

			self.ext.fixed._adjustColWidths.call(this);
			self.ext.fixed._adjustWrapperLayout.call(this);
		},

		//	treeSetFocus: function(ctx, flag) {
		////			alert("treeSetFocus" + ctx.tree.$container);
		//		ctx.tree.$container.focus();
		//		$.ui.fancytree.focusTree = ctx.tree;
		//	}
	});
	// Value returned by `require('jquery.fancytree..')`
	return $.ui.fancytree;
}); // End of closure
