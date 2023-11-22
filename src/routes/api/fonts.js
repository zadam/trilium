const optionService = require('../../services/options.js');

function getFontCss(req, res) {
    res.setHeader('Content-Type', 'text/css');

    if (!optionService.getOptionBool('overrideThemeFonts')) {
        res.send('');

        return;
    }

    const optionsMap = optionService.getOptionMap();

    const mainFontFamilyOverridden = optionsMap.mainFontFamily !== 'theme';
    const treeFontFamilyOverridden = optionsMap.treeFontFamily !== 'theme';
    const detailFontFamilyOverridden = optionsMap.detailFontFamily !== 'theme';
    const monospaceFontFamilyOverridden = optionsMap.monospaceFontFamily !== 'theme';

    // using body to be more specific than themes' :root
    let style = 'body {';

    if (mainFontFamilyOverridden) style += `--main-font-family: ${optionsMap.mainFontFamily};`;
    if (treeFontFamilyOverridden) style += `--tree-font-family: ${optionsMap.treeFontFamily};`;
    if (detailFontFamilyOverridden) style += `--detail-font-family: ${optionsMap.detailFontFamily};`;
    if (monospaceFontFamilyOverridden) style += `--monospace-font-family: ${optionsMap.monospaceFontFamily};`;

    style += `--main-font-size: ${optionsMap.mainFontSize}%;`;
    style += `--tree-font-size: ${optionsMap.treeFontSize}%;`;
    style += `--detail-font-size: ${optionsMap.detailFontSize}%;`;
    style += `--monospace-font-size: ${optionsMap.monospaceFontSize}%;`;

    style += '}';

    res.send(style);
}

module.exports = {
    getFontCss
};
