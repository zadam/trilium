function lexer(str) {
    const fulltextTokens = [];
    const expressionTokens = [];

    let quotes = false;
    let fulltextEnded = false;
    let currentWord = '';
    let symbol = false;

    function isSymbol(chr) {
        return ['=', '*', '>', '<', '!'].includes(chr);
    }

    function finishWord() {
        if (currentWord === '') {
            return;
        }

        if (fulltextEnded) {
            expressionTokens.push(currentWord);
        } else {
            fulltextTokens.push(currentWord);
        }

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
                if (currentWord.length === 0) {
                    quotes = chr;
                }
                else {
                    // quote inside a word does not have special meening and does not break word
                    // e.g. d'Artagnan is kept as a single token
                    currentWord += chr;
                }
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
            if (chr === '#' || chr === '@') {
                fulltextEnded = true;
                continue;
            }
            else if (chr === ' ') {
                finishWord();
                continue;
            }
            else if (fulltextEnded && symbol !== isSymbol(chr)) {
                finishWord();

                currentWord += chr;
                symbol = isSymbol(chr);
                continue;
            }
        }

        currentWord += chr;
    }

    finishWord();

    return {
        fulltextTokens,
        expressionTokens
    }
}

module.exports = lexer;
