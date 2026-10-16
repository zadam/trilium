import "./BulkAction.css";

import { ComponentChildren } from "preact";
import { memo } from "preact/compat";
import { useEffect, useRef } from "preact/hooks";
import { t } from "../../services/i18n";
import AbstractBulkAction, { ActionDefinition } from "./abstract_bulk_action";
import { useSpacedUpdate } from "../react/hooks";
import HelpRemoveButtons from "../react/HelpRemoveButtons";
import Icon from "../react/Icon";

interface BulkActionProps {
    children?: ComponentChildren;
    bulkAction: AbstractBulkAction;
}

const BulkAction = memo(({ children, bulkAction }: BulkActionProps) => {
    const { actionIcon, actionTitle, actionDescription } = bulkAction.constructor as typeof AbstractBulkAction;

    return (
        <tr>
            <td className="title-column">
                {actionIcon && <Icon icon={actionIcon} className="bulk-action-icon" />}{actionTitle}
            </td>
            <td className="bulk-action-fields-column">
                <div className="bulk-action-fields">
                    {children ?? <span className="bulk-action-description">{actionDescription}</span>}
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

/**
 * Saves `data` to `bulkAction` a second after it changes. The values a row opens with are already
 * stored, so the first render saves nothing.
 */
export function useSaveAction(bulkAction: AbstractBulkAction, data: Partial<ActionDefinition>) {
    const spacedUpdate = useSpacedUpdate(() => bulkAction.saveAction(data));
    const isFirstRender = useRef(true);
    const serialized = JSON.stringify(data);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        spacedUpdate.scheduleUpdate();
    }, [ serialized ]);
}

/** Separates a row's source field from its target field, in place of a word such as "to". */
export function BulkActionArrow() {
    return <Icon icon="bx bx-right-arrow-alt" className="bulk-action-arrow" />;
}
