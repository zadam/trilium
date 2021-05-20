import BasicWidget from "./basic_widget.js";
import contextMenu from "../services/context_menu.js";
import utils from "../services/utils.js";
import keyboardActionService from "../services/keyboard_actions.js";
import appContext from "../services/app_context.js";
import froca from "../services/froca.js";

/*!
 * Draggabilly v2.3.0
 * Make that shiz draggable
 * https://draggabilly.desandro.com
 * MIT license
 */
(function(e,i){e.jQueryBridget=i(e,e.jQuery)})(window,function t(e,r){"use strict";var s=Array.prototype.slice;var i=e.console;var f=typeof i=="undefined"?function(){}:function(t){i.error(t)};function n(h,o,d){d=d||r||e.jQuery;if(!d){return}if(!o.prototype.option){o.prototype.option=function(t){if(!d.isPlainObject(t)){return}this.options=d.extend(true,this.options,t)}}d.fn[h]=function(t){if(typeof t=="string"){var e=s.call(arguments,1);return i(this,t,e)}n(this,t);return this};function i(t,r,s){var a;var u="$()."+h+'("'+r+'")';t.each(function(t,e){var i=d.data(e,h);if(!i){f(h+" not initialized. Cannot call methods, i.e. "+u);return}var n=i[r];if(!n||r.charAt(0)=="_"){f(u+" is not a valid method");return}var o=n.apply(i,s);a=a===undefined?o:a});return a!==undefined?a:t}function n(t,n){t.each(function(t,e){var i=d.data(e,h);if(i){i.option(n);i._init()}else{i=new o(e,n);d.data(e,h,i)}})}a(d)}function a(t){if(!t||t&&t.bridget){return}t.bridget=n}a(r||e.jQuery);return n});
(function(t,e){"use strict";t.getSize=e()})(window,function t(){"use strict";function m(t){var e=parseFloat(t);var i=t.indexOf("%")==-1&&!isNaN(e);return i&&e}function e(){}var i=typeof console=="undefined"?e:function(t){console.error(t)};var y=["paddingLeft","paddingRight","paddingTop","paddingBottom","marginLeft","marginRight","marginTop","marginBottom","borderLeftWidth","borderRightWidth","borderTopWidth","borderBottomWidth"];var b=y.length;function E(){var t={width:0,height:0,innerWidth:0,innerHeight:0,outerWidth:0,outerHeight:0};for(var e=0;e<b;e++){var i=y[e];t[i]=0}return t}function _(t){var e=getComputedStyle(t);if(!e){i("Style returned "+e+". Are you running this code in a hidden iframe on Firefox? "+"See http://bit.ly/getsizebug1")}return e}var n=false;var x;function P(){if(n){return}n=true;var t=document.createElement("div");t.style.width="200px";t.style.padding="1px 2px 3px 4px";t.style.borderStyle="solid";t.style.borderWidth="1px 2px 3px 4px";t.style.boxSizing="border-box";var e=document.body||document.documentElement;e.appendChild(t);var i=_(t);o.isBoxSizeOuter=x=m(i.width)==200;e.removeChild(t)}function o(t){P();if(typeof t=="string"){t=document.querySelector(t)}if(!t||typeof t!="object"||!t.nodeType){return}var e=_(t);if(e.display=="none"){return E()}var i={};i.width=t.offsetWidth;i.height=t.offsetHeight;var n=i.isBorderBox=e.boxSizing=="border-box";for(var o=0;o<b;o++){var r=y[o];var s=e[r];var a=parseFloat(s);i[r]=!isNaN(a)?a:0}var u=i.paddingLeft+i.paddingRight;var h=i.paddingTop+i.paddingBottom;var d=i.marginLeft+i.marginRight;var f=i.marginTop+i.marginBottom;var p=i.borderLeftWidth+i.borderRightWidth;var c=i.borderTopWidth+i.borderBottomWidth;var v=n&&x;var l=m(e.width);if(l!==false){i.width=l+(v?0:u+p)}var g=m(e.height);if(g!==false){i.height=g+(v?0:h+c)}i.innerWidth=i.width-(u+p);i.innerHeight=i.height-(h+c);i.outerWidth=i.width+d;i.outerHeight=i.height+f;return i}return o});(function(t,e){t.EvEmitter=e()})(typeof window!="undefined"?window:this,function(){function t(){}var e=t.prototype;e.on=function(t,e){if(!t||!e){return}var i=this._events=this._events||{};var n=i[t]=i[t]||[];if(n.indexOf(e)==-1){n.push(e)}return this};e.once=function(t,e){if(!t||!e){return}this.on(t,e);var i=this._onceEvents=this._onceEvents||{};var n=i[t]=i[t]||{};n[e]=true;return this};e.off=function(t,e){var i=this._events&&this._events[t];if(!i||!i.length){return}var n=i.indexOf(e);if(n!=-1){i.splice(n,1)}return this};e.emitEvent=function(t,e){var i=this._events&&this._events[t];if(!i||!i.length){return}i=i.slice(0);e=e||[];var n=this._onceEvents&&this._onceEvents[t];for(var o=0;o<i.length;o++){var r=i[o];var s=n&&n[r];if(s){this.off(t,r);delete n[r]}r.apply(this,e)}return this};e.allOff=function(){delete this._events;delete this._onceEvents};return t});
(function(e,i){e.Unipointer=i(e,e.EvEmitter)})(window,function t(o,e){function i(){}function n(){}var r=n.prototype=Object.create(e.prototype);r.bindStartEvent=function(t){this._bindStartEvent(t,true)};r.unbindStartEvent=function(t){this._bindStartEvent(t,false)};r._bindStartEvent=function(t,e){e=e===undefined?true:e;var i=e?"addEventListener":"removeEventListener";var n="mousedown";if(o.PointerEvent){n="pointerdown"}else if("ontouchstart"in o){n="touchstart"}t[i](n,this)};r.handleEvent=function(t){var e="on"+t.type;if(this[e]){this[e](t)}};r.getTouch=function(t){for(var e=0;e<t.length;e++){var i=t[e];if(i.identifier==this.pointerIdentifier){return i}}};r.onmousedown=function(t){var e=t.button;if(e&&(e!==0&&e!==1)){return}this._pointerDown(t,t)};r.ontouchstart=function(t){this._pointerDown(t,t.changedTouches[0])};r.onpointerdown=function(t){this._pointerDown(t,t)};r._pointerDown=function(t,e){if(t.button||this.isPointerDown){return}this.isPointerDown=true;this.pointerIdentifier=e.pointerId!==undefined?e.pointerId:e.identifier;this.pointerDown(t,e)};r.pointerDown=function(t,e){this._bindPostStartEvents(t);this.emitEvent("pointerDown",[t,e])};var s={mousedown:["mousemove","mouseup"],touchstart:["touchmove","touchend","touchcancel"],pointerdown:["pointermove","pointerup","pointercancel"]};r._bindPostStartEvents=function(t){if(!t){return}var e=s[t.type];e.forEach(function(t){o.addEventListener(t,this)},this);this._boundPointerEvents=e};r._unbindPostStartEvents=function(){if(!this._boundPointerEvents){return}this._boundPointerEvents.forEach(function(t){o.removeEventListener(t,this)},this);delete this._boundPointerEvents};r.onmousemove=function(t){this._pointerMove(t,t)};r.onpointermove=function(t){if(t.pointerId==this.pointerIdentifier){this._pointerMove(t,t)}};r.ontouchmove=function(t){var e=this.getTouch(t.changedTouches);if(e){this._pointerMove(t,e)}};r._pointerMove=function(t,e){this.pointerMove(t,e)};r.pointerMove=function(t,e){this.emitEvent("pointerMove",[t,e])};r.onmouseup=function(t){this._pointerUp(t,t)};r.onpointerup=function(t){if(t.pointerId==this.pointerIdentifier){this._pointerUp(t,t)}};r.ontouchend=function(t){var e=this.getTouch(t.changedTouches);if(e){this._pointerUp(t,e)}};r._pointerUp=function(t,e){this._pointerDone();this.pointerUp(t,e)};r.pointerUp=function(t,e){this.emitEvent("pointerUp",[t,e])};r._pointerDone=function(){this._pointerReset();this._unbindPostStartEvents();this.pointerDone()};r._pointerReset=function(){this.isPointerDown=false;delete this.pointerIdentifier};r.pointerDone=i;r.onpointercancel=function(t){if(t.pointerId==this.pointerIdentifier){this._pointerCancel(t,t)}};r.ontouchcancel=function(t){var e=this.getTouch(t.changedTouches);if(e){this._pointerCancel(t,e)}};r._pointerCancel=function(t,e){this._pointerDone();this.pointerCancel(t,e)};r.pointerCancel=function(t,e){this.emitEvent("pointerCancel",[t,e])};n.getPointerPoint=function(t){return{x:t.pageX,y:t.pageY}};return n});
(function(e,i){e.Unidragger=i(e,e.Unipointer)})(window,function t(r,e){function i(){}var n=i.prototype=Object.create(e.prototype);n.bindHandles=function(){this._bindHandles(true)};n.unbindHandles=function(){this._bindHandles(false)};n._bindHandles=function(t){t=t===undefined?true:t;var e=t?"addEventListener":"removeEventListener";var i=t?this._touchActionValue:"";for(var n=0;n<this.handles.length;n++){var o=this.handles[n];this._bindStartEvent(o,t);o[e]("click",this);if(r.PointerEvent){o.style.touchAction=i}}};n._touchActionValue="none";n.pointerDown=function(t,e){var i=this.okayPointerDown(t);if(!i){return}this.pointerDownPointer=e;t.preventDefault();this.pointerDownBlur();this._bindPostStartEvents(t);this.emitEvent("pointerDown",[t,e])};var o={TEXTAREA:true,INPUT:true,SELECT:true,OPTION:true};var s={radio:true,checkbox:true,button:true,submit:true,image:true,file:true};n.okayPointerDown=function(t){var e=o[t.target.nodeName];var i=s[t.target.type];var n=!e||i;if(!n){this._pointerReset()}return n};n.pointerDownBlur=function(){var t=document.activeElement;var e=t&&t.blur&&t!=document.body;if(e){t.blur()}};n.pointerMove=function(t,e){var i=this._dragPointerMove(t,e);this.emitEvent("pointerMove",[t,e,i]);this._dragMove(t,e,i)};n._dragPointerMove=function(t,e){var i={x:e.pageX-this.pointerDownPointer.pageX,y:e.pageY-this.pointerDownPointer.pageY};if(!this.isDragging&&this.hasDragStarted(i)){this._dragStart(t,e)}return i};n.hasDragStarted=function(t){return Math.abs(t.x)>3||Math.abs(t.y)>3};n.pointerUp=function(t,e){this.emitEvent("pointerUp",[t,e]);this._dragPointerUp(t,e)};n._dragPointerUp=function(t,e){if(this.isDragging){this._dragEnd(t,e)}else{this._staticClick(t,e)}};n._dragStart=function(t,e){this.isDragging=true;this.isPreventingClicks=true;this.dragStart(t,e)};n.dragStart=function(t,e){this.emitEvent("dragStart",[t,e])};n._dragMove=function(t,e,i){if(!this.isDragging){return}this.dragMove(t,e,i)};n.dragMove=function(t,e,i){t.preventDefault();this.emitEvent("dragMove",[t,e,i])};n._dragEnd=function(t,e){this.isDragging=false;setTimeout(function(){delete this.isPreventingClicks}.bind(this));this.dragEnd(t,e)};n.dragEnd=function(t,e){this.emitEvent("dragEnd",[t,e])};n.onclick=function(t){if(this.isPreventingClicks){t.preventDefault()}};n._staticClick=function(t,e){if(this.isIgnoringMouseUp&&t.type=="mouseup"){return}this.staticClick(t,e);if(t.type!="mouseup"){this.isIgnoringMouseUp=true;setTimeout(function(){delete this.isIgnoringMouseUp}.bind(this),400)}};n.staticClick=function(t,e){this.emitEvent("staticClick",[t,e])};i.getPointerPoint=e.getPointerPoint;return i});
(function(i,n){i.Draggabilly=n(i,i.getSize,i.Unidragger)})(window,function t(r,u,e){function i(t,e){for(var i in e){t[i]=e[i]}return t}function n(){}var o=r.jQuery;function s(t,e){this.element=typeof t=="string"?document.querySelector(t):t;if(o){this.$element=o(this.element)}this.options=i({},this.constructor.defaults);this.option(e);this._create()}var a=s.prototype=Object.create(e.prototype);s.defaults={};a.option=function(t){i(this.options,t)};var h={relative:true,absolute:true,fixed:true};a._create=function(){this.position={};this._getPosition();this.startPoint={x:0,y:0};this.dragPoint={x:0,y:0};this.startPosition=i({},this.position);var t=getComputedStyle(this.element);if(!h[t.position]){this.element.style.position="relative"}this.on("pointerMove",this.onPointerMove);this.on("pointerUp",this.onPointerUp);this.enable();this.setHandles()};a.setHandles=function(){this.handles=this.options.handle?this.element.querySelectorAll(this.options.handle):[this.element];this.bindHandles()};a.dispatchEvent=function(t,e,i){var n=[e].concat(i);this.emitEvent(t,n);this.dispatchJQueryEvent(t,e,i)};a.dispatchJQueryEvent=function(t,e,i){var n=r.jQuery;if(!n||!this.$element){return}var o=n.Event(e);o.type=t;this.$element.trigger(o,i)};a._getPosition=function(){var t=getComputedStyle(this.element);var e=this._getPositionCoord(t.left,"width");var i=this._getPositionCoord(t.top,"height");this.position.x=isNaN(e)?0:e;this.position.y=isNaN(i)?0:i;this._addTransformPosition(t)};a._getPositionCoord=function(t,e){if(t.indexOf("%")!=-1){var i=u(this.element.parentNode);return!i?0:parseFloat(t)/100*i[e]}return parseInt(t,10)};a._addTransformPosition=function(t){var e=t.transform;if(e.indexOf("matrix")!==0){return}var i=e.split(",");var n=e.indexOf("matrix3d")===0?12:4;var o=parseInt(i[n],10);var r=parseInt(i[n+1],10);this.position.x+=o;this.position.y+=r};a.onPointerDown=function(t,e){this.element.classList.add("is-pointer-down");this.dispatchJQueryEvent("pointerDown",t,[e])};a.pointerDown=function(t,e){var i=this.okayPointerDown(t);if(!i||!this.isEnabled){this._pointerReset();return}this.pointerDownPointer={pageX:e.pageX,pageY:e.pageY};t.preventDefault();this.pointerDownBlur();this._bindPostStartEvents(t);this.element.classList.add("is-pointer-down");this.dispatchEvent("pointerDown",t,[e])};a.dragStart=function(t,e){if(!this.isEnabled){return}this._getPosition();this.measureContainment();this.startPosition.x=this.position.x;this.startPosition.y=this.position.y;this.setLeftTop();this.dragPoint.x=0;this.dragPoint.y=0;this.element.classList.add("is-dragging");this.dispatchEvent("dragStart",t,[e]);this.animate()};a.measureContainment=function(){var t=this.getContainer();if(!t){return}var e=u(this.element);var i=u(t);var n=this.element.getBoundingClientRect();var o=t.getBoundingClientRect();var r=i.borderLeftWidth+i.borderRightWidth;var s=i.borderTopWidth+i.borderBottomWidth;var a=this.relativeStartPosition={x:n.left-(o.left+i.borderLeftWidth),y:n.top-(o.top+i.borderTopWidth)};this.containSize={width:i.width-r-a.x-e.width,height:i.height-s-a.y-e.height}};a.getContainer=function(){var t=this.options.containment;if(!t){return}var e=t instanceof HTMLElement;if(e){return t}if(typeof t=="string"){return document.querySelector(t)}return this.element.parentNode};a.onPointerMove=function(t,e,i){this.dispatchJQueryEvent("pointerMove",t,[e,i])};a.dragMove=function(t,e,i){if(!this.isEnabled){return}var n=i.x;var o=i.y;var r=this.options.grid;var s=r&&r[0];var a=r&&r[1];n=d(n,s);o=d(o,a);n=this.containDrag("x",n,s);o=this.containDrag("y",o,a);n=this.options.axis=="y"?0:n;o=this.options.axis=="x"?0:o;this.position.x=this.startPosition.x+n;this.position.y=this.startPosition.y+o;this.dragPoint.x=n;this.dragPoint.y=o;this.dispatchEvent("dragMove",t,[e,i])};function d(t,e,i){i=i||"round";return e?Math[i](t/e)*e:t}a.containDrag=function(t,e,i){if(!this.options.containment){return e}var n=t=="x"?"width":"height";var o=this.relativeStartPosition[t];var r=d(-o,i,"ceil");var s=this.containSize[n];s=d(s,i,"floor");return Math.max(r,Math.min(s,e))};a.onPointerUp=function(t,e){this.element.classList.remove("is-pointer-down");this.dispatchJQueryEvent("pointerUp",t,[e])};a.dragEnd=function(t,e){if(!this.isEnabled){return}this.element.style.transform="";this.setLeftTop();this.element.classList.remove("is-dragging");this.dispatchEvent("dragEnd",t,[e])};a.animate=function(){if(!this.isDragging){return}this.positionDrag();var e=this;requestAnimationFrame(function t(){e.animate()})};a.setLeftTop=function(){this.element.style.left=this.position.x+"px";this.element.style.top=this.position.y+"px"};a.positionDrag=function(){this.element.style.transform="translate3d( "+this.dragPoint.x+"px, "+this.dragPoint.y+"px, 0)"};a.staticClick=function(t,e){this.dispatchEvent("staticClick",t,[e])};a.setPosition=function(t,e){this.position.x=t;this.position.y=e;this.setLeftTop()};a.enable=function(){this.isEnabled=true};a.disable=function(){this.isEnabled=false;if(this.isDragging){this.dragEnd()}};a.destroy=function(){this.disable();this.element.style.transform="";this.element.style.left="";this.element.style.top="";this.element.style.position="";this.unbindHandles();if(this.$element){this.$element.removeData("draggabilly")}};a._init=n;if(o&&o.bridget){o.bridget("draggabilly",s)}return s});

const Draggabilly = window.Draggabilly;

const TAB_CONTAINER_MIN_WIDTH = 24;
const TAB_CONTAINER_MAX_WIDTH = 240;
const NEW_TAB_WIDTH = 32;
const MIN_FILLER_WIDTH = 50;

const TAB_SIZE_SMALL = 84;
const TAB_SIZE_SMALLER = 60;
const TAB_SIZE_MINI = 48;

const TAB_TPL = `
<div class="note-tab">
  <div class="note-tab-wrapper">
    <div class="note-tab-icon"></div>
    <div class="note-tab-title"></div>
    <div class="note-tab-drag-handle"></div>
    <div class="note-tab-close" title="Close tab" data-trigger-command="closeActiveTab"><span>×</span></div>
  </div>
</div>`;

const NEW_TAB_BUTTON_TPL = `<div class="note-new-tab" data-trigger-command="openNewTab" title="Add new tab">+</div>`;
const FILLER_TPL = `<div class="tab-row-filler">
    <div class="tab-row-border"></div>
</div>`;

const TAB_ROW_TPL = `
<div class="note-tab-row">
    <style>
    .note-tab-row {
        box-sizing: border-box;
        position: relative;
        height: 36px;
        width: 100%;
        background: var(--main-background-color);
        overflow: hidden;
        margin-top: 2px;
    }
    
    .note-tab-row * {
        box-sizing: inherit;
        font: inherit;
    }
    
    .note-tab-row .note-tab-row-container {
        box-sizing: border-box;
        position: relative;
        width: 100%;
        height: 100%;
    }
    
    .note-tab-row .note-tab {
        position: absolute;
        left: 0;
        height: 33px;
        width: 240px;
        border: 0;
        margin: 0;
        z-index: 1;
        pointer-events: none;
    }
    
    .note-new-tab {
        position: absolute;
        left: 0;
        height: 33px;
        width: 32px;
        border: 0;
        margin: 0;
        z-index: 1;
        text-align: center;
        font-size: 24px;
        cursor: pointer;
        border-bottom: 1px solid var(--main-border-color);
        box-sizing: border-box;
    }
    
    .note-new-tab:hover {
        background-color: var(--accented-background-color);
        border-radius: 5px;
    }
    
    .tab-row-filler {
        box-sizing: border-box;
        -webkit-app-region: drag;
        position: absolute;
        left: 0;
        height: 36px;
    }
    
    .tab-row-filler .tab-row-border {
        background: linear-gradient(to right, var(--main-border-color), transparent);
        height: 1px;
        margin-top: 32px;
    }
    
    .note-tab-row .note-tab[active] {
        z-index: 5;
    }
    
    .note-tab-row .note-tab,
    .note-tab-row .note-tab * {
        user-select: none;
        cursor: default;
    }
    
    .note-tab-row .note-tab.note-tab-was-just-added {
        top: 10px;
        animation: note-tab-was-just-added 120ms forwards ease-in-out;
    }
    
    .note-tab-row .note-tab .note-tab-wrapper {
        position: absolute;
        display: flex;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 5px 8px;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        overflow: hidden;
        pointer-events: all;
        background-color: var(--accented-background-color);
        border-bottom: 1px solid var(--main-border-color);
    }
    
    .note-tab-row .note-tab[active] .note-tab-wrapper {
        background-color: var(--main-background-color);
        border: 1px solid var(--main-border-color);
        border-bottom: 0;
        font-weight: bold;
    }
    
    .note-tab-row .note-tab[is-mini] .note-tab-wrapper {
        padding-left: 2px;
        padding-right: 2px;
    }
    
    .note-tab-row .note-tab .note-tab-title {
        flex: 1;
        vertical-align: top;
        overflow: hidden;
        white-space: nowrap;
        color: var(--muted-text-color);
    }
    
    .note-tab-row .note-tab .note-tab-icon {
        position: relative;
        top: -1px;
        padding-right: 3px;
    }
    
    .note-tab-row .note-tab[is-small] .note-tab-title {
        margin-left: 0;
    }
    
    .note-tab-row .note-tab[active] .note-tab-title {
        color: var(--main-text-color);
    }
    
    .note-tab-row .note-tab .note-tab-drag-handle {
        position: absolute;
        top: 0;
        bottom: 0;
        right: 0;
        left: 0;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
    }
    
    .note-tab-row .note-tab .note-tab-close {
        flex-grow: 0;
        flex-shrink: 0;
        border-radius: 50%;
        z-index: 100;
        width: 24px;
        height: 24px;
        text-align: center;
    }
    
    .note-tab-row .note-tab .note-tab-close span {
        font-size: 24px;
        position: relative;
        top: -6px;
    }
    
    .note-tab-row .note-tab .note-tab-close:hover {
        background-color: var(--hover-item-background-color);
        color: var(--hover-item-text-color);
    }
    
    .note-tab-row .note-tab[is-smaller] .note-tab-close {
        margin-left: auto;
    }
    .note-tab-row .note-tab[is-mini]:not([active]) .note-tab-close {
        display: none;
    }
    .note-tab-row .note-tab[is-mini][active] .note-tab-close {
        margin-left: auto;
        margin-right: auto;
    }
    @-moz-keyframes note-tab-was-just-added {
        to {
            top: 0;
        }
    }
    @-webkit-keyframes note-tab-was-just-added {
        to {
            top: 0;
        }
    }
    @-o-keyframes note-tab-was-just-added {
        to {
            top: 0;
        }
    }
    @keyframes note-tab-was-just-added {
        to {
            top: 0;
        }
    }
    .note-tab-row.note-tab-row-is-sorting .note-tab:not(.note-tab-is-dragging),
    .note-tab-row:not(.note-tab-row-is-sorting) .note-tab.note-tab-was-just-dragged {
        transition: transform 120ms ease-in-out;
    }
    </style>

    <div class="note-tab-row-container"></div>
</div>`;

export default class TabRowWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TAB_ROW_TPL);

        this.draggabillies = [];
        this.eventListeners = {};

        this.setupStyle();
        this.setupEvents();
        this.setupDraggabilly();
        this.setupNewButton();
        this.setupFiller();
        this.layoutTabs();
        this.setVisibility();

        this.$widget.on('contextmenu', '.note-tab', e => {
            e.preventDefault();

            const tabId = $(e.target).closest(".note-tab").attr('data-tab-id');

            contextMenu.show({
                x: e.pageX,
                y: e.pageY,
                items: [
                    {title: "Move this tab to a new window", command: "moveTabToNewWindow", uiIcon: "window-open"},
                    {title: "Close all tabs", command: "removeAllTabs", uiIcon: "x"},
                    {title: "Close all tabs except for this", command: "removeAllTabsExceptForThis", uiIcon: "x"},
                ],
                selectMenuItemHandler: ({command}) => {
                    this.triggerCommand(command, {tabId});
                }
            });
        });
    }

    setupStyle() {
        this.$style = $("<style>");
        this.$widget.append(this.$style);
    }

    setupEvents() {
        const resizeListener = _ => {
            this.cleanUpPreviouslyDraggedTabs();
            this.layoutTabs();
        };

        // ResizeObserver exists only in FF69
        if (typeof ResizeObserver !== "undefined") {
            new ResizeObserver(resizeListener).observe(this.$widget[0]);
        }
        else {
            // for older firefox
            window.addEventListener('resize', resizeListener);
        }

        this.tabEls.forEach((tabEl) => this.setTabCloseEvent(tabEl));
    }

    setVisibility() {
        this.$widget.show();
    }

    get tabEls() {
        return Array.prototype.slice.call(this.$widget.find('.note-tab'));
    }

    get $tabContainer() {
        return this.$widget.find('.note-tab-row-container');
    }

    get tabWidths() {
        const numberOfTabs = this.tabEls.length;
        const tabsContainerWidth = this.$tabContainer[0].clientWidth - NEW_TAB_WIDTH - MIN_FILLER_WIDTH;
        const targetWidth = tabsContainerWidth / numberOfTabs;
        const clampedTargetWidth = Math.max(TAB_CONTAINER_MIN_WIDTH, Math.min(TAB_CONTAINER_MAX_WIDTH, targetWidth));
        const flooredClampedTargetWidth = Math.floor(clampedTargetWidth);
        const totalTabsWidthUsingTarget = flooredClampedTargetWidth * numberOfTabs;
        const totalExtraWidthDueToFlooring = tabsContainerWidth - totalTabsWidthUsingTarget;

        const widths = [];
        let extraWidthRemaining = totalExtraWidthDueToFlooring;

        for (let i = 0; i < numberOfTabs; i += 1) {
            const extraWidth = flooredClampedTargetWidth < TAB_CONTAINER_MAX_WIDTH && extraWidthRemaining > 0 ? 1 : 0;
            widths.push(flooredClampedTargetWidth + extraWidth);
            if (extraWidthRemaining > 0) extraWidthRemaining -= 1;
        }

        if (this.$filler) {
            this.$filler.css("width", (extraWidthRemaining + MIN_FILLER_WIDTH) + "px");
        }

        return widths;
    }

    getTabPositions() {
        const tabPositions = [];

        let position = 0;
        this.tabWidths.forEach(width => {
            tabPositions.push(position);
            position += width;
        });

        const newTabPosition = position;
        const fillerPosition = position + 32;

        return {tabPositions, newTabPosition, fillerPosition};
    }

    layoutTabs() {
        const tabContainerWidths = this.tabWidths;

        this.tabEls.forEach((tabEl, i) => {
            const width = tabContainerWidths[i];

            tabEl.style.width = width + 'px';
            tabEl.removeAttribute('is-small');
            tabEl.removeAttribute('is-smaller');
            tabEl.removeAttribute('is-mini');

            if (width < TAB_SIZE_SMALL) tabEl.setAttribute('is-small', '');
            if (width < TAB_SIZE_SMALLER) tabEl.setAttribute('is-smaller', '');
            if (width < TAB_SIZE_MINI) tabEl.setAttribute('is-mini', '');
        });

        let styleHTML = '';

        const {tabPositions, newTabPosition, fillerPosition} = this.getTabPositions();

        tabPositions.forEach((position, i) => {
            styleHTML += `.note-tab:nth-child(${ i + 1 }) { transform: translate3d(${ position }px, 0, 0)} `;
        });

        styleHTML += `.note-new-tab { transform: translate3d(${ newTabPosition }px, 0, 0) } `;
        styleHTML += `.tab-row-filler { transform: translate3d(${ fillerPosition }px, 0, 0) } `;

        this.$style.html(styleHTML);
    }

    addTab(tabId) {
        const $tab = $(TAB_TPL).attr('data-tab-id', tabId);

        keyboardActionService.updateDisplayedShortcuts($tab);

        $tab.addClass('note-tab-was-just-added');

        setTimeout(() => $tab.removeClass('note-tab-was-just-added'), 500);

        this.$newTab.before($tab);
        this.setVisibility();
        this.setTabCloseEvent($tab);
        this.updateTitle($tab, 'New tab');
        this.cleanUpPreviouslyDraggedTabs();
        this.layoutTabs();
        this.setupDraggabilly();
    }

    closeActiveTabCommand({$el}) {
        const tabId = $el.closest(".note-tab").attr('data-tab-id');

        appContext.tabManager.removeTab(tabId);
    }

    setTabCloseEvent($tab) {
        $tab.on('mousedown', e => {
            if (e.which === 2) {
                appContext.tabManager.removeTab($tab.attr('data-tab-id'));

                return true; // event has been handled
            }
        });
    }

    get activeTabEl() {
        return this.$widget.find('.note-tab[active]')[0];
    }

    activeTabChangedEvent() {
        let activeTabContext = appContext.tabManager.getActiveTabContext();

        if (!activeTabContext) {
            return;
        }

        if (activeTabContext.parentTabId) {
            activeTabContext = appContext.tabManager.getTabContextById(activeTabContext.parentTabId);
        }

        const tabEl = this.getTabById(activeTabContext.tabId)[0];
        const activeTabEl = this.activeTabEl;
        if (activeTabEl === tabEl) return;
        if (activeTabEl) activeTabEl.removeAttribute('active');
        if (tabEl) tabEl.setAttribute('active', '');
    }

    newTabOpenedEvent({tabContext}) {
        if (!tabContext.parentTabId) {
            this.addTab(tabContext.tabId);
        }
    }

    removeTab(tabId) {
        const tabEl = this.getTabById(tabId)[0];

        if (tabEl) {
            tabEl.parentNode.removeChild(tabEl);
            this.cleanUpPreviouslyDraggedTabs();
            this.layoutTabs();
            this.setupDraggabilly();
            this.setVisibility();
        }
    }

    getTabIdsInOrder() {
        return this.tabEls.map(el => el.getAttribute('data-tab-id'));
    }

    updateTitle($tab, title) {
        $tab.find('.note-tab-title').text(title);
    }

    getTabById(tabId) {
        return this.$widget.find(`[data-tab-id='${tabId}']`);
    }

    getTabId($tab) {
        return $tab.attr('data-tab-id');
    }

    tabRemovedEvent({tabIds}) {
        for (const tabId of tabIds) {
            this.removeTab(tabId);
        }
    }

    cleanUpPreviouslyDraggedTabs() {
        this.tabEls.forEach((tabEl) => tabEl.classList.remove('note-tab-was-just-dragged'));
    }

    setupDraggabilly() {
        const tabEls = this.tabEls;
        const {tabPositions} = this.getTabPositions();

        if (this.isDragging) {
            this.isDragging = false;
            this.$widget.removeClass('note-tab-row-is-sorting');
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
                containment: this.$tabContainer[0]
            });

            this.draggabillies.push(draggabilly);

            draggabilly.on('pointerDown', _ => {
                appContext.tabManager.activateTab(tabEl.getAttribute('data-tab-id'));
            });

            draggabilly.on('dragStart', _ => {
                this.isDragging = true;
                this.draggabillyDragging = draggabilly;
                tabEl.classList.add('note-tab-is-dragging');
                this.$widget.addClass('note-tab-row-is-sorting');
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
                        this.$widget.removeClass('note-tab-row-is-sorting');

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

                if (Math.abs(moveVector.y) > 100) {
                    this.triggerCommand('moveTabToNewWindow', {tabId: this.getTabId($(tabEl))});
                }
            });
        });
    }

    animateTabMove(tabEl, originIndex, destinationIndex) {
        if (destinationIndex < originIndex) {
            tabEl.parentNode.insertBefore(tabEl, this.tabEls[destinationIndex]);
        } else {
            const beforeEl = this.tabEls[destinationIndex + 1] || this.$newTab[0];

            tabEl.parentNode.insertBefore(tabEl, beforeEl);
        }
        this.triggerEvent('tabReorder', {tabIdsInOrder: this.getTabIdsInOrder()});
        this.layoutTabs();
    }

    setupNewButton() {
        this.$newTab = $(NEW_TAB_BUTTON_TPL);

        this.$tabContainer.append(this.$newTab);
    }

    setupFiller() {
        this.$filler = $(FILLER_TPL);

        this.$tabContainer.append(this.$filler);
    }

    closest(value, array) {
        let closest = Infinity;
        let closestIndex = -1;

        array.forEach((v, i) => {
            if (Math.abs(value - v) < closest) {
                closest = Math.abs(value - v);
                closestIndex = i;
            }
        });

        return closestIndex;
    };

    tabNoteSwitchedAndActivatedEvent({tabContext}) {
        this.activeTabChangedEvent();

        this.updateTabById(tabContext.parentTabId || tabContext.tabId);
    }

    tabNoteSwitchedEvent({tabContext}) {
        this.updateTabById(tabContext.parentTabId || tabContext.tabId);
    }

    updateTabById(tabId) {
        const $tab = this.getTabById(tabId);

        const {note} = appContext.tabManager.getTabContextById(tabId);

        this.updateTab($tab, note);
    }

    updateTab($tab, note) {
        if (!$tab.length) {
            return;
        }

        for (const clazz of Array.from($tab[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz !== 'note-tab') {
                $tab.removeClass(clazz);
            }
        }

        const tabContext = appContext.tabManager.getTabContextById(this.getTabId($tab));

        if (tabContext) {
            const hoistedNote = froca.getNoteFromCache(tabContext.hoistedNoteId);

            if (hoistedNote) {
                $tab.find('.note-tab-icon')
                    .removeClass()
                    .addClass("note-tab-icon")
                    .addClass(hoistedNote.getWorkspaceIconClass());

                $tab.find('.note-tab-wrapper').css("background", hoistedNote.getWorkspaceTabBackgroundColor());
            }
            else {
                $tab.find('.note-tab-wrapper').removeAttr("style");
            }
        }

        if (!note) {
            this.updateTitle($tab, 'New tab');
            return;
        }

        this.updateTitle($tab, note.title);

        $tab.addClass(note.getCssClass());
        $tab.addClass(utils.getNoteTypeClass(note.type));
        $tab.addClass(utils.getMimeTypeClass(note.mime));
    }

    async entitiesReloadedEvent({loadResults}) {
        for (const tabContext of appContext.tabManager.tabContexts) {
            if (!tabContext.noteId) {
                continue;
            }

            if (loadResults.isNoteReloaded(tabContext.noteId) ||
                loadResults.getAttributes().find(attr =>
                    ['workspace', 'workspaceIconClass', 'workspaceTabBackgroundColor'].includes(attr.name)
                    && attr.isAffecting(tabContext.note))
            ) {
                const $tab = this.getTabById(tabContext.tabId);

                this.updateTab($tab, tabContext.note);
            }
        }
    }

    frocaReloadedEvent() {
        for (const tabContext of appContext.tabManager.tabContexts) {
            const $tab = this.getTabById(tabContext.tabId);

            this.updateTab($tab, tabContext.note);
        }
    }

    hoistedNoteChangedEvent({tabId}) {
        const $tab = this.getTabById(tabId);

        if ($tab) {
            const tabContext = appContext.tabManager.getTabContextById(tabId);

            this.updateTab($tab, tabContext.note);
        }
    }
}
