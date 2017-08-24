function html2notecase(contents, note) {
    // remove any possible extra newlines which might be inserted - all relevant new lines should be only in <br> and <p>
    contents = contents.replace(/(?:\r\n|\r|\n)/, '');

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
            let endOfTag = curContent.indexOf('>');

            if (endOfTag === -1) {
                console.log("Can't find the end of the tag");
            }

            let curTag = curContent.substr(0, endOfTag + 1);

            //console.log(contents);

            for (tagId in tags) {
                let tag = tags[tagId];

                if (contents.substr(index, tag.length) === tag) {
                    found = true;
                    // if (tagMap.get(index) == undefined) {
                    //   tagMap.get(index) = [];
                    // }

                    // tagMap.get(index).push(key);

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
                        //console.log("Found the end of image data");

                        let imageData = dataStart.substr(0, endOfDataPos);

                        note.images.push({
                            note_id: note.detail.note_id,
                            note_offset: index,
                            is_png: imageType === "png",
                            image_data: imageData
                        });

                        contents = contents.substr(0, index) + contents.substr(index + curTag.length);

                        //console.log("Parsed image: " + imageData.substr(0, 100));

                        found = true;
                    }
                }
            }

            let match = /^<a[^>]+?href="([^"]+?)"[^>]+?>([^<]+?)<\/a>/.exec(curContent);

            if (match !== null) {
                note.links.push({
                    note_id: note.detail.note_id,
                    note_offset: index,
                    target_url: match[1],
                    lnk_text: match[2]
                });
                
                //console.log("Found link with text: " + match[2] + ", targetting: " + match[1]);

                contents = contents.substr(0, index) + match[2] + contents.substr(index + match[0].length);

                found = true;
            }

            // let imageRegex = /<img[^>]+src="data:image\/(jpg|png);base64,([^>\"]+)"[^>]+>/;

            // console.log("Testing for image: " + curTag.substr(0, 100));
            // console.log("End of image: " + curTag.substr(curTag.length - 100));

            // let match = imageRegex.exec(curTag);

            // if (match != null) {

            // }

            if (!found) {
                contents = contents.substr(0, index) + contents.substr(index + endOfTag + 1);
            }
        }
        else {
            let linkMatch = /^(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]/i.exec(curContent);

            if (linkMatch !== null) {
                note.links.push({
                    note_id: note.detail.note_id,
                    note_offset: index,
                    target_url: linkMatch[0],
                    lnk_text: linkMatch[0]
                });

                console.log(linkMatch[0]);
                console.log(linkMatch[0].length);

                index += linkMatch[0].length;
            }
            else {
                index++;
            }
        }
    }

    note.detail.note_text = contents;
}