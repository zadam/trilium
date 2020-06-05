function preprocess(str) {
    if (str.startsWith('<p>')) {
        str = str.substr(3);
    }

    if (str.endsWith('</p>')) {
        str = str.substr(0, str.length - 4);
    }

    str = str.replace("&nbsp;", " ");

    return str.replace(/<a[^>]+href="(#[A-Za-z0-9/]*)"[^>]*>[^<]*<\/a>/g, "$1");
}

function lexer(str) {
    str = preprocess(str);

    const expressionTokens = [];

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

    function finishWord() {
        if (currentWord === '') {
            return;
        }

        expressionTokens.push(currentWord);

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
                    finishWord();
                }

                quotes = chr;
            }
            else if (quotes === chr) {
                quotes = false;

                finishWord();
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
                finishWord();
                continue;
            }
            else if (['(', ')', '.'].includes(chr)) {
                finishWord();
                currentWord += chr;
                finishWord();
                continue;
            }
            else if (previousOperatorSymbol() !== isOperatorSymbol(chr)) {
                finishWord();

                currentWord += chr;
                continue;
            }
        }

        currentWord += chr;
    }

    finishWord();

    return expressionTokens;
}

function parser(tokens) {
    const attrs = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.startsWith('#')) {
            const attr = {
                type: 'label',
                name: token.substr(1),
                isInheritable: false // FIXME
            };

            if (tokens[i + 1] === "=") {
                if (i + 2 >= tokens.length) {
                    throw new Error(`Missing value for label "${token}"`);
                }

                i += 2;

                attr.value = tokens[i];
            }

            attrs.push(attr);
        }
        else if (token.startsWith('~')) {
            if (i + 2 >= tokens.length || tokens[i + 1] !== '=') {
                throw new Error(`Relation "${token}" should point to a note.`);
            }

            i += 2;

            let notePath = tokens[i];
            if (notePath.startsWith("#")) {
                notePath = notePath.substr(1);
            }

            const noteId = notePath.split('/').pop();

            const attr = {
                type: 'relation',
                name: token.substr(1),
                isInheritable: false, // FIXME
                value: noteId
            };

            attrs.push(attr);
        }
        else {
            throw new Error(`Unrecognized attribute "${token}"`);
        }
    }

    return attrs;
}

function lexAndParse(str) {
    const tokens = lexer(str);

    return parser(tokens);
}

export default {
    lexer,
    parser,
    lexAndParse
}
