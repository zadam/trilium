const AndExp = require('./expressions/and');
const OrExp = require('./expressions/or');
const NotExp = require('./expressions/not');
const AttributeExistsExp = require('./expressions/attribute_exists');
const FieldComparisonExp = require('./expressions/field_comparison');
const NoteCacheFulltextExp = require('./expressions/note_cache_fulltext');
const NoteContentFulltextExp = require('./expressions/note_content_fulltext');
const comparatorBuilder = require('./comparator_builder');

function getFulltext(tokens, includingNoteContent) {
    if (tokens.length === 0) {
        return null;
    }
    else if (includingNoteContent) {
        return new OrExp([
            new NoteCacheFulltextExp(tokens),
            new NoteContentFulltextExp(tokens)
        ]);
    }
    else {
        return new NoteCacheFulltextExp(tokens);
    }
}

function isOperator(str) {
    return str.match(/^[=<>*]+$/);
}

function getExpression(tokens) {
    if (tokens.length === 0) {
        return null;
    }

    const expressions = [];
    let op = null;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token === '#' || token === '@') {
            continue;
        }

        if (Array.isArray(token)) {
            expressions.push(getExpression(token));
        }
        else if (token.startsWith('#') || token.startsWith('@')) {
            const type = token.startsWith('#') ? 'label' : 'relation';

            if (i < tokens.length - 2 && isOperator(tokens[i + 1])) {
                const operator = tokens[i + 1];
                const comparedValue = tokens[i + 2];

                const comparator = comparatorBuilder(operator, comparedValue);

                if (!comparator) {
                    throw new Error(`Can't find operator '${operator}'`);
                }

                expressions.push(new FieldComparisonExp(type, token.substr(1), comparator));

                i += 2;
            }
            else {
                expressions.push(new AttributeExistsExp(type, token.substr(1)));
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

    if (op === null || op === 'and') {
        return AndExp.of(expressions);
    }
    else if (op === 'or') {
        return OrExp.of(expressions);
    }
}

function parse(fulltextTokens, expressionTokens, includingNoteContent) {
    return AndExp.of([
        getFulltext(fulltextTokens, includingNoteContent),
        getExpression(expressionTokens)
    ]);
}

module.exports = parse;
