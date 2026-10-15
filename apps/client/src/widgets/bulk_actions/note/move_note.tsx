import { t } from "../../../services/i18n.js";
import AbstractBulkAction from "../abstract_bulk_action.js";
import BulkAction from "../BulkAction.jsx";
import NoteAutocomplete from "../../react/NoteAutocomplete.jsx";
import { useEffect, useState } from "preact/hooks";
import { useSpacedUpdate } from "../../react/hooks.jsx";

function MoveNoteBulkActionComponent({ bulkAction }: { bulkAction: AbstractBulkAction }) {
    const [ targetParentNoteId, setTargetParentNoteId ] = useState<string>();
    const spacedUpdate = useSpacedUpdate(() => {
        return bulkAction.saveAction({ targetParentNoteId: targetParentNoteId })
    });
    useEffect(() => spacedUpdate.scheduleUpdate(), [ targetParentNoteId ]);

    return (
        <BulkAction
            bulkAction={bulkAction}
        >

            <NoteAutocomplete
                placeholder={t("move_note.target_parent_note")}
                noteId={targetParentNoteId} noteIdChanged={setTargetParentNoteId}
            />
        </BulkAction>
    )
}

export default class MoveNoteBulkAction extends AbstractBulkAction {
    static get actionName() {
        return "moveNote";
    }
    static get actionTitle() {
        return t("move_note.move_note");
    }
    static get actionIcon() {
        return "bx bx-note bulk-action-marker-move";
    }
    static get actionDescription() {
        return t("move_note.description");
    }

    doRender() {
        return <MoveNoteBulkActionComponent bulkAction={this} />
    }
}
