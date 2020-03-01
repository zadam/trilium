import FlexContainer from "./flex_container.js";
import NoteTitleWidget from "./note_title.js";
import NoteDetailWidget from "./note_detail.js";
import NoteTreeWidget from "./note_tree.js";

export default class MobileLayout {
    getRootWidget(appContext) {
        return new FlexContainer('row')
            .setParent(appContext)
            .id('root-widget')
            .css('height', '100vh')
            .child(new FlexContainer('column')
                // .child(/* buttons */)
                .child(new NoteTreeWidget()))
            .child(new FlexContainer('column')
                .child(new NoteTitleWidget())
                .child(new NoteDetailWidget()));
    }
}