function notecase2html(note) {
    let noteText = note.detail.note_text;

    let formatting = note.formatting;
    let links = note.links;
    let images = note.images;

    let offset = 0;
    let lastTag = null;

    function inject(target, injected, position) {
        offset += injected.length;

        return noteText.substr(0, position) + injected + noteText.substr(position);
    }

    for (let fmt of formatting) {
        if (tags[fmt.fmt_tag]) {
            noteText = inject(noteText, tags[fmt.fmt_tag], fmt.note_offset + offset);
        }
    }

    offset = 0;

    for (let link of links) {
        let linkHtml = '<a href="' + link.target_url + '">' + link.lnk_text + '</a>';

        noteText = noteText.substr(0, link.note_offset + offset) + noteText.substr(link.note_offset + offset + link.lnk_text.length);

        noteText = inject(noteText, linkHtml, link.note_offset + offset);

        offset -= link.lnk_text.length;
    }

    offset = 0;

    for (let image of images) {
        let type = image.is_png ? "png" : "jpg";

        let imgHtml = '<img alt="Embedded Image" src="data:image/' + type + ';base64,' + image.image_data + '" />';

        noteText = inject(noteText, imgHtml, image.note_offset + offset);
    }

    noteText = noteText.replace(/(?:\r\n|\r|\n)/g, '<br />');

    return noteText;
}