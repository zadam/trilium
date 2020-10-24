import server from './server.js';

async function addLabel(noteId, name, value = "") {
    await server.put(`notes/${noteId}/attribute`, {
        type: 'label',
        name: name,
        value: value
    });
}

async function setLabel(noteId, name, value = "") {
    await server.put(`notes/${noteId}/set-attribute`, {
        type: 'label',
        name: name,
        value: value
    });
}

async function removeAttributeById(noteId, attributeId) {
    await server.remove(`notes/${noteId}/attributes/${attributeId}`);
}

export default {
    addLabel,
    setLabel,
    removeAttributeById
}
