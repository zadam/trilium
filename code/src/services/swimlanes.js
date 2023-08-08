const attributeService=require("./attributes")
const log = require('./log');

function generateMissingSwimlaneAttrs(note) {
    if (note.type !== "swimlane") {
        toastService.showAndLogError(`Note needs to be of task type, while it is: ${note.type}`);
        return;
    }
    const attrNames = [];

    for (const i in note.ownedAttributes) {
        const attr = note.ownedAttributes[i];
        attrNames.push(attr.name);
        log.info(attr.name);
    }

    const createAttributeIfMissing = (attributeName, defaultValue) => {
        if (!attrNames.includes(attributeName)) {
             attributeService.createAttribute({
                name: attributeName,
                type: 'swimlaneprop',
                value: defaultValue,
                noteId: note.noteId
            });
        }
    };

    createAttributeIfMissing("state", "default"); // collapsed/limited/default
    createAttributeIfMissing("maxchildren", "0"); // 0: no limit, >0: the limit
    createAttributeIfMissing("index", "0"); // 0: no limit, >0: the limit

}

function generateMissingSwimlaneDashboardAttrs(note) {
    if (note.type !== "swimlane_dashboard") {
        toastService.showAndLogError(`Note needs to be of task type, while it is: ${note.type}`);
        return;
    }
    const attrNames = [];

    for (const i in note.ownedAttributes) {
        const attr = note.ownedAttributes[i];
        attrNames.push(attr.name);
    }

    const createAttributeIfMissing = (attributeName, defaultValue) => {
        if (!attrNames.includes(attributeName)) {
            attributeService.createAttribute({
                name: attributeName,
                type: 'dashboardprop',
                value: defaultValue,
                noteId: note.noteId
            });
        }
    };

    createAttributeIfMissing("orientation", "{}");
    createAttributeIfMissing("childrenorder", "{}");
    createAttributeIfMissing("default", "");
}

module.exports= {
    generateMissingSwimlaneDashboardAttrs,
    generateMissingSwimlaneAttrs,
};
