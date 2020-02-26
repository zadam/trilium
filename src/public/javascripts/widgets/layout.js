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
        const root = new FlexContainer(appContext)
            .child(new FlexContainer('row')
                .child(new GlobalMenuWidget())
                .child(new TabRowWidget())
                .child(new TitleBarButtonsWidget()))
            .child(new StandardTopWidget())
            new FlexContainer({ 'flex-direction': 'row', 'min-height': '0' }, [
                new SidePaneContainer('left', [
                    new GlobalButtonsWidget(),
                    new SearchBoxWidget(),
                    new SearchResultsWidget(),
                    new NoteTreeWidget()
                ]),
                new FlexContainer({ id: 'center-pane', 'flex-direction': 'column' }, [
                    new FlexContainer({ 'flex-direction': 'row' }, [
                        new TabCachingWidget(new NotePathsWidget()),
                        new NoteTitleWidget(),
                        new RunScriptButtonsWidget(),
                        new ProtectedNoteSwitchWidget(),
                        new NoteTypeWidget(),
                        new NoteActionsWidget()
                    ]),
                    new TabCachingWidget(new PromotedAttributesWidget()),
                    new TabCachingWidget(new NoteDetailWidget())
                ]),
                new SidePaneContainer('right', [
                    new NoteInfoWidget(),
                    new TabCachingWidget(() => new CalendarWidget()),
                    new TabCachingWidget(() => new AttributesWidget()),
                    new TabCachingWidget(() => new LinkMapWidget()),
                    new TabCachingWidget(() => new NoteRevisionsWidget()),
                    new TabCachingWidget(() => new SimilarNotesWidget()),
                    new TabCachingWidget(() => new WhatLinksHereWidget())
                ]),
                new SidePaneToggles()
            ])
        ]);

        root.setParent(appContext);
        
        return root;
    }
}