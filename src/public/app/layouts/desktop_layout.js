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
import LinkMapWidget from "../widgets/ribbon_widgets/link_map.js";
import NotePathsWidget from "../widgets/ribbon_widgets/note_paths.js";
import SimilarNotesWidget from "../widgets/ribbon_widgets/similar_notes.js";

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
                .child(new ButtonWidget()
                    .icon("bx-history")
                    .title("Show recent changes")
                    .command("showRecentChanges"))
                .child(new SpacerWidget())
                .child(new ProtectedSessionStatusWidget())
                .child(new SyncStatusWidget())
                .child(new LeftPaneToggleWidget())
                .css("width", "54px")
            )
            .child(new LeftPaneContainer()
                .hideInZenMode()
                .css("width", "300px")
                .child(new QuickSearchWidget())
                .child(appContext.mainTreeWidget)
                .child(...this.customWidgets.get('left-pane'))
            )
            .child(new FlexContainer('column')
                .id('center-pane')
                .css("flex-grow", "1")
                .child(new FlexContainer('row').overflowing()
                    .child(new TabRowWidget())
                    .child(new TitleBarButtonsWidget())
                    .css('height', '40px')
                )
                .child(new SplitNoteContainer(() =>
                    new FlexContainer('column')
                        .css("flex-grow", "1")
                        .child(new FlexContainer('row').class('title-row')
                            .css('align-items: center;')
                            .cssBlock('.title-row > * { margin: 5px; }')
                            .overflowing()
                            .child(new NoteIconWidget())
                            .child(new NoteTitleWidget())
                            .child(new SpacerWidget(1))
                            .child(new ClosePaneButton())
                            .child(new CreatePaneButton())
                        )
                        .child(
                            new RibbonContainer()
                                .ribbon(new SearchDefinitionWidget())
                                .ribbon(new BasicPropertiesWidget())
                                .ribbon(new BookPropertiesWidget())
                                .ribbon(new NotePropertiesWidget())
                                .ribbon(new FilePropertiesWidget())
                                .ribbon(new ImagePropertiesWidget())
                                .ribbon(new PromotedAttributesWidget())
                                .ribbon(new OwnedAttributeListWidget())
                                .ribbon(new InheritedAttributesWidget())
                                .ribbon(new NotePathsWidget())
                                .ribbon(new LinkMapWidget())
                                .ribbon(new SimilarNotesWidget())
                                .ribbon(new NoteInfoWidget())
                                .button(new ButtonWidget()
                                    .icon('bx bx-history')
                                    .title("Note Revisions")
                                    .command("showNoteRevisions")
                                    .titlePlacement("bottom"))
                                .button(new NoteActionsWidget())
                        )
                            .child(new NoteUpdateStatusWidget())
                        .child(
                            new ScrollingContainer()
                                .child(new SqlTableSchemasWidget())
                                .child(new NoteDetailWidget())
                                .child(new NoteListWidget())
                                .child(new SearchResultWidget())
                                .child(new SqlResultWidget())
                        )
                        .child(...this.customWidgets.get('center-pane'))
                    )
                )
            );
    }
}
