"use strict";

import NoteSet = require("../note_set");
import SearchContext = require("../search_context");

abstract class Expression {
    name: string;

    constructor() {
        this.name = this.constructor.name; // for DEBUG mode to have expression name as part of dumped JSON
    }

    abstract execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext): NoteSet;
}

export = Expression;
