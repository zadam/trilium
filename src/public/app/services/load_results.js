export default class LoadResults {
    constructor(entityChanges) {
        this.entities = {};

        for (const {entityId, entityName, entity} of entityChanges) {
            if (entity) {
                this.entities[entityName] = this.entities[entityName] || [];
                this.entities[entityName][entityId] = entity;
            }
        }

        this.noteIdToComponentId = {};
        this.componentIdToNoteIds = {};

        this.branchRows = [];

        this.attributeRows = [];

        this.noteReorderings = [];

        this.revisionRows = [];

        this.contentNoteIdToComponentId = [];

        this.optionNames = [];

        this.attachmentRows = [];
    }

    getEntityRow(entityName, entityId) {
        return this.entities[entityName]?.[entityId];
    }

    addNote(noteId, componentId) {
        this.noteIdToComponentId[noteId] = this.noteIdToComponentId[noteId] || [];

        if (!this.noteIdToComponentId[noteId].includes(componentId)) {
            this.noteIdToComponentId[noteId].push(componentId);
        }

        this.componentIdToNoteIds[componentId] = this.componentIdToNoteIds[componentId] || [];

        if (!this.componentIdToNoteIds[componentId]) {
            this.componentIdToNoteIds[componentId].push(noteId);
        }
    }

    addBranch(branchId, componentId) {
        this.branchRows.push({branchId, componentId});
    }

    getBranchRows() {
        return this.branchRows
            .map(row => this.getEntityRow("branches", row.branchId))
            .filter(branch => !!branch);
    }

    addNoteReordering(parentNoteId, componentId) {
        this.noteReorderings.push(parentNoteId);
    }

    getNoteReorderings() {
        return this.noteReorderings;
    }

    addAttribute(attributeId, componentId) {
        this.attributeRows.push({attributeId, componentId});
    }

    getAttributeRows(componentId = 'none') {
        return this.attributeRows
            .filter(row => row.componentId !== componentId)
            .map(row => this.getEntityRow("attributes", row.attributeId))
            .filter(attr => !!attr);
    }

    addRevision(revisionId, noteId, componentId) {
        this.revisionRows.push({revisionId, noteId, componentId});
    }

    hasRevisionForNote(noteId) {
        return !!this.revisionRows.find(row => row.noteId === noteId);
    }

    getNoteIds() {
        return Object.keys(this.noteIdToComponentId);
    }

    isNoteReloaded(noteId, componentId = null) {
        if (!noteId) {
            return false;
        }

        const componentIds = this.noteIdToComponentId[noteId];
        return componentIds && componentIds.find(sId => sId !== componentId) !== undefined;
    }

    addNoteContent(noteId, componentId) {
        this.contentNoteIdToComponentId.push({noteId, componentId});
    }

    isNoteContentReloaded(noteId, componentId) {
        if (!noteId) {
            return false;
        }

        return this.contentNoteIdToComponentId.find(l => l.noteId === noteId && l.componentId !== componentId);
    }

    addOption(name) {
        this.optionNames.push(name);
    }

    isOptionReloaded(name) {
        return this.optionNames.includes(name);
    }

    getOptionNames() {
        return this.optionNames;
    }

    addAttachmentRow(attachment) {
        this.attachmentRows.push(attachment);
    }

    getAttachmentRows() {
        return this.attachmentRows;
    }

    /**
     * @returns {boolean} true if there are changes which could affect the attributes (including inherited ones)
     *          notably changes in note itself should not have any effect on attributes
     */
    hasAttributeRelatedChanges() {
        return this.branchRows.length > 0
            || this.attributeRows.length > 0;
    }

    isEmpty() {
        return Object.keys(this.noteIdToComponentId).length === 0
            && this.branchRows.length === 0
            && this.attributeRows.length === 0
            && this.noteReorderings.length === 0
            && this.revisionRows.length === 0
            && this.contentNoteIdToComponentId.length === 0
            && this.optionNames.length === 0
            && this.attachmentRows.length === 0;
    }

    isEmptyForTree() {
        return Object.keys(this.noteIdToComponentId).length === 0
            && this.branchRows.length === 0
            && this.attributeRows.length === 0
            && this.noteReorderings.length === 0;
    }
}
