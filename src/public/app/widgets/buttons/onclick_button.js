import AbstractButtonWidget from "./abstract_button.js";

export default class OnClickButtonWidget extends AbstractButtonWidget {
    doRender() {
        super.doRender();

        if (this.settings.onClick) {
            this.$widget.on("click", e => {
                this.$widget.tooltip("hide");

                this.settings.onClick(this, e);
            });
        } else {
            console.warn(`Button widget '${this.componentId}' has no defined click handler`, this.settings);
        }
    }

    onClick(handler) {
        this.settings.onClick = handler;
        return this;
    }
}
