import TypeWidget from "./type_widget.js";
import server from "../../services/server.js";

const TPL = `
<div class="note-ancillaries note-detail-printable">
    <style>
        .note-ancillaries {
            padding: 15px;
        }
        
        .ancillary-content {
            max-height: 400px;
            background: var(--accented-background-color);
            padding: 10px;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        
        .ancillary-details th {
            padding-left: 10px;
            padding-right: 10px;
        }
    </style>

    <div class="alert alert-info" style="margin: 10px 0 10px 0; padding: 20px;">
        Note ancillaries are pieces of data attached to a given note, providing ancillary support. 
        This view is useful for diagnostics.
    </div>
    
    <div class="note-ancillary-list"></div>
</div>`;

export default class AncillariesTypeWidget extends TypeWidget {
    static getType() { return "ancillaries"; }

    doRender() {
        this.$widget = $(TPL);
        this.$list = this.$widget.find('.note-ancillary-list');

        super.doRender();
    }

    async doRefresh(note) {
        this.$list.empty();

        const ancillaries = await server.get(`notes/${this.noteId}/ancillaries?includeContent=true`);

        if (ancillaries.length === 0) {
            this.$list.html("<strong>This note has no ancillaries.</strong>");

            return;
        }

        for (const ancillary of ancillaries) {
            this.$list.append(
                $('<div class="note-ancillary-wrapper">')
                    .append(
                        $('<h4>').append($('<span class="ancillary-name">').text(ancillary.name))
                    )
                    .append(
                        $('<table class="ancillary-details">')
                            .append(
                                $('<tr>')
                                    .append($('<th>').text('Length:'))
                                    .append($('<td>').text(ancillary.contentLength))
                                    .append($('<th>').text('MIME:'))
                                    .append($('<td>').text(ancillary.mime))
                                    .append($('<th>').text('Date modified:'))
                                    .append($('<td>').text(ancillary.utcDateModified))
                            )
                    )
                    .append(
                        $('<pre class="ancillary-content">')
                            .text(ancillary.content)
                    )
            );
        }
    }
}