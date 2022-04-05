import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import appContext from "../../services/app_context.js";

const TPL = `
    <div 
        id="parentContainer" 
        class="note-detail-canvas-note note-detail-printable"
        style="overflow:auto; width: 100%; height: 400px; background-color: rgba(255,248,230,0.58); border: 1px double #efefef;"
    >
            <h1>Excalidraw Embed Example asdf</h1>
            <div id="app" style="width:100%; height: 100%"></div>
    </div>
    <style type="text/css">

        .button-wrapper button {
            z-index: 1;
            height: 40px;
            width: 100px;
            margin: 10px;
            padding: 5px;
        }

        .excalidraw .App-menu_top .buttonList {
            display: flex;
        }

        .excalidraw-wrapper {
            height: 800px;
            margin: 50px;
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

    // async doRefresh(note) {
    //     // get note from backend and put into canvas
    //     const noteComplement = await this.tabContext.getNoteComplement();
    //     if (this.infiniteCanvas && noteComplement.content) {
    //         const content = JSON.parse(noteComplement.content || "");
    //         await this.infiniteCanvas.setInfiniteCanvas(content);
    //     }
    //     console.log('doRefresh', note, noteComplement);
    // }

    /**
     * Function gets data that will be sent via spacedUpdate.scheduleUpdate();
     */
    // getContent() {
    //     const content = this.infiniteCanvas.getInfiniteCanvas();
    //     console.log('gC', content);
    //     return JSON.stringify(content);
    // }

    // saveData() {
    //     this.spacedUpdate.scheduleUpdate();
    // }

    ExcalidrawReactApp() {
        const React = window.React;
        const Excalidraw = window.Excalidraw;

        const excalidrawRef = React.useRef(null);
        const excalidrawWrapperRef = React.useRef(null);
        const [dimensions, setDimensions] = React.useState({
            width: undefined,
            height: undefined
        });

        const [viewModeEnabled, setViewModeEnabled] = React.useState(false);
        const [zenModeEnabled, setZenModeEnabled] = React.useState(false);
        const [gridModeEnabled, setGridModeEnabled] = React.useState(false);
        //
        // React.useEffect(() => {
        //   setDimensions({
        //     width: excalidrawWrapperRef.current.getBoundingClientRect().width,
        //     height: excalidrawWrapperRef.current.getBoundingClientRect().height
        //   });
        //   const onResize = () => {
        //     setDimensions({
        //       width: excalidrawWrapperRef.current.getBoundingClientRect().width,
        //       height: excalidrawWrapperRef.current.getBoundingClientRect().height
        //     });
        //   };
        //
        //   window.addEventListener("resize", onResize);
        //
        //   return () => window.removeEventListener("resize", onResize);
        // }, [excalidrawWrapperRef]);

        const updateScene = () => {
            const sceneData = {
                elements: [
                    {
                        type: "rectangle",
                        version: 141,
                        versionNonce: 361174001,
                        isDeleted: false,
                        id: "oDVXy8D6rom3H1-LLH2-f",
                        fillStyle: "hachure",
                        strokeWidth: 1,
                        strokeStyle: "solid",
                        roughness: 1,
                        opacity: 100,
                        angle: 0,
                        x: 100.50390625,
                        y: 93.67578125,
                        strokeColor: "#c92a2a",
                        backgroundColor: "transparent",
                        width: 186.47265625,
                        height: 141.9765625,
                        seed: 1968410350,
                        groupIds: []
                    }
                ],
                appState: {
                    viewBackgroundColor: "#edf2ff"
                }
            };
            excalidrawRef.current.updateScene(sceneData);
        };

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
                    onChange: (elements, state) =>
                        console.log("onChange Elements :", elements, "State : ", state),
                    // onPointerUpdate: (payload) => console.log(payload),
                    onCollabButtonClick: () => window.alert("You clicked on collab button"),
                    viewModeEnabled: viewModeEnabled,
                    zenModeEnabled: zenModeEnabled,
                    gridModeEnabled: gridModeEnabled,
                    isCollaborating: false,
                })
            )
        );
    };
}

