import FlexContainer from "../widgets/flex_container.js";
import NoteTitleWidget from "../widgets/note_title.js";
import NoteDetailWidget from "../widgets/note_detail.js";
import NoteTreeWidget from "../widgets/note_tree.js";
import MobileGlobalButtonsWidget from "../widgets/mobile_widgets/mobile_global_buttons.js";
import CloseDetailButtonWidget from "../widgets/mobile_widgets/close_detail_button.js";
import MobileDetailMenuWidget from "../widgets/mobile_widgets/mobile_detail_menu.js";
import ScreenContainer from "../widgets/mobile_widgets/screen_container.js";

const MOBILE_CSS = `
<style>
kbd {
    display: none;
}

.dropdown-menu {
    font-size: larger;
}

.action-button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.5em;
    padding-left: 0.5em;
    padding-right: 0.5em;
}
</style>`;

const FANCYTREE_CSS = `
<style>
.fancytree-custom-icon {
    font-size: 2em;
}

.fancytree-title {
    font-size: 1.5em;
    margin-left: 0.6em !important;
}

.fancytree-node {
    padding: 5px;
}

.fancytree-node .fancytree-expander:before {
    font-size: 2em !important;
}

span.fancytree-expander {
    width: 24px !important;
}

.fancytree-loading span.fancytree-expander {
    width: 24px;
    height: 32px;
}

.fancytree-loading  span.fancytree-expander:after {
    width: 20px;
    height: 20px;
    margin-top: 4px;
    border-width: 2px;
    border-style: solid;
}
</style>`;

export default class MobileLayout {
    getRootWidget(appContext) {
        return new FlexContainer('row').cssBlock(MOBILE_CSS)
            .setParent(appContext)
            .id('root-widget')
            .css('height', '100vh')
            .child(new ScreenContainer("tree", 'column')
                .class("d-sm-flex d-md-flex d-lg-flex d-xl-flex col-12 col-sm-5 col-md-4 col-lg-4 col-xl-4")
                .child(new MobileGlobalButtonsWidget())
                .child(new NoteTreeWidget("main").cssBlock(FANCYTREE_CSS)))
            .child(new ScreenContainer("detail", "column")
                .class("d-sm-flex d-md-flex d-lg-flex d-xl-flex col-12 col-sm-7 col-md-8 col-lg-8")
                .child(new FlexContainer('row')
                    .child(new MobileDetailMenuWidget())
                    .child(new NoteTitleWidget()
                        .css('padding', '10px')
                        .css('font-size', 'larger'))
                    .child(new CloseDetailButtonWidget()))
                .child(new NoteDetailWidget()
                    .css('padding', '5px 20px 10px 0')));
    }
}