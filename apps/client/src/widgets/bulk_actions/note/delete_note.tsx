import { t } from "../../../services/i18n.js";
import AbstractBulkAction from "../abstract_bulk_action.js";
import BulkAction from "../BulkAction.jsx";
import Icon from "../../react/Icon.jsx";

function DeleteNoteBulkActionComponent({ bulkAction }: { bulkAction: AbstractBulkAction }) {
    return (
        <BulkAction
            bulkAction={bulkAction}
            label={<><Icon icon="bx bx-trash" /> {t("delete_note.delete_matched_notes")}</>}
        />
    );
}

export default class DeleteNoteBulkAction extends AbstractBulkAction {
    static get actionName() {
        return "deleteNote";
    }
    static get actionTitle() {
        return t("delete_note.delete_note");
    }
    static get actionIcon() {
        return "bx bx-note bulk-action-marker-delete destructive-action-icon";
    }
    static get actionDescription() {
        return t("delete_note.description");
    }

    doRender() {
        return <DeleteNoteBulkActionComponent bulkAction={this} />
    }
}
