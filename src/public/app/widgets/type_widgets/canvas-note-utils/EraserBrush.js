import _cloneDeep from './lib/lodash.cloneDeep.js';

const EraserBrushFactory = (fabric) => {
  /**
   * ErasedGroup, part of EraserBrush
   *
   * Made it so that the bound is calculated on the original only
   *
   * Note: Might not work with versions other than 3.1.0 / 4.0.0 since it uses some
   * fabric.js overwriting
   *
   * Source: https://github.com/fabricjs/fabric.js/issues/1225#issuecomment-499620550
   */
  const ErasedGroup = fabric.util.createClass(fabric.Group, {
    original: null,
    erasedPath: null,
    initialize: function (original, erasedPath, options, isAlreadyGrouped) {
      this.original = original;
      this.erasedPath = erasedPath;
      this.callSuper(
        'initialize',
        [this.original, this.erasedPath],
        options,
        isAlreadyGrouped,
      );
    },

    _calcBounds: function (onlyWidthHeight) {
      const aX = [],
        aY = [],
        props = ['tr', 'br', 'bl', 'tl'],
        jLen = props.length,
        ignoreZoom = true;

      let o = this.original;
      o.setCoords(ignoreZoom);
      for (let j = 0; j < jLen; j++) {
        const prop = props[j];
        aX.push(o.aCoords[prop].x); // when using dev-fabric js, we need aCoords, in minified oCoords
        aY.push(o.aCoords[prop].y); // when using dev-fabric js, we need aCoords, in minified oCoords
      }

      console.log('_calcBounds', aX, aY, props, jLen, onlyWidthHeight);

      this._getBounds(aX, aY, onlyWidthHeight);
    },
  });

  /**
   * EraserBrush, part of EraserBrush
   *
   * Made it so that the path will be 'merged' with other objects
   * into a customized group and has a 'destination-out' composition
   *
   * Note: Might not work with versions other than 3.1.0 / 4.0.0 since it uses some
   * fabric.js overwriting
   *
   * Source: https://github.com/fabricjs/fabric.js/issues/1225#issuecomment-499620550
   */
  const EraserBrush = fabric.util.createClass(fabric.PencilBrush, {
    /**
     * On mouseup after drawing the path on contextTop canvas
     * we use the points captured to create an new fabric path object
     * and add it to the fabric canvas.
     */
    _finalizeAndAddPath: async function () {
      var ctx = this.canvas.contextTop;
      ctx.closePath();
      if (this.decimate) {
        this._points = this.decimatePoints(this._points, this.decimate);
      }
      var pathData = this.convertPointsToSVGPath(this._points).join('');
      if (pathData === 'M 0 0 Q 0 0 0 0 L 0 0') {
        // do not create 0 width/height paths, as they are
        // rendered inconsistently across browsers
        // Firefox 4, for example, renders a dot,
        // whereas Chrome 10 renders nothing
        this.canvas.requestRenderAll();
        return;
      }

      // use globalCompositeOperation to 'fake' eraser
      var path = this.createPath(pathData);
      path.globalCompositeOperation = 'destination-out';
      path.selectable = false;
      path.evented = false;
      path.absolutePositioned = true;

      // grab all the objects that intersects with the path, filter out objects
      // that are not desired, such as Text and IText
      // otherwise text might get erased (under some circumstances, this might be desired?!)
      const objects = this.canvas.getObjects().filter((obj) => {
        if (obj instanceof fabric.Textbox) return false;
        if (obj instanceof fabric.Text) return false;
        if (obj instanceof fabric.IText) return false;
        // get all objects, that intersect
        // intersectsWithObject(x, absoluteopt=true) <- enables working eraser during zoom
        if (!obj.intersectsWithObject(path, true)) return false;
        return true;
      });

      // async loop to ensure, that first we do the erasing for all objects, and then update canvas
      for (const intersectedObject of objects) {
        // eraserPath is handled by reference later, so we need copy for every intersectedObject
        const eraserPath = _cloneDeep(path);

        // by adding path-object with 'destination-out', it will be 'erased'
        const erasedGroup = new ErasedGroup(intersectedObject, eraserPath);

        const erasedGroupDataURL = erasedGroup.toDataURL({
          withoutTransform: true,
        });
        // Be aware of async behavior!
        const fabricImage = await fabricImageFromURLPromise(erasedGroupDataURL);
        // TODO: If complete path was erased, remove canvas object completely! Right now, an empty image is added
        console.log(eraserPath, erasedGroup, 'fabricimage', fabricImage);
        // console.image(erasedGroupDataURL);
        fabricImage.set({
          left: erasedGroup.left,
          top: erasedGroup.top,
        });

        this.canvas.remove(intersectedObject);
        this.canvas.add(fabricImage);
      }

      this.canvas.renderAll();
      // removes path of eraser
      this.canvas.clearContext(this.canvas.contextTop);
      this._resetShadow();
    },
  });

  /**
   * Promisiefied fromUrl:
   * http://fabricjs.com/docs/fabric.Image.html#.fromURL
   *
   * @param {string} url URL to create an image from
   * @param {object} imgOptionsopt Options object
   */
  const fabricImageFromURLPromise = (url, imgOptionsopt) => {
    return new Promise((resolve) => {
      fabric.Image.fromURL(url, resolve, imgOptionsopt);
    });
  };

  return { EraserBrush, ErasedGroup };
};

export default EraserBrushFactory;
