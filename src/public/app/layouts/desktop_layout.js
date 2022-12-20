import FlexContainer from "../widgets/containers/flex_container.js";
import GlobalMenuWidget from "../widgets/buttons/global_menu.js";
import TabRowWidget from "../widgets/tab_row.js";
import TitleBarButtonsWidget from "../widgets/title_bar_buttons.js";
import LeftPaneContainer from "../widgets/containers/left_pane_container.js";
import NoteTreeWidget from "../widgets/note_tree.js";
import NoteTitleWidget from "../widgets/note_title.js";
import OwnedAttributeListWidget from "../widgets/ribbon_widgets/owned_attribute_list.js";
import NoteActionsWidget from "../widgets/buttons/note_actions.js";
import NoteDetailWidget from "../widgets/note_detail.js";
import RibbonContainer from "../widgets/containers/ribbon_container.js";
import PromotedAttributesWidget from "../widgets/ribbon_widgets/promoted_attributes.js";
import InheritedAttributesWidget from "../widgets/ribbon_widgets/inherited_attribute_list.js";
import NoteListWidget from "../widgets/note_list.js";
import SearchDefinitionWidget from "../widgets/ribbon_widgets/search_definition.js";
import SqlResultWidget from "../widgets/sql_result.js";
import SqlTableSchemasWidget from "../widgets/sql_table_schemas.js";
import FilePropertiesWidget from "../widgets/ribbon_widgets/file_properties.js";
import ImagePropertiesWidget from "../widgets/ribbon_widgets/image_properties.js";
import NotePropertiesWidget from "../widgets/ribbon_widgets/note_properties.js";
import NoteIconWidget from "../widgets/note_icon.js";
import SearchResultWidget from "../widgets/search_result.js";
import ScrollingContainer from "../widgets/containers/scrolling_container.js";
import RootContainer from "../widgets/containers/root_container.js";
import NoteUpdateStatusWidget from "../widgets/note_update_status.js";
import SpacerWidget from "../widgets/spacer.js";
import QuickSearchWidget from "../widgets/quick_search.js";
import SplitNoteContainer from "../widgets/containers/split_note_container.js";
import LeftPaneToggleWidget from "../widgets/buttons/left_pane_toggle.js";
import CreatePaneButton from "../widgets/buttons/create_pane_button.js";
import ClosePaneButton from "../widgets/buttons/close_pane_button.js";
import BasicPropertiesWidget from "../widgets/ribbon_widgets/basic_properties.js";
import NoteInfoWidget from "../widgets/ribbon_widgets/note_info_widget.js";
import BookPropertiesWidget from "../widgets/ribbon_widgets/book_properties.js";
import NoteMapRibbonWidget from "../widgets/ribbon_widgets/note_map.js";
import NotePathsWidget from "../widgets/ribbon_widgets/note_paths.js";
import SimilarNotesWidget from "../widgets/ribbon_widgets/similar_notes.js";
import RightPaneContainer from "../widgets/containers/right_pane_container.js";
import EditButton from "../widgets/buttons/edit_button.js";
import EditedNotesWidget from "../widgets/ribbon_widgets/edited_notes.js";
import MermaidWidget from "../widgets/mermaid.js";
import NoteWrapperWidget from "../widgets/note_wrapper.js";
import BacklinksWidget from "../widgets/floating_buttons/zpetne_odkazy.js";
import SharedInfoWidget from "../widgets/shared_info.js";
import FindWidget from "../widgets/find.js";
import TocWidget from "../widgets/toc.js";
import BulkActionsDialog from "../widgets/dialogs/bulk_actions.js";
import AboutDialog from "../widgets/dialogs/about.js";
import NoteSourceDialog from "../widgets/dialogs/note_source.js";
import HelpDialog from "../widgets/dialogs/help.js";
import RecentChangesDialog from "../widgets/dialogs/recent_changes.js";
import BackendLogDialog from "../widgets/dialogs/backend_log.js";
import BranchPrefixDialog from "../widgets/dialogs/branch_prefix.js";
import SortChildNotesDialog from "../widgets/dialogs/sort_child_notes.js";
import PasswordNoteSetDialog from "../widgets/dialogs/password_not_set.js";
import IncludeNoteDialog from "../widgets/dialogs/include_note.js";
import NoteTypeChooserDialog from "../widgets/dialogs/note_type_chooser.js";
import JumpToNoteDialog from "../widgets/dialogs/jump_to_note.js";
import AddLinkDialog from "../widgets/dialogs/add_link.js";
import CloneToDialog from "../widgets/dialogs/clone_to.js";
import MoveToDialog from "../widgets/dialogs/move_to.js";
import ImportDialog from "../widgets/dialogs/import.js";
import ExportDialog from "../widgets/dialogs/export.js";
import MarkdownImportDialog from "../widgets/dialogs/markdown_import.js";
import ProtectedSessionPasswordDialog from "../widgets/dialogs/protected_session_password.js";
import NoteRevisionsDialog from "../widgets/dialogs/note_revisions.js";
import DeleteNotesDialog from "../widgets/dialogs/delete_notes.js";
import InfoDialog from "../widgets/dialogs/info.js";
import ConfirmDialog from "../widgets/dialogs/confirm.js";
import PromptDialog from "../widgets/dialogs/prompt.js";
import FloatingButtons from "../widgets/floating_buttons/floating_buttons.js";
import RelationMapButtons from "../widgets/floating_buttons/relation_map_buttons.js";
import MermaidExportButton from "../widgets/floating_buttons/mermaid_export_button.js";
import LauncherContainer from "../widgets/containers/launcher_container.js";
import NoteRevisionsButton from "../widgets/buttons/note_revisions_button.js";
import CodeButtonsWidget from "../widgets/floating_buttons/code_buttons.js";
import ApiLogWidget from "../widgets/api_log.js";
import HideFloatingButtonsButton from "../widgets/floating_buttons/hide_floating_buttons_button.js";
import ScriptExecutorWidget from "../widgets/ribbon_widgets/script_executor.js";

export default class DesktopLayout {
    constructor(customWidgets) {
        this.customWidgets = customWidgets;
    }

    getRootWidget(appContext) {
        appContext.noteTreeWidget = new NoteTreeWidget();

        return new RootContainer()
            .setParent(appContext)
            .child(new FlexContainer("column")
                .id("launcher-pane")
                .css("width", "53px")
                .child(new GlobalMenuWidget())
                .child(new LauncherContainer())
                .child(new LeftPaneToggleWidget())
            )
            .child(new LeftPaneContainer()
                .child(new QuickSearchWidget())
                .child(appContext.noteTreeWidget)
                .child(...this.customWidgets.get('left-pane'))
            )
            .child(new FlexContainer('column')
                .id('rest-pane')
                .css("flex-grow", "1")
                .child(new FlexContainer('row')
                    .child(new TabRowWidget())
                    .child(new TitleBarButtonsWidget())
                    .css('height', '40px')
                )
                .child(new FlexContainer('row')
                    .filling()
                    .collapsible()
                    .child(new FlexContainer('column')
                        .filling()
                        .collapsible()
                        .id('center-pane')
                        .child(new SplitNoteContainer(() =>
                                new NoteWrapperWidget()
                                    .child(new FlexContainer('row').class('title-row')
                                        .css("height", "50px")
                                        .css("min-height", "50px")
                                        .css('align-items', "center")
                                        .cssBlock('.title-row > * { margin: 5px; }')
                                        .child(new NoteIconWidget())
                                        .child(new NoteTitleWidget())
                                        .child(new SpacerWidget(0, 1))
                                        .child(new ClosePaneButton())
                                        .child(new CreatePaneButton())
                                    )
                                    .child(
                                        new RibbonContainer()
                                            .ribbon(new ScriptExecutorWidget())
                                            .ribbon(new SearchDefinitionWidget())
                                            .ribbon(new EditedNotesWidget())
                                            .ribbon(new BookPropertiesWidget())
                                            .ribbon(new NotePropertiesWidget())
                                            .ribbon(new FilePropertiesWidget())
                                            .ribbon(new ImagePropertiesWidget())
                                            .ribbon(new PromotedAttributesWidget())
                                            .ribbon(new BasicPropertiesWidget())
                                            .ribbon(new OwnedAttributeListWidget())
                                            .ribbon(new InheritedAttributesWidget())
                                            .ribbon(new NotePathsWidget())
                                            .ribbon(new NoteMapRibbonWidget())
                                            .ribbon(new SimilarNotesWidget())
                                            .ribbon(new NoteInfoWidget())
                                            .button(new NoteRevisionsButton())
                                            .button(new NoteActionsWidget())
                                    )
                                    .child(new SharedInfoWidget())
                                    .child(new NoteUpdateStatusWidget())
                                    .child(new FloatingButtons()
                                        .child(new EditButton())
                                        .child(new CodeButtonsWidget())
                                        .child(new RelationMapButtons())
                                        .child(new MermaidExportButton())
                                        .child(new BacklinksWidget())
                                        .child(new HideFloatingButtonsButton())
                                    )
                                    .child(new MermaidWidget())
                                    .child(
                                        new ScrollingContainer()
                                            .filling()
                                            .child(new SqlTableSchemasWidget())
                                            .child(new NoteDetailWidget())
                                            .child(new NoteListWidget())
                                            .child(new SearchResultWidget())
                                            .child(new SqlResultWidget())
                                    )
                                    .child(new ApiLogWidget())
                                    .child(new FindWidget())
                                    .child(
                                        ...this.customWidgets.get('node-detail-pane'), // typo, let's keep it for a while as BC
                                        ...this.customWidgets.get('note-detail-pane')
                                    )
                            )
                        )
                        .child(...this.customWidgets.get('center-pane'))
                    )
                    .child(new RightPaneContainer()
                        .child(new TocWidget())
                        .child(...this.customWidgets.get('right-pane'))
                    )
                )
            )
            .child(new BulkActionsDialog())
            .child(new AboutDialog())
            .child(new NoteSourceDialog())
            .child(new HelpDialog())
            .child(new RecentChangesDialog())
            .child(new BackendLogDialog())
            .child(new BranchPrefixDialog())
            .child(new SortChildNotesDialog())
            .child(new PasswordNoteSetDialog())
            .child(new IncludeNoteDialog())
            .child(new NoteTypeChooserDialog())
            .child(new JumpToNoteDialog())
            .child(new AddLinkDialog())
            .child(new CloneToDialog())
            .child(new MoveToDialog())
            .child(new ImportDialog())
            .child(new ExportDialog())
            .child(new MarkdownImportDialog())
            .child(new ProtectedSessionPasswordDialog())
            .child(new NoteRevisionsDialog())
            .child(new DeleteNotesDialog())
            .child(new InfoDialog())
            .child(new ConfirmDialog())
            .child(new PromptDialog());
    }
}
