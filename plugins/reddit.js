const sql = require('../services/sql');
const notes = require('../services/notes');
const axios = require('axios');
const log = require('../services/log');
const utils = require('../services/utils');
const unescape = require('unescape');
const sync_table = require('../services/sync_table');
const options = require('../services/options');

const REDDIT_ROOT = 'reddit_root';
const SOURCE_ID = 'reddit_plugin';

async function importReddit(accounts) {
    const accountName = accounts[0];

    let rootNoteId = await sql.getFirst(`SELECT notes.note_id FROM notes JOIN attributes USING(note_id) 
              WHERE attributes.name = '${REDDIT_ROOT}' AND notes.is_deleted = 0`);

    if (!rootNoteId) {
        rootNoteId = (await notes.createNewNote('root', {
            note_title: 'Reddit',
            target: 'into',
            is_protected: false
        }, SOURCE_ID)).noteId;

        await createAttribute(rootNoteId, REDDIT_ROOT);
    }

    const response = await axios.get(`https://www.reddit.com/user/${accountName}.json`);
    const listing = response.data;

    if (listing.kind !== 'Listing') {
        log.info(`Unknown kind ${listing.kind}`);
        return;
    }

    const children = listing.data.children;
    console.log(children[0]);

    for (const child of children) {
        const comment = child.data;

        let commentNoteId = await getNoteIdWithAttribute('reddit_comment_id', comment.id);

        if (commentNoteId) {
            continue;
        }

        const dateTimeStr = utils.dateStr(new Date(comment.created_utc * 1000));
        const dateStr = dateTimeStr.substr(0, 10);

        let dateNoteId = await getNoteIdWithAttribute('date_note', dateStr);

        if (!dateNoteId) {
            dateNoteId = (await notes.createNewNote(rootNoteId, {
                note_title: dateStr,
                target: 'into',
                is_protected: false
            }, SOURCE_ID)).noteId;

            await createAttribute(dateNoteId, "date_note", dateStr);
        }

        commentNoteId = (await notes.createNewNote(dateNoteId, {
            note_title: comment.link_title,
            target: 'into',
            is_protected: false
        }, SOURCE_ID)).noteId;

        console.log("Created note " + commentNoteId);

        const body =
            `<p><a href="${comment.link_permalink}">${comment.link_permalink}</a></p>
            <p>author: ${comment.author}, subreddit: ${comment.subreddit}, karma: ${comment.score}, created at ${dateTimeStr}</p><p></p>`
            + unescape(comment.body_html);

        await sql.execute("UPDATE notes SET note_text = ? WHERE note_id = ?", [body, commentNoteId]);

        await createAttribute(commentNoteId, "reddit_kind", child.kind);
        await createAttribute(commentNoteId, "reddit_id", comment.id);
        await createAttribute(commentNoteId, "reddit_created_utc", comment.created_utc);
    }
}

async function createAttribute(noteId, name, value = null) {
    const now = utils.nowDate();
    const attributeId = utils.newAttributeId();

    await sql.insert("attributes", {
        attribute_id: attributeId,
        note_id: noteId,
        name: name,
        value: value,
        date_modified: now,
        date_created: now
    });

    await sync_table.addAttributeSync(attributeId, SOURCE_ID);
}

async function getNoteIdWithAttribute(name, value) {
    return await sql.getFirstValue(`SELECT notes.note_id FROM notes JOIN attributes USING(note_id) 
          WHERE notes.is_deleted = 0 AND attributes.name = ? AND attributes.value = ?`, [name, value]);
}

sql.dbReady.then(async () => {
    const enabledOption = await options.getOptionOrNull("reddit_enabled");
    const accountsOption = await options.getOptionOrNull("reddit_accounts");

    if (!enabledOption) {
        await options.createOption("reddit_enabled", "false", true);
        await options.createOption("reddit_accounts", "[]", true);
        return;
    }

    if (enabledOption.opt_value !== "true") {
        return;
    }

    if (!accountsOption) {
        log.info("No reddit accounts defined in option 'reddit_accounts'");
    }

    const redditAccounts = JSON.parse(accountsOption.opt_value);

    await importReddit(redditAccounts);
});
