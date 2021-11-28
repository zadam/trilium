import BasicWidget from "./basic_widget.js";
import Timer from "../services/timer.js";

const TLP = `
    <div id="banner-message" class="empty">
        <style>       
            @keyframes bannerMessageTimer {
                0% {
                    transform: scaleX(1);  
                }
                100% {
                    transform: scaleX(0);
                }
            }
            
            @keyframes bannerMessageTimerIndefinite {
                0%, 100% {
                    opacity: 0.4;
                }
                40% {
                    opacity: 0;
                }
            }
         
            #banner-message {
                text-align: center;
                font-weight: 900;
                font-size: 1rem;
                width: 100%;
                color: var(--banner-color);
                background: var(--banner-background-color);
                
                position: relative;
            }
            
            #banner-message > p {
                margin: 0;
                padding: 5px 20px;
            }
            
            #banner-message.empty > p {
                padding: 0;
            }
            
            #banner-message > .timer {
                position: absolute;
                left: 0;
                bottom: 0;
                width: 100%;
                height: 1px;
                background: #fff;
                opacity: .4;
                animation: bannerMessageTimer linear 5s forwards;
                transform-origin: left;
                will-change: transform;
            }
            
            #banner-message > .timer.indefinite {
                animation: bannerMessageTimerIndefinite linear 1s infinite;
            }
        </style>
        <p></p>
        <div class="timer"></div>
    </div>
`;

const AVAILABLE_TYPES = new Set([
    "error", "info", "warning", "success", "plain"
]);

export default class BannerMessageWidget extends BasicWidget {
    durationTimer;

    constructor() {
        super();
    }

    doRender() {
        this.$widget = $(TLP);
        this.$bannerParagraph = this.$widget.find("p");
        this.$timer = this.$widget.find(".timer");

        this.$widget.on("mouseenter", this.pauseTimer.bind(this));
        this.$widget.on("mouseleave", this.resumeTimer.bind(this));
    }

    hideBanner() {
        this.$bannerParagraph.text("");
        this.$widget.removeClass();
        this.$widget.addClass("empty");

        // In case `hideBanner` is called before the actual end, clear timer to avoid hard bugs
        this.durationTimer?.clear();
        this.durationTimer = undefined;
    }

    pauseTimer() {
        if (this.durationTimer) {
            this.$timer.css({
                animationPlayState: "paused",
            });
            this.durationTimer?.pause();
        }
    }

    resumeTimer() {
        if (this.durationTimer) {
            this.$timer.css({
                animationPlayState: "",
            });
            this.durationTimer?.resume();
        }
    }

    /**
     * Shows a top banner.
     * @param text - string: The text that should be displayed
     * @param type - string: Type of the banner ("error", "info", "warning", "success", "plain")
     * @param duration - number?: How long to show the banner. If `none` or `undefined`,
     * the banner will not automatically be hidden.
     */
    setBannerEvent({
        text,
        type = "alert",
        duration,
    }) {
        if (!text) {
            this.hideBanner();
            return;
        }

        const className = AVAILABLE_TYPES.has(type) ? type : "plain";

        this.$bannerParagraph.text(text);
        this.$widget.removeClass();
        this.$widget.addClass(className);
        this.$timer.removeClass("indefinite");

        // Remove old timer to avoid hard bug
        this.durationTimer?.clear();

        if (duration) {
            this.durationTimer = new Timer(this.hideBanner.bind(this), duration);
            this.$timer.css({
                animationDuration: `${duration}ms`
            })
        } else {
            this.$timer.addClass("indefinite");
        }
    }

    hideBannerEvent() {
        this.hideBanner();
    }
}
