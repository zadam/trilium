import TypeWidget from "./type_widget.js";
import ZoomFactorOptions from "./options/appearance/zoom_factor.js";
import NativeTitleBarOptions from "./options/appearance/native_title_bar.js";
import ThemeOptions from "./options/appearance/theme.js";
import FontsOptions from "./options/appearance/fonts.js";
import MaxContentWidthOptions from "./options/appearance/max_content_width.js";
import KeyboardShortcutsOptions from "./options/shortcuts.js";
import HeadingStyleOptions from "./options/text_notes/heading_style.js";
import TableOfContentsOptions from "./options/text_notes/table_of_contents.js";
import TextAutoReadOnlySizeOptions from "./options/text_notes/text_auto_read_only_size.js";
import VimKeyBindingsOptions from "./options/code_notes/vim_key_bindings.js";
import WrapLinesOptions from "./options/code_notes/wrap_lines.js";
import CodeAutoReadOnlySizeOptions from "./options/code_notes/code_auto_read_only_size.js";
import CodeMimeTypesOptions from "./options/code_notes/code_mime_types.js";

const TPL = `<div class="note-detail-content-widget note-detail-printable">
    <style>
        .note-detail-content-widget-content {
            padding: 15px;
        }
    </style>

    <div class="note-detail-content-widget-content"></div>
</div>`;

const CONTENT_WIDGETS = {
    optionsAppearance: [
        ZoomFactorOptions,
        NativeTitleBarOptions,
        ThemeOptions,
        FontsOptions,
        MaxContentWidthOptions
    ],
    optionsShortcuts: [ KeyboardShortcutsOptions ],
    optionsTextNotes: [
        HeadingStyleOptions,
        TableOfContentsOptions,
        TextAutoReadOnlySizeOptions
    ],
    optionsCodeNotes: [
        VimKeyBindingsOptions,
        WrapLinesOptions,
        CodeAutoReadOnlySizeOptions,
        CodeMimeTypesOptions
    ]
};

export default class ContentWidgetTypeWidget extends TypeWidget {
    static getType() { return "contentWidget"; }

    doRender() {
        this.$widget = $(TPL);
        this.$content = this.$widget.find(".note-detail-content-widget-content");

        super.doRender();
    }

    async doRefresh(note) {
        this.$content.empty();
        this.children = [];

        const contentWidgets = CONTENT_WIDGETS[note.noteId];

        if (contentWidgets) {
            for (const clazz of contentWidgets) {
                const widget = new clazz();

                await widget.handleEvent('setNoteContext', { noteContext: this.noteContext });
                this.child(widget);

                this.$content.append(widget.render());
                await widget.refresh();
            }
        } else {
            this.$content.append(`Unknown widget for "${note.noteId}"`);
        }
    }
}
