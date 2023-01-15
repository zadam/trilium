import utils from "./utils.js";

function lex(str) {
    str = str.trim();

    const tokens = [];

    let quotes = false;
    let currentWord = '';

    function isOperatorSymbol(chr) {
        return ['=', '*', '>', '<', '!'].includes(chr);
    }

    function previousOperatorSymbol() {
        if (currentWord.length === 0) {
            return false;
        }
        else {
            return isOperatorSymbol(currentWord[currentWord.length - 1]);
        }
    }

    /**
     * @param endIndex - index of the last character of the token
     */
    function finishWord(endIndex) {
        if (currentWord === '') {
            return;
        }

        tokens.push({
            text: currentWord,
            startIndex: endIndex - currentWord.length + 1,
            endIndex: endIndex
        });

        currentWord = '';
    }

    for (let i = 0; i < str.length; i++) {
        const chr = str[i];

        if (chr === '\\') {
            if ((i + 1) < str.length) {
                i++;

                currentWord += str[i];
            }
            else {
                currentWord += chr;
            }

            continue;
        }
        else if (['"', "'", '`'].includes(chr)) {
            if (!quotes) {
                if (previousOperatorSymbol()) {
                    finishWord(i - 1);
                }

                quotes = chr;
            }
            else if (quotes === chr) {
                quotes = false;

                finishWord(i - 1);
            }
            else {
                // it's a quote but within other kind of quotes, so it's valid as a literal character
                currentWord += chr;
            }
            continue;
        }
        else if (!quotes) {
            if (currentWord.length === 0 && (chr === '#' || chr === '~')) {
                currentWord = chr;

                continue;
            }
            else if (chr === ' ') {
                finishWord(i - 1);
                continue;
            }
            else if (['(', ')'].includes(chr)) {
                finishWord(i - 1);

                currentWord = chr;

                finishWord(i);

                continue;
            }
            else if (previousOperatorSymbol() !== isOperatorSymbol(chr)) {
                finishWord(i - 1);

                currentWord += chr;
                continue;
            }
        }

        currentWord += chr;
    }

    finishWord(str.length - 1);

    return tokens;
}

function checkAttributeName(attrName) {
    if (attrName.length === 0) {
        throw new Error("Attribute name is empty, please fill the name.");
    }

    if (!utils.isValidAttributeName(attrName)) {
        throw new Error(`Attribute name "${attrName}" contains disallowed characters, only alphanumeric characters, colon and underscore are allowed.`);
    }
}

function parse(tokens, str, allowEmptyRelations = false) {
    const attrs = [];

    function context(i) {
        let {startIndex, endIndex} = tokens[i];
        startIndex = Math.max(0, startIndex - 20);
        endIndex = Math.min(str.length, endIndex + 20);

        return `"${startIndex !== 0 ? "..." : ""}${str.substr(startIndex, endIndex - startIndex)}${endIndex !== str.length ? "..." : ""}"`;
    }

    for (let i = 0; i < tokens.length; i++) {
        const {text, startIndex} = tokens[i];

        function isInheritable() {
            if (tokens.length > i + 3
                && tokens[i + 1].text === '('
                && tokens[i + 2].text === 'inheritable'
                && tokens[i + 3].text === ')') {

                i += 3;

                return true;
            }
            else {
                return false;
            }
        }

        if (text.startsWith('#')) {
            const labelName = text.substr(1);

            checkAttributeName(labelName);

            const attr = {
                type: 'label',
                name: labelName,
                isInheritable: isInheritable(),
                startIndex: startIndex,
                endIndex: tokens[i].endIndex // i could be moved by isInheritable
            };

            if (i + 1 < tokens.length && tokens[i + 1].text === "=") {
                if (i + 2 >= tokens.length) {
                    throw new Error(`Missing value for label "${text}" in ${context(i)}`);
                }

                i += 2;

                attr.value = tokens[i].text;
                attr.endIndex = tokens[i].endIndex;
            }

            attrs.push(attr);
        }
        else if (text.startsWith('~')) {
            const relationName = text.substr(1);

            checkAttributeName(relationName);

            const attr = {
                type: 'relation',
                name: relationName,
                isInheritable: isInheritable(),
                startIndex: startIndex,
                endIndex: tokens[i].endIndex // i could be moved by isInheritable
            };

            attrs.push(attr);

            if (i + 2 >= tokens.length || tokens[i + 1].text !== '=') {
                if (allowEmptyRelations) {
                    break;
                }
                else {
                    throw new Error(`Relation "${text}" in ${context(i)} should point to a note.`);
                }
            }

            i += 2;

            let notePath = tokens[i].text;
            if (notePath.startsWith("#")) {
                notePath = notePath.substr(1);
            }

            const noteId = notePath.split('/').pop();

            attr.value = noteId;
            attr.endIndex = tokens[i].endIndex;
        }
        else {
            throw new Error(`Invalid attribute "${text}" in ${context(i)}`);
        }
    }

    return attrs;
}

function lexAndParse(str, allowEmptyRelations = false) {
    const tokens = lex(str);

    return parse(tokens, str, allowEmptyRelations);
}

export default {
    lex,
    parse,
    lexAndParse
}
