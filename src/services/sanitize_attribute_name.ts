function sanitizeAttributeName(origName: string) {
    let fixedName: string;

    if (origName === '') {
        fixedName = "unnamed";
    }
    else {
        // any not allowed character should be replaced with underscore
        fixedName = origName.replace(/[^\p{L}\p{N}_:]/ug, "_");
    }

    return fixedName;
}


export = {
    sanitizeAttributeName
};
