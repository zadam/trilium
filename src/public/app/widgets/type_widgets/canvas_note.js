import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";
import sleep from './canvas-note-utils/sleep.js';
import froca from "../../services/froca.js";
import debounce from "./canvas-note-utils/lodash.debounce.js";
import uniqueId from "./canvas-note-utils/lodash.uniqueId.js";
import replaceExternalAssets from "./canvas-note-utils/replaceExternalAssets.js";

const TPL = `
    <div class="canvas-note-widget note-detail-canvas-note note-detail-printable note-detail">
        <style type="text/css">
        .excalidraw .App-menu_top .buttonList {
            display: flex;
        }

        .excalidraw-wrapper {
            height: 100%;
        }

        :root[dir="ltr"]
        .excalidraw
        .layer-ui__wrapper
        .zen-mode-transition.App-menu_bottom--transition-left {
            transform: none;
        }

        </style>
        <!-- height here necessary. otherwise excalidraw not shown -->
        <div class="canvas-note-render" style="height: 100%"></div>
    </div>
`;

/**
 * ## Excalidraw and SVG
 * 2022-04-16 - @thfrei
 * 
 * Known issues:
 *  - excalidraw-to-svg (node.js) does not render any hand drawn (freedraw) paths. There is an issue with 
 *    Path2D object not present in node-canvas library used by jsdom. (See Trilium PR for samples and other issues 
 *    in respective library. Link will be added later). Related links:
 *     - https://github.com/Automattic/node-canvas/pull/2013
 *     - https://github.com/google/canvas-5-polyfill 
 *     - https://github.com/Automattic/node-canvas/issues/1116 
 *     - https://www.npmjs.com/package/path2d-polyfill 
 *  - excalidraw-to-svg (node.js) takes quite some time to load an image (1-2s)
 *  - excalidraw-utils (browser) does render freedraw, however NOT freedraw with background
 * 
 * Due to this issues, we opt to use **only excalidraw in the frontend**. Upon saving, we will also get the SVG
 * output from the live excalidraw instance. We will save this **SVG side by side the native excalidraw format
 * in the trilium note**.
 * 
 * Pro: we will combat bit-rot. Showing the SVG will be very fast, since it is already rendered.
 * Con: The note will get bigger (maybe +30%?), we will generate more bandwith. 
 *      (However, using trilium desktop instance, does not care too much about bandwidth. Size increase is probably
 *       acceptable, as a trade off.)
 */
export default class ExcalidrawTypeWidget extends TypeWidget {
    constructor() {
        super();

        // config
        this.debounceTimeOnchangeHandler = 750; // ms
        // ensure that assets are loaded from trilium
        window.EXCALIDRAW_ASSET_PATH = `${window.location.origin}/node_modules/@excalidraw/excalidraw/dist/`;

        // temporary vars
        this.currentNoteId = "";
        this.currentSceneVersion = -1;

        // will be overwritten
        this.excalidrawRef;
        this.$render;
        this.renderElement;
        this.$widget;
        this.reactHandlers; // used to control react state
        
        this.ExcalidrawReactApp = this.ExcalidrawReactApp.bind(this);
        this.doRefresh = this.doRefresh.bind(this);
        this.getContent = this.getContent.bind(this);
        this.saveData = this.saveData.bind(this);
        this.refreshWithNote = this.refreshWithNote.bind(this);
        this.onChangeHandler = this.onChangeHandler.bind(this);
        this.isNewSceneVersion = this.isNewSceneVersion.bind(this);
        this.updateSceneVersion = this.updateSceneVersion.bind(this);
        this.getSceneVersion = this.getSceneVersion.bind(this);

        // debugging helper - delete this block or comment
        this.uniqueId = uniqueId();
        console.log("uniqueId", this.uniqueId);
        if (!window.triliumexcalidraw) {
            window.triliumexcalidraw = [];
        }
        window.triliumexcalidraw[this.uniqueId] = this;
        // end debug
    }

    /**
     * (trilium)
     * @returns {string} "canvas-note"
     */
    static getType() {
        return "canvas-note";
    }

    /**
     * (trilium)
     * renders note
     */
    doRender() {
        this.$widget = $(TPL);

        // leads to contain: none
        // https://developer.mozilla.org/en-US/docs/Web/CSS/contain
        // this.contentSized();
        this.$widget.toggleClass("full-height", true); // only add
        this.$render = this.$widget.find('.canvas-note-render');
        this.renderElement = this.$render.get(0);
        // this.log("doRender", this.$widget);

        libraryLoader
            .requireLibrary(libraryLoader.EXCALIDRAW)
            .then(() => {
                this.log("react, react-dom, excalidraw loaded");

                const React = window.React;
                const ReactDOM = window.ReactDOM;
                
                ReactDOM.unmountComponentAtNode(this.renderElement);
                ReactDOM.render(React.createElement(this.ExcalidrawReactApp), this.renderElement);
            })

        return this.$widget;
    }

    /**
     * (trilium)
     * called to populate the widget container with the note content
     * 
     * @param {note} note 
     */
    async doRefresh(note) {
        // see if note changed, since we do not get a new class for a new note
        // this.log("doRefresh note", this.currentNoteId, note.noteId);
        const noteChanged = this.currentNoteId !== note.noteId;
        if (noteChanged) {
            // this.log("doRefresh resetCurrentSceneVersion = -1");
            // reset scene to omit unnecessary onchange handler
            this.currentSceneVersion = -1;
        }
        this.currentNoteId = note.noteId;
        
        // get note from backend and put into canvas
        const noteComplement = await froca.getNoteComplement(note.noteId);
        // this.log('doRefresh', note, noteComplement);

        /**
         * before we load content into excalidraw, make sure excalidraw has loaded
         */
        while (!this.excalidrawRef || !this.excalidrawRef.current) {
            this.log("doRefresh! excalidrawref not yet loeaded, sleep 200ms...");
            await sleep(200);
        }

        /**
         * new and empty note - make sure that canvas is empty.
         * If we do not set it manually, we occasionally get some "bleeding" from another
         * note into this fresh note. Probably due to that this note-instance does not get
         * newly instantiated?
         */
        if (this.excalidrawRef.current && noteComplement.content === "") {
            const sceneData = {
                elements: [], 
                appState: {},
                collaborators: []
            };
            
            this.excalidrawRef.current.updateScene(sceneData);
        }

        /**
         * load saved content into excalidraw canvas
         */
        else if (this.excalidrawRef.current && noteComplement.content) {
            try {
                const content = JSON.parse(noteComplement.content || "");
                
                const {elements, appState, files} = content;

                /**
                 * use widths and offsets of current view, since stored appState has the state from
                 * previous edit. using the stored state would lead to pointer mismatch.
                 */
                const boundingClientRect = this.excalidrawWrapperRef.current.getBoundingClientRect();
                appState.width = boundingClientRect.width;
                appState.height = boundingClientRect.height;
                appState.offsetLeft = boundingClientRect.left;
                appState.offsetTop = boundingClientRect.top;

                const sceneData = {
                    elements, 
                    appState,
                    collaborators: []
                };

                // files are expected in an array when loading. they are stored as an key-index object
                // see example for loading here:
                // https://github.com/excalidraw/excalidraw/blob/c5a7723185f6ca05e0ceb0b0d45c4e3fbcb81b2a/src/packages/excalidraw/example/App.js#L68
                const fileArray = [];
                for (const fileId in files) {
                    const file = files[fileId];
                    // TODO: dataURL is replaceable with a trilium image url
                    //       maybe we can save normal images (pasted) with base64 data url, and trilium images
                    //       with their respective url! nice
                    // file.dataURL = "http://localhost:8080/api/images/ltjOiU8nwoZx/start.png";
                    fileArray.push(file);
                }

                this.log("doRefresh(note) sceneData, files", sceneData, files, fileArray);

                this.sceneVersion = window.Excalidraw.getSceneVersion(elements);

                this.excalidrawRef.current.updateScene(sceneData);
                this.excalidrawRef.current.addFiles(fileArray);
            } catch(err) {
                console.error("Error (note, noteComplement, err)", note, noteComplement, err);
            }
        }
        
        // set initial scene version
        if (this.currentSceneVersion === -1) {
            this.currentSceneVersion = this.getSceneVersion();
        }
    }

    /**
     * (trilium)
     * gets data from widget container that will be sent via spacedUpdate.scheduleUpdate();
     * this is automatically called after this.saveData();
     */
    async getContent() {
        const elements = this.excalidrawRef.current.getSceneElements();
        const appState = this.excalidrawRef.current.getAppState();
        
        /**
         * A file is not deleted, even though removed from canvas. therefore we only keep
         * files that are referenced by an element. Maybe this will change with new excalidraw version?
         */
        const files = this.excalidrawRef.current.getFiles();
        
        /**
         * parallel svg export to combat bitrot and enable rendering image for note inclusion,
         * preview and share.
         */
        const svg = await window.Excalidraw.exportToSvg({
            elements,
            appState,
            exportPadding: 5, // 5 px padding
            metadata: 'trilium-export',
            files
        });
        const svgString = svg.outerHTML;

        /**
         * workaround until https://github.com/excalidraw/excalidraw/pull/5065 is merged and published
         */
        const svgSafeString = replaceExternalAssets(svgString);

        const activeFiles = {};
        elements.forEach((element) => {
            if (element.fileId) {
                activeFiles[element.fileId] = files[element.fileId];
            }
        })

        const content = {
            _meta: "This note has type `canvas-note`. It uses excalidraw and stores an exported svg alongside.",
            elements, // excalidraw
            appState, // excalidraw
            files: activeFiles, // excalidraw
            svg: svgSafeString, // not needed for excalidraw, used for note_short, content, and image api
        };

        const contentString = JSON.stringify(content);
        this.log("getContent note size content.svg/content", `~${content.svg.length/1024}kB/${contentString.length/1024}kB`, content.svg.length/contentString.length, "% of svg");

        return contentString;
    }

    /**
     * (trilium)
     * save content to backend
     * spacedUpdate is kind of a debouncer.
     */
    saveData() {
        this.log("saveData()");
        this.spacedUpdate.scheduleUpdate();
    }

    onChangeHandler() {
        this.log("onChangeHandler() =================", new Date(), this.isNewSceneVersion());        
        const appState = this.excalidrawRef.current.getAppState() || {};

        // changeHandler is called upon any tiny change in excalidraw. button clicked, hover, etc.
        // make sure only when a new element is added, we actually save something.
        const isNewSceneVersion = this.isNewSceneVersion();
        /**
         * FIXME: however, we might want to make an exception, if viewport changed, since viewport
         *        is desired to save? (add) and appState background, and some things
         */

        // upon updateScene, onchange is called, even though "nothing really changed" that is worth saving
        const isNotInitialScene = this.currentSceneVersion !== -1;

        const shouldSave = isNewSceneVersion && isNotInitialScene;

        if (shouldSave) {
            this.updateSceneVersion();
            this.saveData();
        } else {
            // do nothing
        }
    }

    ExcalidrawReactApp() {
        const React = window.React;
        const Excalidraw = window.Excalidraw;

        const excalidrawRef = React.useRef(null);
        this.excalidrawRef = excalidrawRef;
        const excalidrawWrapperRef = React.useRef(null);
        this.excalidrawWrapperRef = excalidrawWrapperRef;
        const [dimensions, setDimensions] = React.useState({
            width: undefined,
            height: undefined
        });

        const [viewModeEnabled, setViewModeEnabled] = React.useState(false);
        const [zenModeEnabled, setZenModeEnabled] = React.useState(false);
        const [gridModeEnabled, setGridModeEnabled] = React.useState(false);
        const [synchronized, setSynchronized] = React.useState(true);
        
        React.useEffect(() => {
            const dimensions = {
                width: excalidrawWrapperRef.current.getBoundingClientRect().width,
                height: excalidrawWrapperRef.current.getBoundingClientRect().height
            };
            this.log('effect, setdimensions', dimensions);
            setDimensions(dimensions);

            const onResize = () => {
                const dimensions = {
                    width: excalidrawWrapperRef.current.getBoundingClientRect().width,
                    height: excalidrawWrapperRef.current.getBoundingClientRect().height
                };
                this.log('onResize, setdimensions', dimensions);
                setDimensions(dimensions);
            };
            
            window.addEventListener("resize", onResize);
            
            return () => window.removeEventListener("resize", onResize);
        }, [excalidrawWrapperRef]);

        const onLinkOpen = React.useCallback((element, event) => {
            const link = element.link;
            const { nativeEvent } = event.detail;
            const isNewTab = nativeEvent.ctrlKey || nativeEvent.metaKey;
            const isNewWindow = nativeEvent.shiftKey;
            const isInternalLink =
                link.startsWith("/") || link.includes(window.location.origin);
                
            this.log("onLinkOpen", element, event, nativeEvent, "isinternallink", isInternalLink);

            if (isInternalLink && !isNewTab && !isNewWindow) {
                // signal that we're handling the redirect ourselves
                event.preventDefault();
                // do a custom redirect, such as passing to react-router
                // ...
            } else {
                // open in same tab
            }
          }, []);

        return React.createElement(
            React.Fragment,
            null,
            React.createElement(
                "div",
                {
                    className: "excalidraw-wrapper",
                    ref: excalidrawWrapperRef
                },
                React.createElement(Excalidraw.default, {
                    ref: excalidrawRef,
                    width: dimensions.width,
                    height: dimensions.height,
                    // initialData: InitialData,
                    onPaste: (data, event) => {
                        this.log("excalidraw internal paste", data, event);
                    },
                    onChange: debounce(this.onChangeHandler, this.debounceTimeOnchangeHandler),
                    // onPointerUpdate: (payload) => console.log(payload),
                    onCollabButtonClick: () => {
                        window.alert("You clicked on collab button")
                    },
                    viewModeEnabled: viewModeEnabled,
                    zenModeEnabled: zenModeEnabled,
                    gridModeEnabled: gridModeEnabled,
                    isCollaborating: false,
                    detectScroll: false,
                    handleKeyboardGlobally: false,
                    autoFocus: true,
                    onLinkOpen,
                })
            )
        );
    }    

    /**
     * needed to ensure, that multipleOnChangeHandler calls do not trigger a safe.
     * we compare the scene version as suggested in:
     * https://github.com/excalidraw/excalidraw/issues/3014#issuecomment-778115329
     * 
     * info: sceneVersions are not incrementing. it seems to be a pseudo-random number
     */
     isNewSceneVersion() {
        const sceneVersion = this.getSceneVersion();
        // this.log("isNewSceneVersion()", this.currentSceneVersion, sceneVersion);
        if (
            this.currentSceneVersion === -1     // initial scene version update
            || this.currentSceneVersion !== sceneVersion
            ) {
            return true;
        } else {
            return false;
        }
    }

    getSceneVersion() {
        if (this.excalidrawRef) {
            const elements = this.excalidrawRef.current.getSceneElements();
            const sceneVersion = window.Excalidraw.getSceneVersion(elements);
            return sceneVersion;
        } else {
            return -2;
        }
    }

    updateSceneVersion() {
        this.currentSceneVersion = this.getSceneVersion();
    }
    
    /**
     * logs to console.log with some predefined title
     * 
     * @param  {...any} args 
     */
    log(...args) {
        let title = '';
        if (this.note) {
            title = this.note.title;
        } else {
            title = this.noteId + "nt/na";
        }

        console.log(title, "=", this.noteId, "==",  ...args);
    }
}
