import FlexContainer from "../flex_container.js";

export default class ScreenContainer extends FlexContainer {
    constructor(screenName, direction) {
        super(direction);

        this.screenName = screenName;
    }

    activeScreenChangedEvent({activeScreen}) {
        if (activeScreen === this.screenName) {
            this.$widget.removeClass('d-none');
        }
        else {
            this.$widget.addClass('d-none');
        }
    }
}