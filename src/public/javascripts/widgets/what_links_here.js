import StandardWidget from "./standard_widget.js";
import linkService from "../services/link.js";

class WhatLinksHereWidget extends StandardWidget {
    getWidgetTitle() { return "What links here"; }

    getMaxHeight() { return "200px"; }

    getHeaderActions() {
        const $showFullButton = $("<a>").append("show link map").addClass('widget-header-action');
        $showFullButton.click(async () => {
            const linkMapDialog = await import("../dialogs/link_map.js");
            linkMapDialog.showDialog();
        });

        return [$showFullButton];
    }

    async doRenderBody() {
        const targetRelations = await this.ctx.note.getTargetRelations();

        if (targetRelations.length === 0) {
            this.$body.text("Nothing links here yet ...");
            return;
        }

        const $list = $("<ul>");

        for (const rel of targetRelations) {
            const $item = $("<li>")
                .append(await linkService.createNoteLink(rel.noteId))
                .append($("<span>").text(" (" + rel.name + ")"));

            $list.append($item);
        }

        this.$body.empty().append($list);
    }
}

export default WhatLinksHereWidget;