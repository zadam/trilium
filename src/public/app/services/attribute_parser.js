function preprocess(str) {
    if (str.startsWith('<p>')) {
        str = str.substr(3);
    }

    if (str.endsWith('</p>')) {
        str = str.substr(0, str.length - 4);
    }

    str = str.replace(/&nbsp;/g, " ");

    return str.replace(/<a[^>]+href="(#[A-Za-z0-9/]*)"[^>]*>[^<]*<\/a>/g, "$1");
}

function lexer(str) {
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
                // it's a quote but within other kind of quotes so it's valid as a literal character
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

function parser(tokens, str, allowEmptyRelations = false) {
    const attrs = [];

    function context(i) {
        let {startIndex, endIndex} = tokens[i];
        startIndex = Math.max(0, startIndex - 20);
        endIndex = Math.min(str.length, endIndex + 20);

        return '"' + (startIndex !== 0 ? "..." : "")
            + str.substr(startIndex, endIndex - startIndex)
            + (endIndex !== str.length ? "..." : "") + '"';
    }

    for (let i = 0; i < tokens.length; i++) {
        const {text, startIndex, endIndex} = tokens[i];

        if (text.startsWith('#')) {
            const attr = {
                type: 'label',
                name: text.substr(1),
                isInheritable: false, // FIXME
                nameStartIndex: startIndex,
                nameEndIndex: endIndex
            };

            if (i + 1 < tokens.length && tokens[i + 1].text === "=") {
                if (i + 2 >= tokens.length) {
                    throw new Error(`Missing value for label "${text}" in ${context(i)}`);
                }

                i += 2;

                attr.value = tokens[i].text;
                attr.valueStartIndex = tokens[i].startIndex;
                attr.valueEndIndex = tokens[i].endIndex;
            }

            attrs.push(attr);
        }
        else if (text.startsWith('~')) {
            const attr = {
                type: 'relation',
                name: text.substr(1),
                isInheritable: false, // FIXME
                nameStartIndex: startIndex,
                nameEndIndex: endIndex
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
            attr.valueStartIndex = tokens[i].startIndex;
            attr.valueEndIndex = tokens[i].endIndex;
        }
        else {
            throw new Error(`Unrecognized attribute "${text}" in ${context(i)}`);
        }
    }

    return attrs;
}

function lexAndParse(str, allowEmptyRelations = false) {
    str = preprocess(str);

    const tokens = lexer(str);

    return parser(tokens, str, allowEmptyRelations);
}

export default {
    lexer,
    parser,
    lexAndParse
}
