import FlexContainer from "./flex_container.js";
import GlobalMenuWidget from "./global_menu.js";
import TabRowWidget from "./tab_row.js";
import TitleBarButtonsWidget from "./title_bar_buttons.js";
import StandardTopWidget from "./standard_top_widget.js";
import SidePaneContainer from "./side_pane_container.js";
import GlobalButtonsWidget from "./global_buttons.js";
import SearchBoxWidget from "./search_box.js";
import SearchResultsWidget from "./search_results.js";
import NoteTreeWidget from "./note_tree.js";
import TabCachingWidget from "./tab_caching_widget.js";
import NotePathsWidget from "./note_paths.js";
import NoteTitleWidget from "./note_title.js";
import RunScriptButtonsWidget from "./run_script_buttons.js";
import ProtectedNoteSwitchWidget from "./protected_note_switch.js";
import NoteTypeWidget from "./note_type.js";
import NoteActionsWidget from "./note_actions.js";
import PromotedAttributesWidget from "./promoted_attributes.js";
import NoteDetailWidget from "./note_detail.js";
import NoteInfoWidget from "./note_info.js";
import CalendarWidget from "./calendar.js";
import AttributesWidget from "./attributes.js";
import LinkMapWidget from "./link_map.js";
import NoteRevisionsWidget from "./note_revisions.js";
import SimilarNotesWidget from "./similar_notes.js";
import WhatLinksHereWidget from "./what_links_here.js";
import SidePaneToggles from "./side_pane_toggles.js";

export default class Layout {
    getRootWidget(appContext) {
        const root = new FlexContainer('column').id('root-widget')
            .child(new FlexContainer('row')
                .child(new GlobalMenuWidget())
                .child(new TabRowWidget())
                .child(new TitleBarButtonsWidget()))
            .child(new StandardTopWidget())
            .child(new FlexContainer('row').collapsible()
                .child(new SidePaneContainer('left')
                    .child(new GlobalButtonsWidget())
                    .child(new SearchBoxWidget())
                    .child(new SearchResultsWidget())
                    .child(new NoteTreeWidget())
                )
                .child(new FlexContainer('column').id('center-pane')
                    .child(new FlexContainer('row').class('title-row')
                        .cssBlock('.title-row > * { margin: 5px; }')
                        .child(new TabCachingWidget(() => new NotePathsWidget()))
                        .child(new NoteTitleWidget())
                        .child(new RunScriptButtonsWidget())
                        .child(new ProtectedNoteSwitchWidget())
                        .child(new NoteTypeWidget())
                        .child(new NoteActionsWidget())
                    )
                    .child(new TabCachingWidget(() => new PromotedAttributesWidget()))
                    .child(new TabCachingWidget(() => new NoteDetailWidget()))
                )
                .child(new SidePaneContainer('right')
                    .child(new NoteInfoWidget())
                    .child(new TabCachingWidget(() => new CalendarWidget()))
                    .child(new TabCachingWidget(() => new AttributesWidget()))
                    .child(new TabCachingWidget(() => new LinkMapWidget()))
                    .child(new TabCachingWidget(() => new NoteRevisionsWidget()))
                    .child(new TabCachingWidget(() => new SimilarNotesWidget()))
                    .child(new TabCachingWidget(() => new WhatLinksHereWidget()))
                )
                .child(new SidePaneToggles())
            );

        root.setParent(appContext);
        
        return root;
    }
}