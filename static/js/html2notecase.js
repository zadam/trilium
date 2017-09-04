function html2notecase(contents, note) {
    // remove any possible extra newlines which might be inserted - all relevant new lines should be only in <br> and <p>
    contents = contents.replace(/(?:\r\n|\r|\n)/, '');

    contents = contents.replace(/<br><\/p>/g, '\n');
    contents = contents.replace(/<p><br><\/p>/g, '\n');
    contents = contents.replace(/<br \/>/g, '\n');
    contents = contents.replace(/<br>/g, '\n');
    contents = contents.replace(/<\/p>/g, '\n');
    contents = contents.replace(/<p>/g, '');
    contents = contents.replace(/&nbsp;/g, ' ');

    let index = 0;

    note.formatting = [];
    note.links = [];
    note.images = [];

    while (index < contents.length) {
        let curContent = contents.substr(index);

        if (contents[index] === '<') {
            let found = false;
            const endOfTag = curContent.indexOf('>');

            if (endOfTag === -1) {
                console.log("Can't find the end of the tag");
            }

            const curTag = curContent.substr(0, endOfTag + 1);

            for (tagId in tags) {
                const tag = tags[tagId];

                if (contents.substr(index, tag.length) === tag) {
                    found = true;

                    note.formatting.push({
                        note_id: note.detail.note_id,
                        note_offset: index,
                        fmt_tag: tagId,
                        fmt_color: '',
                        fmt_font: '',
                        fmt_value: 100
                    });

                    contents = contents.substr(0, index) + contents.substr(index + tag.length);

                    break;
                }
            }

            if (curTag.substr(0, 4) === "<img") {
                //console.log("Found img tag");

                let dataImagePos = curTag.indexOf('data:image/');

                if (dataImagePos !== -1) {
                    let imageType = curTag.substr(dataImagePos + 11, 3);

                    //console.log("image type: " + imageType);

                    let dataStart = curTag.substr(dataImagePos + 22);

                    let endOfDataPos = dataStart.indexOf('"');

                    if (endOfDataPos !== -1) {
                        const imageData = dataStart.substr(0, endOfDataPos);

                        note.images.push({
                            note_id: note.detail.note_id,
                            note_offset: index,
                            is_png: imageType === "png",
                            image_data: imageData
                        });

                        contents = contents.substr(0, index) + contents.substr(index + curTag.length);

                        found = true;
                    }
                }
            }

            const linkMatch = /^<a[^>]+?href="([^"]+?)"[^>]*?>([^<]+?)<\/a>/.exec(curContent);

            if (linkMatch !== null) {
                const targetUrl = linkMatch[1];
                const linkText = linkMatch[2];

                const newLink = {
                    note_id: note.detail.note_id,
                    note_offset: index,
                    lnk_text: linkText
                };

                const noteIdMatch = /app#([A-Za-z0-9]{22})/.exec(targetUrl);

                if (noteIdMatch !== null) {
                    newLink.target_note_id = noteIdMatch[1];
                }
                else {
                    newLink.target_url = targetUrl;
                }

                note.links.push(newLink);

                contents = contents.substr(0, index) + linkText + contents.substr(index + linkMatch[0].length);

                // we'll skip the link text so that it's not processed twice (second time by link auto detection)
                index += linkText.length;

                found = true;
            }

            if (!found) {
                contents = contents.substr(0, index) + contents.substr(index + endOfTag + 1);
            }
        }
        else {
            let linkMatch = /^(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]/i.exec(curContent);

            if (linkMatch !== null) {
                const targetUrl = linkMatch[0];

                const newLink = {
                    note_id: note.detail.note_id,
                    note_offset: index,
                    lnk_text: targetUrl
                };

                const noteIdMatch = /app#([A-Za-z0-9]{22})/.exec(targetUrl);

                if (noteIdMatch !== null) {
                    newLink.target_note_id = noteIdMatch[1];
                }
                else {
                    newLink.target_url = targetUrl;
                }

                note.links.push(newLink);

                index += targetUrl.length;
            }
            else {
                index++;
            }
        }
    }

    contents = contents.trim();

    note.detail.note_text = contents;
}