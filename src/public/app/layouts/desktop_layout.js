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
import SyncStatusWidget from "../widgets/sync_status.js";
import ScrollingContainer from "../widgets/containers/scrolling_container.js";
import RootContainer from "../widgets/containers/root_container.js";
import NoteUpdateStatusWidget from "../widgets/note_update_status.js";
import SpacerWidget from "../widgets/spacer.js";
import QuickSearchWidget from "../widgets/quick_search.js";
import ButtonWidget from "../widgets/buttons/button_widget.js";
import ProtectedSessionStatusWidget from "../widgets/buttons/protected_session_status.js";
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
import CalendarWidget from "../widgets/buttons/calendar.js";
import EditedNotesWidget from "../widgets/ribbon_widgets/edited_notes.js";
import OpenNoteButtonWidget from "../widgets/buttons/open_note_button_widget.js";
import MermaidWidget from "../widgets/mermaid.js";
import BookmarkButtons from "../widgets/bookmark_buttons.js";
import NoteWrapperWidget from "../widgets/note_wrapper.js";
import BacklinksWidget from "../widgets/backlinks.js";
import SharedInfoWidget from "../widgets/shared_info.js";

export default class DesktopLayout {
    constructor(customWidgets) {
        this.customWidgets = customWidgets;
    }

    getRootWidget(appContext) {
        appContext.mainTreeWidget = new NoteTreeWidget("main");

        return new RootContainer()
            .setParent(appContext)
            .child(new FlexContainer("column")
                .id("launcher-pane")
                .css("width", "53px")
                .child(new GlobalMenuWidget())
                .child(new ButtonWidget()
                    .icon("bx-file-blank")
                    .title("New note")
                    .command("createNoteIntoInbox"))
                .child(new ButtonWidget()
                    .icon("bx-search")
                    .title("Search")
                    .command("searchNotes"))
                .child(new ButtonWidget()
                    .icon("bx-send")
                    .title("Jump to note")
                    .command("jumpToNote"))
                .child(new OpenNoteButtonWidget()
                    .targetNote('globalnotemap'))
                .child(new ButtonWidget()
                    .icon("bx-history")
                    .title("Show recent changes")
                    .command("showRecentChanges"))
                .child(new CalendarWidget())
                .child(new SpacerWidget(40, 0))
                .child(new FlexContainer("column")
                    .id("plugin-buttons")
                    .contentSized())
                .child(new BookmarkButtons())
                .child(new SpacerWidget(0, 1000))
                .child(new ProtectedSessionStatusWidget())
                .child(new SyncStatusWidget())
                .child(new LeftPaneToggleWidget())
            )
            .child(new LeftPaneContainer()
                .child(new QuickSearchWidget())
                .child(appContext.mainTreeWidget)
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
                                        .button(new EditButton())
                                        .button(new ButtonWidget()
                                            .icon('bx-history')
                                            .title("Note Revisions")
                                            .command("showNoteRevisions")
                                            .titlePlacement("bottom"))
                                        .button(new NoteActionsWidget())
                                )
                                .child(new SharedInfoWidget())
                                .child(new NoteUpdateStatusWidget())
                                .child(new BacklinksWidget())
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
                                .child(...this.customWidgets.get('node-detail-pane'))
                            )
                        )
                        .child(...this.customWidgets.get('center-pane'))
                    )
                    .child(new RightPaneContainer()
                        .child(...this.customWidgets.get('right-pane'))
                    )
                )
            );
    }
}
