import _throttle from './lib/lodash.throttle.js';
import _debounce from './lib/lodash.debounce.js';
import sleep from './lib/sleep.js';
import deleteIcon from './lib/deleteIcon.js';

var img = document.createElement('img');
img.src = deleteIcon;

/**
 * Class of all valid Infinite Canvas States
 *
 * usage:
 * const canvasState = new CanvasState();
 * canvasState.on('selecting', ()=>{});
 * canvasState.activate('selecting');
Inspiration: https://stackoverflow.com/a/53917410
https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 */
class CanvasState extends EventTarget {
  constructor(initialState) {
    this.states = {
      IDLE: 'idle',
      INTERACTING: 'interacting',
      DRAGGING: 'dragging',
      PANNING: 'panning',
      SELECTING: 'selecting',
      PINCH_ZOOMING: 'pinch_zooming',
      SELECTED: 'selected,',
    };

    this.currentState = initialState || this.state.IDLE;

    this.listeners = {};
  }

  activate(state) {
    if (this._isValidState(state)) {
      this.currentState = state;
      this.dispatchEvent(new Event(state));
    } else {
      throw new Error(`This is not a valid State: '${state}`);
    }
  }

  _isValidState(state) {
    const statesArray = Object.values(this.states);
    return statesArray.find(state);
  }

  get() {
    return this.currentState;
  }

  getStates() {
    return this.states;
  }
}

/**
 * Infinite Canvas
 */
class InfiniteCanvas {
  constructor($canvas, $parent, $canvasContainer) {
    this.$canvas = $canvas;
    this.$canvasContainer = $canvasContainer;
    this.$parent = $parent;

    // Canvas
    this.isDragging;
    this.selection;
    this.lastPosX;
    this.lastPosY;
    this.startPosX = 0;
    this.startPosY = 0;
    this.numberOfPanEvents;
    this.lastScale = 1;
    this.fonts = [
      'Times New Roman',
      'Arial',
      'Verdana',
      'Calibri',
      'Consolas',
      'Comic Sans MS',
    ];
    this.width = this.scaledWidth = 1500; //px
    this.height = this.scaledHeight = 1500; //px
    this.drawWithTouch = false;
    this.activatePlaceTextBox = false;

    // bind methods to this
    this.handlePointerEventBefore = this.handlePointerEventBefore.bind(this);
    this.resizeCanvas = this.resizeCanvas.bind(this);
    this.handlePinch = this.handlePinch.bind(this);
    this.handlePinchEnd = this.handlePinchEnd.bind(this);
    this.handlePanStart = this.handlePanStart.bind(this);
    this.handlePanning = this.handlePanning.bind(this);
    this.handlePanEnd = this.handlePanEnd.bind(this);
    this.transformCanvas = this.transformCanvas.bind(this);
    this.resetZoom = this.resetZoom.bind(this);
    this.cropCanvas = this.cropCanvas.bind(this);
    this.placeTextBox = this.placeTextBox.bind(this);
  }

  overrideFabric() {
    const self = this;

    fabric.Object.prototype.controls.deleteControl = new fabric.Control({
      x: 0.5,
      y: -0.5,
      offsetY: 16,
      cursorStyle: 'pointer',
      mouseUpHandler: self.deleteObject,
      render: self.renderIcon,
      cornerSize: 24,
    });
  }

  renderIcon(ctx, left, top, styleOverride, fabricObject) {
    var size = this.cornerSize;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  deleteObject(eventData, target) {
    var canvas = target.canvas;
    canvas.remove(target);
    canvas.requestRenderAll();
  }

  initFabric() {
    this.overrideFabric();

    const canvasElement = this.$canvas.get(0); // fabric.Canvas requires HTMLElement
    this.canvasElement = canvasElement;

    const self = this;
    const canvas = new fabric.Canvas(canvasElement, {
      isDrawingMode: false,
      allowTouchScrolling: true,
      transparentCorners: false,
    });
    this.$canvas = canvas;
    // fabric.Object.prototype.transparentCorners = false;

    // Resizing
    // FIXME: canvas should only enlarge, maybe we dont even need, since canvas will scroll behind parent!
    // const canvasNote = this.$parent.get(0);
    // new ResizeObserver(_throttle(this.resizeCanvas, 200)).observe(canvasNote); // this leads to a eraserbrush remaining...

    // Handle different input devices: Touch (Finger), Pen, Mouse
    canvas.on('mouse:down:before', this.handlePointerEventBefore);

    this.hammer = new Hammer.Manager(canvas.upperCanvasEl);
    var pinch = new Hammer.Pinch();
    var pan = new Hammer.Pan();
    this.hammer.add([pinch, pan]);

    // Zoom (Pinch)
    // FIXME: not working
    // Problem: Somehow eraser planes from matched do not overlay and then do not erase
    this.hammer.on('pinchmove', _throttle(this.handlePinch, 20));
    // the pinchend call must be debounced, since a pinchmove event might
    // occur after a couple of ms after the actual pinchend event. With the
    // debounce, it is garuanted, that this.lastScale and the scale for the
    // next pinch zoom is set correctly
    this.hammer.on('pinchend', _debounce(this.handlePinchEnd, 200));

    // Move Canvas
    this.hammer.on('panstart', this.handlePanStart);
    this.hammer.on('pan', this.handlePanning);
    this.hammer.on('panend', this.handlePanEnd);

    canvas.transformCanvas = this.transformCanvas;

    return self;
  }

  /**
   *
   * @param {string} direction [top, left, right, bottom]
   * @param {float} distance distance in px
   */
  transformCanvas(direction, distance) {
    console.log('transforming', direction, distance);
    const canvas = this.$canvas;
    this.resetZoom();

    const items = canvas.getObjects();

    // Move all items, so that it seems canvas was added on the outside
    for (let i = 0; i < items.length; i++) {
      const item = canvas.item(i).setCoords();
      console.log('tc, item', item);
      if (direction === 'top') {
        // move all down
        item.top = item.top + distance;
      }
      if (direction === 'left') {
        // move all to the right
        item.left = item.left + distance;
      }
    }

    let newWidth = this.scaledWidth,
      newHeight = this.scaledHeight;

    if (direction === 'top' || direction === 'bottom') {
      newHeight = this.scaledHeight + distance;
    } else if (direction === 'left' || direction === 'right') {
      newWidth = this.scaledWidth + distance;
    }
    this.scaledWidth = this.width = newWidth;
    this.scaledHeight = this.height = newHeight;
    canvas.setWidth(newWidth);
    canvas.setHeight(newHeight);

    this.$canvasContainer.width(newWidth).height(newHeight);

    canvas.renderAll();
    console.log('called tc', direction, distance);
  }

  resetZoom() {
    const canvas = this.$canvas;

    // zoom level of canvas
    canvas.setZoom(1);
    // width of
    canvas.setWidth(this.width);
    canvas.setHeight(this.height);
    // reset scale, so that for next pinch we start with "fresh" values
    this.scaledWidth = this.width;
    this.scaledHeight = this.height;
    this.lastScale = 1;
    // set div container of canvas
    this.$canvasContainer.width(this.width).height(this.height);
  }

  handlePointerEventBefore(fabricEvent) {
    const canvas = this.$canvas;
    const inputType = this.recognizeInput(fabricEvent.e);
    console.log('mdb', fabricEvent, fabricEvent.e, 'inputType', inputType);
    // place text box independent of touch type
    if (this.activatePlaceTextBox) {
      if (fabricEvent && fabricEvent.absolutePointer) {
        this.placeTextBox(fabricEvent.absolutePointer.x, fabricEvent.absolutePointer.y);
        this.activatePlaceTextBox = false;
        return;
      }
    }

    // recognize touch
    if (inputType === 'touch') {
      if (this.drawWithTouch) {
        // drawing
        canvas.isDrawingMode = true;
      } else {
        // panning
        console.log('mdb touch');
        canvas.isDrawingMode = false;
        canvas.selection = false;
        // unselect any possible targets (if you start the pan on an object)
        if (fabricEvent.target && canvas) {
          // source: https://stackoverflow.com/a/25535052
          canvas.deactivateAll().renderAll();
        }
      }
    } else if (inputType === 'pen') {
      // draw with pen
      console.log('mdb pen');
      canvas.isDrawingMode = true;
    } else if (inputType === 'mouse') {
      // draw with mouse
      console.log('mdb mouse, draw');
    } else {
      console.log('mdb input type not recognized!');
      throw new Error('input type not recognized!');
    }
  }

  placeTextBox(x, y) {
    const canvas = this.$canvas;
    canvas.add(
      new fabric.IText('Tap and Type', {
        fontFamily: 'Arial',
        // fontWeith: '200',
        fontSize: 15,
        left: x,
        top: y,
      }),
    );
    canvas.isDrawingMode = false;
  }

  handlePinch(e) {
    console.log('hp', e);
    const canvas = this.$canvas;
    console.log('pinch', e, 'pinchingi scale', this.lastScale, e.scale);
    // during pinch, we need to focus top left corner.
    // otherwise canvas might slip underneath the container and misalign.
    let point = null;
    point = new fabric.Point(0, 0);
    // point = new fabric.Point(e.center.x, e.center.y);
    canvas.zoomToPoint(point, this.lastScale * e.scale);
  }

  handlePinchEnd(e) {
    const canvas = this.$canvas;

    console.log('hpe', e);
    this.lastScale = this.lastScale * e.scale;
    console.log('pinchend', this.lastScale, e.scale, e);

    // resize canvas, maybe this fixes eraser
    this.scaledWidth = this.scaledWidth * e.scale;
    this.scaledHeight = this.scaledHeight * e.scale;
    canvas.setWidth(this.scaledWidth);
    canvas.setHeight(this.scaledHeight);

    this.$canvasContainer.width(this.scaledWidth).height(this.scaledHeight);

    // ("width", `${self.width}px`);
    // console.log('zoom100, cc', self.$canvasContainer);

    // reactivate drawing mode after the pinch is over
  }

  handlePanStart(e) {
    const canvas = this.$canvas;
    console.log('panstart', e);

    if (
      e.pointerType === 'touch' &&
      !this.drawWithTouch // pointertype mouse and canvas state mouse-drag
    ) {
      canvas.isDrawingMode = false;
      canvas.isDragging = true;
      canvas.selection = false;
      this.selection = false;

      var scrollContainer = $('#parentContainer').get(0);
      this.startPosX = scrollContainer.scrollLeft;
      this.startPosY = scrollContainer.scrollTop;
    }
  }

  handlePanning(e) {
    const canvas = this.$canvas;
    // console.log('panning', e);

    if (e.pointerType === 'touch') {
      // console.log('pan', e);
      if (canvas.isDragging) {
        // scrolltest
        const panMultiplier = 1.0;
        const dx = this.startPosX - e.deltaX * panMultiplier;
        const dy = this.startPosY - e.deltaY * panMultiplier;
        var scrollContainer = $('#parentContainer');
        scrollContainer.scrollLeft(dx);
        scrollContainer.scrollTop(dy);
        canvas.requestRenderAll();
      }
    }
  }

  async handlePanEnd(e) {
    const canvas = this.$canvas;
    console.log('panend', e);

    if (e.pointerType === 'touch') {
      // take momentum of panning to do it once panning is finished
      // let deltaX = e.deltaX;
      // let deltaY = e.deltaY;
      // for(let v = Math.abs(e.overallVelocity); v>0; v=v-0.1) {
      //   if (deltaX > 0) {
      //     deltaX = e.deltaX + e.deltaX * v;
      //   } else {
      //     deltaX = e.deltaX - e.deltaX * v;
      //   }
      //   deltaY = e.deltaY + e.deltaY * v;
      //   const newEvent = {...e, overallVelocity: v, deltaX, deltaY};
      //   console.log('vel', v, deltaX, deltaY, newEvent);
      //   this.handlePanning(newEvent);
      //   await this.sleep(1000);
      // }

      // on mouse up we want to recalculate new interaction
      // for all objects, so we call setViewportTransform
      // canvas.setViewportTransform(canvas.viewportTransform);
      canvas.isDragging = false;
      canvas.selection = true;

      var scrollContainer = $('#parentContainer').get(0);
      this.startPosX = scrollContainer.scrollLeft;
      this.startPosY = scrollContainer.scrollTop;
    }
  }

  /**
   *
   * @param {FabricPointerEvent} e
   */
  recognizeInput(e) {
    const TOUCH = 'touch';
    const PEN = 'pen';
    const MOUSE = 'mouse';
    // we need to modify fabric.js in order to get the
    // pointerevent and not only the touchevent when using pen
    console.log('recognizeInput Touchevent', e);

    if (e.touches) {
      if (e.touches.length > 1) {
        // most likely pinch, since two fingers, aka touch inputs
        console.log('recognizeInput', TOUCH);
        return TOUCH;
      }
      if (e.touches.length === 1) {
        // now it may be pen or one finger
        const touchEvent = e.touches[0] || {};
        console.log('recognizeInput Touchevent', touchEvent);
        if (touchEvent.radiusX === 0.5 && touchEvent.radiusY === 0.5) {
          // when we have pointer event, we can distinguish between
          // pen (buttons=1) and eraser (buttons=32) <- pointerevent
          // at least on chrome; firefox not supported :-(
          console.log('recognizeInput', PEN);
          return PEN;
        } else {
          console.log('recognizeInput', TOUCH);
          return TOUCH;
        }
      }
    } else {
      console.log('recognizeInput', MOUSE);
      return MOUSE;
    }
  }

  // detect parent div size change
  resizeCanvas() {
    const canvas = this.$canvas;
    const width = this.$parent.width();
    const height = this.$parent.height();
    console.log(`setting canvas to ${width} x ${height}px`);
    // canvas.setWidth(width);
    // canvas.setHeight(height);
    canvas.setWidth(1500);
    canvas.setHeight(1500);
    canvas.renderAll();
  }

  /**
   * Crop the canvas to the surrounding box of all elements on the canvas
   *
    Learnings: we must NOT use fabric.Group, since this messes with items and then
    SVG export is scwed. Items coordinates are not set correctly!
    fabric.Group(items).aCoords does NOT work.
    Therefore we need to get bounding box ourselves
    Note: Or maybe we can use group, destroy and readd everything afterwards:
    http://fabricjs.com/manage-selection
    https://gist.github.com/msievers/6069778#gistcomment-2030151
    https://stackoverflow.com/a/31828460
   */
  async cropCanvas() {
    console.log('cropCanvas');
    const canvas = this.$canvas;

    // get all objects
    const items = canvas.getObjects();
    // get maximum bounding rectangle of all objects
    const bound = { tl: { x: Infinity, y: Infinity }, br: { x: 0, y: 0 } };
    for (let i = 0; i < items.length; i++) {
      // focus on tl/br;
      const item = items[i];
      const tl = item.aCoords.tl;
      const br = item.aCoords.br;
      console.log('cC, item', tl, br);
      if (tl.x < bound.tl.x) {
        bound.tl.x = tl.x;
      }
      if (tl.y < bound.tl.y) {
        bound.tl.y = tl.y;
      }
      if (br.x > bound.br.x) {
        bound.br.x = br.x;
      }
      if (br.y > bound.br.y) {
        bound.br.y = br.y;
      }
    }
    console.log('cC, bounds:', bound);

    // cut area on all sides
    this.transformCanvas('left', -bound.tl.x);
    this.transformCanvas('top', -bound.tl.y);
    this.transformCanvas('right', -(this.width - bound.br.x + bound.tl.x));
    this.transformCanvas('bottom', -(this.height - bound.br.y + bound.tl.y));
  }
}

export { InfiniteCanvas, CanvasState };
