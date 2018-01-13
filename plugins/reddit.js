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

async function getYearNoteId(dateTimeStr, rootNoteId) {
    const yearStr = dateTimeStr.substr(0, 4);

    let dateNoteId = await getNoteIdWithAttribute('year_note', yearStr);

    if (!dateNoteId) {
        dateNoteId = (await notes.createNewNote(rootNoteId, {
            note_title: yearStr,
            target: 'into',
            is_protected: false
        }, SOURCE_ID)).noteId;

        await createAttribute(dateNoteId, "year_note", yearStr);
    }

    return dateNoteId;
}

async function getMonthNoteId(dateTimeStr, rootNoteId) {
    const monthStr = dateTimeStr.substr(0, 7);

    let dateNoteId = await getNoteIdWithAttribute('month_note', monthStr);

    if (!dateNoteId) {
        const monthNoteId = await getYearNoteId(dateTimeStr, rootNoteId);

        dateNoteId = (await notes.createNewNote(monthNoteId, {
            note_title: dateTimeStr.substr(5, 2),
            target: 'into',
            is_protected: false
        }, SOURCE_ID)).noteId;

        await createAttribute(dateNoteId, "month_note", monthStr);
    }

    return dateNoteId;
}

async function getDateNoteId(dateTimeStr, rootNoteId) {
    const dateStr = dateTimeStr.substr(0, 10);

    let dateNoteId = await getNoteIdWithAttribute('date_note', dateStr);

    if (!dateNoteId) {
        const monthNoteId = await getMonthNoteId(dateTimeStr, rootNoteId);

        dateNoteId = (await notes.createNewNote(monthNoteId, {
            note_title: dateTimeStr.substr(8, 2),
            target: 'into',
            is_protected: false
        }, SOURCE_ID)).noteId;

        await createAttribute(dateNoteId, "date_note", dateStr);
    }

    return dateNoteId;
}

async function getDateNoteIdForReddit(dateTimeStr, rootNoteId) {
    const dateStr = dateTimeStr.substr(0, 10);

    let redditDateNoteId = await getNoteIdWithAttribute('reddit_date_note', dateStr);

    if (!redditDateNoteId) {
        const dateNoteId = await getDateNoteId(dateTimeStr, rootNoteId);

        redditDateNoteId = (await notes.createNewNote(dateNoteId, {
            note_title: "Reddit",
            target: 'into',
            is_protected: false
        }, SOURCE_ID)).noteId;

        await createAttribute(redditDateNoteId, "reddit_date_note", dateStr);
    }

    return redditDateNoteId;
}

async function importReddit(accountName, afterId = null) {
    let rootNoteId = await sql.getFirstValue(`SELECT notes.note_id FROM notes JOIN attributes USING(note_id) 
              WHERE attributes.name = '${REDDIT_ROOT}' AND notes.is_deleted = 0`);

    if (!rootNoteId) {
        rootNoteId = (await notes.createNewNote('root', {
            note_title: 'Reddit',
            target: 'into',
            is_protected: false
        }, SOURCE_ID)).noteId;

        await createAttribute(rootNoteId, REDDIT_ROOT);
    }

    let url = `https://www.reddit.com/user/${accountName}.json`;

    if (afterId) {
        url += "?after=" + afterId;
    }

    const response = await axios.get(url);
    const listing = response.data;

    if (listing.kind !== 'Listing') {
        log.info(`Unknown kind ${listing.kind}`);
        return;
    }

    const children = listing.data.children;

    for (const child of children) {
        const comment = child.data;

        let commentNoteId = await getNoteIdWithAttribute('reddit_id', redditId(child.kind, comment.id));

        if (commentNoteId) {
            continue;
        }

        const dateTimeStr = utils.dateStr(new Date(comment.created_utc * 1000));

        const parentNoteId = await getDateNoteIdForReddit(dateTimeStr, rootNoteId);

        commentNoteId = (await notes.createNewNote(parentNoteId, {
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
        await createAttribute(commentNoteId, "reddit_id", redditId(child.kind, comment.id));
        await createAttribute(commentNoteId, "reddit_created_utc", comment.created_utc);
    }

    if (listing.data.after) {
        log.info("Importing next page ...");

        await importReddit(accountName, listing.data.after);
    }
}

function redditId(kind, id) {
    return kind + "_" + id;
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

    for (const account of redditAccounts) {
        log.info("Importing account " + account);

        await importReddit(account);
    }

    log.info("Import finished.");
});
