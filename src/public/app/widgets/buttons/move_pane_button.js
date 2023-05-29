import OnClickButtonWidget from "./onclick_button.js";
import appContext from "../../components/app_context.js";

export default class MovePaneButton extends OnClickButtonWidget {
    isEnabled() {
        if (!super.isEnabled())
            return false;
        
        if (this.isMovingLeft) {
            // movable if the current context is not a main context, i.e. non-null mainNtxId
            return !!this.noteContext?.mainNtxId;
        } else {
            const currentIndex = appContext.tabManager.noteContexts.findIndex(c => c.ntxId === this.ntxId);
            const nextContext = appContext.tabManager.noteContexts[currentIndex + 1];
            // movable if the next context is not null and not a main context, i.e. non-null mainNtxId
            return !!nextContext?.mainNtxId;
        }
    }

    initialRenderCompleteEvent() {
        this.refresh();
        super.initialRenderCompleteEvent();
    }

    async noteContextRemovedEvent({ntxIds}) {
        this.refresh();
    }

    async newNoteContextCreatedEvent({noteContext}) {
        this.refresh();
    }

    async noteContextSwitchEvent() {
        this.refresh();
    }

    async noteContextReorderEvent({ntxIdsInOrder}) {
        this.refresh();
    }

    constructor(isMovingLeft) {
        super();

        this.isMovingLeft = isMovingLeft;

        this.icon(isMovingLeft ? "bx-chevron-left" : "bx-chevron-right")
            .title(isMovingLeft ? "Move left" : "Move right")
            .titlePlacement("bottom")
            .onClick(async (widget, e) => {
                e.stopPropagation();
                widget.triggerCommand("moveThisNoteSplit", {ntxId: widget.getClosestNtxId(), isMovingLeft: this.isMovingLeft});
            })
            .class("icon-action");
    }
}
