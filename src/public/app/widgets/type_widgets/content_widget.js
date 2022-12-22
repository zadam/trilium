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
import ImageOptions from "./options/images.js";
import SpellcheckOptions from "./options/spellcheck.js";
import PasswordOptions from "./options/password.js";
import EtapiOptions from "./options/etapi.js";
import BackupOptions from "./options/backup.js";
import SyncOptions from "./options/sync.js";
import TrayOptions from "./options/other/tray.js";
import NoteErasureTimeoutOptions from "./options/other/note_erasure_timeout.js";
import NoteRevisionsSnapshotIntervalOptions from "./options/other/note_revisions_snapshot_interval.js";
import NetworkConnectionsOptions from "./options/other/network_connections.js";
import AdvancedSyncOptions from "./options/advanced/sync.js";
import DatabaseIntegrityCheckOptions from "./options/advanced/database_integrity_check.js";
import ConsistencyChecksOptions from "./options/advanced/consistency_checks.js";
import VacuumDatabaseOptions from "./options/advanced/vacuum_database.js";
import DatabaseAnonymizationOptions from "./options/advanced/database_anonymization.js";
import BackendLogWidget from "./content/backend_log.js";

const TPL = `<div class="note-detail-content-widget note-detail-printable">
    <style>
        .type-contentWidget .note-detail {
            height: 100%;
        }
        
        .note-detail-content-widget {
            height: 100%;
        }
    
        .note-detail-content-widget-content {
            padding: 15px;
            height: 100%;
        }
    </style>

    <div class="note-detail-content-widget-content"></div>
</div>`;

const CONTENT_WIDGETS = {
    _optionsAppearance: [
        ZoomFactorOptions,
        NativeTitleBarOptions,
        ThemeOptions,
        FontsOptions,
        MaxContentWidthOptions
    ],
    _optionsShortcuts: [ KeyboardShortcutsOptions ],
    _optionsTextNotes: [
        HeadingStyleOptions,
        TableOfContentsOptions,
        TextAutoReadOnlySizeOptions
    ],
    _optionsCodeNotes: [
        VimKeyBindingsOptions,
        WrapLinesOptions,
        CodeAutoReadOnlySizeOptions,
        CodeMimeTypesOptions
    ],
    _optionsImages: [ ImageOptions ],
    _optionsSpellcheck: [ SpellcheckOptions ],
    _optionsPassword: [ PasswordOptions ],
    _optionsEtapi: [ EtapiOptions ],
    _optionsBackup: [ BackupOptions ],
    _optionsSync: [ SyncOptions ],
    _optionsOther: [
        TrayOptions,
        NoteErasureTimeoutOptions,
        NoteRevisionsSnapshotIntervalOptions,
        NetworkConnectionsOptions
    ],
    _optionsAdvanced: [
        DatabaseIntegrityCheckOptions,
        ConsistencyChecksOptions,
        DatabaseAnonymizationOptions,
        AdvancedSyncOptions,
        VacuumDatabaseOptions
    ],
    _backendLog: [ BackendLogWidget ]
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
