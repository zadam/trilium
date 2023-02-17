import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import utils from '../../services/utils.js';
import froca from "../../services/froca.js";
import debounce from "../../services/debounce.js";

const {sleep} = utils;

const TPL = `
    <div class="canvas-widget note-detail-canvas note-detail-printable note-detail">
        <style>
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
        
        /* collaboration not possible so hide the button */
        .CollabButton {
            display: none !important;
        }

        </style>
        <!-- height here necessary. otherwise excalidraw not shown -->
        <div class="canvas-render" style="height: 100%"></div>
    </div>
`;

/**
 * # Canvas note with excalidraw
 * @author thfrei 2022-05-11
 *
 * Background:
 * excalidraw gives great support for hand drawn notes. It also allows to include images and support
 * for sketching. Excalidraw has a vibrant and active community.
 *
 * Functionality:
 * We store the excalidraw assets (elements, appState, files) in the note. In addition to that, we
 * export the SVG from the canvas on every update. The SVG is also saved in the note. It is used when
 * calling api/images and makes referencing very easy.
 *
 * Paths not taken.
 *  - excalidraw-to-svg (node.js) could be used to avoid storing the svg in the backend.
 *    We could render the SVG on the fly. However, as of now, it does not render any hand drawn
 *    (freedraw) paths. There is an issue with Path2D object not present in node-canvas library
 *    used by jsdom. (See Trilium PR for samples and other issues in respective library.
 *    Link will be added later). Related links:
 *     - https://github.com/Automattic/node-canvas/pull/2013
 *     - https://github.com/google/canvas-5-polyfill
 *     - https://github.com/Automattic/node-canvas/issues/1116
 *     - https://www.npmjs.com/package/path2d-polyfill
 *  - excalidraw-to-svg (node.js) takes quite some time to load an image (1-2s)
 *  - excalidraw-utils (browser) does render freedraw, however NOT freedraw with background. It is not
 *    used, since it is a big dependency, and has the same functionality as react + excalidraw.
 *  - infinite-drawing-canvas with fabric.js. This library lacked a lot of feature, excalidraw already
 *    has.
 *
 * Known issues:
 *  - the 3 excalidraw fonts should be included in the share and everywhere, so that it is shown
 *    when requiring svg.
 *
 * Discussion of storing svg in the note:
 *  - Pro: we will combat bit-rot. Showing the SVG will be very fast and easy, since it is already there.
 *  - Con: The note will get bigger (~40-50%?), we will generate more bandwith. However, using trilium
 *         desktop instance mitigates that issue.
 *
 * Roadmap:
 *  - Support image-notes as reference in excalidraw
 *  - Support canvas note as reference (svg) in other canvas notes.
 *  - Make it easy to include a canvas note inside a text note
 *  - Support for excalidraw libraries. Maybe special code notes with a tag.
 */
export default class ExcalidrawTypeWidget extends TypeWidget {
    constructor() {
        super();

        // constants
        this.SCENE_VERSION_INITIAL = -1; // -1 indicates, that it is fresh. excalidraw scene version is always >0
        this.SCENE_VERSION_ERROR = -2; // -2 indicates error

        // config
        this.DEBOUNCE_TIME_ONCHANGEHANDLER = 750; // ms
        // ensure that assets are loaded from trilium
        window.EXCALIDRAW_ASSET_PATH = `${window.location.origin}/node_modules/@excalidraw/excalidraw/dist/`;

        // temporary vars
        this.currentNoteId = "";
        this.currentSceneVersion = this.SCENE_VERSION_INITIAL;

        // will be overwritten
        this.excalidrawRef;
        this.$render;
        this.$widget;
        this.reactHandlers; // used to control react state

        // binds
        this.createExcalidrawReactApp = this.createExcalidrawReactApp.bind(this);
        this.onChangeHandler = this.onChangeHandler.bind(this);
        this.isNewSceneVersion = this.isNewSceneVersion.bind(this);
    }

    static getType() {
        return "canvas";
    }

    doRender() {
        this.$widget = $(TPL);
        this.$widget.bind('mousewheel DOMMouseScroll', event => {
            if (event.ctrlKey) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        });

        this.$widget.toggleClass("full-height", true); // only add
        this.$render = this.$widget.find('.canvas-render');
        const documentStyle = window.getComputedStyle(document.documentElement);
        this.themeStyle = documentStyle.getPropertyValue('--theme-style')?.trim();

        libraryLoader
            .requireLibrary(libraryLoader.EXCALIDRAW)
            .then(() => {
                const React = window.React;
                const ReactDOM = window.ReactDOM;
                const renderElement = this.$render.get(0);

                ReactDOM.unmountComponentAtNode(renderElement);
                ReactDOM.render(React.createElement(this.createExcalidrawReactApp), renderElement);
            });

        return this.$widget;
    }

    /**
     * called to populate the widget container with the note content
     *
     * @param {FNote} note
     */
    async doRefresh(note) {
        // see if note changed, since we do not get a new class for a new note
        const noteChanged = this.currentNoteId !== note.noteId;
        if (noteChanged) {
            // reset scene to omit unnecessary onchange handler
            this.currentSceneVersion = this.SCENE_VERSION_INITIAL;
        }
        this.currentNoteId = note.noteId;

        // get note from backend and put into canvas
        const noteComplement = await froca.getNoteComplement(note.noteId);

        // before we load content into excalidraw, make sure excalidraw has loaded
        while (!this.excalidrawRef || !this.excalidrawRef.current) {
            console.log("excalidrawRef not yet loaded, sleep 200ms...");
            await sleep(200);
        }

        /**
         * new and empty note - make sure that canvas is empty.
         * If we do not set it manually, we occasionally get some "bleeding" from another
         * note into this fresh note. Probably due to that this note-instance does not get
         * newly instantiated?
         */
        if (this.excalidrawRef.current && noteComplement.content?.trim() === "") {
            const sceneData = {
                elements: [],
                appState: {
                    theme: this.themeStyle
                },
                collaborators: []
            };

            this.excalidrawRef.current.updateScene(sceneData);
        }
        else if (this.excalidrawRef.current && noteComplement.content) {
            // load saved content into excalidraw canvas
            let content;

            try {
                content = JSON.parse(noteComplement.content || "");
            } catch(err) {
                console.error("Error parsing content. Probably note.type changed",
                              "Starting with empty canvas"
                              , note, noteComplement, err);

                content = {
                    elements: [],
                    appState: {},
                    files: [],
                };
            }

            const {elements, appState, files} = content;

            appState.theme = this.themeStyle;

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

            // files are expected in an array when loading. they are stored as a key-index object
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

            this.excalidrawRef.current.updateScene(sceneData);
            this.excalidrawRef.current.addFiles(fileArray);
        }

        // set initial scene version
        if (this.currentSceneVersion === this.SCENE_VERSION_INITIAL) {
            this.currentSceneVersion = this.getSceneVersion();
        }
    }

    /**
     * gets data from widget container that will be sent via spacedUpdate.scheduleUpdate();
     * this is automatically called after this.saveData();
     */
    async getData() {
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
        const svg = await window.ExcalidrawLib.exportToSvg({
            elements,
            appState,
            exportPadding: 5, // 5 px padding
            metadata: 'trilium-export',
            files
        });
        const svgString = svg.outerHTML;

        const activeFiles = {};
        elements.forEach((element) => {
            if (element.fileId) {
                activeFiles[element.fileId] = files[element.fileId];
            }
        })

        const content = {
            _meta: "This note has type `canvas`. It uses excalidraw and stores an exported svg alongside.",
            elements, // excalidraw
            appState, // excalidraw
            files: activeFiles, // excalidraw
            svg: svgString, // not needed for excalidraw, used for note_short, content, and image api
        };

        return {
            content: JSON.stringify(content)
        };
    }

    /**
     * save content to backend
     * spacedUpdate is kind of a debouncer.
     */
    saveData() {
        this.spacedUpdate.scheduleUpdate();
    }

    onChangeHandler() {
        // changeHandler is called upon any tiny change in excalidraw. button clicked, hover, etc.
        // make sure only when a new element is added, we actually save something.
        const isNewSceneVersion = this.isNewSceneVersion();
        /**
         * FIXME: however, we might want to make an exception, if viewport changed, since viewport
         *        is desired to save? (add) and appState background, and some things
         */

        // upon updateScene, onchange is called, even though "nothing really changed" that is worth saving
        const isNotInitialScene = this.currentSceneVersion !== this.SCENE_VERSION_INITIAL;

        const shouldSave = isNewSceneVersion && isNotInitialScene;

        if (shouldSave) {
            this.updateSceneVersion();
            this.saveData();
        } else {
            // do nothing
        }
    }

    createExcalidrawReactApp() {
        const React = window.React;
        const { Excalidraw } = window.ExcalidrawLib;

        const excalidrawRef = React.useRef(null);
        this.excalidrawRef = excalidrawRef;
        const excalidrawWrapperRef = React.useRef(null);
        this.excalidrawWrapperRef = excalidrawWrapperRef;
        const [dimensions, setDimensions] = React.useState({
            width: undefined,
            height: undefined
        });

        React.useEffect(() => {
            const dimensions = {
                width: excalidrawWrapperRef.current.getBoundingClientRect().width,
                height: excalidrawWrapperRef.current.getBoundingClientRect().height
            };
            setDimensions(dimensions);

            const onResize = () => {
                if (this.note?.type !== 'canvas') {
                    return;
                }

                const dimensions = {
                    width: excalidrawWrapperRef.current.getBoundingClientRect().width,
                    height: excalidrawWrapperRef.current.getBoundingClientRect().height
                };
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
            const isInternalLink = link.startsWith("/")
                || link.includes(window.location.origin);

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
                React.createElement(Excalidraw, {
                    // this makes sure that 1) manual theme switch button is hidden 2) theme stays as it should after opening menu
                    theme: this.themeStyle,
                    ref: excalidrawRef,
                    width: dimensions.width,
                    height: dimensions.height,
                    onPaste: (data, event) => {
                        console.log("Verbose: excalidraw internal paste. No trilium action implemented.", data, event);
                    },
                    onChange: debounce(this.onChangeHandler, this.DEBOUNCE_TIME_ONCHANGEHANDLER),
                    viewModeEnabled: false,
                    zenModeEnabled: false,
                    gridModeEnabled: false,
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

        return this.currentSceneVersion === this.SCENE_VERSION_INITIAL // initial scene version update
            || this.currentSceneVersion !== sceneVersion // ensure scene changed
        ;
    }

    getSceneVersion() {
        if (this.excalidrawRef) {
            const elements = this.excalidrawRef.current.getSceneElements();
            return window.ExcalidrawLib.getSceneVersion(elements);
        } else {
            return this.SCENE_VERSION_ERROR;
        }
    }

    updateSceneVersion() {
        this.currentSceneVersion = this.getSceneVersion();
    }
}
