import FlexContainer from "./flex_container.js";
import NoteTitleWidget from "./note_title.js";
import NoteDetailWidget from "./note_detail.js";
import NoteTreeWidget from "./note_tree.js";
import MobileGlobalButtonsWidget from "./mobile_global_buttons.js";

export default class MobileLayout {
    getRootWidget(appContext) {
        return new FlexContainer('row')
            .setParent(appContext)
            .id('root-widget')
            .css('height', '100vh')
            .child(new FlexContainer('column')
                .class("d-sm-flex d-md-flex d-lg-flex d-xl-flex col-12 col-sm-5 col-md-4 col-lg-4 col-xl-4")
                .child(new MobileGlobalButtonsWidget())
                .child(new NoteTreeWidget()))
            .child(new FlexContainer('column')
                .class("d-none d-sm-flex d-md-flex d-lg-flex d-xl-flex col-12 col-sm-7 col-md-8 col-lg-8")
                .child(new NoteTitleWidget())
                .child(new NoteDetailWidget()));
    }
}