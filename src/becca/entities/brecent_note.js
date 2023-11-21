import dateUtils from '../../services/date_utils.js'
import AbstractBeccaEntity from './abstract_becca_entity.js'

/**
 * RecentNote represents recently visited note.
 *
 * @extends AbstractBeccaEntity
 */
class BRecentNote extends AbstractBeccaEntity {
    static get entityName() { return "recent_notes"; }
    static get primaryKeyName() { return "noteId"; }

    constructor(row) {
        super();

        /** @type {string} */
        this.noteId = row.noteId;
        /** @type {string} */
        this.notePath = row.notePath;
        /** @type {string} */
        this.utcDateCreated = row.utcDateCreated || dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            noteId: this.noteId,
            notePath: this.notePath,
            utcDateCreated: this.utcDateCreated
        }
    }
}

export default BRecentNote;
