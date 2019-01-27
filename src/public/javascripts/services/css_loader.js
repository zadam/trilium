async function requireCss(url) {
    const css = Array
        .from(document.querySelectorAll('link'))
        .map(scr => scr.href);

    if (!css.includes(url)) {
        $('head').append($('<link rel="stylesheet" type="text/css" />').attr('href', url));
    }
}

export default {
    requireCss
}