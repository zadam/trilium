import "./BulkAction.css";

import { ComponentChildren } from "preact";
import { memo } from "preact/compat";
import { t } from "../../services/i18n";
import AbstractBulkAction from "./abstract_bulk_action";
import HelpRemoveButtons from "../react/HelpRemoveButtons";
import Icon from "../react/Icon";

interface BulkActionProps {
    label: string | ComponentChildren;
    children?: ComponentChildren;
    bulkAction: AbstractBulkAction;
}

// Define styles as constants to prevent recreation
const flexContainerStyle = { display: "flex", alignItems: "center" } as const;
const labelStyle = { marginInlineEnd: "10px" } as const;
const textStyle = { marginInlineEnd: "10px", marginInlineStart: "10px" } as const;

const BulkAction = memo(({ label, children, bulkAction }: BulkActionProps) => {
    const { actionIcon } = bulkAction.constructor as typeof AbstractBulkAction;

    return (
        <tr>
            <td colSpan={2}>
                <div style={flexContainerStyle}>
                    <div style={labelStyle} className="text-nowrap">
                        {actionIcon && <Icon icon={actionIcon} className="bulk-action-icon" />}{" "}{label}
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

export const BulkActionText = memo(({ text }: { text: string }) => {
    return (
        <div
            style={textStyle}
            className="text-nowrap">
                {text}
            </div>
    );
});
