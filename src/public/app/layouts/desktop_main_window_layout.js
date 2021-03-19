import FlexContainer from "../widgets/flex_container.js";
import GlobalMenuWidget from "../widgets/global_menu.js";
import TabRowWidget from "../widgets/tab_row.js";
import TitleBarButtonsWidget from "../widgets/title_bar_buttons.js";
import StandardTopWidget from "../widgets/standard_top_widget.js";
import SidePaneContainer from "../widgets/side_pane_container.js";
import NoteTreeWidget from "../widgets/note_tree.js";
import TabCachingWidget from "../widgets/tab_caching_widget.js";
import NotePathsWidget from "../widgets/note_paths.js";
import NoteTitleWidget from "../widgets/note_title.js";
import OwnedAttributeListWidget from "../widgets/type_property_widgets/owned_attribute_list.js";
import NoteTypeWidget from "../widgets/note_type.js";
import NoteActionsWidget from "../widgets/note_actions.js";
import NoteDetailWidget from "../widgets/note_detail.js";
import NoteInfoWidget from "../widgets/collapsible_widgets/note_info.js";
import CalendarWidget from "../widgets/collapsible_widgets/calendar.js";
import LinkMapWidget from "../widgets/collapsible_widgets/link_map.js";
import NoteRevisionsWidget from "../widgets/collapsible_widgets/note_revisions.js";
import SimilarNotesWidget from "../widgets/similar_notes.js";
import WhatLinksHereWidget from "../widgets/collapsible_widgets/what_links_here.js";
import SidePaneToggles from "../widgets/side_pane_toggles.js";
import EditedNotesWidget from "../widgets/collapsible_widgets/edited_notes.js";
import CollapsibleSectionContainer from "../widgets/collapsible_section_container.js";
import PromotedAttributesWidget from "../widgets/type_property_widgets/promoted_attributes.js";
import InheritedAttributesWidget from "../widgets/type_property_widgets/inherited_attribute_list.js";
import NoteListWidget from "../widgets/note_list.js";
import SearchDefinitionWidget from "../widgets/type_property_widgets/search_definition.js";
import Container from "../widgets/container.js";
import SqlResultWidget from "../widgets/sql_result.js";
import SqlTableSchemasWidget from "../widgets/sql_table_schemas.js";
import FilePropertiesWidget from "../widgets/type_property_widgets/file_properties.js";
import ImagePropertiesWidget from "../widgets/type_property_widgets/image_properties.js";
import NotePropertiesWidget from "../widgets/type_property_widgets/note_properties.js";
import NoteIconWidget from "../widgets/note_icon.js";
import SearchResultWidget from "../widgets/search_result.js";
import SyncStatusWidget from "../widgets/sync_status.js";

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
    padding: 6px 10px 3px 0;
    width: 99%; /* to give minimal right margin */
    background-color: var(--button-background-color);
    border-color: var(--button-border-color);
    border-width: 0 0 1px 0;
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
    cursor: pointer;
    color: var(--main-text-color) !important;
    text-decoration: none;
    font-size: large;
    position: relative;
    top: 2px;
}

#right-pane .widget-help {
    color: var(--muted-text-color);
    position: relative;
    top: 2px;
    font-size: large;
}

#right-pane .widget-help.no-link:hover {
    cursor: default;
    text-decoration: none;
}

#right-pane .widget-toggle-button {
    cursor: pointer;
    color: var(--main-text-color) !important;
}

#right-pane .widget-toggle-button:hover {
    text-decoration: none !important;
}

#right-pane .widget-toggle-icon {
    position: relative;
    top: 2px;
    font-size: large;
    padding-left: 5px;
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
            .child(new FlexContainer('row').overflowing()
                .css('height', '36px')
                .child(new GlobalMenuWidget())
                .child(new SyncStatusWidget())
                .child(new TabRowWidget())
                .child(new TitleBarButtonsWidget()))
            .child(new StandardTopWidget()
                .hideInZenMode())
            .child(new FlexContainer('row')
                .collapsible()
                .filling()
                .child(new SidePaneContainer('left')
                    .hideInZenMode()
                    .child(appContext.mainTreeWidget)
                    .child(...this.customWidgets.get('left-pane'))
                )
                .child(new FlexContainer('column').id('center-pane')
                    .child(new FlexContainer('row').class('title-row')
                        .css('align-items: center;')
                        .cssBlock('.title-row > * { margin: 5px; }')
                        .overflowing()
                        .child(new NoteIconWidget())
                        .child(new NoteTitleWidget())
                        .child(new NotePathsWidget().hideInZenMode())
                        .child(new NoteTypeWidget().hideInZenMode())
                        .child(new NoteActionsWidget().hideInZenMode())
                    )
                    .child(
                        new TabCachingWidget(() => new CollapsibleSectionContainer()
                            .child(new SearchDefinitionWidget())
                            .child(new NotePropertiesWidget())
                            .child(new FilePropertiesWidget())
                            .child(new ImagePropertiesWidget())
                            .child(new PromotedAttributesWidget())
                            .child(new OwnedAttributeListWidget())
                            .child(new InheritedAttributesWidget())
                        )
                    )
                    .child(new Container()
                        .css('height: 100%; overflow: auto;')
                        .child(new TabCachingWidget(() => new SqlTableSchemasWidget()))
                        .child(new TabCachingWidget(() => new NoteDetailWidget()))
                        .child(new TabCachingWidget(() => new NoteListWidget()))
                        .child(new TabCachingWidget(() => new SearchResultWidget()))
                        .child(new TabCachingWidget(() => new SqlResultWidget()))
                    )
                    .child(new TabCachingWidget(() => new SimilarNotesWidget()))
                    .child(...this.customWidgets.get('center-pane'))
                )
                .child(new SidePaneContainer('right')
                    .cssBlock(RIGHT_PANE_CSS)
                    .hideInZenMode()
                    .child(new NoteInfoWidget())
                    .child(new TabCachingWidget(() => new CalendarWidget()))
                    .child(new TabCachingWidget(() => new EditedNotesWidget()))
                    .child(new TabCachingWidget(() => new LinkMapWidget()))
                    .child(new TabCachingWidget(() => new NoteRevisionsWidget()))
                    .child(new TabCachingWidget(() => new WhatLinksHereWidget()))
                    .child(...this.customWidgets.get('right-pane'))
                )
                .child(new SidePaneToggles().hideInZenMode())
            );
    }
}
