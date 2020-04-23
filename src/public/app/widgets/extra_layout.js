import FlexContainer from "./flex_container.js";
import GlobalMenuWidget from "./global_menu.js";
import TabRowWidget from "./tab_row.js";
import TitleBarButtonsWidget from "./title_bar_buttons.js";
import NoteTreeWidget from "./note_tree.js";
import TabCachingWidget from "./tab_caching_widget.js";
import NoteTitleWidget from "./note_title.js";
import RunScriptButtonsWidget from "./run_script_buttons.js";
import ProtectedNoteSwitchWidget from "./protected_note_switch.js";
import NoteTypeWidget from "./note_type.js";
import NoteActionsWidget from "./note_actions.js";
import PromotedAttributesWidget from "./promoted_attributes.js";
import NoteDetailWidget from "./note_detail.js";

export default class ExtraLayout {
    constructor(customWidgets) {
        this.customWidgets = customWidgets;
    }

    getRootWidget(appContext) {
        appContext.mainTreeWidget = new NoteTreeWidget();

        return new FlexContainer('column')
            .setParent(appContext)
            .id('root-widget')
            .css('height', '100vh')
            .child(new FlexContainer('row')
                .child(new GlobalMenuWidget())
                .child(new TabRowWidget())
                .child(new TitleBarButtonsWidget()))
            .child(new FlexContainer('row')
                .collapsible()
                .child(new FlexContainer('column').id('center-pane')
                    .child(new FlexContainer('row').class('title-row')
                        .cssBlock('.title-row > * { margin: 5px; }')
                        .child(new NoteTitleWidget())
                        .child(new RunScriptButtonsWidget().hideInZenMode())
                        .child(new ProtectedNoteSwitchWidget().hideInZenMode())
                        .child(new NoteTypeWidget().hideInZenMode())
                        .child(new NoteActionsWidget().hideInZenMode())
                    )
                    .child(new TabCachingWidget(() => new PromotedAttributesWidget()))
                    .child(new TabCachingWidget(() => new NoteDetailWidget()))
                    .child(...this.customWidgets.get('center-pane'))
                )
            );
    }
}