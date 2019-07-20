/*!
 * Draggabilly PACKAGED v2.2.0
 * Make that shiz draggable
 * https://draggabilly.desandro.com
 * MIT license
 */

import optionsInit from './options_init.js';

!function(i,e){"function"==typeof define&&define.amd?define("jquery-bridget/jquery-bridget",["jquery"],function(t){return e(i,t)}):"object"==typeof module&&module.exports?module.exports=e(i,require("jquery")):i.jQueryBridget=e(i,i.jQuery)}(window,function(t,i){"use strict";var c=Array.prototype.slice,e=t.console,p=void 0===e?function(){}:function(t){e.error(t)};function n(d,o,u){(u=u||i||t.jQuery)&&(o.prototype.option||(o.prototype.option=function(t){u.isPlainObject(t)&&(this.options=u.extend(!0,this.options,t))}),u.fn[d]=function(t){if("string"==typeof t){var i=c.call(arguments,1);return s=i,a="$()."+d+'("'+(r=t)+'")',(e=this).each(function(t,i){var e=u.data(i,d);if(e){var n=e[r];if(n&&"_"!=r.charAt(0)){var o=n.apply(e,s);h=void 0===h?o:h}else p(a+" is not a valid method")}else p(d+" not initialized. Cannot call methods, i.e. "+a)}),void 0!==h?h:e}var e,r,s,h,a,n;return n=t,this.each(function(t,i){var e=u.data(i,d);e?(e.option(n),e._init()):(e=new o(i,n),u.data(i,d,e))}),this},r(u))}function r(t){!t||t&&t.bridget||(t.bridget=n)}return r(i||t.jQuery),n}),function(t,i){"use strict";"function"==typeof define&&define.amd?define("get-size/get-size",[],function(){return i()}):"object"==typeof module&&module.exports?module.exports=i():t.getSize=i()}(window,function(){"use strict";function m(t){var i=parseFloat(t);return-1==t.indexOf("%")&&!isNaN(i)&&i}var e="undefined"==typeof console?function(){}:function(t){console.error(t)},y=["paddingLeft","paddingRight","paddingTop","paddingBottom","marginLeft","marginRight","marginTop","marginBottom","borderLeftWidth","borderRightWidth","borderTopWidth","borderBottomWidth"],b=y.length;function E(t){var i=getComputedStyle(t);return i||e("Style returned "+i+". Are you running this code in a hidden iframe on Firefox? See http://bit.ly/getsizebug1"),i}var _,x=!1;function P(t){if(function(){if(!x){x=!0;var t=document.createElement("div");t.style.width="200px",t.style.padding="1px 2px 3px 4px",t.style.borderStyle="solid",t.style.borderWidth="1px 2px 3px 4px",t.style.boxSizing="border-box";var i=document.body||document.documentElement;i.appendChild(t);var e=E(t);P.isBoxSizeOuter=_=200==m(e.width),i.removeChild(t)}}(),"string"==typeof t&&(t=document.querySelector(t)),t&&"object"==typeof t&&t.nodeType){var i=E(t);if("none"==i.display)return function(){for(var t={width:0,height:0,innerWidth:0,innerHeight:0,outerWidth:0,outerHeight:0},i=0;i<b;i++)t[y[i]]=0;return t}();var e={};e.width=t.offsetWidth,e.height=t.offsetHeight;for(var n=e.isBorderBox="border-box"==i.boxSizing,o=0;o<b;o++){var r=y[o],s=i[r],h=parseFloat(s);e[r]=isNaN(h)?0:h}var a=e.paddingLeft+e.paddingRight,d=e.paddingTop+e.paddingBottom,u=e.marginLeft+e.marginRight,c=e.marginTop+e.marginBottom,p=e.borderLeftWidth+e.borderRightWidth,f=e.borderTopWidth+e.borderBottomWidth,g=n&&_,l=m(i.width);!1!==l&&(e.width=l+(g?0:a+p));var v=m(i.height);return!1!==v&&(e.height=v+(g?0:d+f)),e.innerWidth=e.width-(a+p),e.innerHeight=e.height-(d+f),e.outerWidth=e.width+u,e.outerHeight=e.height+c,e}}return P}),function(t,i){"function"==typeof define&&define.amd?define("ev-emitter/ev-emitter",i):"object"==typeof module&&module.exports?module.exports=i():t.EvEmitter=i()}("undefined"!=typeof window?window:this,function(){function t(){}var i=t.prototype;return i.on=function(t,i){if(t&&i){var e=this._events=this._events||{},n=e[t]=e[t]||[];return-1==n.indexOf(i)&&n.push(i),this}},i.once=function(t,i){if(t&&i){this.on(t,i);var e=this._onceEvents=this._onceEvents||{};return(e[t]=e[t]||{})[i]=!0,this}},i.off=function(t,i){var e=this._events&&this._events[t];if(e&&e.length){var n=e.indexOf(i);return-1!=n&&e.splice(n,1),this}},i.emitEvent=function(t,i){var e=this._events&&this._events[t];if(e&&e.length){e=e.slice(0),i=i||[];for(var n=this._onceEvents&&this._onceEvents[t],o=0;o<e.length;o++){var r=e[o];n&&n[r]&&(this.off(t,r),delete n[r]),r.apply(this,i)}return this}},i.allOff=function(){delete this._events,delete this._onceEvents},t}),function(i,e){"function"==typeof define&&define.amd?define("unipointer/unipointer",["ev-emitter/ev-emitter"],function(t){return e(i,t)}):"object"==typeof module&&module.exports?module.exports=e(i,require("ev-emitter")):i.Unipointer=e(i,i.EvEmitter)}(window,function(o,t){function i(){}var e=i.prototype=Object.create(t.prototype);e.bindStartEvent=function(t){this._bindStartEvent(t,!0)},e.unbindStartEvent=function(t){this._bindStartEvent(t,!1)},e._bindStartEvent=function(t,i){var e=(i=void 0===i||i)?"addEventListener":"removeEventListener",n="mousedown";o.PointerEvent?n="pointerdown":"ontouchstart"in o&&(n="touchstart"),t[e](n,this)},e.handleEvent=function(t){var i="on"+t.type;this[i]&&this[i](t)},e.getTouch=function(t){for(var i=0;i<t.length;i++){var e=t[i];if(e.identifier==this.pointerIdentifier)return e}},e.onmousedown=function(t){var i=t.button;i&&0!==i&&1!==i||this._pointerDown(t,t)},e.ontouchstart=function(t){this._pointerDown(t,t.changedTouches[0])},e.onpointerdown=function(t){this._pointerDown(t,t)},e._pointerDown=function(t,i){t.button||this.isPointerDown||(this.isPointerDown=!0,this.pointerIdentifier=void 0!==i.pointerId?i.pointerId:i.identifier,this.pointerDown(t,i))},e.pointerDown=function(t,i){this._bindPostStartEvents(t),this.emitEvent("pointerDown",[t,i])};var n={mousedown:["mousemove","mouseup"],touchstart:["touchmove","touchend","touchcancel"],pointerdown:["pointermove","pointerup","pointercancel"]};return e._bindPostStartEvents=function(t){if(t){var i=n[t.type];i.forEach(function(t){o.addEventListener(t,this)},this),this._boundPointerEvents=i}},e._unbindPostStartEvents=function(){this._boundPointerEvents&&(this._boundPointerEvents.forEach(function(t){o.removeEventListener(t,this)},this),delete this._boundPointerEvents)},e.onmousemove=function(t){this._pointerMove(t,t)},e.onpointermove=function(t){t.pointerId==this.pointerIdentifier&&this._pointerMove(t,t)},e.ontouchmove=function(t){var i=this.getTouch(t.changedTouches);i&&this._pointerMove(t,i)},e._pointerMove=function(t,i){this.pointerMove(t,i)},e.pointerMove=function(t,i){this.emitEvent("pointerMove",[t,i])},e.onmouseup=function(t){this._pointerUp(t,t)},e.onpointerup=function(t){t.pointerId==this.pointerIdentifier&&this._pointerUp(t,t)},e.ontouchend=function(t){var i=this.getTouch(t.changedTouches);i&&this._pointerUp(t,i)},e._pointerUp=function(t,i){this._pointerDone(),this.pointerUp(t,i)},e.pointerUp=function(t,i){this.emitEvent("pointerUp",[t,i])},e._pointerDone=function(){this._pointerReset(),this._unbindPostStartEvents(),this.pointerDone()},e._pointerReset=function(){this.isPointerDown=!1,delete this.pointerIdentifier},e.pointerDone=function(){},e.onpointercancel=function(t){t.pointerId==this.pointerIdentifier&&this._pointerCancel(t,t)},e.ontouchcancel=function(t){var i=this.getTouch(t.changedTouches);i&&this._pointerCancel(t,i)},e._pointerCancel=function(t,i){this._pointerDone(),this.pointerCancel(t,i)},e.pointerCancel=function(t,i){this.emitEvent("pointerCancel",[t,i])},i.getPointerPoint=function(t){return{x:t.pageX,y:t.pageY}},i}),function(i,e){"function"==typeof define&&define.amd?define("unidragger/unidragger",["unipointer/unipointer"],function(t){return e(i,t)}):"object"==typeof module&&module.exports?module.exports=e(i,require("unipointer")):i.Unidragger=e(i,i.Unipointer)}(window,function(r,t){function i(){}var e=i.prototype=Object.create(t.prototype);e.bindHandles=function(){this._bindHandles(!0)},e.unbindHandles=function(){this._bindHandles(!1)},e._bindHandles=function(t){for(var i=(t=void 0===t||t)?"addEventListener":"removeEventListener",e=t?this._touchActionValue:"",n=0;n<this.handles.length;n++){var o=this.handles[n];this._bindStartEvent(o,t),o[i]("click",this),r.PointerEvent&&(o.style.touchAction=e)}},e._touchActionValue="none",e.pointerDown=function(t,i){this.okayPointerDown(t)&&(this.pointerDownPointer=i,t.preventDefault(),this.pointerDownBlur(),this._bindPostStartEvents(t),this.emitEvent("pointerDown",[t,i]))};var o={TEXTAREA:!0,INPUT:!0,SELECT:!0,OPTION:!0},s={radio:!0,checkbox:!0,button:!0,submit:!0,image:!0,file:!0};return e.okayPointerDown=function(t){var i=o[t.target.nodeName],e=s[t.target.type],n=!i||e;return n||this._pointerReset(),n},e.pointerDownBlur=function(){var t=document.activeElement;t&&t.blur&&t!=document.body&&t.blur()},e.pointerMove=function(t,i){var e=this._dragPointerMove(t,i);this.emitEvent("pointerMove",[t,i,e]),this._dragMove(t,i,e)},e._dragPointerMove=function(t,i){var e={x:i.pageX-this.pointerDownPointer.pageX,y:i.pageY-this.pointerDownPointer.pageY};return!this.isDragging&&this.hasDragStarted(e)&&this._dragStart(t,i),e},e.hasDragStarted=function(t){return 3<Math.abs(t.x)||3<Math.abs(t.y)},e.pointerUp=function(t,i){this.emitEvent("pointerUp",[t,i]),this._dragPointerUp(t,i)},e._dragPointerUp=function(t,i){this.isDragging?this._dragEnd(t,i):this._staticClick(t,i)},e._dragStart=function(t,i){this.isDragging=!0,this.isPreventingClicks=!0,this.dragStart(t,i)},e.dragStart=function(t,i){this.emitEvent("dragStart",[t,i])},e._dragMove=function(t,i,e){this.isDragging&&this.dragMove(t,i,e)},e.dragMove=function(t,i,e){t.preventDefault(),this.emitEvent("dragMove",[t,i,e])},e._dragEnd=function(t,i){this.isDragging=!1,setTimeout(function(){delete this.isPreventingClicks}.bind(this)),this.dragEnd(t,i)},e.dragEnd=function(t,i){this.emitEvent("dragEnd",[t,i])},e.onclick=function(t){this.isPreventingClicks&&t.preventDefault()},e._staticClick=function(t,i){this.isIgnoringMouseUp&&"mouseup"==t.type||(this.staticClick(t,i),"mouseup"!=t.type&&(this.isIgnoringMouseUp=!0,setTimeout(function(){delete this.isIgnoringMouseUp}.bind(this),400)))},e.staticClick=function(t,i){this.emitEvent("staticClick",[t,i])},i.getPointerPoint=t.getPointerPoint,i}),function(e,n){"function"==typeof define&&define.amd?define(["get-size/get-size","unidragger/unidragger"],function(t,i){return n(e,t,i)}):"object"==typeof module&&module.exports?module.exports=n(e,require("get-size"),require("unidragger")):e.Draggabilly=n(e,e.getSize,e.Unidragger)}(window,function(r,a,t){function e(t,i){for(var e in i)t[e]=i[e];return t}var n=r.jQuery;function i(t,i){this.element="string"==typeof t?document.querySelector(t):t,n&&(this.$element=n(this.element)),this.options=e({},this.constructor.defaults),this.option(i),this._create()}var o=i.prototype=Object.create(t.prototype);i.defaults={},o.option=function(t){e(this.options,t)};var s={relative:!0,absolute:!0,fixed:!0};function d(t,i,e){return e=e||"round",i?Math[e](t/i)*i:t}return o._create=function(){this.position={},this._getPosition(),this.startPoint={x:0,y:0},this.dragPoint={x:0,y:0},this.startPosition=e({},this.position);var t=getComputedStyle(this.element);s[t.position]||(this.element.style.position="relative"),this.on("pointerDown",this.onPointerDown),this.on("pointerMove",this.onPointerMove),this.on("pointerUp",this.onPointerUp),this.enable(),this.setHandles()},o.setHandles=function(){this.handles=this.options.handle?this.element.querySelectorAll(this.options.handle):[this.element],this.bindHandles()},o.dispatchEvent=function(t,i,e){var n=[i].concat(e);this.emitEvent(t,n),this.dispatchJQueryEvent(t,i,e)},o.dispatchJQueryEvent=function(t,i,e){var n=r.jQuery;if(n&&this.$element){var o=n.Event(i);o.type=t,this.$element.trigger(o,e)}},o._getPosition=function(){var t=getComputedStyle(this.element),i=this._getPositionCoord(t.left,"width"),e=this._getPositionCoord(t.top,"height");this.position.x=isNaN(i)?0:i,this.position.y=isNaN(e)?0:e,this._addTransformPosition(t)},o._getPositionCoord=function(t,i){if(-1!=t.indexOf("%")){var e=a(this.element.parentNode);return e?parseFloat(t)/100*e[i]:0}return parseInt(t,10)},o._addTransformPosition=function(t){var i=t.transform;if(0===i.indexOf("matrix")){var e=i.split(","),n=0===i.indexOf("matrix3d")?12:4,o=parseInt(e[n],10),r=parseInt(e[n+1],10);this.position.x+=o,this.position.y+=r}},o.onPointerDown=function(t,i){this.element.classList.add("is-pointer-down"),this.dispatchJQueryEvent("pointerDown",t,[i])},o.dragStart=function(t,i){this.isEnabled&&(this._getPosition(),this.measureContainment(),this.startPosition.x=this.position.x,this.startPosition.y=this.position.y,this.setLeftTop(),this.dragPoint.x=0,this.dragPoint.y=0,this.element.classList.add("is-dragging"),this.dispatchEvent("dragStart",t,[i]),this.animate())},o.measureContainment=function(){var t=this.getContainer();if(t){var i=a(this.element),e=a(t),n=this.element.getBoundingClientRect(),o=t.getBoundingClientRect(),r=e.borderLeftWidth+e.borderRightWidth,s=e.borderTopWidth+e.borderBottomWidth,h=this.relativeStartPosition={x:n.left-(o.left+e.borderLeftWidth),y:n.top-(o.top+e.borderTopWidth)};this.containSize={width:e.width-r-h.x-i.width,height:e.height-s-h.y-i.height}}},o.getContainer=function(){var t=this.options.containment;if(t)return t instanceof HTMLElement?t:"string"==typeof t?document.querySelector(t):this.element.parentNode},o.onPointerMove=function(t,i,e){this.dispatchJQueryEvent("pointerMove",t,[i,e])},o.dragMove=function(t,i,e){if(this.isEnabled){var n=e.x,o=e.y,r=this.options.grid,s=r&&r[0],h=r&&r[1];n=d(n,s),o=d(o,h),n=this.containDrag("x",n,s),o=this.containDrag("y",o,h),n="y"==this.options.axis?0:n,o="x"==this.options.axis?0:o,this.position.x=this.startPosition.x+n,this.position.y=this.startPosition.y+o,this.dragPoint.x=n,this.dragPoint.y=o,this.dispatchEvent("dragMove",t,[i,e])}},o.containDrag=function(t,i,e){if(!this.options.containment)return i;var n="x"==t?"width":"height",o=d(-this.relativeStartPosition[t],e,"ceil"),r=this.containSize[n];return r=d(r,e,"floor"),Math.max(o,Math.min(r,i))},o.onPointerUp=function(t,i){this.element.classList.remove("is-pointer-down"),this.dispatchJQueryEvent("pointerUp",t,[i])},o.dragEnd=function(t,i){this.isEnabled&&(this.element.style.transform="",this.setLeftTop(),this.element.classList.remove("is-dragging"),this.dispatchEvent("dragEnd",t,[i]))},o.animate=function(){if(this.isDragging){this.positionDrag();var t=this;requestAnimationFrame(function(){t.animate()})}},o.setLeftTop=function(){this.element.style.left=this.position.x+"px",this.element.style.top=this.position.y+"px"},o.positionDrag=function(){this.element.style.transform="translate3d( "+this.dragPoint.x+"px, "+this.dragPoint.y+"px, 0)"},o.staticClick=function(t,i){this.dispatchEvent("staticClick",t,[i])},o.setPosition=function(t,i){this.position.x=t,this.position.y=i,this.setLeftTop()},o.enable=function(){this.isEnabled=!0},o.disable=function(){this.isEnabled=!1,this.isDragging&&this.dragEnd()},o.destroy=function(){this.disable(),this.element.style.transform="",this.element.style.left="",this.element.style.top="",this.element.style.position="",this.unbindHandles(),this.$element&&this.$element.removeData("draggabilly")},o._init=function(){},n&&n.bridget&&n.bridget("draggabilly",i),i});

const Draggabilly = window.Draggabilly;

const TAB_CONTENT_MIN_WIDTH = 24;
const TAB_CONTENT_MAX_WIDTH = 240;
const NEW_TAB_WIDTH = 32;

const TAB_SIZE_SMALL = 84;
const TAB_SIZE_SMALLER = 60;
const TAB_SIZE_MINI = 48;

const tabTemplate = `
<div class="note-tab">
  <div class="note-tab-wrapper">
    <div class="note-tab-title"></div>
    <div class="note-tab-drag-handle"></div>
    <div class="note-tab-close"><span>×</span></div>
  </div>
</div>`;

const newTabButtonTemplate = `<div class="note-new-tab" title="Add new tab">+</div>`;

class TabRow {
    constructor(el) {
        this.draggabillies = [];
        this.eventListeners = {};

        this.el = el;
        this.hideTabRowForOneTab = false;

        this.setupStyleEl();
        this.setupEvents();
        this.layoutTabs();
        this.setupDraggabilly();
        this.setupNewButton();
        this.setVisibility();
    }

    addListener(eventName, callback) {
        this.eventListeners[eventName] = this.eventListeners[eventName] || [];
        this.eventListeners[eventName].push(callback);
    }

    async emit(eventName, data) {
        for (const listener of this.eventListeners[eventName]) {
            await listener({ detail: data });
        }
    }

    setHideTabRowForOneTab(hideTabRowForOneTab) {
        this.hideTabRowForOneTab = hideTabRowForOneTab;

        this.setVisibility();
    }

    setupStyleEl() {
        this.styleEl = document.createElement('style');
        this.el.appendChild(this.styleEl);
    }

    setupEvents() {
        const resizeListener = _ => {
            this.cleanUpPreviouslyDraggedTabs();
            this.layoutTabs();
        };

        // ResizeObserver exists only in FF69
        if (typeof ResizeObserver !== "undefined") {
            new ResizeObserver(resizeListener).observe(this.el);
        }
        else {
            // for older firefox
            window.addEventListener('resize', resizeListener);
        }

        this.tabEls.forEach((tabEl) => this.setTabCloseEventListener(tabEl));
    }

    setVisibility() {
        this.el.style.display = (this.tabEls.length > 1 || !this.hideTabRowForOneTab) ? "block" : "none";
    }

    get tabEls() {
        return Array.prototype.slice.call(this.el.querySelectorAll('.note-tab'));
    }

    get tabContentEl() {
        return this.el.querySelector('.note-tab-row-content');
    }

    get tabContentWidths() {
        const numberOfTabs = this.tabEls.length;
        const tabsContentWidth = this.tabContentEl.clientWidth - NEW_TAB_WIDTH;
        const targetWidth = tabsContentWidth / numberOfTabs;
        const clampedTargetWidth = Math.max(TAB_CONTENT_MIN_WIDTH, Math.min(TAB_CONTENT_MAX_WIDTH, targetWidth));
        const flooredClampedTargetWidth = Math.floor(clampedTargetWidth);
        const totalTabsWidthUsingTarget = flooredClampedTargetWidth * numberOfTabs;
        const totalExtraWidthDueToFlooring = tabsContentWidth - totalTabsWidthUsingTarget;

        const widths = [];
        let extraWidthRemaining = totalExtraWidthDueToFlooring;
        for (let i = 0; i < numberOfTabs; i += 1) {
            const extraWidth = flooredClampedTargetWidth < TAB_CONTENT_MAX_WIDTH && extraWidthRemaining > 0 ? 1 : 0;
            widths.push(flooredClampedTargetWidth + extraWidth);
            if (extraWidthRemaining > 0) extraWidthRemaining -= 1;
        }

        return widths;
    }

    getTabPositions() {
        const tabPositions = [];
        const tabContentWidths = this.tabContentWidths;

        let position = 0;
        tabContentWidths.forEach(width => {
            tabPositions.push(position);
            position += width;
        });

        const newTabPosition = position;

        return {tabPositions, newTabPosition};
    }

    layoutTabs() {
        const tabContentWidths = this.tabContentWidths;

        this.tabEls.forEach((tabEl, i) => {
            const width = tabContentWidths[i];

            tabEl.style.width = width + 'px';
            tabEl.removeAttribute('is-small');
            tabEl.removeAttribute('is-smaller');
            tabEl.removeAttribute('is-mini');

            if (width < TAB_SIZE_SMALL) tabEl.setAttribute('is-small', '');
            if (width < TAB_SIZE_SMALLER) tabEl.setAttribute('is-smaller', '');
            if (width < TAB_SIZE_MINI) tabEl.setAttribute('is-mini', '');
        });

        let styleHTML = '';

        const {tabPositions, newTabPosition} = this.getTabPositions();

        tabPositions.forEach((position, i) => {
            styleHTML += `.note-tab:nth-child(${ i + 1 }) { transform: translate3d(${ position }px, 0, 0)} `;
        });

        styleHTML += `.note-new-tab { transform: translate3d(${ newTabPosition }px, 0, 0) } `;

        this.styleEl.innerHTML = styleHTML;
    }

    addTab(tabId) {
        const div = document.createElement('div');
        div.innerHTML = tabTemplate;
        const tabEl = div.firstElementChild;
        tabEl.setAttribute('data-tab-id', tabId);

        tabEl.classList.add('note-tab-was-just-added');
        setTimeout(() => tabEl.classList.remove('note-tab-was-just-added'), 500);

        this.newTabEl.before(tabEl);
        this.setVisibility();
        this.setTabCloseEventListener(tabEl);
        this.updateTab(tabEl, {title: 'New tab'});
        this.cleanUpPreviouslyDraggedTabs();
        this.layoutTabs();
        this.setupDraggabilly();

        return tabEl;
    }

    setTabCloseEventListener(tabEl) {
        tabEl.querySelector('.note-tab-close').addEventListener('click', _ => this.removeTab(tabEl));

        tabEl.addEventListener('mousedown', e => {
            if (e.which === 2) {
                this.removeTab(tabEl);

                return true; // event has been handled
            }
        });
    }

    get activeTabEl() {
        return this.el.querySelector('.note-tab[active]');
    }

    get previousTabEl() {
        const tabEls = this.tabEls;

        if (tabEls.length <= 1) {
            return null;
        }

        let prev = tabEls[tabEls.length - 1];

        for (const tabEl of tabEls) {
            if (tabEl.hasAttribute("active")) {
                return prev;
            }

            prev = tabEl;
        }

        return null;
    }

    get nextTabEl() {
        const tabEls = this.tabEls;

        if (tabEls.length <= 1) {
            return null;
        }

        let prev = tabEls[tabEls.length - 1];

        for (const tabEl of tabEls) {
            if (prev.hasAttribute("active")) {
                return tabEl;
            }

            prev = tabEl;
        }

        return null;
    }

    hasActiveTab() {
        return !!this.activeTabEl;
    }

    async activateTab(tabEl) {
        const activeTabEl = this.activeTabEl;
        if (activeTabEl === tabEl) return;
        if (activeTabEl) activeTabEl.removeAttribute('active');
        tabEl.setAttribute('active', '');
        await this.emit('activeTabChange', { tabEl });
    }

    async removeTab(tabEl) {
        if (tabEl === this.activeTabEl) {
            if (tabEl.nextElementSibling && tabEl.nextElementSibling.classList.contains("note-tab")) {
                await this.activateTab(tabEl.nextElementSibling)
            } else if (tabEl.previousElementSibling && tabEl.previousElementSibling.classList.contains("note-tab")) {
                await this.activateTab(tabEl.previousElementSibling)
            }
        }
        tabEl.parentNode.removeChild(tabEl);
        await this.emit('tabRemove', { tabEl });
        this.cleanUpPreviouslyDraggedTabs();
        this.layoutTabs();
        this.setupDraggabilly();
        this.setVisibility();
    }

    async removeAllTabs() {
        for (const tabEl of this.tabEls) {
            await this.removeTab(tabEl);
        }
    }

    async removeAllTabsExceptForThis(remainingTabEl) {
        for (const tabEl of this.tabEls) {
            if (remainingTabEl !== tabEl) {
                await this.removeTab(tabEl);
            }
        }
    }

    updateTab(tabEl, tabProperties) {
        tabEl.querySelector('.note-tab-title').textContent = tabProperties.title;
    }

    cleanUpPreviouslyDraggedTabs() {
        this.tabEls.forEach((tabEl) => tabEl.classList.remove('note-tab-was-just-dragged'));
    }

    setupDraggabilly() {
        const tabEls = this.tabEls;
        const {tabPositions} = this.getTabPositions();

        if (this.isDragging) {
            this.isDragging = false;
            this.el.classList.remove('note-tab-row-is-sorting');
            this.draggabillyDragging.element.classList.remove('note-tab-is-dragging');
            this.draggabillyDragging.element.style.transform = '';
            this.draggabillyDragging.dragEnd();
            this.draggabillyDragging.isDragging = false;
            this.draggabillyDragging.positionDrag = _ => {}; // Prevent Draggabilly from updating tabEl.style.transform in later frames
            this.draggabillyDragging.destroy();
            this.draggabillyDragging = null;
        }

        this.draggabillies.forEach(d => d.destroy());

        tabEls.forEach((tabEl, originalIndex) => {
            const originalTabPositionX = tabPositions[originalIndex];
            const draggabilly = new Draggabilly(tabEl, {
                axis: 'x',
                handle: '.note-tab-drag-handle',
                containment: this.tabContentEl
            });

            this.draggabillies.push(draggabilly);

            draggabilly.on('pointerDown', _ => {
                this.activateTab(tabEl)
            });

            draggabilly.on('dragStart', _ => {
                this.isDragging = true;
                this.draggabillyDragging = draggabilly;
                tabEl.classList.add('note-tab-is-dragging');
                this.el.classList.add('note-tab-row-is-sorting');
            });

            draggabilly.on('dragEnd', _ => {
                this.isDragging = false;
                const finalTranslateX = parseFloat(tabEl.style.left, 10);
                tabEl.style.transform = `translate3d(0, 0, 0)`;

                // Animate dragged tab back into its place
                requestAnimationFrame(_ => {
                    tabEl.style.left = '0';
                    tabEl.style.transform = `translate3d(${ finalTranslateX }px, 0, 0)`;

                    requestAnimationFrame(_ => {
                        tabEl.classList.remove('note-tab-is-dragging');
                        this.el.classList.remove('note-tab-row-is-sorting');

                        tabEl.classList.add('note-tab-was-just-dragged');

                        requestAnimationFrame(_ => {
                            tabEl.style.transform = '';

                            this.layoutTabs();
                            this.setupDraggabilly();
                        })
                    })
                })
            });

            draggabilly.on('dragMove', (event, pointer, moveVector) => {
                // Current index be computed within the event since it can change during the dragMove
                const tabEls = this.tabEls;
                const currentIndex = tabEls.indexOf(tabEl);

                const currentTabPositionX = originalTabPositionX + moveVector.x;
                const destinationIndexTarget = this.closest(currentTabPositionX, tabPositions);
                const destinationIndex = Math.max(0, Math.min(tabEls.length, destinationIndexTarget));

                if (currentIndex !== destinationIndex) {
                    this.animateTabMove(tabEl, currentIndex, destinationIndex);
                }
            })
        })
    }

    async animateTabMove(tabEl, originIndex, destinationIndex) {
        if (destinationIndex < originIndex) {
            tabEl.parentNode.insertBefore(tabEl, this.tabEls[destinationIndex]);
        } else {
            const beforeEl = this.tabEls[destinationIndex + 1] || this.newTabEl;

            tabEl.parentNode.insertBefore(tabEl, beforeEl);
        }
        await this.emit('tabReorder', { tabEl, originIndex, destinationIndex });
        this.layoutTabs();
    }

    setupNewButton() {
        const div = document.createElement('div');
        div.innerHTML = newTabButtonTemplate;
        this.newTabEl = div.firstElementChild;

        this.tabContentEl.appendChild(this.newTabEl);
        this.layoutTabs();

        this.newTabEl.addEventListener('click', _ => this.emit('newTab'));
    }

    closest(value, array) {
        let closest = Infinity;
        let closestIndex = -1;

        array.forEach((v, i) => {
            if (Math.abs(value - v) < closest) {
                closest = Math.abs(value - v);
                closestIndex = i
            }
        });

        return closestIndex;
    };
}

const noteTabRowEl = document.querySelector('.note-tab-row');
const tabRow = new TabRow(noteTabRowEl);

optionsInit.addLoadListener(options => tabRow.setHideTabRowForOneTab(options.hideTabRowForOneTab === 'true'));

export default tabRow;