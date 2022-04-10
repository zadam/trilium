import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";
import sleep from './canvas-note-utils/sleep.js';
import froca from "../../services/froca.js";
import debounce from "./canvas-note-utils/lodash.debounce.js";
import uniqueId from "./canvas-note-utils/lodash.uniqueId.js";

 // NoteContextAwareWidget does not handle loading/refreshing of note context
import NoteContextAwareWidget from "../note_context_aware_widget.js";

const TPL = `
    <div class="canvas-note-widget note-detail-canvas-note note-detail-printable note-detail">
        <style type="text/css">
        .excalidraw .App-menu_top .buttonList {
            /*display: flex;*/
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
 * FIXME: Buttons from one excalidraw get activated. Problems with instance?! (maybe it is only visually, once
 *        mouse is over one instance they change?)
 */
/**
 * FIXME: FONTS from unpkg.com are loaded. Change font to HELVETICA? 
 *        See: https://www.npmjs.com/package/@excalidraw/excalidraw => FONT_FAMILY
 */
/**
 * FIXME: when loading a note, onchangehandler gets fired and then note is automatically saved. this leads to
 *        network overhead, and also sometimes to an empty note, if somehow loading failed, then empty content
 *        is saved.
 */
/**
 * Discussion?: add complete @excalidraw/excalidraw, utils, react, react-dom as library? maybe also node_modules?
 */
export default class ExcalidrawTypeWidget extends TypeWidget {
    constructor() {
        super();

        // config
        this.debounceTimeOnchangeHandler = 750; // ms

        // temporary vars
        this.currentSceneVersion = -1;

        // will be overwritten
        this.excalidrawRef;
        this.$render;
        this.$renderElement;
        this.$widget;
        
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
     * 
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
        this.$renderElement = this.$render.get(0);
        this.log("doRender", this.$widget);

        libraryLoader
            .requireLibrary(libraryLoader.EXCALIDRAW)
            .then(() => {
                this.log("react, react-dom, excalidraw loaded");

                const React = window.React;
                const ReactDOM = window.ReactDOM;
                
                ReactDOM.unmountComponentAtNode(this.$renderElement);
                ReactDOM.render(React.createElement(this.ExcalidrawReactApp), this.$renderElement);

                // FIXME: probably, now, i should manually trigger a refresh?!
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
        // get note from backend and put into canvas
        const noteComplement = await froca.getNoteComplement(note.noteId);
        this.log('doRefresh', note, noteComplement);

        /**
         * before we load content into excalidraw, make sure excalidraw has loaded
         */
        while (!this.excalidrawRef) {
            this.log("doRefresh! excalidrawref not yet loeaded, sleep 200ms...");
            await sleep(200);
        }

        if (this.excalidrawRef.current && noteComplement.content) {
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
                // appState: {},
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
            this.log("doRefresh sceneVersion", window.Excalidraw.getSceneVersion(elements));

            this.excalidrawRef.current.updateScene(sceneData);
            this.excalidrawRef.current.addFiles(fileArray);

            // set initial version
            if (this.currentSceneVersion === -1) {
                this.currentSceneVersion = this.getSceneVersion();
            }
        }
    }

    /**
     * (trilium)
     * gets data from widget container that will be sent via spacedUpdate.scheduleUpdate();
     * this is automatically called after this.saveData();
     */
    getContent() {
        const time = new Date();

        const elements = this.excalidrawRef.current.getSceneElements();
        const appState = this.excalidrawRef.current.getAppState();
        /**
         * FIXME: a file is not deleted, even though removed from canvas
         *        maybe cross-reference elements and files before saving?!
         */
        const files = this.excalidrawRef.current.getFiles();

        const content = {
            elements,
            appState,
            files,
            time
        };

        this.log('getContent()', content);

        return JSON.stringify(content);
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

    /**
     * 
        // FIXME: also, after we save, a refresh is triggered. if we switch too fast, we might get the saved
        //        version instead of our (draw something, activate circle, then refresh happens, circle activation
        //        is revoked)         
     */
    onChangeHandler() {
        this.log("onChangeHandler() =================", new Date(), this.isNewSceneVersion());        
        const appState = this.excalidrawRef.current.getAppState() || {};

        // if cursor is down, rectangle is not yet part of elements. updating and refreshing breaks stuff
        const isCursorUp = appState.cursorButton === "up";
        // changeHandler is called upon any tiny change in excalidraw. button clicked, hover, etc.
        // make sure only when a new element is added, we actually save something.
        const isNewSceneVersion = this.isNewSceneVersion();
        // FIXME: however, we might want to make an exception, if viewport changed, since viewport
        //        is desired to save? (add)

        const shouldSave = isCursorUp && isNewSceneVersion;

        if (shouldSave) {
            this.updateSceneVersion();
            this.saveData();
        } else {
            // do nothing
        }
    }

    ExcalidrawReactApp(handlers) {

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
            // ensure that resize is also called for split creation and deletion
            // not really the problem. problem is saved appState!
            // self.$renderElement.addEventListener("resize", onResize);
            
            return () => window.removeEventListener("resize", onResize);
        }, [excalidrawWrapperRef]);

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
                        this.log("tom", data, event);
                    },
                    // onChange: (elements, state) => {
                    //     this.log("onChange Elements :", elements, "State : ", state)
                    //     debounce(() => {
                    //         this.log('called onChange via throttle');
                    //         self.saveData();
                    //     }, 400);
                    // },
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
        const elements = this.excalidrawRef.current.getSceneElements();
        const sceneVersion = window.Excalidraw.getSceneVersion(elements);
        return sceneVersion;
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
