function lex(str) {
    str = str.toLowerCase();

    let fulltextQuery = "";
    const fulltextTokens = [];
    const expressionTokens = [];

    let quotes = false; // otherwise contains used quote - ', " or `
    let fulltextEnded = false;
    let currentWord = '';

    function isSymbolAnOperator(chr) {
        return ['=', '*', '>', '<', '!', "-", "+", '%'].includes(chr);
    }

    function isPreviousSymbolAnOperator() {
        if (currentWord.length === 0) {
            return false;
        }
        else {
            return isSymbolAnOperator(currentWord[currentWord.length - 1]);
        }
    }

    function finishWord(endIndex, createAlsoForEmptyWords = false) {
        if (currentWord === '' && !createAlsoForEmptyWords) {
            return;
        }

        const rec = {
            token: currentWord,
            inQuotes: !!quotes,
            startIndex: endIndex - currentWord.length + 1,
            endIndex
        };

        if (fulltextEnded) {
            expressionTokens.push(rec);
        } else {
            fulltextTokens.push(rec);

            fulltextQuery = str.substr(0, endIndex + 1);
        }

        currentWord = '';
    }

    for (let i = 0; i < str.length; i++) {
        const chr = str[i];

        if (chr === '\\') {
            if (i + 1 < str.length) {
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
                if (currentWord.length === 0 || isPreviousSymbolAnOperator()) {
                    finishWord(i - 1);

                    quotes = chr;
                }
                else {
                    // quote inside a word does not have special meening and does not break word
                    // e.g. d'Artagnan is kept as a single token
                    currentWord += chr;
                }
            }
            else if (quotes === chr) {
                finishWord(i - 1, true);

                quotes = false;
            }
            else {
                // it's a quote but within other kind of quotes, so it's valid as a literal character
                currentWord += chr;
            }

            continue;
        }
        else if (!quotes) {
            if (!fulltextEnded && currentWord === 'note' && chr === '.' && i + 1 < str.length) {
                fulltextEnded = true;
            }

            if (chr === '#' || chr === '~') {
                if (!fulltextEnded) {
                    fulltextEnded = true;
                }
                else {
                    finishWord(i - 1);
                }

                currentWord = chr;

                continue;
            }
            else if (['#', '~'].includes(currentWord) && chr === '!') {
                currentWord += chr;
                continue;
            }
            else if (chr === ' ') {
                finishWord(i - 1);
                continue;
            }
            else if (fulltextEnded && ['(', ')', '.'].includes(chr)) {
                finishWord(i - 1);
                currentWord += chr;
                finishWord(i);
                continue;
            }
            else if (fulltextEnded
                && !['#!', '~!'].includes(currentWord)
                && isPreviousSymbolAnOperator() !== isSymbolAnOperator(chr)) {

                finishWord(i - 1);

                currentWord += chr;
                continue;
            }
        }

        currentWord += chr;
    }

    finishWord(str.length - 1);

    fulltextQuery = fulltextQuery.trim();

    return {
        fulltextQuery,
        fulltextTokens,
        expressionTokens
    }
}

module.exports = lex;
