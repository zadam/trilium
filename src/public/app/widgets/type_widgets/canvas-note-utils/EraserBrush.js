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
            this.callSuper('initialize', [this.original, this.erasedPath], options, isAlreadyGrouped);
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
                aX.push(o.oCoords[prop].x);
                aY.push(o.oCoords[prop].y);
            }

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
        _finalizeAndAddPath: function () {
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

            // grab all the objects that intersects with the path
            const objects = this.canvas.getObjects().filter((obj) => {
                // if (obj instanceof fabric.Textbox) return false;
                // if (obj instanceof fabric.IText) return false;
                if (!obj.intersectsWithObject(path)) return false;
                return true;
            });

            if (objects.length > 0) {

                // merge those objects into a group
                const mergedGroup = new fabric.Group(objects);

                // This will perform the actual 'erasing'
                // NOTE: you can do this for each object, instead of doing it with a merged group
                // however, there will be a visible lag when there's many objects affected by this
                const newPath = new ErasedGroup(mergedGroup, path);

                const left = newPath.left;
                const top = newPath.top;

                // convert it into a dataURL, then back to a fabric image
                const newData = newPath.toDataURL({
                    withoutTransform: true
                });
                fabric.Image.fromURL(newData, (fabricImage) => {
                    fabricImage.set({
                        left: left,
                        top: top,
                    });

                    // remove the old objects then add the new image
                    this.canvas.remove(...objects);
                    this.canvas.add(fabricImage);
                });
            }

            this.canvas.clearContext(this.canvas.contextTop);
            this.canvas.renderAll();
            this._resetShadow();
        },
    });

    return {EraserBrush, ErasedGroup};
};

export default EraserBrushFactory;
