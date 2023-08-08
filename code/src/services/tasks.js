const attributeService=require("./attributes")
const log = require('./log');

function generateMissingTaskAttrs(note) {
    if (note.type !== "task") {
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
                type: 'taskprop',
                value: defaultValue,
                noteId: note.noteId
            });
        }
    };

    createAttributeIfMissing("description", `
    <h3><i>What</i></h3>
    <br>
    <br>
    <h3><i>Why</i></h3>
    <br>
    <br>
    <h3><i>How</i></h3>
    <br>
    `);
    createAttributeIfMissing("relations", "rel1");
    createAttributeIfMissing("state", 'default');
    createAttributeIfMissing("owner", 'admin');
    createAttributeIfMissing("comments", "");
    createAttributeIfMissing("subTasks", "subt1");
    createAttributeIfMissing("deadline", "1999-01-01");
    createAttributeIfMissing("hasDeadline", 0);
    createAttributeIfMissing("prio", "normal");
    createAttributeIfMissing("swimlane", "0");
}

module.exports= {
    generateMissingTaskAttrs
};
