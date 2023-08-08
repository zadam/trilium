/**
 * The purpose of this class is to cache the list of attributes for notes.
 *
 * Cache invalidation granularity is global - whenever a write operation is detected to notes, branches or attributes,
 * we invalidate the whole cache. That's OK, since the purpose for this is to speed up batch read-only operations, such
 * as loading the tree which uses attributes heavily.
 */
class NoteAttributeCache {
    constructor() {
        /** @property {Object.<string, BAttribute[]>} */
        this.attributes = {};
    }

    invalidate() {
        this.attributes = {};
    }
}

const noteAttributeCache = new NoteAttributeCache();

export default noteAttributeCache;
