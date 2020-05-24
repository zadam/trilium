"use strict";

/**
 * Search string is lower cased for case insensitive comparison. But when retrieving properties
 * we need case sensitive form so we have this translation object.
 */
const PROP_MAPPING = {
    "noteid": "noteId",
    "title": "title",
    "type": "type",
    "mime": "mime",
    "isprotected": "isProtected",
    "isarhived": "isArchived",
    "datecreated": "dateCreated",
    "datemodified": "dateModified",
    "utcdatecreated": "utcDateCreated",
    "utcdatemodified": "utcDateModified",
    "contentlength": "contentLength",
    "parentcount": "parentCount",
    "childrencount": "childrenCount",
    "attributecount": "attributeCount",
    "labelcount": "labelCount",
    "relationcount": "relationCount"
};

class ValueExtractor {
    constructor(propertyPath) {
        this.propertyPath = propertyPath.map(pathEl => pathEl.toLowerCase());

        if (this.propertyPath[0].startsWith('#')) {
            this.propertyPath = ['note', 'labels', this.propertyPath[0].substr(1), ...this.propertyPath.slice( 1, this.propertyPath.length)];
        }
        else if (this.propertyPath[0].startsWith('~')) {
            this.propertyPath = ['note', 'relations', this.propertyPath[0].substr(1), ...this.propertyPath.slice( 1, this.propertyPath.length)];
        }
    }

    validate() {
        if (this.propertyPath[0] !== 'note') {
            return `property specifier must start with 'note', but starts with '${this.propertyPath[0]}'`;
        }

        for (let i = 1; i < this.propertyPath.length; i++) {
            const pathEl = this.propertyPath[i];

            if (pathEl === 'labels') {
                if (i !== this.propertyPath.length - 2) {
                    return `label is a terminal property specifier and must be at the end`;
                }

                i++;
            }
            else if (pathEl === 'relations') {
                if (i >= this.propertyPath.length - 2) {
                    return `relation name or property name is missing`;
                }

                i++;
            }
            else if (pathEl in PROP_MAPPING) {
                if (i !== this.propertyPath.length - 1) {
                    return `${pathEl} is a terminal property specifier and must be at the end`;
                }
            }
            else if (!["parents", "children"].includes(pathEl)) {
                return `Unrecognized property specifier ${pathEl}`;
            }
        }
    }

    extract(note) {
        let cursor = note;

        let i;

        const cur = () => this.propertyPath[i];

        for (i = 0; i < this.propertyPath.length; i++) {
            if (!cursor) {
                return cursor;
            }

            if (cur() === 'labels') {
                i++;

                return cursor.getLabelValue(cur());
            }

            if (cur() === 'relations') {
                i++;

                cursor = cursor.getRelationTarget(cur());
            }
            else if (cur() === 'parents') {
                cursor = cursor.parents[0];
            }
            else if (cur() === 'children') {
                cursor = cursor.children[0];
            }
            else if (cur() in PROP_MAPPING) {
                return cursor[PROP_MAPPING[cur()]];
            }
            else {
                // FIXME
            }
        }
    }
}

module.exports = ValueExtractor;
