import NoteContextAwareWidget from "./note_context_aware_widget.js";

const TPL = `<div class="scroll-padding-widget"></div>`;

export default class ScrollPaddingWidget extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled() && ["text", "code"].includes(this.note?.type);
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$widget.on("click", () =>
            this.triggerCommand('scrollToEnd', {ntxId: this.ntxId}));
    }

    initialRenderCompleteEvent() {
        this.$scrollingContainer = this.$widget.closest(".scrolling-container");

        new ResizeObserver(() => this.refreshHeight()).observe(this.$scrollingContainer[0]);

        this.refreshHeight();
    }

    refreshHeight() {
        const containerHeight = this.$scrollingContainer.height();

        this.$widget.css("height", Math.round(containerHeight / 2));
    }
}
