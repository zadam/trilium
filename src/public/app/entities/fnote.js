import server from '../services/server.js';
import noteAttributeCache from "../services/note_attribute_cache.js";
import ws from "../services/ws.js";
import options from "../services/options.js";
import froca from "../services/froca.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import cssClassManager from "../services/css_class_manager.js";

const LABEL = 'label';
const RELATION = 'relation';

const NOTE_TYPE_ICONS = {
    "file": "bx bx-file",
    "image": "bx bx-image",
    "code": "bx bx-code",
    "render": "bx bx-extension",
    "search": "bx bx-file-find",
    "relationMap": "bx bx-map-alt",
    "book": "bx bx-book",
    "noteMap": "bx bx-map-alt",
    "mermaid": "bx bx-selection",
    "canvas": "bx bx-pen",
    "webView": "bx bx-globe-alt",
    "launcher": "bx bx-link",
    "doc": "bx bxs-file-doc",
    "contentWidget": "bx bxs-widget"
};

class FNote {
    /**
     * @param {Froca} froca
     * @param {Object.<string, Object>} row
     */
    constructor(froca, row) {
        this.froca = froca;

        /** @type {string[]} */
        this.attributes = [];

        /** @type {string[]} */
        this.targetRelations = [];

        /** @type {string[]} */
        this.parents = [];
        /** @type {string[]} */
        this.children = [];

        /** @type {Object.<string, string>} */
        this.parentToBranch = {};

        /** @type {Object.<string, string>} */
        this.childToBranch = {};

        this.update(row);
    }

    update(row) {
        /** @type {string} */
        this.noteId = row.noteId;
        /** @type {string} */
        this.title = row.title;
        /** @type {boolean} */
        this.isProtected = !!row.isProtected;
        /**
         * one of 'text', 'code', 'file' or 'render'
         * @type {string}
         */
        this.type = row.type;
        /**
         * content-type, e.g. "application/json"
         * @type {string}
         */
        this.mime = row.mime;
    }

    addParent(parentNoteId, branchId, sort = true) {
        if (parentNoteId === 'none') {
            return;
        }

        if (!this.parents.includes(parentNoteId)) {
            this.parents.push(parentNoteId);
        }

        this.parentToBranch[parentNoteId] = branchId;

        if (sort) {
            this.sortParents();
        }
    }

    addChild(childNoteId, branchId, sort = true) {
        if (!(childNoteId in this.childToBranch)) {
            this.children.push(childNoteId);
        }

        this.childToBranch[childNoteId] = branchId;

        if (sort) {
            this.sortChildren();
        }
    }

    sortChildren() {
        const branchIdPos = {};

        for (const branchId of Object.values(this.childToBranch)) {
            branchIdPos[branchId] = this.froca.getBranch(branchId).notePosition;
        }

        this.children.sort((a, b) => branchIdPos[this.childToBranch[a]] < branchIdPos[this.childToBranch[b]] ? -1 : 1);
    }

    /** @returns {boolean} */
    isJson() {
        return this.mime === "application/json";
    }

    async getContent() {
        // we're not caching content since these objects are in froca and as such pretty long-lived
        const note = await server.get(`notes/${this.noteId}`);

        return note.content;
    }

    async getJsonContent() {
        const content = await this.getContent();

        try {
            return JSON.parse(content);
        }
        catch (e) {
            console.log(`Cannot parse content of note '${this.noteId}': `, e.message);

            return null;
        }
    }

    /**
     * @returns {string[]}
     */
    getParentBranchIds() {
        return Object.values(this.parentToBranch);
    }

    /**
     * @returns {string[]}
     * @deprecated use getParentBranchIds() instead
     */
    getBranchIds() {
        return this.getParentBranchIds();
    }

    /**
     * @returns {FBranch[]}
     */
    getParentBranches() {
        const branchIds = Object.values(this.parentToBranch);

        return this.froca.getBranches(branchIds);
    }

    /**
     * @returns {FBranch[]}
     * @deprecated use getParentBranches() instead
     */
    getBranches() {
        return this.getParentBranches();
    }

    /** @returns {boolean} */
    hasChildren() {
        return this.children.length > 0;
    }

    /** @returns {FBranch[]} */
    getChildBranches() {
        // don't use Object.values() to guarantee order
        const branchIds = this.children.map(childNoteId => this.childToBranch[childNoteId]);

        return this.froca.getBranches(branchIds);
    }

    /** @returns {string[]} */
    getParentNoteIds() {
        return this.parents;
    }

    /** @returns {FNote[]} */
    getParentNotes() {
        return this.froca.getNotesFromCache(this.parents);
    }

    // will sort the parents so that non-search & non-archived are first and archived at the end
    // this is done so that non-search & non-archived paths are always explored as first when looking for note path
    sortParents() {
        this.parents.sort((aNoteId, bNoteId) => {
            const aBranchId = this.parentToBranch[aNoteId];

            if (aBranchId && aBranchId.startsWith('virt-')) {
                return 1;
            }

            const aNote = this.froca.getNoteFromCache(aNoteId);

            if (aNote.isArchived || aNote.isHiddenCompletely()) {
                return 1;
            }

            return -1;
        });
    }

    get isArchived() {
        return this.hasAttribute('label', 'archived');
    }

    /** @returns {string[]} */
    getChildNoteIds() {
        return this.children;
    }

    /** @returns {Promise<FNote[]>} */
    async getChildNotes() {
        return await this.froca.getNotes(this.children);
    }

    /**
     * @param {string} [type] - (optional) attribute type to filter
     * @param {string} [name] - (optional) attribute name to filter
     * @returns {FAttribute[]} all note's attributes, including inherited ones
     */
    getOwnedAttributes(type, name) {
        const attrs = this.attributes
            .map(attributeId => this.froca.attributes[attributeId])
            .filter(Boolean); // filter out nulls;

        return this.__filterAttrs(attrs, type, name);
    }

    /**
     * @param {string} [type] - (optional) attribute type to filter
     * @param {string} [name] - (optional) attribute name to filter
     * @returns {FAttribute[]} all note's attributes, including inherited ones
     */
    getAttributes(type, name) {
        return this.__filterAttrs(this.__getCachedAttributes([]), type, name);
    }

    /**
     * @param {string[]} path
     * @return {FAttribute[]}
     * @private
     */
    __getCachedAttributes(path) {
        // notes/clones cannot form tree cycles, it is possible to create attribute inheritance cycle via templates
        // when template instance is a parent of template itself
        if (path.includes(this.noteId)) {
            return [];
        }

        if (!(this.noteId in noteAttributeCache.attributes)) {
            const newPath = [...path, this.noteId];
            const attrArrs = [ this.getOwnedAttributes() ];

            // inheritable attrs on root are typically not intended to be applied to hidden subtree #3537
            if (this.noteId !== 'root' && this.noteId !== '_hidden') {
                for (const parentNote of this.getParentNotes()) {
                    // these virtual parent-child relationships are also loaded into froca
                    if (parentNote.type !== 'search') {
                        attrArrs.push(parentNote.__getInheritableAttributes(newPath));
                    }
                }
            }

            for (const templateAttr of attrArrs.flat().filter(attr => attr.type === 'relation' && ['template', 'inherit'].includes(attr.name))) {
                const templateNote = this.froca.notes[templateAttr.value];

                if (templateNote && templateNote.noteId !== this.noteId) {
                    attrArrs.push(
                        templateNote.__getCachedAttributes(newPath)
                            // template attr is used as a marker for templates, but it's not meant to be inherited
                            .filter(attr => !(attr.type === 'label' && (attr.name === 'template' || attr.name === 'workspacetemplate')))
                    );
                }
            }

            noteAttributeCache.attributes[this.noteId] = [];
            const addedAttributeIds = new Set();

            for (const attr of attrArrs.flat()) {
                if (!addedAttributeIds.has(attr.attributeId)) {
                    addedAttributeIds.add(attr.attributeId);

                    noteAttributeCache.attributes[this.noteId].push(attr);
                }
            }
        }

        return noteAttributeCache.attributes[this.noteId];
    }

    isRoot() {
        return this.noteId === 'root';
    }

    /**
     * Gives all possible note paths leading to this note. Paths containing search note are ignored (could form cycles)
     *
     * @returns {string[][]} - array of notePaths (each represented by array of noteIds constituting the particular note path)
     */
    getAllNotePaths() {
        if (this.noteId === 'root') {
            return [['root']];
        }

        const parentNotes = this.getParentNotes();
        let notePaths = [];

        if (parentNotes.length === 1) { // optimization for most common case
            notePaths = parentNotes[0].getAllNotePaths();
        } else {
            notePaths = parentNotes.flatMap(parentNote => parentNote.getAllNotePaths());
        }

        for (const notePath of notePaths) {
            notePath.push(this.noteId);
        }

        return notePaths;
    }

    /**
     * @param {string} [hoistedNoteId='root']
     * @return {{isArchived: boolean, isInHoistedSubTree: boolean, notePath: string[], isHidden: boolean}[]}
     */
    getSortedNotePathRecords(hoistedNoteId = 'root') {
        const isHoistedRoot = hoistedNoteId === 'root';

        const notePaths = this.getAllNotePaths().map(path => ({
            notePath: path,
            isInHoistedSubTree: isHoistedRoot || path.includes(hoistedNoteId),
            isArchived: path.some(noteId => froca.notes[noteId].isArchived),
            isHidden: path.includes('_hidden')
        }));

        notePaths.sort((a, b) => {
            if (a.isInHoistedSubTree !== b.isInHoistedSubTree) {
                return a.isInHoistedSubTree ? -1 : 1;
            } else if (a.isArchived !== b.isArchived) {
                return a.isArchived ? 1 : -1;
            } else if (a.isHidden !== b.isHidden) {
                return a.isHidden ? 1 : -1;
            } else {
                return a.notePath.length - b.notePath.length;
            }
        });

        return notePaths;
    }

    /**
     * Returns note path considered to be the "best"
     *
     * @param {string} [hoistedNoteId='root']
     * @return {string[]} array of noteIds constituting the particular note path
     */
    getBestNotePath(hoistedNoteId = 'root') {
        return this.getSortedNotePathRecords(hoistedNoteId)[0]?.notePath;
    }

    /**
     * Returns note path considered to be the "best"
     *
     * @param {string} [hoistedNoteId='root']
     * @return {string} serialized note path (e.g. 'root/a1h315/js725h')
     */
    getBestNotePathString(hoistedNoteId = 'root') {
        const notePath = this.getBestNotePath(hoistedNoteId);

        return notePath?.join("/");
    }

    /**
     * @return boolean - true if there's no non-hidden path, note is not cloned to the visible tree
     */
    isHiddenCompletely() {
        if (this.noteId === 'root') {
            return false;
        }

        for (const parentNote of this.getParentNotes()) {
            if (parentNote.noteId === 'root') {
                return false;
            } else if (parentNote.noteId === '_hidden') {
                continue;
            }

            if (!parentNote.isHiddenCompletely()) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param {FAttribute[]} attributes
     * @param {string} type
     * @param {string} name
     * @return {FAttribute[]}
     * @private
     */
    __filterAttrs(attributes, type, name) {
        this.__validateTypeName(type, name);

        if (!type && !name) {
            return attributes;
        } else if (type && name) {
            return attributes.filter(attr => attr.name === name && attr.type === type);
        } else if (type) {
            return attributes.filter(attr => attr.type === type);
        } else if (name) {
            return attributes.filter(attr => attr.name === name);
        }
    }

    __getInheritableAttributes(path) {
        const attrs = this.__getCachedAttributes(path);

        return attrs.filter(attr => attr.isInheritable);
    }

    __validateTypeName(type, name) {
        if (type && type !== 'label' && type !== 'relation') {
            throw new Error(`Unrecognized attribute type '${type}'. Only 'label' and 'relation' are possible values.`);
        }

        if (name) {
            const firstLetter = name.charAt(0);
            if (firstLetter === '#' || firstLetter === '~') {
                throw new Error(`Detect '#' or '~' in the attribute's name. In the API, attribute names should be set without these characters.`);
            }
        }
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {FAttribute[]} all note's labels (attributes with type label), including inherited ones
     */
    getOwnedLabels(name) {
        return this.getOwnedAttributes(LABEL, name);
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {FAttribute[]} all note's labels (attributes with type label), including inherited ones
     */
    getLabels(name) {
        return this.getAttributes(LABEL, name);
    }

    getIcon() {
        const iconClassLabels = this.getLabels('iconClass');
        const workspaceIconClass = this.getWorkspaceIconClass();

        if (iconClassLabels.length > 0) {
            return iconClassLabels[0].value;
        }
        else if (workspaceIconClass) {
            return workspaceIconClass;
        }
        else if (this.noteId === 'root') {
            return "bx bx-chevrons-right";
        }
        if (this.noteId === '_share') {
            return "bx bx-share-alt";
        }
        else if (this.type === 'text') {
            if (this.isFolder()) {
                return "bx bx-folder";
            }
            else {
                return "bx bx-note";
            }
        }
        else if (this.type === 'code' && this.mime.startsWith('text/x-sql')) {
            return "bx bx-data";
        }
        else {
            return NOTE_TYPE_ICONS[this.type];
        }
    }

    getColorClass() {
        const color = this.getLabelValue("color");
        return cssClassManager.createClassForColor(color);
    }

    isFolder() {
        return this.type === 'search'
            || this.getFilteredChildBranches().length > 0;
    }

    getFilteredChildBranches() {
        let childBranches = this.getChildBranches();

        if (!childBranches) {
            ws.logError(`No children for '${this.noteId}'. This shouldn't happen.`);
            return;
        }

        if (options.is("hideIncludedImages_main")) {
            const imageLinks = this.getRelations('imageLink');

            // image is already visible in the parent note so no need to display it separately in the book
            childBranches = childBranches.filter(branch => !imageLinks.find(rel => rel.value === branch.noteId));
        }

        // we're not checking hideArchivedNotes since that would mean we need to lazy load the child notes
        // which would seriously slow down everything.
        // we check this flag only once user chooses to expand the parent. This has the negative consequence that
        // note may appear as folder but not contain any children when all of them are archived

        return childBranches;
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {FAttribute[]} all note's relations (attributes with type relation), including inherited ones
     */
    getOwnedRelations(name) {
        return this.getOwnedAttributes(RELATION, name);
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {FAttribute[]} all note's relations (attributes with type relation), including inherited ones
     */
    getRelations(name) {
        return this.getAttributes(RELATION, name);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {boolean} true if note has an attribute with given type and name (including inherited)
     */
    hasAttribute(type, name) {
        const attributes = this.getAttributes();

        return attributes.some(attr => attr.name === name && attr.type === type);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {boolean} true if note has an attribute with given type and name (including inherited)
     */
    hasOwnedAttribute(type, name) {
        return !!this.getOwnedAttribute(type, name);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {FAttribute} attribute of given type and name. If there's more such attributes, first is  returned. Returns null if there's no such attribute belonging to this note.
     */
    getOwnedAttribute(type, name) {
        const attributes = this.getOwnedAttributes();

        return attributes.find(attr => attr.name === name && attr.type === type);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {FAttribute} attribute of given type and name. If there's more such attributes, first is  returned. Returns null if there's no such attribute belonging to this note.
     */
    getAttribute(type, name) {
        const attributes = this.getAttributes();

        return attributes.find(attr => attr.name === name && attr.type === type);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {string} attribute value of given type and name or null if no such attribute exists.
     */
    getOwnedAttributeValue(type, name) {
        const attr = this.getOwnedAttribute(type, name);

        return attr ? attr.value : null;
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {string} attribute value of given type and name or null if no such attribute exists.
     */
    getAttributeValue(type, name) {
        const attr = this.getAttribute(type, name);

        return attr ? attr.value : null;
    }

    /**
     * @param {string} name - label name
     * @returns {boolean} true if label exists (excluding inherited)
     */
    hasOwnedLabel(name) { return this.hasOwnedAttribute(LABEL, name); }

    /**
     * @param {string} name - label name
     * @returns {boolean} true if label exists (including inherited)
     */
    hasLabel(name) { return this.hasAttribute(LABEL, name); }

    /**
     * @param {string} name - label name
     * @returns {boolean} true if label exists (including inherited) and does not have "false" value.
     */
    isLabelTruthy(name) {
        const label = this.getLabel(name);

        if (!label) {
            return false;
        }

        return label && label.value !== 'false';
    }

    /**
     * @param {string} name - relation name
     * @returns {boolean} true if relation exists (excluding inherited)
     */
    hasOwnedRelation(name) { return this.hasOwnedAttribute(RELATION, name); }

    /**
     * @param {string} name - relation name
     * @returns {boolean} true if relation exists (including inherited)
     */
    hasRelation(name) { return this.hasAttribute(RELATION, name); }

    /**
     * @param {string} name - label name
     * @returns {FAttribute} label if it exists, null otherwise
     */
    getOwnedLabel(name) { return this.getOwnedAttribute(LABEL, name); }

    /**
     * @param {string} name - label name
     * @returns {FAttribute} label if it exists, null otherwise
     */
    getLabel(name) { return this.getAttribute(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {FAttribute} relation if it exists, null otherwise
     */
    getOwnedRelation(name) { return this.getOwnedAttribute(RELATION, name); }

    /**
     * @param {string} name - relation name
     * @returns {FAttribute} relation if it exists, null otherwise
     */
    getRelation(name) { return this.getAttribute(RELATION, name); }

    /**
     * @param {string} name - label name
     * @returns {string} label value if label exists, null otherwise
     */
    getOwnedLabelValue(name) { return this.getOwnedAttributeValue(LABEL, name); }

    /**
     * @param {string} name - label name
     * @returns {string} label value if label exists, null otherwise
     */
    getLabelValue(name) { return this.getAttributeValue(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {string} relation value if relation exists, null otherwise
     */
    getOwnedRelationValue(name) { return this.getOwnedAttributeValue(RELATION, name); }

    /**
     * @param {string} name - relation name
     * @returns {string} relation value if relation exists, null otherwise
     */
    getRelationValue(name) { return this.getAttributeValue(RELATION, name); }

    /**
     * @param {string} name
     * @returns {Promise<FNote>|null} target note of the relation or null (if target is empty or note was not found)
     */
    async getRelationTarget(name) {
        const targets = await this.getRelationTargets(name);

        return targets.length > 0 ? targets[0] : null;
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {Promise<FNote[]>}
     */
    async getRelationTargets(name) {
        const relations = this.getRelations(name);
        const targets = [];

        for (const relation of relations) {
            targets.push(await this.froca.getNote(relation.value));
        }

        return targets;
    }

    /**
     * @returns {FNote[]}
     */
    getNotesToInheritAttributesFrom() {
        const relations = [
            ...this.getRelations('template'),
            ...this.getRelations('inherit')
        ];

        return relations.map(rel => this.froca.notes[rel.value]);
    }

    getPromotedDefinitionAttributes() {
        if (this.hasLabel('hidePromotedAttributes')) {
            return [];
        }

        const promotedAttrs = this.getAttributes()
            .filter(attr => attr.isDefinition())
            .filter(attr => {
                const def = attr.getDefinition();

                return def && def.isPromoted;
            });

        // attrs are not resorted if position changes after initial load
        promotedAttrs.sort((a, b) => {
            if (a.noteId === b.noteId) {
                return a.position < b.position ? -1 : 1;
            } else {
                // inherited promoted attributes should stay grouped: https://github.com/zadam/trilium/issues/3761
                return a.noteId < b.noteId ? -1 : 1;
            }
        });

        return promotedAttrs;
    }

    hasAncestor(ancestorNoteId, followTemplates = false, visitedNoteIds = null) {
        if (this.noteId === ancestorNoteId) {
            return true;
        }

        if (!visitedNoteIds) {
            visitedNoteIds = new Set();
        } else if (visitedNoteIds.has(this.noteId)) {
            // to avoid infinite cycle when template is descendent of the instance
            return false;
        }

        visitedNoteIds.add(this.noteId);

        if (followTemplates) {
            for (const templateNote of this.getNotesToInheritAttributesFrom()) {
                if (templateNote.hasAncestor(ancestorNoteId, followTemplates, visitedNoteIds)) {
                    return true;
                }
            }
        }

        for (const parentNote of this.getParentNotes()) {
            if (parentNote.hasAncestor(ancestorNoteId, followTemplates, visitedNoteIds)) {
                return true;
            }
        }

        return false;
    }

    isInHiddenSubtree() {
        return this.noteId === '_hidden' || this.hasAncestor('_hidden');
    }

    /**
     * @deprecated NOOP
     */
    invalidateAttributeCache() {}

    /**
     * Get relations which target this note
     *
     * @returns {FAttribute[]}
     */
    getTargetRelations() {
        return this.targetRelations
            .map(attributeId => this.froca.attributes[attributeId]);
    }

    /**
     * Get relations which target this note
     *
     * @returns {FNote[]}
     */
    async getTargetRelationSourceNotes() {
        const targetRelations = this.getTargetRelations();

        return await this.froca.getNotes(targetRelations.map(tr => tr.noteId));
    }

    /**
     * Return note complement which is most importantly note's content
     *
     * @returns {Promise<FNoteComplement>}
     */
    async getNoteComplement() {
        return await this.froca.getNoteComplement(this.noteId);
    }

    toString() {
        return `Note(noteId=${this.noteId}, title=${this.title})`;
    }

    get dto() {
        const dto = Object.assign({}, this);
        delete dto.froca;

        return dto;
    }

    getCssClass() {
        const labels = this.getLabels('cssClass');
        return labels.map(l => l.value).join(' ');
    }

    getWorkspaceIconClass() {
        const labels = this.getLabels('workspaceIconClass');
        return labels.length > 0 ? labels[0].value : "";
    }

    getWorkspaceTabBackgroundColor() {
        const labels = this.getLabels('workspaceTabBackgroundColor');
        return labels.length > 0 ? labels[0].value : "";
    }

    /** @returns {boolean} true if this note is JavaScript (code or file) */
    isJavaScript() {
        return (this.type === "code" || this.type === "file" || this.type === 'launcher')
            && (this.mime.startsWith("application/javascript")
                || this.mime === "application/x-javascript"
                || this.mime === "text/javascript");
    }

    /** @returns {boolean} true if this note is HTML */
    isHtml() {
        return (this.type === "code" || this.type === "file" || this.type === "render") && this.mime === "text/html";
    }

    /** @returns {string|null} JS script environment - either "frontend" or "backend" */
    getScriptEnv() {
        if (this.isHtml() || (this.isJavaScript() && this.mime.endsWith('env=frontend'))) {
            return "frontend";
        }

        if (this.type === 'render') {
            return "frontend";
        }

        if (this.isJavaScript() && this.mime.endsWith('env=backend')) {
            return "backend";
        }

        return null;
    }

    async executeScript() {
        if (!this.isJavaScript()) {
            throw new Error(`Note ${this.noteId} is of type ${this.type} and mime ${this.mime} and thus cannot be executed`);
        }

        const env = this.getScriptEnv();

        if (env === "frontend") {
            const bundleService = (await import("../services/bundle.js")).default;
            return await bundleService.getAndExecuteBundle(this.noteId);
        }
        else if (env === "backend") {
            const resp = await server.post(`script/run/${this.noteId}`);
        }
        else {
            throw new Error(`Unrecognized env type ${env} for note ${this.noteId}`);
        }
    }

    isShared() {
        for (const parentNoteId of this.parents) {
            if (parentNoteId === 'root' || parentNoteId === 'none') {
                continue;
            }

            const parentNote = froca.notes[parentNoteId];

            if (!parentNote || parentNote.type === 'search') {
                continue;
            }

            if (parentNote.noteId === '_share' || parentNote.isShared()) {
                return true;
            }
        }

        return false;
    }

    isContentAvailable() {
        return !this.isProtected || protectedSessionHolder.isProtectedSessionAvailable()
    }

    isLaunchBarConfig() {
        return this.type === 'launcher' || ['_lbRoot', '_lbAvailableLaunchers', '_lbVisibleLaunchers'].includes(this.noteId);
    }

    isOptions() {
        return this.noteId.startsWith("_options");
    }
}

export default FNote;
