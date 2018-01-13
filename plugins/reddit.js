const sql = require('../services/sql');
const notes = require('../services/notes');
const axios = require('axios');
const log = require('../services/log');
const utils = require('../services/utils');
const unescape = require('unescape');
const attributes = require('../services/attributes');
const options = require('../services/options');

const REDDIT_ROOT = 'reddit_root';

async function createNote(parentNoteId, noteTitle, noteText) {
    return (await notes.createNewNote(parentNoteId, {
        note_title: noteTitle,
        note_text: noteText,
        target: 'into',
        is_protected: false
    })).noteId;
}

function redditId(kind, id) {
    return kind + "_" + id;
}

async function getYearNoteId(dateTimeStr, rootNoteId) {
    const yearStr = dateTimeStr.substr(0, 4);

    let yearNoteId = await attributes.getNoteIdWithAttribute('year_note', yearStr);

    if (!yearNoteId) {
        yearNoteId = await createNote(rootNoteId, yearStr);

        await attributes.createAttribute(yearNoteId, "year_note", yearStr);
    }

    return yearNoteId;
}

async function getMonthNoteId(dateTimeStr, rootNoteId) {
    const monthStr = dateTimeStr.substr(0, 7);

    let monthNoteId = await attributes.getNoteIdWithAttribute('month_note', monthStr);

    if (!monthNoteId) {
        const yearNoteId = await getYearNoteId(dateTimeStr, rootNoteId);

        monthNoteId = await createNote(yearNoteId, dateTimeStr.substr(5, 2));

        await attributes.createAttribute(monthNoteId, "month_note", monthStr);
    }

    return monthNoteId;
}

async function getDateNoteId(dateTimeStr, rootNoteId) {
    const dateStr = dateTimeStr.substr(0, 10);

    let dateNoteId = await attributes.getNoteIdWithAttribute('date_note', dateStr);

    if (!dateNoteId) {
        const monthNoteId = await getMonthNoteId(dateTimeStr, rootNoteId);

        dateNoteId = await createNote(monthNoteId, dateTimeStr.substr(8, 2));

        await attributes.createAttribute(dateNoteId, "date_note", dateStr);
    }

    return dateNoteId;
}

async function getDateNoteIdForReddit(dateTimeStr, rootNoteId) {
    const dateStr = dateTimeStr.substr(0, 10);

    let redditDateNoteId = await attributes.getNoteIdWithAttribute('reddit_date_note', dateStr);

    if (!redditDateNoteId) {
        const dateNoteId = await getDateNoteId(dateTimeStr, rootNoteId);

        redditDateNoteId = await createNote(dateNoteId, "Reddit");

        await attributes.createAttribute(redditDateNoteId, "reddit_date_note", dateStr);
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
        })).noteId;

        await attributes.createAttribute(rootNoteId, REDDIT_ROOT);
    }

    let url = `https://www.reddit.com/user/${accountName}.json`;

    if (afterId) {
        url += "?after=" + afterId;
    }

    const response = await axios.get(url);
    const listing = response.data;

    if (listing.kind !== 'Listing') {
        log.info(`Reddit: Unknown object kind ${listing.kind}`);
        return;
    }

    const children = listing.data.children;

    let importedComments = 0;

    for (const child of children) {
        const comment = child.data;

        let commentNoteId = await attributes.getNoteIdWithAttribute('reddit_id', redditId(child.kind, comment.id));

        if (commentNoteId) {
            continue;
        }

        const dateTimeStr = utils.dateStr(new Date(comment.created_utc * 1000));

        const noteText =
            `<p><a href="${comment.link_permalink}">${comment.link_permalink}</a></p>
            <p>author: ${comment.author}, subreddit: ${comment.subreddit}, karma: ${comment.score}, created at ${dateTimeStr}</p><p></p>`
            + unescape(comment.body_html);

        let parentNoteId = await getDateNoteIdForReddit(dateTimeStr, rootNoteId);

        commentNoteId = await createNote(parentNoteId, comment.link_title, noteText);

        log.info("Reddit: Imported comment to note " + commentNoteId);
        importedComments++;

        await sql.doInTransaction(async () => {
            await attributes.createAttribute(commentNoteId, "reddit_kind", child.kind);
            await attributes.createAttribute(commentNoteId, "reddit_id", redditId(child.kind, comment.id));
            await attributes.createAttribute(commentNoteId, "reddit_created_utc", comment.created_utc);
        });
    }

    // if there have been no imported comments on this page, there shouldn't be any to import
    // on the next page since those are older
    if (listing.data.after && importedComments > 0) {
        log.info("Reddit: Importing from next page of comments ...");

        importedComments += await importReddit(accountName, listing.data.after);
    }

    return importedComments;
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
        log.info("Reddit: No reddit accounts defined in option 'reddit_accounts'");
    }

    const redditAccounts = JSON.parse(accountsOption.opt_value);
    let importedComments = 0;

    for (const account of redditAccounts) {
        log.info("Importing account " + account);

        importedComments += await importReddit(account);
    }

    log.info(`Reddit: Imported ${importedComments} comments.`);
});
