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
const NoteContentFulltextExp = require('./expressions/note_content_fulltext');
const OrderByAndLimitExp = require('./expressions/order_by_and_limit');
const comparatorBuilder = require('./comparator_builder');
const ValueExtractor = require('./value_extractor');

function getFulltext(tokens, parsingContext) {
    parsingContext.highlightedTokens.push(...tokens);

    if (tokens.length === 0) {
        return null;
    }
    else if (parsingContext.includeNoteContent) {
        return new OrExp([
            new NoteCacheFulltextExp(tokens),
            new NoteContentFulltextExp('*=*', tokens)
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
        if (tokens[i] !== '.') {
            parsingContext.addError('Expected "." to separate field path');
            return;
        }

        i++;

        if (tokens[i] === 'content') {
            i += 1;

            const operator = tokens[i];

            if (!isOperator(operator)) {
                parsingContext.addError(`After content expected operator, but got "${tokens[i]}"`);
                return;
            }

            i++;

            return new NoteContentFulltextExp(operator, [tokens[i]]);
        }

        if (tokens[i] === 'parents') {
            i += 1;

            return new ChildOfExp(parseNoteProperty());
        }

        if (tokens[i] === 'children') {
            i += 1;

            return new ParentOfExp(parseNoteProperty());
        }

        if (tokens[i] === 'ancestors') {
            i += 1;

            return new DescendantOfExp(parseNoteProperty());
        }

        if (tokens[i] === 'labels') {
            if (tokens[i + 1] !== '.') {
                parsingContext.addError(`Expected "." to separate field path, god "${tokens[i + 1]}"`);
                return;
            }

            i += 2;

            return parseLabel(tokens[i]);
        }

        if (tokens[i] === 'relations') {
            if (tokens[i + 1] !== '.') {
                parsingContext.addError(`Expected "." to separate field path, god "${tokens[i + 1]}"`);
                return;
            }

            i += 2;

            return parseRelation(tokens[i]);
        }

        if (PropertyComparisonExp.isProperty(tokens[i])) {
            const propertyName = tokens[i];
            const operator = tokens[i + 1];
            const comparedValue = tokens[i + 2];
            const comparator = comparatorBuilder(operator, comparedValue);

            if (!comparator) {
                parsingContext.addError(`Can't find operator '${operator}'`);
                return;
            }

            i += 2;

            return new PropertyComparisonExp(propertyName, comparator);
        }

        parsingContext.addError(`Unrecognized note property "${tokens[i]}"`);
    }

    function parseLabel(labelName) {
        parsingContext.highlightedTokens.push(labelName);

        if (i < tokens.length - 2 && isOperator(tokens[i + 1])) {
            let operator = tokens[i + 1];
            const comparedValue = tokens[i + 2];

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

        if (i < tokens.length - 2 && tokens[i + 1] === '.') {
            i += 1;

            return new RelationWhereExp(relationName, parseNoteProperty());
        } else {
            return new AttributeExistsExp('relation', relationName, parsingContext.fuzzyAttributeSearch);
        }
    }

    function parseOrderByAndLimit() {
        const orderDefinitions = [];
        let limit;

        if (tokens[i] === 'orderby') {
            do {
                const propertyPath = [];
                let direction = "asc";

                do {
                    i++;

                    propertyPath.push(tokens[i]);

                    i++;
                } while (tokens[i] === '.');

                if (["asc", "desc"].includes(tokens[i])) {
                    direction = tokens[i];
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
            } while (tokens[i] === ',');
        }

        if (tokens[i] === 'limit') {
            limit = parseInt(tokens[i + 1]);
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
        const token = tokens[i];

        if (token === '#' || token === '~') {
            continue;
        }

        if (Array.isArray(token)) {
            expressions.push(getExpression(token, parsingContext, level++));
        }
        else if (token.startsWith('#')) {
            const labelName = token.substr(1);

            expressions.push(parseLabel(labelName));
        }
        else if (token.startsWith('~')) {
            const relationName = token.substr(1);

            expressions.push(parseRelation(relationName));
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
