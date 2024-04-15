"use strict";

import { Request } from "express";

import similarityService = require('../../becca/similarity');
import becca = require('../../becca/becca');

async function getSimilarNotes(req: Request) {
    const noteId = req.params.noteId;

    const note = becca.getNoteOrThrow(noteId);

    return await similarityService.findSimilarNotes(noteId);
}

export = {
    getSimilarNotes
};
