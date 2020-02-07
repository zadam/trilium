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
        return new FlexContainer(appContext, { 'flex-direction': 'column', 'height': '100vh' }, [
            new FlexContainer(appContext, { 'flex-direction': 'row' }, [
                new GlobalMenuWidget(appContext),
                new TabRowWidget(appContext),
                new TitleBarButtonsWidget(appContext)
            ]),
            new StandardTopWidget(appContext),
            new FlexContainer(appContext, { 'flex-direction': 'row', 'overflow': 'hidden' }, [
                new SidePaneContainer(appContext, 'left', [
                    new GlobalButtonsWidget(appContext),
                    new SearchBoxWidget(appContext),
                    new SearchResultsWidget(appContext),
                    new NoteTreeWidget(appContext)
                ]),
                new FlexContainer(appContext, { id: 'center-pane', 'flex-direction': 'column' }, [
                    new FlexContainer(appContext, { 'flex-direction': 'row' }, [
                        new TabCachingWidget(appContext, () => new NotePathsWidget(appContext)),
                        new NoteTitleWidget(appContext),
                        new RunScriptButtonsWidget(appContext),
                        new ProtectedNoteSwitchWidget(appContext),
                        new NoteTypeWidget(appContext),
                        new NoteActionsWidget(appContext)
                    ]),
                    new TabCachingWidget(appContext, () => new PromotedAttributesWidget(appContext)),
                    new TabCachingWidget(appContext, () => new NoteDetailWidget(appContext))
                ]),
                new SidePaneContainer(appContext, 'right', [
                    new NoteInfoWidget(appContext),
                    new TabCachingWidget(appContext, () => new CalendarWidget(appContext)),
                    new TabCachingWidget(appContext, () => new AttributesWidget(appContext)),
                    new TabCachingWidget(appContext, () => new LinkMapWidget(appContext)),
                    new TabCachingWidget(appContext, () => new NoteRevisionsWidget(appContext)),
                    new TabCachingWidget(appContext, () => new SimilarNotesWidget(appContext)),
                    new TabCachingWidget(appContext, () => new WhatLinksHereWidget(appContext))
                ]),
                new SidePaneToggles(appContext)
            ])
        ])
    }
}