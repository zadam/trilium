const AndExp = require('./expressions/and');
const OrExp = require('./expressions/or');
const NotExp = require('./expressions/not');
const ExistsExp = require('./expressions/exists');
const EqualsExp = require('./expressions/equals');
const NoteCacheFulltextExp = require('./expressions/note_cache_fulltext');
const NoteContentFulltextExp = require('./expressions/note_content_fulltext');

function getFulltext(tokens, includingNoteContent) {
    if (includingNoteContent) {
        return [
            new OrExp([
                new NoteCacheFulltextExp(tokens),
                new NoteContentFulltextExp(tokens)
            ])
        ]
    }
    else {
        return [
            new NoteCacheFulltextExp(tokens)
        ]
    }
}

function isOperator(str) {
    return str.matches(/^[=<>*]+$/);
}

function getExpressions(tokens) {
    const expressions = [];
    let op = null;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token === '#' || token === '@') {
            continue;
        }

        if (Array.isArray(token)) {
            expressions.push(getExpressions(token));
        }
        else if (token.startsWith('#') || token.startsWith('@')) {
            const type = token.startsWith('#') ? 'label' : 'relation';

            if (i < tokens.length - 2 && isOperator(tokens[i + 1])) {
                expressions.push(new EqualsExp(type, token.substr(1), tokens[i + 1], tokens[i + 2]));

                i += 2;
            }
            else {
                expressions.push(new ExistsExp(type, token.substr(1)));
            }
        }
        else if (['and', 'or'].includes(token.toLowerCase())) {
            if (!op) {
                op = token.toLowerCase();
            }
            else if (op !== token.toLowerCase()) {
                throw new Error('Mixed usage of AND/OR - always use parenthesis to group AND/OR expressions.');
            }
        }
        else if (isOperator(token)) {
            throw new Error(`Misplaced or incomplete expression "${token}"`);
        }
        else {
            throw new Error(`Unrecognized expression "${token}"`);
        }

        if (!op && expressions.length > 1) {
            op = 'and';
        }
    }
}

function parse(fulltextTokens, expressionTokens, includingNoteContent) {
    return AndExp.of([
        ...getFulltext(fulltextTokens, includingNoteContent),
        ...getExpressions(expressionTokens)
    ]);
}
