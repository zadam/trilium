import FlexContainer from "./containers/flex_container.js";
import searchService from "../services/search.js";
import OpenNoteButtonWidget from "./buttons/open_note_button_widget.js";
import BookmarkFolderWidget from "./buttons/bookmark_folder.js";
import BasicWidget from "./basic_widget.js";

const TLP = `
    <style>
        #banner-message {
            text-align: center;
            font-weight: 900;
            font-size: .85rem;
            width: 100%;
            background-color: var(--banner-background-color);
            color: var(--banner-color);
            padding: 8px 20px;
        }
        
        #banner-message:empty {
            padding: 0;
        }
    </style>
    <div id="banner-message"></div>
`

export default class BannerMessageWidget extends BasicWidget {
    constructor() {
        super();
    }

    doRender() {
        this.$widget = $(TLP);
    }
}
