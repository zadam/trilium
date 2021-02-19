import FlexContainer from "../widgets/flex_container.js";
import GlobalMenuWidget from "../widgets/global_menu.js";
import TabRowWidget from "../widgets/tab_row.js";
import TitleBarButtonsWidget from "../widgets/title_bar_buttons.js";
import NoteTreeWidget from "../widgets/note_tree.js";
import TabCachingWidget from "../widgets/tab_caching_widget.js";
import NoteTitleWidget from "../widgets/note_title.js";
import NoteTypeWidget from "../widgets/note_type.js";
import NoteActionsWidget from "../widgets/note_actions.js";
import NoteDetailWidget from "../widgets/note_detail.js";
import OwnedAttributeListWidget from "../widgets/type_property_widgets/owned_attribute_list.js";
import CollapsibleSectionContainer from "../widgets/collapsible_section_container.js";
import SearchDefinitionWidget from "../widgets/type_property_widgets/search_definition.js";
import PromotedAttributesWidget from "../widgets/type_property_widgets/promoted_attributes.js";
import InheritedAttributesWidget from "../widgets/type_property_widgets/inherited_attribute_list.js";
import Container from "../widgets/container.js";
import SqlTableSchemasWidget from "../widgets/sql_table_schemas.js";
import NoteListWidget from "../widgets/note_list.js";
import SqlResultWidget from "../widgets/sql_result.js";
import FilePropertiesWidget from "../widgets/type_property_widgets/file_properties.js";
import ImagePropertiesWidget from "../widgets/type_property_widgets/image_properties.js";
import NotePropertiesWidget from "../widgets/type_property_widgets/note_properties.js";
import NoteIconWidget from "../widgets/note_icon.js";
import NotePathsWidget from "../widgets/note_paths.js";
import SearchResultWidget from "../widgets/search_result.js";

export default class DesktopExtraWindowLayout {
    constructor(customWidgets) {
        this.customWidgets = customWidgets;
    }

    getRootWidget(appContext) {
        appContext.mainTreeWidget = new NoteTreeWidget();

        return new FlexContainer('column')
            .setParent(appContext)
            .id('root-widget')
            .css('height', '100vh')
            .child(new FlexContainer('row').overflowing()
                .child(new GlobalMenuWidget())
                .child(new TabRowWidget())
                .child(new TitleBarButtonsWidget()))
            .child(new FlexContainer('row')
                .collapsible()
                .filling()
                .child(new FlexContainer('column').id('center-pane').filling()
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
                    .child(...this.customWidgets.get('center-pane'))
                )
            );
    }
}
