import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";
import EraserBrushFactory from './canvas-note-utils/EraserBrush.js';


const TPL = `
<div class="note-detail-canvas-note note-detail-printable">
    
    <style>
    #drawing-mode {
      margin-bottom: 10px;
      vertical-align: top;
    }
    #drawing-mode-options {
        position: relative;
      display: inline-block;
      vertical-align: top;
      margin-bottom: 10px;
      margin-top: 10px;
      background: #f5f2f0;
      padding: 10px;
    }
    label {
      display: inline-block; width: 130px;
    }
    .info {
      display: inline-block;
      width: 25px;
      background: #ffc;
    }
    #bd-wrapper {
      min-width: 1500px;
    }
    </style>
    <div id="drawing-mode-options">
    <label for="drawing-mode-selector">Mode:</label>
    <select id="drawing-mode-selector">
      <option>Pencil</option>
      <option>Circle</option>
      <option>Spray</option>
      <option>Pattern</option>
      <option>Eraser</option>
    </select><br>

    <label for="drawing-line-width">Line width:</label>
    <span class="info">30</span><input type="range" value="30" min="0" max="150" id="drawing-line-width"><br>

    <label for="drawing-color">Line color:</label>
    <input type="color" value="#005E7A" id="drawing-color"><br>

    <label for="drawing-shadow-color">Shadow color:</label>
    <input type="color" value="#005E7A" id="drawing-shadow-color"><br>

    <label for="drawing-shadow-width">Shadow width:</label>
    <span class="info">0</span><input type="range" value="0" min="0" max="50" id="drawing-shadow-width"><br>

    <label for="drawing-shadow-offset">Shadow offset:</label>
    <span class="info">0</span><input type="range" value="0" min="0" max="50" id="drawing-shadow-offset"><br>
  </div>
    <div style="display: block; position: relative; margin-left: 10px">
      <button id="drawing-mode" class="btn btn-info">Cancel drawing mode</button>
      <button id="clear-canvas" class="btn btn-info">Clear</button>
      <button id="save-canvas" class="btn btn-info">Save</button>
      <button id="refresh-canvas" class="btn btn-info">Refresh</button>
      <button id="undo"><-</button>
      <button id="redo">-></button>
    
    </div>
    <div id="canvasWrapper" style="display: inline-block; background-color: red; border: 3px double black">
    <canvas id="c" style="border:1px solid #aaa; position: absolute; touch-action:none; user-select: none;"></canvas>
    </div>
</div>`;

export default class CanvasNoteTypeWidget extends TypeWidget {
    static getType() {
        return "canvas-note";
    }

    doRender() {
        this.$widget = $(TPL);

        libraryLoader
            .requireLibrary(libraryLoader.CANVAS_NOTE)
            .then(() => {
                console.log("fabric.js-loaded")
                this.initFabric();
            });

        return this.$widget;
    }

    async doRefresh(note) {
        const noteComplement = await this.tabContext.getNoteComplement();
        if (this.__canvas && noteComplement.content) {
            this.__canvas.loadFromJSON(noteComplement.content);
        }
        console.log('doRefresh', note, noteComplement);
    }

    /**
     * Function gets data that will be sent via spacedUpdate.scheduleUpdate();
     */
    getContent() {
        const content = JSON.stringify(this.__canvas.toJSON());
        console.log('gC', content);
        return content;
    }

    saveData() {
        this.spacedUpdate.scheduleUpdate();
    }

    initFabric() {
        const self = this;
        const canvas = this.__canvas = new fabric.Canvas('c', {
            isDrawingMode: true
        });
        fabric.Object.prototype.transparentCorners = false;

        canvas.on('after:render', () => {
            self.saveData();
        });

        window.addEventListener('resize', resizeCanvas, false);

        function resizeCanvas() {
            const width = $('.note-detail-canvas-note').width();
            const height = $('.note-detail-canvas-note').height()
            console.log(`setting canvas to ${width} x ${height}px`)
            canvas.setWidth(width);
            canvas.setHeight(height);
            canvas.renderAll();
        }

        // resize on init
        resizeCanvas();

        const {EraserBrush} = EraserBrushFactory(fabric);

        var drawingModeEl = $('#drawing-mode'),
            drawingOptionsEl = $('#drawing-mode-options'),
            drawingColorEl = $('#drawing-color'),
            drawingShadowColorEl = $('#drawing-shadow-color'),
            drawingLineWidthEl = $('#drawing-line-width'),
            drawingShadowWidth = $('#drawing-shadow-width'),
            drawingShadowOffset = $('#drawing-shadow-offset'),
            saveCanvas = $('#save-canvas'),
            refreshCanvas = $('#refresh-canvas'),
            clearEl = $('#clear-canvas'),
            undo = $('#undo'),
            redo = $('#redo')
        ;

        const deletedItems = [];

        undo.on('click', function () {
            // Source: https://stackoverflow.com/a/28666556
            var lastItemIndex = (canvas.getObjects().length - 1);
            var item = canvas.item(lastItemIndex);

            deletedItems.push(item);
            // if(item.get('type') === 'path') {
            canvas.remove(item);
            canvas.renderAll();
            // }
        })

        redo.on('click', function () {
            const lastItem = deletedItems.pop();
            if (lastItem) {
                canvas.add(lastItem);
                canvas.renderAll();
            }
        })

        clearEl.on('click', function () {
            console.log('cE-oC');
            canvas.clear()
        });

        saveCanvas.on('click', function () {
            console.log('sC-oC');
            const canvasContent = canvas.toJSON();
            console.log('Canvas JSON', canvasContent);
            self.saveData();
        });
        refreshCanvas.on('click', function () {
            console.log('rC-oC');
            self.doRefresh('no note entity needed for refresh, only noteComplement');
        });
        drawingModeEl.on('click', function () {
            canvas.isDrawingMode = !canvas.isDrawingMode;
            if (canvas.isDrawingMode) {
                drawingModeEl.html('Cancel drawing mode');
                drawingOptionsEl.css('display', '');
            } else {
                drawingModeEl.html('Enter drawing mode');
                drawingOptionsEl.css('display', 'none');
            }
        });
        //
        // if (fabric.PatternBrush) {
        //     var vLinePatternBrush = new fabric.PatternBrush(canvas);
        //     vLinePatternBrush.getPatternSrc = function () {
        //
        //         var patternCanvas = fabric.document.createElement('canvas');
        //         patternCanvas.width = patternCanvas.height = 10;
        //         var ctx = patternCanvas.getContext('2d');
        //
        //         ctx.strokeStyle = this.color;
        //         ctx.lineWidth = 5;
        //         ctx.beginPath();
        //         ctx.moveTo(0, 5);
        //         ctx.lineTo(10, 5);
        //         ctx.closePath();
        //         ctx.stroke();
        //
        //         return patternCanvas;
        //     };
        //
        //     var hLinePatternBrush = new fabric.PatternBrush(canvas);
        //     hLinePatternBrush.getPatternSrc = function () {
        //
        //         var patternCanvas = fabric.document.createElement('canvas');
        //         patternCanvas.width = patternCanvas.height = 10;
        //         var ctx = patternCanvas.getContext('2d');
        //
        //         ctx.strokeStyle = this.color;
        //         ctx.lineWidth = 5;
        //         ctx.beginPath();
        //         ctx.moveTo(5, 0);
        //         ctx.lineTo(5, 10);
        //         ctx.closePath();
        //         ctx.stroke();
        //
        //         return patternCanvas;
        //     };
        //
        //     var squarePatternBrush = new fabric.PatternBrush(canvas);
        //     squarePatternBrush.getPatternSrc = function () {
        //
        //         var squareWidth = 10, squareDistance = 2;
        //
        //         var patternCanvas = fabric.document.createElement('canvas');
        //         patternCanvas.width = patternCanvas.height = squareWidth + squareDistance;
        //         var ctx = patternCanvas.getContext('2d');
        //
        //         ctx.fillStyle = this.color;
        //         ctx.fillRect(0, 0, squareWidth, squareWidth);
        //
        //         return patternCanvas;
        //     };
        //
        //     var diamondPatternBrush = new fabric.PatternBrush(canvas);
        //     diamondPatternBrush.getPatternSrc = function () {
        //
        //         var squareWidth = 10, squareDistance = 5;
        //         var patternCanvas = fabric.document.createElement('canvas');
        //         var rect = new fabric.Rect({
        //             width: squareWidth,
        //             height: squareWidth,
        //             angle: 45,
        //             fill: this.color
        //         });
        //
        //         var canvasWidth = rect.getBoundingRect().width;
        //
        //         patternCanvas.width = patternCanvas.height = canvasWidth + squareDistance;
        //         rect.set({left: canvasWidth / 2, top: canvasWidth / 2});
        //
        //         var ctx = patternCanvas.getContext('2d');
        //         rect.render(ctx);
        //
        //         return patternCanvas;
        //     };
        //
        //     // var img = new Image();
        //     // img.src = './libraries/canvas-note/honey_im_subtle.png';
        //
        //     // var texturePatternBrush = new fabric.PatternBrush(canvas);
        //     // texturePatternBrush.source = img;
        // }

        $('#drawing-mode-selector').change(function () {
            if (false) {
            }
                // else if (this.value === 'hline') {
                //     canvas.freeDrawingBrush = vLinePatternBrush;
                // } else if (this.value === 'vline') {
                //     canvas.freeDrawingBrush = hLinePatternBrush;
                // } else if (this.value === 'square') {
                //     canvas.freeDrawingBrush = squarePatternBrush;
                // } else if (this.value === 'diamond') {
                //     canvas.freeDrawingBrush = diamondPatternBrush;
                // }
                // else if (this.value === 'texture') {
                //   canvas.freeDrawingBrush = texturePatternBrush;
            // }
            else if (this.value === "Eraser") {
                // to use it, just set the brush
                const eraserBrush = new EraserBrush(canvas);
                eraserBrush.width = parseInt(drawingLineWidthEl.val(), 10) || 1;
                eraserBrush.color = 'rgb(236,195,195)'; // erser works with opacity!
                canvas.freeDrawingBrush = eraserBrush;
                canvas.isDrawingMode = true;
            } else {
                canvas.freeDrawingBrush = new fabric[this.value + 'Brush'](canvas);
                canvas.freeDrawingBrush.color = drawingColorEl.val();
                canvas.freeDrawingBrush.width = parseInt(drawingLineWidthEl.val(), 10) || 1;
                canvas.freeDrawingBrush.shadow = new fabric.Shadow({
                    blur: parseInt(drawingShadowWidth.val(), 10) || 0,
                    offsetX: 0,
                    offsetY: 0,
                    affectStroke: true,
                    color: drawingShadowColorEl.val(),
                });
            }


        });

        drawingColorEl.change(function () {
            canvas.freeDrawingBrush.color = this.value;
        });
        drawingShadowColorEl.change(function () {
            canvas.freeDrawingBrush.shadow.color = this.value;
        })
        drawingLineWidthEl.change(function () {
            canvas.freeDrawingBrush.width = parseInt(this.value, 10) || 1;
            drawingLineWidthEl.prev().html(this.value);
        });
        drawingShadowWidth.change(function () {
            canvas.freeDrawingBrush.shadow.blur = parseInt(this.value, 10) || 0;
            drawingShadowWidth.prev().html(this.value);
        });
        drawingShadowOffset.change(function () {
            canvas.freeDrawingBrush.shadow.offsetX = parseInt(this.value, 10) || 0;
            canvas.freeDrawingBrush.shadow.offsetY = parseInt(this.value, 10) || 0;
            drawingShadowOffset.prev().html(this.value);
        })

        if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = drawingColorEl.value;
            canvas.freeDrawingBrush.width = parseInt(drawingLineWidthEl.value, 10) || 1;
            canvas.freeDrawingBrush.shadow = new fabric.Shadow({
                blur: parseInt(drawingShadowWidth.value, 10) || 0,
                offsetX: 0,
                offsetY: 0,
                affectStroke: true,
                color: drawingShadowColorEl.value,
            });
        }
    }
}

