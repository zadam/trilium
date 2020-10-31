import FlexContainer from "../widgets/flex_container.js";
import GlobalMenuWidget from "../widgets/global_menu.js";
import TabRowWidget from "../widgets/tab_row.js";
import TitleBarButtonsWidget from "../widgets/title_bar_buttons.js";
import NoteTreeWidget from "../widgets/note_tree.js";
import TabCachingWidget from "../widgets/tab_caching_widget.js";
import NoteTitleWidget from "../widgets/note_title.js";
import RunScriptButtonsWidget from "../widgets/run_script_buttons.js";
import NoteTypeWidget from "../widgets/note_type.js";
import NoteActionsWidget from "../widgets/note_actions.js";
import NoteDetailWidget from "../widgets/note_detail.js";
import OwnedAttributeListWidget from "../widgets/owned_attribute_list.js";

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
                        .overflowing()
                        .cssBlock('.title-row > * { margin: 5px 5px 0 5px; }')
                        .child(new NoteTitleWidget())
                        .child(new RunScriptButtonsWidget().hideInZenMode())
                        .child(new NoteTypeWidget().hideInZenMode())
                        .child(new NoteActionsWidget().hideInZenMode())
                    )
                    .child(new TabCachingWidget(() => new OwnedAttributeListWidget()))
                    .child(new TabCachingWidget(() => new NoteDetailWidget()))
                    .child(...this.customWidgets.get('center-pane'))
                )
            );
    }
}
