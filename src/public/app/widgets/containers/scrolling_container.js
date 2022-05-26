import Container from "./container.js";

export default class ScrollingContainer extends Container {
    constructor() {
        super();

        this.css('overflow', 'auto');
        this.css('position', 'relative');
    }

    setNoteContextEvent({noteContext}) {
        /** @var {NoteContext} */
        this.noteContext = noteContext;
    }

    async noteSwitchedEvent({noteContext, notePath}) {
        this.$widget.scrollTop(0);
    }

    async noteSwitchedAndActivatedEvent({noteContext, notePath}) {
        this.noteContext = noteContext;

        this.$widget.scrollTop(0);
    }

    async activeContextChangedEvent({noteContext}) {
        this.noteContext = noteContext;
    }

    handleEventInChildren(name, data) {
        if (name === 'readOnlyTemporarilyDisabled'
                && this.noteContext
                && this.noteContext.ntxId === data.noteContext.ntxId) {

            const scrollTop = this.$widget.scrollTop();

            const promise = super.handleEventInChildren(name, data);

            // there seems to be some asynchronicity, and we need to wait a bit before scrolling
            promise.then(() => setTimeout(() => this.$widget.scrollTop(scrollTop), 500));

            return promise;
        }
        else {
            return super.handleEventInChildren(name, data);
        }
    }

    scrollContainerToCommand({position}) {
        this.$widget.scrollTop(position);
    }
}
