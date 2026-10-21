import {
    ButtonView, DropdownView, IconCodeBlock, IconImage, IconPreviousArrow, IconTable, IconThreeVerticalDots, Plugin,
    ToolbarSeparatorView, ToolbarView, WidgetToolbarRepository
} from "ckeditor5";
import type { Editor, ToolbarConfig, ToolbarConfigItem, ViewElement, ViewDocumentSelection } from "ckeditor5";

import admonitionIcon from "../icons/admonition.svg?raw";
import { isListMenu, openListAsMenu } from "./toolbar_group_menu.js";

/** The icons of the `contextToolbar` button, by the id a widget toolbar is registered under. */
const TOOLBAR_ICONS: Record<string, string> = {
    table: IconTable,
    tableContent: IconTable,
    image: IconImage,
    codeblock: IconCodeBlock,
    admonition: admonitionIcon
};

/** What `WidgetToolbarRepository` keeps of a registered toolbar. */
interface WidgetToolbarDefinition {
    view: ToolbarView;
    getRelatedElement(selection: ViewDocumentSelection): ViewElement | null;
    itemsConfig: ToolbarConfigItem[];
}

/** The widget toolbar for the selection, as the `contextToolbar` button shows it. */
interface ContextToolbarSource {
    id: string;
    definition: WidgetToolbarDefinition;
    /** The widget the toolbar is for. */
    element: ViewElement;
    /** Whether the selection holds the widget whole, as it does an image, rather than a caret inside it. */
    isSelected: boolean;
}

/**
 * Moves the toolbars of `WidgetToolbarRepository` (table, image, code block, …) out of their
 * balloons into a toolbar the host application places, as {@link TextFormattingToolbar} does for
 * text formatting. Applies only to an editor whose toolbar holds the `contextToolbar` button.
 *
 * The button shows while the selection is in a widget that has a toolbar. It swaps in
 * {@link toolbarView}: a back button, then the items of the toolbar the balloon would show, which is
 * the one of the innermost widget. The toolbar swaps in on its own as a widget is selected whole,
 * since there is no text to format then, and swaps out as the selection leaves the widget.
 * Its dropdowns open as menus of `ToolbarGroupMenu`, like the rest of a phone's toolbar.
 */
export default class ContextToolbar extends Plugin {

    /** Whether the toolbar is the one to show. */
    declare isActive: boolean;

    /** The widget toolbar for the selection, or `null` outside any widget that has one. */
    declare source: ContextToolbarSource | null;

    // Built before `afterInit()`, so `ToolbarGroupMenu` can watch it whichever plugin starts first.
    readonly toolbarView: ToolbarView;

    private readonly backView: ButtonView;
    /** The source whose items {@link toolbarView} holds. */
    private shownSource: ContextToolbarSource | null = null;

    static get requires() {
        return [WidgetToolbarRepository] as const;
    }

    static get pluginName() {
        return "ContextToolbar" as const;
    }

    constructor(editor: Editor) {
        super(editor);
        this.set("isActive", false);
        this.set("source", null);
        this.toolbarView = new ToolbarView(editor.locale, { shouldGroupWhenFull: true });

        // Names the widget whose tools the row holds, as `‹ Table`.
        const back = this.backView = new ButtonView(editor.locale);
        back.set({ icon: IconPreviousArrow, tooltip: editor.t("Back") });
        back.bind("label").to(this, "source", (source) => getToolbarName(editor, source) ?? editor.t("Back"));
        back.bind("withText").to(this, "source", (source) => getToolbarName(editor, source) !== undefined);
        back.on("execute", () => this.setActive(false));
    }

    init() {
        const editor = this.editor;

        editor.ui.componentFactory.add("contextToolbar", (locale) => {
            // A chip naming the widget, `Table ›`, which the host styles apart from the tools.
            const button = new ButtonView(locale);
            button.set({ class: "ck-context-toolbar-button" });
            button.bind("isVisible").to(this, "source", (source) => source !== null);
            button.bind("label").to(this, "source", (source) =>
                getToolbarName(editor, source) ?? source?.definition.view.ariaLabel ?? "");
            button.bind("withText").to(this, "source", (source) => getToolbarName(editor, source) !== undefined);
            button.bind("tooltip").to(this, "source", (source) => source?.definition.view.ariaLabel ?? true);
            button.bind("icon").to(this, "source", (source) => (source && TOOLBAR_ICONS[source.id]) ?? IconThreeVerticalDots);
            button.on("execute", () => this.setActive(true));
            return button;
        });
    }

    afterInit() {
        const editor = this.editor;
        if (!hasItem(editor.config.get("toolbar"), "contextToolbar")) {
            return;
        }

        editor.plugins.get(WidgetToolbarRepository).forceDisabled(ContextToolbar.pluginName);

        // Grouping measures the rendered toolbar as items arrive.
        this.toolbarView.render();
        this.toolbarView.items.addMany([this.backView, new ToolbarSeparatorView()]);
        // Before `ToolbarGroupMenu`, which decides on a dropdown as it is added.
        this.listenTo(this.toolbarView.items, "add", (_evt, item) => {
            if (item instanceof DropdownView && !isListMenu(item)) {
                openListAsMenu(item);
            }
        }, { priority: "highest" });
        editor.ui.addToolbar(this.toolbarView);

        // The event `WidgetToolbarRepository` updates its balloons on.
        this.listenTo(editor.ui, "update", () => this.updateSource());
    }

    override destroy() {
        super.destroy();
        if (this.toolbarView.isRendered) {
            this.toolbarView.destroy();
        } else {
            this.backView.destroy();
        }
    }

    private setActive(isActive: boolean) {
        if (isActive) {
            this.fillToolbar();
        }
        this.isActive = isActive;
        this.editor.editing.view.focus();
    }

    /** Fills {@link toolbarView} with the items of the toolbar for the selection, after the back button. */
    private fillToolbar() {
        if (this.source === this.shownSource || !this.source) {
            return;
        }

        for (const item of [...this.toolbarView.items].slice(2)) {
            this.toolbarView.items.remove(item);
            item.destroy();
        }
        this.toolbarView.fillFromConfig(this.source.definition.itemsConfig, this.editor.ui.componentFactory);
        this.shownSource = this.source;
    }

    /** Finds the toolbar of the innermost widget at the selection, as `WidgetToolbarRepository` does. */
    private updateSource() {
        const selection = this.editor.editing.view.document.selection;
        let deepest: { source: ContextToolbarSource; depth: number } | null = null;

        for (const [id, definition] of getDefinitions(this.editor)) {
            const element = definition.getRelatedElement(selection);
            const depth = element?.getAncestors().length ?? 0;
            if (element && depth > (deepest?.depth ?? 0)) {
                const isSelected = element === selection.getSelectedElement();
                deepest = { source: { id, definition, element, isSelected }, depth };
            }
        }

        const next = deepest?.source ?? null;
        // Unchanged for the same widget, so the back button holds while the selection stays on it.
        if (next?.id === this.source?.id && next?.element === this.source?.element) {
            return;
        }
        this.source = next;
        if (next?.isSelected) {
            this.fillToolbar();
            this.isActive = true;
        } else if (this.isActive) {
            this.isActive = false;
        }
    }
}

/** The short name of the widget a toolbar is for, or `undefined` for a toolbar without one. */
function getToolbarName(editor: Editor, source: ContextToolbarSource | null) {
    const t = editor.t;
    switch (source?.id) {
        case "table":
        case "tableContent": return t("Table");
        case "image": return t("Image");
        case "codeblock": return t("Code block");
        case "inlineCode": return t("Code");
        case "admonition": return t("Admonition");
        case "tabs": return t("Tabs");
        case "multicolumnLayout": return t("Columns");
        case "contentEmbed":
        case "linkEmbed": return t("Embed");
        default: return undefined;
    }
}

/**
 * The toolbars registered with `WidgetToolbarRepository`. It keeps them in a private map: the spec
 * fails if a CKEditor upgrade renames it.
 */
function getDefinitions(editor: Editor): Map<string, WidgetToolbarDefinition> {
    const repository = editor.plugins.get(WidgetToolbarRepository) as unknown as {
        _toolbarDefinitions: Map<string, WidgetToolbarDefinition>;
    };
    return repository._toolbarDefinitions;
}

/** Whether a toolbar configuration holds `name`, at its top level or in a group. */
function hasItem(config: ToolbarConfig | undefined, name: string): boolean {
    const items = Array.isArray(config) ? config : config?.items ?? [];
    return items.some((item) => item === name || (typeof item === "object" && hasItem(item.items, name)));
}

declare module "ckeditor5" {
    interface PluginsMap {
        [ContextToolbar.pluginName]: ContextToolbar;
    }
}
