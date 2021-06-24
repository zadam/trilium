import Container from "./container.js";

export default class ScrollingContainer extends Container {
    constructor() {
        super();

        this.css('overflow', 'auto');
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

            promise.then(() => setTimeout(() => this.$widget.scrollTop(scrollTop), 500));
        }
        else {
            return super.handleEventInChildren(name, data);
        }
    }
}
