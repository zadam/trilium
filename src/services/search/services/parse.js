"use strict";

const dayjs = require("dayjs");
const AndExp = require('../expressions/and');
const OrExp = require('../expressions/or');
const NotExp = require('../expressions/not');
const ChildOfExp = require('../expressions/child_of');
const DescendantOfExp = require('../expressions/descendant_of');
const ParentOfExp = require('../expressions/parent_of');
const RelationWhereExp = require('../expressions/relation_where');
const PropertyComparisonExp = require('../expressions/property_comparison');
const AttributeExistsExp = require('../expressions/attribute_exists');
const LabelComparisonExp = require('../expressions/label_comparison');
const NoteFlatTextExp = require('../expressions/note_flat_text');
const NoteContentFulltextExp = require('../expressions/note_content_fulltext.js');
const OrderByAndLimitExp = require('../expressions/order_by_and_limit');
const AncestorExp = require("../expressions/ancestor");
const buildComparator = require('./build_comparator');
const ValueExtractor = require('../value_extractor');
const utils = require("../../utils");

function getFulltext(tokens, searchContext) {
    tokens = tokens.map(t => utils.removeDiacritic(t.token));

    searchContext.highlightedTokens.push(...tokens);

    if (tokens.length === 0) {
        return null;
    }

    if (!searchContext.fastSearch) {
        return new OrExp([
            new NoteFlatTextExp(tokens),
            new NoteContentFulltextExp('*=*', {tokens, flatText: true})
        ]);
    }
    else {
        return new NoteFlatTextExp(tokens);
    }
}

function isOperator(str) {
    return str.match(/^[!=<>*%]+$/);
}

function getExpression(tokens, searchContext, level = 0) {
    if (tokens.length === 0) {
        return null;
    }

    const expressions = [];
    let op = null;

    let i;

    function context(i) {
        let {startIndex, endIndex} = tokens[i];
        startIndex = Math.max(0, startIndex - 20);
        endIndex = Math.min(searchContext.originalQuery.length, endIndex + 20);

        return '"' + (startIndex !== 0 ? "..." : "")
            + searchContext.originalQuery.substr(startIndex, endIndex - startIndex)
            + (endIndex !== searchContext.originalQuery.length ? "..." : "") + '"';
    }

    function resolveConstantOperand() {
        const operand = tokens[i];

        if (!operand.inQuotes
            && (operand.token.startsWith('#') || operand.token.startsWith('~') || operand.token === 'note')) {
            searchContext.addError(`Error near token "${operand.token}" in ${context(i)}, it's possible to compare with constant only.`);
            return null;
        }

        if (operand.inQuotes || !["now", "today", "month", "year"].includes(operand.token)) {
            return operand.token;
        }

        let delta = 0;

        if (i + 2 < tokens.length) {
            if (tokens[i + 1].token === '+') {
                i += 2;

                delta += parseInt(tokens[i].token);
            }
            else if (tokens[i + 1].token === '-') {
                i += 2;

                delta -= parseInt(tokens[i].token);
            }
        }

        let format, date;

        if (operand.token === 'now') {
            date = dayjs().add(delta, 'second');
            format = "YYYY-MM-DD HH:mm:ss";
        }
        else if (operand.token === 'today') {
            date = dayjs().add(delta, 'day');
            format = "YYYY-MM-DD";
        }
        else if (operand.token === 'month') {
            date = dayjs().add(delta, 'month');
            format = "YYYY-MM";
        }
        else if (operand.token === 'year') {
            date = dayjs().add(delta, 'year');
            format = "YYYY";
        }
        else {
            throw new Error("Unrecognized keyword: " + operand.token);
        }

        return date.format(format);
    }

    function parseNoteProperty() {
        if (tokens[i].token !== '.') {
            searchContext.addError('Expected "." to separate field path');
            return;
        }

        i++;

        if (['content', 'rawcontent'].includes(tokens[i].token)) {
            const raw = tokens[i].token === 'rawcontent';

            i += 1;

            const operator = tokens[i].token;

            if (!isOperator(operator)) {
                searchContext.addError(`After content expected operator, but got "${tokens[i].token}" in ${context(i)}`);
                return;
            }

            i++;

            return new NoteContentFulltextExp(operator, {tokens: [tokens[i].token], raw });
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
                searchContext.addError(`Expected "." to separate field path, got "${tokens[i + 1].token}" in ${context(i)}`);
                return;
            }

            i += 2;

            return parseLabel(tokens[i].token);
        }

        if (tokens[i].token === 'relations') {
            if (tokens[i + 1].token !== '.') {
                searchContext.addError(`Expected "." to separate field path, got "${tokens[i + 1].token}" in ${context(i)}`);
                return;
            }

            i += 2;

            return parseRelation(tokens[i].token);
        }

        if (tokens[i].token === 'text') {
            if (tokens[i + 1].token !== '*=*') {
                searchContext.addError(`Virtual attribute "note.text" supports only *=* operator, instead given "${tokens[i + 1].token}" in ${context(i)}`);
                return;
            }

            i += 2;

            return new OrExp([
                new PropertyComparisonExp(searchContext, 'title', '*=*', tokens[i].token),
                new NoteContentFulltextExp('*=*', {tokens: [tokens[i].token]})
            ]);
        }

        if (PropertyComparisonExp.isProperty(tokens[i].token)) {
            const propertyName = tokens[i].token;
            const operator = tokens[i + 1].token;

            i += 2;

            const comparedValue = resolveConstantOperand();

            return new PropertyComparisonExp(searchContext, propertyName, operator, comparedValue);
        }

        searchContext.addError(`Unrecognized note property "${tokens[i].token}" in ${context(i)}`);
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
        searchContext.highlightedTokens.push(labelName);

        if (i < tokens.length - 2 && isOperator(tokens[i + 1].token)) {
            let operator = tokens[i + 1].token;

            i += 2;

            const comparedValue = resolveConstantOperand();

            if (comparedValue === null) {
                return;
            }

            searchContext.highlightedTokens.push(comparedValue);

            if (searchContext.fuzzyAttributeSearch && operator === '=') {
                operator = '*=*';
            }

            const comparator = buildComparator(operator, comparedValue);

            if (!comparator) {
                searchContext.addError(`Can't find operator '${operator}' in ${context(i - 1)}`);
            } else {
                return new LabelComparisonExp('label', labelName, comparator);
            }
        } else {
            return new AttributeExistsExp('label', labelName, searchContext.fuzzyAttributeSearch);
        }
    }

    function parseRelation(relationName) {
        searchContext.highlightedTokens.push(relationName);

        if (i < tokens.length - 2 && tokens[i + 1].token === '.') {
            i += 1;

            return new RelationWhereExp(relationName, parseNoteProperty());
        }
        else if (i < tokens.length - 2 && isOperator(tokens[i + 1].token)) {
            searchContext.addError(`Relation can be compared only with property, e.g. ~relation.title=hello in ${context(i)}`);

            return null;
        }
        else {
            return new AttributeExistsExp('relation', relationName, searchContext.fuzzyAttributeSearch);
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

                const valueExtractor = new ValueExtractor(searchContext, propertyPath);

                if (valueExtractor.validate()) {
                    searchContext.addError(valueExtractor.validate());
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
        else {
            throw new Error(`Unrecognized op=${op}`);
        }
    }

    for (i = 0; i < tokens.length; i++) {
        if (Array.isArray(tokens[i])) {
            expressions.push(getExpression(tokens[i], searchContext, level++));
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
                searchContext.addError('orderBy can appear only on the top expression level');
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
                searchContext.addError(`not keyword should be followed by sub-expression in parenthesis, got ${tokens[i].token} instead`);
                continue;
            }

            expressions.push(new NotExp(getExpression(tokens[i], searchContext, level++)));
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
                searchContext.addError('Mixed usage of AND/OR - always use parenthesis to group AND/OR expressions.');
            }
        }
        else if (isOperator(token)) {
            searchContext.addError(`Misplaced or incomplete expression "${token}"`);
        }
        else {
            searchContext.addError(`Unrecognized expression "${token}"`);
        }

        if (!op && expressions.length > 1) {
            op = 'and';
        }
    }

    return getAggregateExpression();
}

function parse({fulltextTokens, expressionTokens, searchContext}) {
    let exp = AndExp.of([
        searchContext.includeArchivedNotes ? null : new PropertyComparisonExp(searchContext, "isarchived", "=", "false"),
        (searchContext.ancestorNoteId && searchContext.ancestorNoteId !== 'root') ? new AncestorExp(searchContext.ancestorNoteId, searchContext.ancestorDepth) : null,
        getFulltext(fulltextTokens, searchContext),
        getExpression(expressionTokens, searchContext)
    ]);

    if (searchContext.orderBy && searchContext.orderBy !== 'relevancy') {
        const filterExp = exp;

        exp = new OrderByAndLimitExp([{
            valueExtractor: new ValueExtractor(searchContext, ['note', searchContext.orderBy]),
            direction: searchContext.orderDirection
        }], searchContext.limit);

        exp.subExpression = filterExp;
    }

    return exp;
}

module.exports = parse;
