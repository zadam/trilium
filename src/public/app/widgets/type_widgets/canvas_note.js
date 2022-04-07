import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";
import _debounce from './canvas-note-utils/lodash.debounce.js';
import _throttle from './canvas-note-utils/lodash.throttle.js';
import sleep from './canvas-note-utils/sleep.js';
import froca from "../../services/froca.js";
import throttle from "./canvas-note-utils/lodash.throttle.js";
import debounce from "./canvas-note-utils/lodash.debounce.js";

const TPL = `
    <div 
        id="parentContainer" 
        class="note-detail-canvas-note note-detail-printable"
        style="overflow:auto; width: 100%; height: 500px; background-color: rgba(255,248,230,0.58); border: 1px double #efefef;"
    >
        <div id="app" style="width:100%; height: 100%"></div>
    </div>
    <style type="text/css">
        .excalidraw .App-menu_top .buttonList {
            display: flex;
        }

        .excalidraw-wrapper {
            height: 100%;
            position: relative;
        }

        :root[dir="ltr"]
        .excalidraw
        .layer-ui__wrapper
        .zen-mode-transition.App-menu_bottom--transition-left {
            transform: none;
        }

    </style>
`;


export default class ExcalidrawTypeWidget extends TypeWidget {
    constructor() {
        super();

        this.ExcalidrawReactApp = this.ExcalidrawReactApp.bind(this);
        this.doRefresh = this.doRefresh.bind(this);
        this.getContent = this.getContent.bind(this);
        this.saveData = this.saveData.bind(this);
        this.refreshWithNote = this.refreshWithNote.bind(this);
        this.onChangeHandler = this.onChangeHandler.bind(this);
        window.triliumexcalidraw = this;
    }
    static getType() {
        return "canvas-note";
    }

    doRender() {
        this.$widget = $(TPL);

        libraryLoader
            .requireLibrary(libraryLoader.EXCALIDRAW)
            .then(() => {
                console.log("react, react-dom, excalidraw loaded");

                const excalidrawWrapper = document.getElementById("app");

                const React = window.React;
                const ReactDOM = window.ReactDOM;

                ReactDOM.render(React.createElement(this.ExcalidrawReactApp), excalidrawWrapper);
            })

        return this.$widget;
    }
    
    async refreshWithNote(note) {
        const noteComplement = await froca.getNoteComplement(note.noteId);
        const content = noteComplement.content || "";
        console.log('refreshWithNote(note) called', content);
    }

    /**
     * called to populate the widget container with the note content
     * 
     * @param {note} note 
     */
    async doRefresh(note) {
        console.log('doRefresh()', note);
        // get note from backend and put into canvas
        
        console.log('sleep 1s...');
        await sleep(1000);

        const noteComplement = await froca.getNoteComplement(note.noteId);
        console.log('doRefresh', note, noteComplement, noteComplement.content);

        if (this.excalidrawRef.current && noteComplement.content) {
            const content = JSON.parse(noteComplement.content || "");
            const {elements, appState} = content;

            console.log('doRefresh with this:', elements, appState);

            const sceneData = {
                elements, 
                appState, 
                collaborators: []
            };

            console.log("doRefresh(note) sceneData", sceneData);
            this.excalidrawRef.current.updateScene(sceneData);
        }
    }

    /**
     * gets data from widget container that will be sent via spacedUpdate.scheduleUpdate();
     */
    getContent() {
        console.log('getContent()');
        const time = new Date();
        // const content = "hallöchen"+time.toUTCString();

        const elements = this.excalidrawRef.current.getSceneElements();
        const appState = this.excalidrawRef.current.getAppState();

        const content = {
            elements,
            appState,
            time
        };

        console.log('gC', content);

        return JSON.stringify(content);
    }

    saveData() {
        console.log("saveData()");
        this.spacedUpdate.scheduleUpdate();
    }

    onChangeHandler() {
        this.saveData();
    }

    ExcalidrawReactApp() {
        var self = this;

        const React = window.React;
        const Excalidraw = window.Excalidraw;

        const excalidrawRef = React.useRef(null);
        self.excalidrawRef = excalidrawRef;
        const excalidrawWrapperRef = React.useRef(null);
        const [dimensions, setDimensions] = React.useState({
            width: undefined,
            height: undefined
        });

        const [viewModeEnabled, setViewModeEnabled] = React.useState(false);
        const [zenModeEnabled, setZenModeEnabled] = React.useState(false);
        const [gridModeEnabled, setGridModeEnabled] = React.useState(false);
        
        React.useEffect(() => {
          setDimensions({
            width: excalidrawWrapperRef.current.getBoundingClientRect().width,
            height: excalidrawWrapperRef.current.getBoundingClientRect().height
          });
          const onResize = () => {
            setDimensions({
              width: excalidrawWrapperRef.current.getBoundingClientRect().width,
              height: excalidrawWrapperRef.current.getBoundingClientRect().height
            });
          };
        
          window.addEventListener("resize", onResize);
        
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
                        console.log("tom", data, event);
                    },
                    // onChange: (elements, state) => {
                    //     console.log("onChange Elements :", elements, "State : ", state)
                    //     debounce(() => {
                    //         console.log('called onChange via throttle');
                    //         self.saveData();
                    //     }, 400);
                    // },
                    onChange: debounce(self.onChangeHandler, 500),
                    // onPointerUpdate: (payload) => console.log(payload),
                    onCollabButtonClick: () => {
                        window.alert("You clicked on collab button")
                    },
                    viewModeEnabled: viewModeEnabled,
                    zenModeEnabled: zenModeEnabled,
                    gridModeEnabled: gridModeEnabled,
                    isCollaborating: false,
                })
            )
        );
    };
}

