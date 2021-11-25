import FlexContainer from "./containers/flex_container.js";
import searchService from "../services/search.js";
import OpenNoteButtonWidget from "./buttons/open_note_button_widget.js";
import BookmarkFolderWidget from "./buttons/bookmark_folder.js";
import BasicWidget from "./basic_widget.js";

const TLP = `
    <div id="banner-message" class="empty">
        <style>        
            #banner-message {
                text-align: center;
                font-weight: 900;
                font-size: 1rem;
                width: 100%;
                color: var(--banner-color);
            }
            
            #banner-message.error {
                background-color: var(--banner-background-color-error);
            }
            
            #banner-message.info {
                background-color: var(--banner-background-color-info);
            }
            
            #banner-message.warning {
                background-color: var(--banner-background-color-warning);
            }
            
            #banner-message.success {
                background-color: var(--banner-background-color-success);
            }
            
            #banner-message.plain {
                background-color: var(--banner-background-color-plain);
            }
            
            #banner-message > p {
                margin: 0;
                padding: 5px 20px;
            }
            
            #banner-message.empty > p {
                padding: 0;
            }
        </style>
        <p></p>
    </div>
`;

const AVAILABLE_TYPES = new Set([
    "error", "info", "warning", "success", "plain"
]);

export default class BannerMessageWidget extends BasicWidget {
    constructor() {
        super();
    }

    doRender() {
        this.$widget = $(TLP);
        this.$banner = this.$widget;
        this.$bannerParagraph = this.$banner.find("p");
    }

    hideBanner() {
        this.$bannerParagraph.text("");
        this.$banner.removeClass();
        this.$banner.addClass("empty");
    }

    setBannerEvent({
        text,
        type = "alert"
    }) {
        if (!text) {
            this.hideBanner();
            return;
        }

        const className = AVAILABLE_TYPES.has(type) ? type : "plain";

        this.$bannerParagraph.text(text);
        this.$banner.removeClass();
        this.$banner.addClass(className);
    }

    hideBannerEvent() {
        this.hideBanner();
    }
}
