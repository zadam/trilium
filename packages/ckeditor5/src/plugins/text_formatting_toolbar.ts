import {
    ButtonView, IconPreviousArrow, IconText, Plugin, ToolbarSeparatorView, ToolbarView
} from "ckeditor5";
import type { Editor, ToolbarConfig } from "ckeditor5";

/**
 * A second toolbar of text formatting, which the `textFormatting` button swaps in for the editor's
 * own toolbar and the back button at its start swaps out again. The items come from the
 * `textFormattingToolbar` configuration. The host application places {@link toolbarView} and
 * shows it in place of the editor's toolbar while {@link isActive} is `true`.
 */
export default class TextFormattingToolbar extends Plugin {

    /** Whether the toolbar is the one to show. */
    declare isActive: boolean;

    // Built before `afterInit()`, so `ToolbarGroupMenu` can watch it whichever plugin starts first.
    readonly toolbarView: ToolbarView;

    static get pluginName() {
        return "TextFormattingToolbar" as const;
    }

    constructor(editor: Editor) {
        super(editor);
        this.set("isActive", false);
        // Groups, as the editor's own toolbar does by default, which keeps the items on one line.
        this.toolbarView = new ToolbarView(editor.locale, { shouldGroupWhenFull: true });
    }

    init() {
        const editor = this.editor;
        const t = editor.t;

        editor.ui.componentFactory.add("textFormatting", (locale) => {
            const button = new ButtonView(locale);
            button.set({ label: t("Text formatting"), icon: IconText, tooltip: true });
            button.on("execute", () => this.setActive(true));
            return button;
        });
    }

    afterInit() {
        const editor = this.editor;
        const t = editor.t;

        const back = new ButtonView(editor.locale);
        back.set({ label: t("Back"), icon: IconPreviousArrow, tooltip: true });
        back.on("execute", () => this.setActive(false));

        // Grouping measures the rendered toolbar as items arrive.
        this.toolbarView.render();
        this.toolbarView.items.add(back);

        const config = editor.config.get("textFormattingToolbar");
        const items = Array.isArray(config) ? config : config?.items ?? [];
        if (items.length) {
            this.toolbarView.items.add(new ToolbarSeparatorView());
            this.toolbarView.fillFromConfig(items, editor.ui.componentFactory);
        }
        editor.ui.addToolbar(this.toolbarView);
    }

    override destroy() {
        super.destroy();
        this.toolbarView.destroy();
    }

    /** The button that swaps the toolbars leaves the page with its toolbar, so the editor takes the focus. */
    private setActive(isActive: boolean) {
        this.isActive = isActive;
        this.editor.editing.view.focus();
    }
}

declare module "ckeditor5" {
    interface PluginsMap {
        [TextFormattingToolbar.pluginName]: TextFormattingToolbar;
    }

    interface EditorConfig {
        /** The items of the {@link TextFormattingToolbar}, after its back button. */
        textFormattingToolbar?: ToolbarConfig;
    }
}
