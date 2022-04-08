import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";
import sleep from './canvas-note-utils/sleep.js';
import froca from "../../services/froca.js";
import debounce from "./canvas-note-utils/lodash.debounce.js";
 // NoteContextAwareWidget does not handle loading/refreshing of note context
import NoteContextAwareWidget from "../note_context_aware_widget.js";

const TPL = `
    <div class="canvas-note-widget note-detail-canvas-note note-detail-printable">
        <style type="text/css">
        .note-detail-canvas-note {
            height: 100%;
        }

        .excalidraw .App-menu_top .buttonList {
            /*display: flex;*/
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
        <!-- height here necessary .otherwise excalidraw not shown. also, one window resize necessary! -->
        <div class="canvas-note-render" style="height: 500px"></div>
    </div>
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
        const self = this;
        this.$widget = $(TPL);

        this.contentSized();
        this.$render = this.$widget.find('.canvas-note-render');
        this.$renderElement = this.$render.get(0);
        console.log(this.noteId, "doRender", this.$widget);

        libraryLoader
            .requireLibrary(libraryLoader.EXCALIDRAW)
            .then(() => {
                console.log(this.noteId, "react, react-dom, excalidraw loaded");

                const React = window.React;
                const ReactDOM = window.ReactDOM;
                
                ReactDOM.unmountComponentAtNode(this.$renderElement);
                ReactDOM.render(React.createElement(this.ExcalidrawReactApp), self.$renderElement);
            })

        return this.$widget;
    }

    /**
     * called to populate the widget container with the note content
     * 
     * @param {note} note 
     */
    async doRefresh(note) {
        console.log(this.noteId, 'doRefresh()', note);
        // get note from backend and put into canvas
        
        // wait for react to have rendered!
        // console.log(this.noteId, 'sleep 1s...');
        // await sleep(1000);

        const noteComplement = await froca.getNoteComplement(note.noteId);
        console.log(this.noteId, 'doRefresh', note, noteComplement, noteComplement.content);

        if (!this.excalidrawRef) {
            console.log(this.noteId, "doRefresh !!!!!!!!!!! excalidrawref not yet loeaded, sleep 1s...");
            await sleep(1000);
        }

        if (this.excalidrawRef.current && noteComplement.content) {
            const content = JSON.parse(noteComplement.content || "");
            const {elements, appState} = content;

            console.log(this.noteId, 'doRefresh with this:', elements, appState);

            const sceneData = {
                elements, 
                appState, 
                collaborators: []
            };

            console.log(this.noteId, "doRefresh(note) sceneData", sceneData);
            this.excalidrawRef.current.updateScene(sceneData);
        }
    }

    /**
     * gets data from widget container that will be sent via spacedUpdate.scheduleUpdate();
     */
    getContent() {
        console.log(this.noteId, 'getContent()');
        const time = new Date();
        // const content = "hallöchen"+time.toUTCString();

        const elements = this.excalidrawRef.current.getSceneElements();
        const appState = this.excalidrawRef.current.getAppState();

        const content = {
            elements,
            appState,
            time
        };

        console.log(this.noteId, 'gC', content);

        return JSON.stringify(content);
    }

    saveData() {
        console.log(this.noteId, "saveData()");
        this.spacedUpdate.scheduleUpdate();
    }

    onChangeHandler() {
        console.log(this.noteId, "onChangeHandler() =================", new Date());
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
            const dimensions = {
                width: excalidrawWrapperRef.current.getBoundingClientRect().width,
                height: excalidrawWrapperRef.current.getBoundingClientRect().height
            };
            console.log(this.noteId, 'effect, setdimensions', dimensions);
            setDimensions(dimensions);

            const onResize = () => {
                const dimensions = {
                    width: excalidrawWrapperRef.current.getBoundingClientRect().width,
                    height: excalidrawWrapperRef.current.getBoundingClientRect().height
                };
                console.log(this.noteId, 'onResize, setdimensions', dimensions);
                setDimensions(dimensions);
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
                        console.log(this.noteId, "tom", data, event);
                    },
                    // onChange: (elements, state) => {
                    //     console.log(this.noteId, "onChange Elements :", elements, "State : ", state)
                    //     debounce(() => {
                    //         console.log(this.noteId, 'called onChange via throttle');
                    //         self.saveData();
                    //     }, 400);
                    // },
                    onChange: debounce(self.onChangeHandler, 750),
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

