import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";
import { InfiniteCanvas } from './canvas-note-utils/infinite-drawing-canvas.js';

import { initButtons, initPens } from './canvas-note-utils/gui.js';
import _debounce from './canvas-note-utils/lib/lodash.debounce.js';

const TPL = `
    <div 
        id="parentContainer" 
        class="note-detail-canvas-note note-detail-printable"
        style="overflow:auto; width: 100%; height: 70%; background-color: rgba(255,248,230,0.58); border: 1px double #efefef;"
    >
    <div id="canvasContainer" style="width: 1500px; height: 1500px;">
        <canvas id="c" class="canvasElement" style="border:1px solid #aaa; width: 1500px; height: 1500px"></canvas>
    </div>
    <br />
    </div>
  
    <div id="pens-and-markers">
    <!--    Drawing:-->
    <!--    <button id="undo" disabled><i class='bx bx-undo'></i></button>-->
    <!--    <button id="redo" disabled><i class='bx bx-redo'></i></button>-->
    Pens:
    <button id="pen-1" class="btn btn-info"><i class='bx bx-pencil' style="border-left: 3px solid black"></i></button>
    <button id="pen-2" class="btn btn-info"><i class='bx bx-pencil' style="border-left: 3px solid red"></i></button>
    <button id="pen-3" class="btn btn-info"><i class='bx bx-pencil' style="border-left: 3px solid green"></i></button>
    <button id="pen-4" class="btn btn-info"><i class='bx bx-pencil' style="border-left: 3px solid blue"></i></button>
    <button id="marker-1" class="btn btn-info"><i class='bx bx-pen' style="border-left: 7px solid yellow"></i></button>
    <button id="marker-2" class="btn btn-info"><i class='bx bx-pen' style="border-left: 7px solid wheat"></i></button>
    <button id="marker-3" class="btn btn-info"><i class='bx bx-pen'
        style="border-left: 7px solid rgba(51,204,0, 0.5)"></i></button>
    <button id="marker-4" class="btn btn-info"><i class='bx bx-pen' style="border-left: 7px solid skyblue"></i></button>
    <button id="eraser" class="btn btn-info"><i class='bx bx-eraser' style="border-left: 7px solid black"></i></button>
    <button id="eraser-path" class="btn btn-info"><i class='bx bx-eraser' style="border-left: 7px dashed rgba(236,195,220, 20)"><i class='bx bx-shape-polygon' ></i></i></button>
    Shapes:
    <button id="text-1" class="btn btn-info"><i class='bx bx-text' style="border-left: 3px solid black"></i></button>
    <br />
    Mode:
    <button id="mode-select" class="btn btn-info"><i class='bx bx-pointer'></i></button>
    <!-- <button id="mode-1" class="btn btn-info"><i class='bx bx-mouse'></i></button> -->
    <button id="mode-drawWithTouch" class="btn btn-info"><i class='bx bxs-hand-up'></i> Draw with Touch</button>
    <!-- <button id="mode-3" class="btn btn-info"><i class='bx bx-stats'></i>Pen-Touch-Mouse</button> -->
    <br />
    Canvas:
    Enlarge <input type="number" value=100 id="enlargeValue" style="width: 60px" />px
    <button id="enlarge-left" class="btn btn-info"><i class='bx bxs-dock-left'></i></button>
    <button id="enlarge-top" class="btn btn-info"><i class='bx bxs-dock-left bx-rotate-90' ></i></button>
    <button id="enlarge-bottom" class="btn btn-info"><i class='bx bxs-dock-left bx-rotate-270' ></i></button>
    <button id="enlarge-right" class="btn btn-info"><i class='bx bxs-dock-left bx-rotate-180' ></i></button>
    Crop: 
    <button id="crop-canvas" class="btn btn-info"><i class='bx bx-crop'></i></button>
    <br />
    <button id="zoom-100" class="btn btn-info">Zoom 100%</button>
    <button id="clear-canvas" class="btn btn-info">Clear</button>
  </div>
  
    <style>
        .note-detail {
            height: 100%;
        }
    </style>
`;

export default class CanvasNoteTypeWidget extends TypeWidget {
    constructor() {
        super();

        this.initCanvas = this.initCanvas.bind(this);
        this.saveData = this.saveData.bind(this);
        this.getContent = this.getContent.bind(this);
        this.doRefresh = this.doRefresh.bind(this);
    }
    static getType() {
        return "canvas-note";
    }

    doRender() {
        this.$widget = $(TPL);

        libraryLoader
            .requireLibrary(libraryLoader.CANVAS_NOTE)
            .then(() => {
                console.log("fabric.js-loaded")
                this.initCanvas();
            })
            .then(async () => {
                const noteComplement = await this.tabContext.getNoteComplement();
                if (this.infiniteCanvas && noteComplement.content) {
                    const content = JSON.parse(noteComplement.content || "");
                    await this.infiniteCanvas.setInfiniteCanvas(content);
                }
                this.canvas.on('after:render', _debounce(this.saveData, 1000));
            });

        return this.$widget;
    }

    async doRefresh(note) {
        // get note from backend and put into canvas
        const noteComplement = await this.tabContext.getNoteComplement();
        if (this.infiniteCanvas && noteComplement.content) {
            const content = JSON.parse(noteComplement.content || "");
            await this.infiniteCanvas.setInfiniteCanvas(content);
        }
        console.log('doRefresh', note, noteComplement);
    }

    /**
     * Function gets data that will be sent via spacedUpdate.scheduleUpdate();
     */
    getContent() {
        const content = this.infiniteCanvas.getInfiniteCanvas();
        console.log('gC', content);
        return JSON.stringify(content);
    }

    saveData() {
        this.spacedUpdate.scheduleUpdate();
    }

    initCanvas() {
        const myCanvas = new InfiniteCanvas(
            $('.canvasElement'),
            $('#parentContainer'),
            $('#canvasContainer'),
        );

        this.infiniteCanvas = myCanvas.initFabric();
        this.canvas = this.infiniteCanvas.$canvas;
        // this.canvas.clear();

        this.canvas.setWidth(myCanvas.width);
        this.canvas.setHeight(myCanvas.height);

        // Buttons
        initButtons(this.infiniteCanvas);
        initPens(this.infiniteCanvas);
    }
}

