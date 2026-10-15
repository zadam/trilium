import { t } from "../../../services/i18n.js";
import Icon from "../../react/Icon.jsx";
import AbstractBulkAction from "../abstract_bulk_action.js";
import BulkAction from "../BulkAction.jsx";

function DeleteRevisionsBulkActionComponent({ bulkAction }: { bulkAction: AbstractBulkAction }) {
    return (
        <BulkAction
            bulkAction={bulkAction}
            label={<><Icon icon="bx bx-trash" /> {t("delete_revisions.delete_note_revisions")}</>}
            helpText={t("delete_revisions.all_past_note_revisions")}
        />
    )
}


export default class DeleteRevisionsBulkAction extends AbstractBulkAction {
    static get actionName() {
        return "deleteRevisions";
    }
    static get actionTitle() {
        return t("delete_revisions.delete_note_revisions");
    }
    static get actionIcon() {
        return "bx bx-history bulk-action-marker-delete destructive-action-icon";
    }

    doRender() {
        return <DeleteRevisionsBulkActionComponent bulkAction={this} />
    }
}
