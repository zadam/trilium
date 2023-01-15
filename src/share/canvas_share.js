/**
 * this is used as a "standalone js" file and required by a shared note directly via script-tags
 *
 * data input comes via window variable as follows
 * const {elements, appState, files} = window.triliumExcalidraw;
 */

document.getElementById("excalidraw-app").style.height = `${appState.height}px`;

const App = () => {
    const excalidrawRef = React.useRef(null);
    const excalidrawWrapperRef = React.useRef(null);
    const [dimensions, setDimensions] = React.useState({
        width: undefined,
        height: appState.height,
    });
    const [viewModeEnabled, setViewModeEnabled] = React.useState(false);

    // ensure that assets are loaded from trilium

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
            React.createElement(ExcalidrawLib.Excalidraw, {
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
                renderFooter: () => {
                    return React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(
                            "div",
                            {
                                className: "excalidraw-top-right-ui excalidraw Island",
                            },
                            React.createElement(
                                "label",
                                {
                                    style: {
                                        padding: "5px",
                                    },
                                    className: "excalidraw Stack",
                                },
                                React.createElement(
                                    "button",
                                    {
                                        onClick: () => setViewModeEnabled(!viewModeEnabled)
                                    },
                                    viewModeEnabled ? " Enter simple view mode " : " Enter extended view mode "
                                ),
                                ""
                            ),
                        ));
                },
            })
        )
    );
};
ReactDOM.render(React.createElement(App), document.getElementById("excalidraw-app"));
