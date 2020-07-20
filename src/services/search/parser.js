"use strict";

const AndExp = require('./expressions/and');
const OrExp = require('./expressions/or');
const NotExp = require('./expressions/not');
const ChildOfExp = require('./expressions/child_of');
const DescendantOfExp = require('./expressions/descendant_of');
const ParentOfExp = require('./expressions/parent_of');
const RelationWhereExp = require('./expressions/relation_where');
const PropertyComparisonExp = require('./expressions/property_comparison');
const AttributeExistsExp = require('./expressions/attribute_exists');
const LabelComparisonExp = require('./expressions/label_comparison');
const NoteCacheFulltextExp = require('./expressions/note_cache_fulltext');
const NoteContentProtectedFulltextExp = require('./expressions/note_content_protected_fulltext');
const NoteContentUnprotectedFulltextExp = require('./expressions/note_content_unprotected_fulltext');
const OrderByAndLimitExp = require('./expressions/order_by_and_limit');
const comparatorBuilder = require('./comparator_builder');
const ValueExtractor = require('./value_extractor');

function getFulltext(tokens, parsingContext) {
    tokens = tokens.map(t => t.token);

    parsingContext.highlightedTokens.push(...tokens);

    if (tokens.length === 0) {
        return null;
    }
    else if (parsingContext.includeNoteContent) {
        return new OrExp([
            new NoteCacheFulltextExp(tokens),
            new NoteContentProtectedFulltextExp('*=*', tokens),
            new NoteContentUnprotectedFulltextExp('*=*', tokens)
        ]);
    }
    else {
        return new NoteCacheFulltextExp(tokens);
    }
}

function isOperator(str) {
    return str.match(/^[=<>*]+$/);
}

function getExpression(tokens, parsingContext, level = 0) {
    if (tokens.length === 0) {
        return null;
    }

    const expressions = [];
    let op = null;

    let i;

    function parseNoteProperty() {
        if (tokens[i].token !== '.') {
            parsingContext.addError('Expected "." to separate field path');
            return;
        }

        i++;

        if (tokens[i].token === 'content') {
            i += 1;

            const operator = tokens[i].token;

            if (!isOperator(operator)) {
                parsingContext.addError(`After content expected operator, but got "${tokens[i].token}"`);
                return;
            }

            i++;

            return new OrExp([
                new NoteContentUnprotectedFulltextExp(operator, [tokens[i].token]),
                new NoteContentProtectedFulltextExp(operator, [tokens[i].token])
            ]);
        }

        if (tokens[i].token === 'parents') {
            i += 1;

            return new ChildOfExp(parseNoteProperty());
        }

        if (tokens[i].token === 'children') {
            i += 1;

            return new ParentOfExp(parseNoteProperty());
        }

        if (tokens[i].token === 'ancestors') {
            i += 1;

            return new DescendantOfExp(parseNoteProperty());
        }

        if (tokens[i].token === 'labels') {
            if (tokens[i + 1].token !== '.') {
                parsingContext.addError(`Expected "." to separate field path, got "${tokens[i + 1].token}"`);
                return;
            }

            i += 2;

            return parseLabel(tokens[i].token);
        }

        if (tokens[i].token === 'relations') {
            if (tokens[i + 1].token !== '.') {
                parsingContext.addError(`Expected "." to separate field path, got "${tokens[i + 1].token}"`);
                return;
            }

            i += 2;

            return parseRelation(tokens[i].token);
        }

        if (PropertyComparisonExp.isProperty(tokens[i].token)) {
            const propertyName = tokens[i].token;
            const operator = tokens[i + 1].token;
            const comparedValue = tokens[i + 2].token;
            const comparator = comparatorBuilder(operator, comparedValue);

            if (!comparator) {
                parsingContext.addError(`Can't find operator '${operator}'`);
                return;
            }

            i += 2;

            return new PropertyComparisonExp(propertyName, comparator);
        }

        parsingContext.addError(`Unrecognized note property "${tokens[i].token}"`);
    }

    function parseAttribute(name) {
        const isLabel = name.startsWith('#');

        name = name.substr(1);

        const isNegated = name.startsWith('!');

        if (isNegated) {
            name = name.substr(1);
        }

        const subExp = isLabel ? parseLabel(name) : parseRelation(name);

        return isNegated ? new NotExp(subExp) : subExp;
    }

    function parseLabel(labelName) {
        parsingContext.highlightedTokens.push(labelName);

        if (i < tokens.length - 2 && isOperator(tokens[i + 1].token)) {
            let operator = tokens[i + 1].token;
            const comparedValue = tokens[i + 2].token;

            if (!tokens[i + 2].inQuotes
                && (comparedValue.startsWith('#') || comparedValue.startsWith('~') || comparedValue === 'note')) {
                parsingContext.addError(`Error near token "${comparedValue}", it's possible to compare with constant only.`);
                return;
            }

            parsingContext.highlightedTokens.push(comparedValue);

            if (parsingContext.fuzzyAttributeSearch && operator === '=') {
                operator = '*=*';
            }

            const comparator = comparatorBuilder(operator, comparedValue);

            if (!comparator) {
                parsingContext.addError(`Can't find operator '${operator}'`);
            } else {
                i += 2;

                return new LabelComparisonExp('label', labelName, comparator);
            }
        } else {
            return new AttributeExistsExp('label', labelName, parsingContext.fuzzyAttributeSearch);
        }
    }

    function parseRelation(relationName) {
        parsingContext.highlightedTokens.push(relationName);

        if (i < tokens.length - 2 && tokens[i + 1].token === '.') {
            i += 1;

            return new RelationWhereExp(relationName, parseNoteProperty());
        } else {
            return new AttributeExistsExp('relation', relationName, parsingContext.fuzzyAttributeSearch);
        }
    }

    function parseOrderByAndLimit() {
        const orderDefinitions = [];
        let limit;

        if (tokens[i].token === 'orderby') {
            do {
                const propertyPath = [];
                let direction = "asc";

                do {
                    i++;

                    propertyPath.push(tokens[i].token);

                    i++;
                } while (i < tokens.length && tokens[i].token === '.');

                if (i < tokens.length && ["asc", "desc"].includes(tokens[i].token)) {
                    direction = tokens[i].token;
                    i++;
                }

                const valueExtractor = new ValueExtractor(propertyPath);

                if (valueExtractor.validate()) {
                    parsingContext.addError(valueExtractor.validate());
                }

                orderDefinitions.push({
                    valueExtractor,
                    direction
                });
            } while (i < tokens.length && tokens[i].token === ',');
        }

        if (i < tokens.length && tokens[i].token === 'limit') {
            limit = parseInt(tokens[i + 1].token);
        }

        return new OrderByAndLimitExp(orderDefinitions, limit);
    }

    function getAggregateExpression() {
        if (op === null || op === 'and') {
            return AndExp.of(expressions);
        }
        else if (op === 'or') {
            return OrExp.of(expressions);
        }
    }

    for (i = 0; i < tokens.length; i++) {
        if (Array.isArray(tokens[i])) {
            expressions.push(getExpression(tokens[i], parsingContext, level++));
            continue;
        }

        const token = tokens[i].token;

        if (token === '#' || token === '~') {
            continue;
        }

        if (token.startsWith('#') || token.startsWith('~')) {
            expressions.push(parseAttribute(token));
        }
        else if (['orderby', 'limit'].includes(token)) {
            if (level !== 0) {
                parsingContext.addError('orderBy can appear only on the top expression level');
                continue;
            }

            const exp = parseOrderByAndLimit();

            if (!exp) {
                continue;
            }

            exp.subExpression = getAggregateExpression();

            return exp;
        }
        else if (token === 'not') {
            i += 1;

            if (!Array.isArray(tokens[i])) {
                parsingContext.addError(`not keyword should be followed by sub-expression in parenthesis, got ${tokens[i].token} instead`);
                continue;
            }

            expressions.push(new NotExp(getExpression(tokens[i], parsingContext, level++)));
        }
        else if (token === 'note') {
            i++;

            expressions.push(parseNoteProperty(tokens));

            continue;
        }
        else if (['and', 'or'].includes(token)) {
            if (!op) {
                op = token;
            }
            else if (op !== token) {
                parsingContext.addError('Mixed usage of AND/OR - always use parenthesis to group AND/OR expressions.');
            }
        }
        else if (isOperator(token)) {
            parsingContext.addError(`Misplaced or incomplete expression "${token}"`);
        }
        else {
            parsingContext.addError(`Unrecognized expression "${token}"`);
        }

        if (!op && expressions.length > 1) {
            op = 'and';
        }
    }

    return getAggregateExpression();
}

function parse({fulltextTokens, expressionTokens, parsingContext}) {
    return AndExp.of([
        getFulltext(fulltextTokens, parsingContext),
        getExpression(expressionTokens, parsingContext)
    ]);
}

module.exports = parse;
