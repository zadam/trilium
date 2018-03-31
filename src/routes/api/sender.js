"use strict";

const image = require('../../services/image');
const utils = require('../../services/utils');
const date_notes = require('../../services/date_notes');
const sql = require('../../services/sql');
const notes = require('../../services/notes');
const password_encryption = require('../../services/password_encryption');
const options = require('../../services/options');
const sync_table = require('../../services/sync_table');

async function login(req) {
    const username = req.body.username;
    const password = req.body.password;

    const isUsernameValid = username === await options.getOption('username');
    const isPasswordValid = await password_encryption.verifyPassword(password);

    if (!isUsernameValid || !isPasswordValid) {
        return [401, "Incorrect username/password"];
    }

    const token = utils.randomSecureToken();

    const apiTokenId = utils.newApiTokenId();

    await sql.insert("api_tokens", {
        apiTokenId: apiTokenId,
        token: token,
        dateCreated: utils.nowDate(),
        isDeleted: false
    });

    await sync_table.addApiTokenSync(apiTokenId);

    return {
        token: token
    };
}

async function uploadImage(req) {
    const file = req.file;

    if (!["image/png", "image/jpeg", "image/gif"].includes(file.mimetype)) {
        return [400, "Unknown image type: " + file.mimetype];
    }

    const parentNoteId = await date_notes.getDateNoteId(req.headers['x-local-date']);

    const {noteId} = await notes.createNewNote(parentNoteId, {
        title: "Sender image",
        content: "",
        target: 'into',
        isProtected: false,
        type: 'text',
        mime: 'text/html'
    });

    const {fileName, imageId} = await image.saveImage(file, null, noteId);

    const url = `/api/images/${imageId}/${fileName}`;

    const content = `<img src="${url}"/>`;

    await sql.execute("UPDATE notes SET content = ? WHERE noteId = ?", [content, noteId]);
}

async function saveNote(req) {
    const parentNoteId = await date_notes.getDateNoteId(req.headers['x-local-date']);

    await notes.createNewNote(parentNoteId, {
        title: req.body.title,
        content: req.body.content,
        target: 'into',
        isProtected: false,
        type: 'text',
        mime: 'text/html'
    });
}

module.exports = {
    login,
    uploadImage,
    saveNote
};