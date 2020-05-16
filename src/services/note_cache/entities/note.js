export default class Note {
    constructor(row) {
        /** @param {string} */
        this.noteId = row.noteId;
        /** @param {string} */
        this.title = row.title;
        /** @param {boolean} */
        this.isProtected = !!row.isProtected;
        /** @param {boolean} */
        this.isDecrypted = !row.isProtected || !!row.isContentAvailable;
        /** @param {Branch[]} */
        this.parentBranches = [];
        /** @param {Note[]} */
        this.parents = [];
        /** @param {Note[]} */
        this.children = [];
        /** @param {Attribute[]} */
        this.ownedAttributes = [];

        /** @param {Attribute[]|null} */
        this.attributeCache = null;
        /** @param {Attribute[]|null} */
        this.inheritableAttributeCache = null;

        /** @param {Attribute[]} */
        this.targetRelations = [];

        /** @param {string|null} */
        this.flatTextCache = null;

        if (protectedSessionService.isProtectedSessionAvailable()) {
            decryptProtectedNote(this);
        }
    }

    /** @return {Attribute[]} */
    get attributes() {
        if (!this.attributeCache) {
            const parentAttributes = this.ownedAttributes.slice();

            if (this.noteId !== 'root') {
                for (const parentNote of this.parents) {
                    parentAttributes.push(...parentNote.inheritableAttributes);
                }
            }

            const templateAttributes = [];

            for (const ownedAttr of parentAttributes) { // parentAttributes so we process also inherited templates
                if (ownedAttr.type === 'relation' && ownedAttr.name === 'template') {
                    const templateNote = notes[ownedAttr.value];

                    if (templateNote) {
                        templateAttributes.push(...templateNote.attributes);
                    }
                }
            }

            this.attributeCache = parentAttributes.concat(templateAttributes);
            this.inheritableAttributeCache = [];

            for (const attr of this.attributeCache) {
                if (attr.isInheritable) {
                    this.inheritableAttributeCache.push(attr);
                }
            }
        }

        return this.attributeCache;
    }

    /** @return {Attribute[]} */
    get inheritableAttributes() {
        if (!this.inheritableAttributeCache) {
            this.attributes; // will refresh also this.inheritableAttributeCache
        }

        return this.inheritableAttributeCache;
    }

    hasAttribute(type, name) {
        return this.attributes.find(attr => attr.type === type && attr.name === name);
    }

    get isArchived() {
        return this.hasAttribute('label', 'archived');
    }

    get isHideInAutocompleteOrArchived() {
        return this.attributes.find(attr =>
            attr.type === 'label'
            && ["archived", "hideInAutocomplete"].includes(attr.name));
    }

    get hasInheritableOwnedArchivedLabel() {
        return !!this.ownedAttributes.find(attr => attr.type === 'label' && attr.name === 'archived' && attr.isInheritable);
    }

    // will sort the parents so that non-archived are first and archived at the end
    // this is done so that non-archived paths are always explored as first when searching for note path
    resortParents() {
        this.parents.sort((a, b) => a.hasInheritableOwnedArchivedLabel ? 1 : -1);
    }

    /**
     * @return {string} - returns flattened textual representation of note, prefixes and attributes usable for searching
     */
    get flatText() {
        if (!this.flatTextCache) {
            if (this.isHideInAutocompleteOrArchived) {
                this.flatTextCache = " "; // can't be empty
                return this.flatTextCache;
            }

            this.flatTextCache = '';

            for (const branch of this.parentBranches) {
                if (branch.prefix) {
                    this.flatTextCache += branch.prefix + ' - ';
                }
            }

            this.flatTextCache += this.title;

            for (const attr of this.attributes) {
                // it's best to use space as separator since spaces are filtered from the search string by the tokenization into words
                this.flatTextCache += (attr.type === 'label' ? '#' : '@') + attr.name;

                if (attr.value) {
                    this.flatTextCache += '=' + attr.value;
                }
            }

            this.flatTextCache = this.flatTextCache.toLowerCase();
        }

        return this.flatTextCache;
    }

    invalidateThisCache() {
        this.flatTextCache = null;

        this.attributeCache = null;
        this.inheritableAttributeCache = null;
    }

    invalidateSubtreeCaches() {
        this.invalidateThisCache();

        for (const childNote of this.children) {
            childNote.invalidateSubtreeCaches();
        }

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    note.invalidateSubtreeCaches();
                }
            }
        }
    }

    invalidateSubtreeFlatText() {
        this.flatTextCache = null;

        for (const childNote of this.children) {
            childNote.invalidateSubtreeFlatText();
        }

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    note.invalidateSubtreeFlatText();
                }
            }
        }
    }

    get isTemplate() {
        return !!this.targetRelations.find(rel => rel.name === 'template');
    }

    /** @return {Note[]} */
    get subtreeNotesIncludingTemplated() {
        const arr = [[this]];

        for (const childNote of this.children) {
            arr.push(childNote.subtreeNotesIncludingTemplated);
        }

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    arr.push(note.subtreeNotesIncludingTemplated);
                }
            }
        }

        return arr.flat();
    }

    /** @return {Note[]} */
    get subtreeNotes() {
        const arr = [[this]];

        for (const childNote of this.children) {
            arr.push(childNote.subtreeNotes);
        }

        return arr.flat();
    }

    /** @return {Note[]} - returns only notes which are templated, does not include their subtrees
     *                     in effect returns notes which are influenced by note's non-inheritable attributes */
    get templatedNotes() {
        const arr = [this];

        for (const targetRelation of this.targetRelations) {
            if (targetRelation.name === 'template') {
                const note = targetRelation.note;

                if (note) {
                    arr.push(note);
                }
            }
        }

        return arr;
    }
}
