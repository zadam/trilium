import "./BulkAction.css";

import { ComponentChildren } from "preact";
import { memo } from "preact/compat";
import { t } from "../../services/i18n";
import AbstractBulkAction from "./abstract_bulk_action";
import HelpRemoveButtons from "../react/HelpRemoveButtons";
import Icon from "../react/Icon";

interface BulkActionProps {
    children?: ComponentChildren;
    bulkAction: AbstractBulkAction;
}

const BulkAction = memo(({ children, bulkAction }: BulkActionProps) => {
    const { actionIcon, actionTitle } = bulkAction.constructor as typeof AbstractBulkAction;

    return (
        <tr>
            <td colSpan={2}>
                <div className="bulk-action-row">
                    <div className="bulk-action-label">
                        {actionIcon && <Icon icon={actionIcon} className="bulk-action-icon" />}{" "}{actionTitle}
                    </div>

                    {children}
                </div>
            </td>
            <HelpRemoveButtons
                removeText={t("bulk_actions.remove_action")}
                onRemove={() => bulkAction?.deleteAction()}
            />
        </tr>
    );
});

export default BulkAction;

/** Separates a row's source field from its target field, in place of a word such as "to". */
export function BulkActionArrow() {
    return <Icon icon="bx bx-right-arrow-alt" className="bulk-action-arrow" />;
}
