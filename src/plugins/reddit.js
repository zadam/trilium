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
const date_notes = require('../services/date_notes');

// "reddit" date note is subnote of date note which contains all reddit comments from that date
const REDDIT_DATE_ATTRIBUTE = 'reddit_date_note';

async function createNote(parentNoteId, noteTitle, noteText) {
    return (await notes.createNewNote(parentNoteId, {
        title: noteTitle,
        content: noteText,
        target: 'into',
        isProtected: false
    })).noteId;
}

function redditId(kind, id) {
    return kind + "_" + id;
}

async function getDateNoteIdForReddit(dateTimeStr, rootNoteId) {
    const dateStr = dateTimeStr.substr(0, 10);

    let redditDateNoteId = await attributes.getNoteIdWithAttribute(REDDIT_DATE_ATTRIBUTE, dateStr);

    if (!redditDateNoteId) {
        const dateNoteId = await date_notes.getDateNoteId(dateTimeStr, rootNoteId);

        redditDateNoteId = await createNote(dateNoteId, "Reddit");

        await attributes.createAttribute(redditDateNoteId, REDDIT_DATE_ATTRIBUTE, dateStr);
        await attributes.createAttribute(redditDateNoteId, "hide_in_autocomplete");
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

        await sql.doInTransaction(async () => {
            commentNoteId = await createNote(parentNoteId, comment.link_title, noteText);

            log.info("Reddit: Imported comment to note " + commentNoteId);
            importedComments++;

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
    const rootNoteId = await date_notes.getRootCalendarNoteId();

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
