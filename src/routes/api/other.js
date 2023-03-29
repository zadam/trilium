const becca = require("../../becca/becca");

function getIconUsage() {
    const iconClassToCountMap = {};

    for (const {value: iconClass, noteId} of becca.findAttributes('label', 'iconClass')) {
        if (noteId.startsWith("_")) {
            continue; // ignore icons of "system" notes since they were not set by the user
        }

        if (!iconClass?.trim()) {
            continue;
        }

        for (const clazz of iconClass.trim().split(/\s+/)) {
            if (clazz === 'bx') {
                continue;
            }

            iconClassToCountMap[clazz] = (iconClassToCountMap[clazz] || 0) + 1;
        }
    }

    return { iconClassToCountMap };
}

module.exports = {
    getIconUsage
};
