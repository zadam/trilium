function lexer(str) {
    str = str.toLowerCase();

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

export default {
    lexer
}
