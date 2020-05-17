"use strict";

class NotExp {
    constructor(subExpression) {
        this.subExpression = subExpression;
    }

    execute(noteSet, searchContext) {
        const subNoteSet = this.subExpression.execute(noteSet, searchContext);

        return noteSet.minus(subNoteSet);
    }
}

module.exports = NotExp;
