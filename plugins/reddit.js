"use strict";

const sql = require('../services/sql');
const notes = require('../services/notes');
const axios = require('axios');
const log = require('../services/log');
const utils = require('../services/utils');
const unescape = require('unescape');
const attributes = require('../services/attributes');
const sync_mutex = require('../services/sync_mutex');
const config = require('../services/config');

const CALENDAR_ROOT_ATTRIBUTE = 'calendar_root';
const YEAR_ATTRIBUTE = 'year_note';
const MONTH_ATTRIBUTE = 'month_note';
const DATE_ATTRIBUTE = 'date_note';

// "reddit" date note is subnote of date note which contains all reddit comments from that date
const REDDIT_DATE_ATTRIBUTE = 'reddit_date_note';

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

async function getNoteStartingWith(parentNoteId, startsWith) {
    return await sql.getFirstValue(`SELECT note_id FROM notes JOIN notes_tree USING(note_id) 
                                    WHERE parent_note_id = ? AND note_title LIKE '${startsWith}%'
                                    AND notes.is_deleted = 0 AND notes_tree.is_deleted = 0`, [parentNoteId]);
}

async function getRootNoteId() {
    let rootNoteId = await sql.getFirstValue(`SELECT notes.note_id FROM notes JOIN attributes USING(note_id) 
              WHERE attributes.name = '${CALENDAR_ROOT_ATTRIBUTE}' AND notes.is_deleted = 0`);

    if (!rootNoteId) {
        rootNoteId = (await notes.createNewNote('root', {
            note_title: 'Calendar',
            target: 'into',
            is_protected: false
        })).noteId;

        await attributes.createAttribute(rootNoteId, CALENDAR_ROOT_ATTRIBUTE);
    }

    return rootNoteId;
}

async function getYearNoteId(dateTimeStr, rootNoteId) {
    const yearStr = dateTimeStr.substr(0, 4);

    let yearNoteId = await attributes.getNoteIdWithAttribute(YEAR_ATTRIBUTE, yearStr);

    if (!yearNoteId) {
        yearNoteId = await getNoteStartingWith(rootNoteId, yearStr);

        if (!yearNoteId) {
            yearNoteId = await createNote(rootNoteId, yearStr);
        }

        await attributes.createAttribute(yearNoteId, YEAR_ATTRIBUTE, yearStr);
    }

    return yearNoteId;
}

async function getMonthNoteId(dateTimeStr, rootNoteId) {
    const monthStr = dateTimeStr.substr(0, 7);
    const monthNumber = dateTimeStr.substr(5, 2);

    let monthNoteId = await attributes.getNoteIdWithAttribute(MONTH_ATTRIBUTE, monthStr);

    if (!monthNoteId) {
        const yearNoteId = await getYearNoteId(dateTimeStr, rootNoteId);

        monthNoteId = await getNoteStartingWith(yearNoteId, monthNumber);

        if (!monthNoteId) {
            monthNoteId = await createNote(yearNoteId, monthNumber);
        }

        await attributes.createAttribute(monthNoteId, MONTH_ATTRIBUTE, monthStr);
    }

    return monthNoteId;
}

async function getDateNoteId(dateTimeStr, rootNoteId) {
    const dateStr = dateTimeStr.substr(0, 10);
    const dayNumber = dateTimeStr.substr(8, 2);

    let dateNoteId = await attributes.getNoteIdWithAttribute(DATE_ATTRIBUTE, dateStr);

    if (!dateNoteId) {
        const monthNoteId = await getMonthNoteId(dateTimeStr, rootNoteId);

        dateNoteId = await getNoteStartingWith(monthNoteId, dayNumber);

        if (!dateNoteId) {
            dateNoteId = await createNote(monthNoteId, dayNumber);
        }

        await attributes.createAttribute(dateNoteId, DATE_ATTRIBUTE, dateStr);
    }

    return dateNoteId;
}

async function getDateNoteIdForReddit(dateTimeStr, rootNoteId) {
    const dateStr = dateTimeStr.substr(0, 10);

    let redditDateNoteId = await attributes.getNoteIdWithAttribute(REDDIT_DATE_ATTRIBUTE, dateStr);

    if (!redditDateNoteId) {
        const dateNoteId = await getDateNoteId(dateTimeStr, rootNoteId);

        redditDateNoteId = await createNote(dateNoteId, "Reddit");

        await attributes.createAttribute(redditDateNoteId, REDDIT_DATE_ATTRIBUTE, dateStr);
    }

    return redditDateNoteId;
}

async function importComments(rootNoteId, accountName, afterId = null) {
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

        const permaLink = 'https://reddit.com' + comment.permalink;

        const noteText =
`<p><a href="${permaLink}">${permaLink}</a></p>
<p>author: <a href="https://reddit.com/u/${comment.author}">${comment.author}</a>, 
subreddit: <a href="https://reddit.com/r/${comment.subreddit}">${comment.subreddit}</a>, 
karma: ${comment.score}, created at ${dateTimeStr}</p><p></p>`
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
        importedComments += await importComments(rootNoteId, accountName, listing.data.after);
    }

    return importedComments;
}

let redditAccounts = [];

async function runImport() {
    const rootNoteId = await getRootNoteId();

    // technically mutex shouldn't be necessary but we want to avoid doing potentially expensive import
    // concurrently with sync
    await sync_mutex.doExclusively(async () => {
        let importedComments = 0;

        for (const account of redditAccounts) {
            importedComments += await importComments(rootNoteId, account);
        }

        log.info(`Reddit: Imported ${importedComments} comments.`);
    });
}

sql.dbReady.then(async () => {
    if (!config['Reddit'] || config['Reddit']['enabled'] !== true) {
        return;
    }

    const redditAccountsStr = config['Reddit']['accounts'];

    if (!redditAccountsStr) {
        log.info("Reddit: No reddit accounts defined in option 'reddit_accounts'");
    }

    redditAccounts = redditAccountsStr.split(",").map(s => s.trim());

    const pollingIntervalInSeconds = config['Reddit']['pollingIntervalInSeconds'] || (4 * 3600);

    setInterval(runImport, pollingIntervalInSeconds * 1000);
    setTimeout(runImport, 10000); // 10 seconds after startup - intentionally after initial sync
});
