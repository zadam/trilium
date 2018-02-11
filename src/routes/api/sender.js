"use strict";

const express = require('express');
const router = express.Router();
const image = require('../../services/image');
const utils = require('../../services/utils');
const date_notes = require('../../services/date_notes');
const sql = require('../../services/sql');
const wrap = require('express-promise-wrap').wrap;
const notes = require('../../services/notes');
const multer = require('multer')();
const password_encryption = require('../../services/password_encryption');
const options = require('../../services/options');
const sync_table = require('../../services/sync_table');

router.post('/login', wrap(async (req, res, next) => {
    const username = req.body.username;
    const password = req.body.password;

    const isUsernameValid = username === await options.getOption('username');
    const isPasswordValid = await password_encryption.verifyPassword(password);

    if (!isUsernameValid || !isPasswordValid) {
        res.status(401).send("Incorrect username/password");
    }
    else {
        const token = utils.randomSecureToken();

        await sql.doInTransaction(async () => {
            const apiTokenId = utils.newApiTokenId();

            await sql.insert("api_tokens", {
                apiTokenId: apiTokenId,
                token: token,
                dateCreated: utils.nowDate(),
                isDeleted: false
            });

            await sync_table.addApiTokenSync(apiTokenId);
        });

        res.send({
            token: token
        });
    }
}));

async function checkSenderToken(req, res, next) {
    const token = req.headers.authorization;

    if (await sql.getValue("SELECT COUNT(*) FROM api_tokens WHERE isDeleted = 0 AND token = ?", [token]) === 0) {
        res.status(401).send("Not authorized");
    }
    else if (await sql.isDbUpToDate()) {
        next();
    }
    else {
        res.status(409).send("Mismatched app versions"); // need better response than that
    }
}

router.post('/image', checkSenderToken, multer.single('upload'), wrap(async (req, res, next) => {
    const file = req.file;

    if (!["image/png", "image/jpeg", "image/gif"].includes(file.mimetype)) {
        return res.status(400).send("Unknown image type: " + file.mimetype);
    }

    const parentNoteId = await date_notes.getDateNoteId(utils.nowDate());

    const noteId = (await notes.createNewNote(parentNoteId, {
        title: "Sender image",
        content: "",
        target: 'into',
        isProtected: false,
        type: 'text',
        mime: 'text/html'
    })).noteId;

    const {fileName, imageId} = await image.saveImage(file, null, noteId);

    const url = `/api/images/${imageId}/${fileName}`;

    const content = `<img src="${url}"/>`;

    await sql.execute("UPDATE notes SET content = ? WHERE noteId = ?", [content, noteId]);

    res.send({});
}));

module.exports = router;