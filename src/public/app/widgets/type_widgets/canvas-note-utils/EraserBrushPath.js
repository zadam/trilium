const EraserBrushPathFactory = (fabric) => {
  /**
   * EraserBrushPath, part of EraserBrushPath
   *
   * Made it so that the path will be 'merged' with other objects
   * into a customized group and has a 'destination-out' composition
   *
   * Note: Might not work with versions other than 3.1.0 / 4.0.0 since it uses some
   * fabric.js overwriting
   *
   * Source: https://github.com/fabricjs/fabric.js/issues/1225#issuecomment-499620550
   */
  const EraserBrushPath = fabric.util.createClass(fabric.PencilBrush, {
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
        // intersectsWithObject(x, absoluteopt=true) <- enables working eraser during zoom
        if (!obj.intersectsWithObject(path, true)) return false;
        return true;
      });

      // async loop to ensure, that first we do the erasing for all objects, and then update canvas
      for (const intersectedObject of objects) {
        this.canvas.remove(intersectedObject);
      }

      this.canvas.renderAll();
      // removes path of eraser
      this.canvas.clearContext(this.canvas.contextTop);
      this._resetShadow();
    },
  });

  return { EraserBrushPath };
};

export default EraserBrushPathFactory;
