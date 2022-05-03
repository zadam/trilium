// const {elements, appState, files} = window.triliumExcalidraw;
document.getElementById("excalidraw-app").style.height = appState.height+"px";

const App = () => {
    const excalidrawRef = React.useRef(null);
    const excalidrawWrapperRef = React.useRef(null);
    const [dimensions, setDimensions] = React.useState({
        width: undefined,
        height: appState.height,
    });
    const [viewModeEnabled, setViewModeEnabled] = React.useState(false);
    console.log("no render?");
    
    /**
     * resizing
     */
    React.useEffect(() => {
        const dimensions = {
            width: excalidrawWrapperRef.current.getBoundingClientRect().width,
            height: excalidrawWrapperRef.current.getBoundingClientRect().height
        };
        setDimensions(dimensions);

        const onResize = () => {
            const dimensions = {
                width: excalidrawWrapperRef.current.getBoundingClientRect().width,
                height: excalidrawWrapperRef.current.getBoundingClientRect().height
            };
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
            React.createElement(
                "label",
                null,
                React.createElement("input", {
                  type: "checkbox",
                  checked: viewModeEnabled,
                  onChange: () => setViewModeEnabled(!viewModeEnabled)
                }),
                " Edit mode "
              ),
              React.createElement("br"),
        
            React.createElement(Excalidraw.default, {
                ref: excalidrawRef,
                width: dimensions.width,
                height: dimensions.height,
                initialData: {
                    elements, appState, files
                },
                viewModeEnabled: !viewModeEnabled,
                zenModeEnabled: false,
                gridModeEnabled: false,
                isCollaborating: false,
                detectScroll: false,
                handleKeyboardGlobally: false,
                autoFocus: true,
                renderTopRightUI: () => {
                    return React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(
                            "div",
                            {
                                className: "excalidraw-top-right-ui",
                            },
                            "view mode"
                        ));
                },
            })
        )
    );
};
ReactDOM.render(React.createElement(App), document.getElementById("excalidraw-app"));
