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
            parent => new FlexContainer(parent, { 'flex-direction': 'row' }, [
                parent => new GlobalMenuWidget(parent),
                parent => new TabRowWidget(parent),
                parent => new TitleBarButtonsWidget(parent)
            ]),
            parent => new StandardTopWidget(parent),
            parent => new FlexContainer(parent, { 'flex-direction': 'row', 'overflow': 'hidden' }, [
                parent => new SidePaneContainer(parent, 'left', [
                    parent => new GlobalButtonsWidget(parent),
                    parent => new SearchBoxWidget(parent),
                    parent => new SearchResultsWidget(parent),
                    parent => new NoteTreeWidget(parent)
                ]),
                parent => new FlexContainer(parent, { id: 'center-pane', 'flex-direction': 'column' }, [
                    parent => new FlexContainer(parent, { 'flex-direction': 'row' }, [
                        parent => new TabCachingWidget(parent, parent => new NotePathsWidget(parent)),
                        parent => new NoteTitleWidget(parent),
                        parent => new RunScriptButtonsWidget(parent),
                        parent => new ProtectedNoteSwitchWidget(parent),
                        parent => new NoteTypeWidget(parent),
                        parent => new NoteActionsWidget(parent)
                    ]),
                    parent => new TabCachingWidget(parent, parent => new PromotedAttributesWidget(parent)),
                    parent => new TabCachingWidget(parent, parent => new NoteDetailWidget(parent))
                ]),
                parent => new SidePaneContainer(parent, 'right', [
                    parent => new NoteInfoWidget(parent),
                    parent => new TabCachingWidget(parent, parent => new CalendarWidget(parent)),
                    parent => new TabCachingWidget(parent, parent => new AttributesWidget(parent)),
                    parent => new TabCachingWidget(parent, parent => new LinkMapWidget(parent)),
                    parent => new TabCachingWidget(parent, parent => new NoteRevisionsWidget(parent)),
                    parent => new TabCachingWidget(parent, parent => new SimilarNotesWidget(parent)),
                    parent => new TabCachingWidget(parent, parent => new WhatLinksHereWidget(parent))
                ]),
                parent => new SidePaneToggles(parent)
            ])
        ])
    }
}