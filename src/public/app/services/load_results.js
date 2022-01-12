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

        this.branches = [];

        this.attributes = [];

        this.noteReorderings = [];

        this.noteRevisions = [];

        this.contentNoteIdToComponentId = [];

        this.options = [];
    }

    getEntity(entityName, entityId) {
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
        this.branches.push({branchId, componentId});
    }

    getBranches() {
        return this.branches
            .map(row => this.getEntity("branches", row.branchId))
            .filter(branch => !!branch);
    }

    addNoteReordering(parentNoteId, componentId) {
        this.noteReorderings.push(parentNoteId);
    }

    getNoteReorderings() {
        return this.noteReorderings;
    }

    addAttribute(attributeId, componentId) {
        this.attributes.push({attributeId, componentId});
    }

    /** @returns {Attribute[]} */
    getAttributes(componentId = 'none') {
        return this.attributes
            .filter(row => row.componentId !== componentId)
            .map(row => this.getEntity("attributes", row.attributeId))
            .filter(attr => !!attr);
    }

    addNoteRevision(noteRevisionId, noteId, componentId) {
        this.noteRevisions.push({noteRevisionId, noteId, componentId});
    }

    hasNoteRevisionForNote(noteId) {
        return !!this.noteRevisions.find(nr => nr.noteId === noteId);
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
        this.options.push(name);
    }

    isOptionReloaded(name) {
        return this.options.includes(name);
    }

    /**
     * @return {boolean} true if there are changes which could affect the attributes (including inherited ones)
     *          notably changes in note itself should not have any effect on attributes
     */
    hasAttributeRelatedChanges() {
        return this.branches.length > 0
            || this.attributes.length > 0;
    }

    isEmpty() {
        return Object.keys(this.noteIdToComponentId).length === 0
            && this.branches.length === 0
            && this.attributes.length === 0
            && this.noteReorderings.length === 0
            && this.noteRevisions.length === 0
            && this.contentNoteIdToComponentId.length === 0
            && this.options.length === 0;
    }

    isEmptyForTree() {
        return Object.keys(this.noteIdToComponentId).length === 0
            && this.branches.length === 0
            && this.attributes.length === 0
            && this.noteReorderings.length === 0;
    }
}
