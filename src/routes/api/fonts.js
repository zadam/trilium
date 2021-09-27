const optionService = require('../../services/options');

function getFontCss(req, res) {
    res.setHeader('Content-Type', 'text/css');

    if (!optionService.getOptionBool('overrideThemeFonts')) {
        res.send('');

        return;
    }

    const optionsMap = optionService.getOptionsMap();

    // using body to be more specific than themes' :root
    res.send(`
body {
    --main-font-family: ${optionsMap.mainFontFamily};
    --main-font-size: ${optionsMap.mainFontSize}%;
     
    --tree-font-family: ${optionsMap.treeFontFamily};
    --tree-font-size: ${optionsMap.treeFontSize}%; 
    
    --detail-font-family: ${optionsMap.detailFontFamily};
    --detail-font-size: ${optionsMap.detailFontSize}%;
    
    --monospace-font-family: ${optionsMap.monospaceFontFamily};
    --monospace-font-size: ${optionsMap.monospaceFontSize};
}`);
}

module.exports = {
    getFontCss
};
