"use strict";

import NoteSet = require("../note_set");
import SearchContext = require("../search_context");

import Expression = require('./expression');

class TrueExp extends Expression {
    execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext): NoteSet {
        return inputNoteSet;
    }
}

export = TrueExp;
