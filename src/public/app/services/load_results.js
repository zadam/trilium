export default class LoadResults {
    constructor(entityChanges) {
        this.entities = {};

        for (const {entityId, entityName, entity} of entityChanges) {
            if (entity) {
                this.entities[entityName] = this.entities[entityName] || [];
                this.entities[entityName][entityId] = entity;
            }
        }

        this.noteIdToSourceId = {};
        this.sourceIdToNoteIds = {};

        this.branches = [];

        this.attributes = [];

        this.noteReorderings = [];

        this.noteRevisions = [];

        this.contentNoteIdToSourceId = [];

        this.options = [];
    }

    getEntity(entityName, entityId) {
        return this.entities[entityName]?.[entityId];
    }

    addNote(noteId, sourceId) {
        this.noteIdToSourceId[noteId] = this.noteIdToSourceId[noteId] || [];

        if (!this.noteIdToSourceId[noteId].includes(sourceId)) {
            this.noteIdToSourceId[noteId].push(sourceId);
        }

        this.sourceIdToNoteIds[sourceId] = this.sourceIdToNoteIds[sourceId] || [];

        if (!this.sourceIdToNoteIds[sourceId]) {
            this.sourceIdToNoteIds[sourceId].push(noteId);
        }
    }

    addBranch(branchId, sourceId) {
        this.branches.push({branchId, sourceId});
    }

    getBranches() {
        return this.branches
            .map(row => this.getEntity("branches", row.branchId))
            .filter(branch => !!branch);
    }

    addNoteReordering(parentNoteId, sourceId) {
        this.noteReorderings.push(parentNoteId);
    }

    getNoteReorderings() {
        return this.noteReorderings;
    }

    addAttribute(attributeId, sourceId) {
        this.attributes.push({attributeId, sourceId});
    }

    /** @returns {Attribute[]} */
    getAttributes(sourceId = 'none') {
        return this.attributes
            .filter(row => row.sourceId !== sourceId)
            .map(row => this.getEntity("attributes", row.attributeId))
            .filter(attr => !!attr);
    }

    addNoteRevision(noteRevisionId, noteId, sourceId) {
        this.noteRevisions.push({noteRevisionId, noteId, sourceId});
    }

    hasNoteRevisionForNote(noteId) {
        return !!this.noteRevisions.find(nr => nr.noteId === noteId);
    }

    getNoteIds() {
        return Object.keys(this.noteIdToSourceId);
    }

    isNoteReloaded(noteId, sourceId = null) {
        if (!noteId) {
            return false;
        }

        const sourceIds = this.noteIdToSourceId[noteId];
        return sourceIds && !!sourceIds.find(sId => sId !== sourceId);
    }

    addNoteContent(noteId, sourceId) {
        this.contentNoteIdToSourceId.push({noteId, sourceId});
    }

    isNoteContentReloaded(noteId, sourceId) {
        if (!noteId) {
            return false;
        }

        return this.contentNoteIdToSourceId.find(l => l.noteId === noteId && l.sourceId !== sourceId);
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
        return Object.keys(this.noteIdToSourceId).length === 0
            && this.branches.length === 0
            && this.attributes.length === 0
            && this.noteReorderings.length === 0
            && this.noteRevisions.length === 0
            && this.contentNoteIdToSourceId.length === 0
            && this.options.length === 0;
    }

    isEmptyForTree() {
        return Object.keys(this.noteIdToSourceId).length === 0
            && this.branches.length === 0
            && this.attributes.length === 0
            && this.noteReorderings.length === 0;
    }
}
