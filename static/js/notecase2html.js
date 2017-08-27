function notecase2html(note) {
    let noteText = note.detail.note_text;

    note.formatting.forEach(el => el.type = 'formatting');
    note.links.forEach(el => el.type = 'link');
    note.images.forEach(el => el.type = 'image');

    let all = note.formatting.concat(note.links).concat(note.images);
    all.sort(function compare(a, b) {
        return a.note_offset - b.note_offset;
    });

    let offset = 0;
    let lastTag = null;

    function inject(target, injected, position) {
        offset += injected.length;

        return noteText.substr(0, position) + injected + noteText.substr(position);
    }

    for (let el of all) {
        if (el.type === 'formatting') {
            if (tags[el.fmt_tag]) {
                noteText = inject(noteText, tags[el.fmt_tag], el.note_offset + offset);
            }
        }
        else if (el.type === 'link') {
            let targetUrl;

            if (el.target_url) {
                targetUrl = el.target_url;
            }
            else {
                targetUrl = "app#" + el.target_note_id;
            }

            let linkHtml = '<a href="' + targetUrl + '">' + el.lnk_text + '</a>';

            noteText = noteText.substr(0, el.note_offset + offset) + noteText.substr(el.note_offset + offset + el.lnk_text.length);

            noteText = inject(noteText, linkHtml, el.note_offset + offset);

            offset -= el.lnk_text.length;
        }
        else if (el.type === 'image') {
            let type = el.is_png ? "png" : "jpg";

            let imgHtml = '<img alt="Embedded Image" src="data:image/' + type + ';base64,' + el.image_data + '" />';

            noteText = inject(noteText, imgHtml, el.note_offset + offset);
        }
    }

    noteText = noteText.replace(/(?:\r\n|\r)/g, '\n');

    noteText = noteText.replace(/(.+)\n/g, '<p>$1</p>');

    noteText = noteText.replace(/\n/g, '<p><br></p>');

    noteText = noteText.replace(/  /g, '&nbsp;&nbsp;');

    return noteText;
}