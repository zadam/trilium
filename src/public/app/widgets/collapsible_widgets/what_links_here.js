import CollapsibleWidget from "../collapsible_widget.js";
import linkService from "../../services/link.js";

export default class WhatLinksHereWidget extends CollapsibleWidget {
    get widgetTitle() { return "What links here"; }

    get help() {
        return {
            title: "This list contains all notes which link to this note through links and relations."
        };
    }

    get headerActions() {
        const $showFullButton = $("<a>").append("show link map").addClass('widget-header-action');
        $showFullButton.on('click', async () => {
            const linkMapDialog = await import("../../dialogs/link_map.js");
            linkMapDialog.showDialog();
        });

        return [$showFullButton];
    }

    async refreshWithNote(note) {
        const targetRelations = note.getTargetRelations();

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
            $list.append($("<li>").text(`${targetRelations.length - i} more links ...`));
        }

        this.$body.empty().append($list);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes().find(attr => attr.type === 'relation' && attr.value === this.noteId)) {
            this.refresh();
        }
    }
}