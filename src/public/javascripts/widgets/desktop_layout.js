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

const RIGHT_PANE_CSS = `
<style>
#right-pane {
    overflow: auto;
}

#right-pane .card {
    border: 0;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
}

#right-pane .card-header {
    background: inherit;
    padding: 3px 10px 3px 10px;
    width: 99%; /* to give minimal right margin */
    background-color: var(--button-background-color);
    border-color: var(--button-border-color);
    border-width: 1px;
    border-radius: 4px;
    border-style: solid;
    display: flex;
    justify-content: space-between;
}

#right-pane .widget-title {
    border-radius: 0;
    padding: 0;
    border: 0;
    background: inherit;
    font-weight: bold;
    text-transform: uppercase;
    color: var(--muted-text-color) !important;
}

#right-pane .widget-header-action {
    color: var(--link-color) !important;
    cursor: pointer;
}

#right-pane .widget-help {
    color: var(--muted-text-color);
    position: relative;
    top: 2px;
}

#right-pane .widget-help.no-link:hover {
    cursor: default;
    text-decoration: none;
}

#right-pane .body-wrapper {
    overflow: auto;
}

#right-pane .card-body {
    width: 100%;
    padding: 8px;
    border: 0;
    height: 100%;
    overflow: auto;
}

#right-pane .card-body ul {
    padding-left: 25px;
    margin-bottom: 5px;
}
</style>`;

export default class DesktopLayout {
    getRootWidget(appContext) {
        return new FlexContainer('column')
            .setParent(appContext)
            .id('root-widget')
            .css('height', '100vh')
            .child(new FlexContainer('row')
                .child(new GlobalMenuWidget())
                .child(new TabRowWidget())
                .child(new TitleBarButtonsWidget()))
            .child(new StandardTopWidget()
                .hideInZenMode())
            .child(new FlexContainer('row')
                .collapsible()
                .child(new SidePaneContainer('left')
                    .hideInZenMode()
                    .child(new GlobalButtonsWidget())
                    .child(new SearchBoxWidget())
                    .child(new SearchResultsWidget())
                    .child(new NoteTreeWidget())
                )
                .child(new FlexContainer('column').id('center-pane')
                    .child(new FlexContainer('row').class('title-row')
                        .cssBlock('.title-row > * { margin: 5px; }')
                        .child(new TabCachingWidget(() => new NotePathsWidget()).hideInZenMode())
                        .child(new NoteTitleWidget())
                        .child(new RunScriptButtonsWidget().hideInZenMode())
                        .child(new ProtectedNoteSwitchWidget().hideInZenMode())
                        .child(new NoteTypeWidget().hideInZenMode())
                        .child(new NoteActionsWidget().hideInZenMode())
                    )
                    .child(new TabCachingWidget(() => new PromotedAttributesWidget()))
                    .child(new TabCachingWidget(() => new NoteDetailWidget()))
                )
                .child(new SidePaneContainer('right')
                    .cssBlock(RIGHT_PANE_CSS)
                    .hideInZenMode()
                    .child(new NoteInfoWidget())
                    .child(new TabCachingWidget(() => new CalendarWidget()))
                    .child(new TabCachingWidget(() => new AttributesWidget()))
                    .child(new TabCachingWidget(() => new LinkMapWidget()))
                    .child(new TabCachingWidget(() => new NoteRevisionsWidget()))
                    .child(new TabCachingWidget(() => new SimilarNotesWidget()))
                    .child(new TabCachingWidget(() => new WhatLinksHereWidget()))
                )
                .child(new SidePaneToggles().hideInZenMode())
            );
    }
}