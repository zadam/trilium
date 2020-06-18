import FlexContainer from "../widgets/flex_container.js";
import GlobalMenuWidget from "../widgets/global_menu.js";
import TabRowWidget from "../widgets/tab_row.js";
import TitleBarButtonsWidget from "../widgets/title_bar_buttons.js";
import StandardTopWidget from "../widgets/standard_top_widget.js";
import SidePaneContainer from "../widgets/side_pane_container.js";
import GlobalButtonsWidget from "../widgets/global_buttons.js";
import SearchBoxWidget from "../widgets/search_box.js";
import SearchResultsWidget from "../widgets/search_results.js";
import NoteTreeWidget from "../widgets/note_tree.js";
import TabCachingWidget from "../widgets/tab_caching_widget.js";
import NotePathsWidget from "../widgets/note_paths.js";
import NoteTitleWidget from "../widgets/note_title.js";
import RunScriptButtonsWidget from "../widgets/run_script_buttons.js";
import NoteTypeWidget from "../widgets/note_type.js";
import NoteActionsWidget from "../widgets/note_actions.js";
import PromotedAttributesWidget from "../widgets/promoted_attributes.js";
import NoteDetailWidget from "../widgets/note_detail.js";
import NoteInfoWidget from "../widgets/collapsible_widgets/note_info.js";
import CalendarWidget from "../widgets/collapsible_widgets/calendar.js";
import AttributesWidget from "../widgets/collapsible_widgets/attributes.js";
import LinkMapWidget from "../widgets/collapsible_widgets/link_map.js";
import NoteRevisionsWidget from "../widgets/collapsible_widgets/note_revisions.js";
import SimilarNotesWidget from "../widgets/collapsible_widgets/similar_notes.js";
import WhatLinksHereWidget from "../widgets/collapsible_widgets/what_links_here.js";
import SidePaneToggles from "../widgets/side_pane_toggles.js";
import EditedNotesWidget from "../widgets/collapsible_widgets/edited_notes.js";

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
    max-height: 300px;
}

#right-pane .card-body ul {
    padding-left: 25px;
    margin-bottom: 5px;
}
</style>`;

export default class DesktopMainWindowLayout {
    constructor(customWidgets) {
        this.customWidgets = customWidgets;
    }

    getRootWidget(appContext) {
        appContext.mainTreeWidget = new NoteTreeWidget("main");

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
                .filling()
                .child(new SidePaneContainer('left')
                    .hideInZenMode()
                    .child(new GlobalButtonsWidget())
                    .child(new SearchBoxWidget())
                    .child(new SearchResultsWidget())
                    .child(new TabCachingWidget(() => new NotePathsWidget()))
                    .child(appContext.mainTreeWidget)
                    .child(...this.customWidgets.get('left-pane'))
                )
                .child(new FlexContainer('column').id('center-pane')
                    .child(new FlexContainer('row').class('title-row')
                        .cssBlock('.title-row > * { margin: 5px; }')
                        .child(new NoteTitleWidget())
                        .child(new RunScriptButtonsWidget().hideInZenMode())
                        .child(new NoteTypeWidget().hideInZenMode())
                        .child(new NoteActionsWidget().hideInZenMode())
                    )
                    .child(new TabCachingWidget(() => new PromotedAttributesWidget()))
                    .child(new TabCachingWidget(() => new NoteDetailWidget()))
                    .child(...this.customWidgets.get('center-pane'))
                )
                .child(new SidePaneContainer('right')
                    .cssBlock(RIGHT_PANE_CSS)
                    .hideInZenMode()
                    .child(new NoteInfoWidget())
                    .child(new TabCachingWidget(() => new CalendarWidget()))
                    .child(new TabCachingWidget(() => new EditedNotesWidget()))
                    .child(new TabCachingWidget(() => new AttributesWidget()))
                    .child(new TabCachingWidget(() => new LinkMapWidget()))
                    .child(new TabCachingWidget(() => new NoteRevisionsWidget()))
                    .child(new TabCachingWidget(() => new SimilarNotesWidget()))
                    .child(new TabCachingWidget(() => new WhatLinksHereWidget()))
                    .child(...this.customWidgets.get('right-pane'))
                )
                .child(new SidePaneToggles().hideInZenMode())
            );
    }
}
