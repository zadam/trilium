import StandardWidget from "./standard_widget.js";
import linkService from "../services/link.js";

class WhatLinksHereWidget extends StandardWidget {
    getWidgetTitle() { return "What links here"; }

    getMaxHeight() { return "200px"; }

    getHelp() {
        return {
            title: "This list contains all notes which link to this note through links and relations."
        };
    }

    getHeaderActions() {
        const $showFullButton = $("<a>").append("show link map").addClass('widget-header-action');
        $showFullButton.on('click', async () => {
            const linkMapDialog = await import("../dialogs/link_map.js");
            linkMapDialog.showDialog();
        });

        return [$showFullButton];
    }

    async refreshWithNote() {
        const targetRelations = await this.tabContext.note.getTargetRelations();

        if (targetRelations.length === 0) {
            this.$body.text("Nothing links here yet ...");
            return;
        }

        const $list = $("<ul>");
        let i = 0;

        for (; i < targetRelations.length && i < 50; i++) {
            const rel = targetRelations[i];

            const $item = $("<li>")
                .append(await linkService.createNoteLink(rel.noteId))
                .append($("<span>").text(" (" + rel.name + ")"));

            $list.append($item);
        }

        if (i < targetRelations.length) {
            $list.append($("<li>").text(`${targetRelations.length - i} more links ...`))
        }

        this.$body.empty().append($list);
    }
}

export default WhatLinksHereWidget;