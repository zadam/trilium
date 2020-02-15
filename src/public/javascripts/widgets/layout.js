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
        return new FlexContainer(appContext, appContext, { 'flex-direction': 'column', 'height': '100vh' }, [
            parent => new FlexContainer(appContext, parent, { 'flex-direction': 'row' }, [
                parent => new GlobalMenuWidget(appContext, parent),
                parent => new TabRowWidget(appContext, parent),
                parent => new TitleBarButtonsWidget(appContext, parent)
            ]),
            parent => new StandardTopWidget(appContext, parent),
            parent => new FlexContainer(appContext, parent, { 'flex-direction': 'row', 'overflow': 'hidden' }, [
                parent => new SidePaneContainer(appContext, parent, 'left', [
                    parent => new GlobalButtonsWidget(appContext, parent),
                    parent => new SearchBoxWidget(appContext, parent),
                    parent => new SearchResultsWidget(appContext, parent),
                    parent => new NoteTreeWidget(appContext, parent)
                ]),
                parent => new FlexContainer(appContext, parent, { id: 'center-pane', 'flex-direction': 'column' }, [
                    parent => new FlexContainer(appContext, parent, { 'flex-direction': 'row' }, [
                        parent => new TabCachingWidget(appContext, parent, parent => new NotePathsWidget(appContext, parent)),
                        parent => new NoteTitleWidget(appContext, parent),
                        parent => new RunScriptButtonsWidget(appContext, parent),
                        parent => new ProtectedNoteSwitchWidget(appContext, parent),
                        parent => new NoteTypeWidget(appContext, parent),
                        parent => new NoteActionsWidget(appContext, parent)
                    ]),
                    parent => new TabCachingWidget(appContext, parent, parent => new PromotedAttributesWidget(appContext, parent)),
                    parent => new TabCachingWidget(appContext, parent, parent => new NoteDetailWidget(appContext, parent))
                ]),
                parent => new SidePaneContainer(appContext, parent, 'right', [
                    parent => new NoteInfoWidget(appContext, parent),
                    parent => new TabCachingWidget(appContext, parent, parent => new CalendarWidget(appContext, parent)),
                    parent => new TabCachingWidget(appContext, parent, parent => new AttributesWidget(appContext, parent)),
                    parent => new TabCachingWidget(appContext, parent, parent => new LinkMapWidget(appContext, parent)),
                    parent => new TabCachingWidget(appContext, parent, parent => new NoteRevisionsWidget(appContext, parent)),
                    parent => new TabCachingWidget(appContext, parent, parent => new SimilarNotesWidget(appContext, parent)),
                    parent => new TabCachingWidget(appContext, parent, parent => new WhatLinksHereWidget(appContext, parent))
                ]),
                parent => new SidePaneToggles(appContext, parent)
            ])
        ])
    }
}