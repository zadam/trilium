import type { ComponentChildren } from "preact";
import { Fragment } from "preact/jsx-runtime";

import bulk_action, { ACTION_GROUPS } from "../../services/bulk_action";
import Dropdown from "../react/Dropdown";
import { FormListHeader, FormListItem } from "../react/FormList";

interface AddBulkActionButtonProps {
    /** The note the chosen action is stored on, as an `#action` label. */
    noteId: string;
    text: ComponentChildren;
    buttonClassName?: string;
}

/**
 * A menu of every bulk action, grouped as in {@link ACTION_GROUPS}, that adds the picked one to the
 * note's actions.
 */
export default function AddBulkActionButton({ noteId, text, buttonClassName }: AddBulkActionButtonProps) {
    return (
        <Dropdown
            buttonClassName={buttonClassName}
            dropdownContainerClassName="action-add-menu"
            text={text}
            noSelectButtonStyle
            mobileBottomSheet
        >
            {ACTION_GROUPS.map(({ actions, title }, index) => (
                <Fragment key={index}>
                    <FormListHeader text={title} />

                    <div>
                        {actions.map(({ actionName, actionTitle, actionIcon, actionDescription }) => (
                            <FormListItem
                                key={actionName}
                                icon={actionIcon}
                                title={actionDescription}
                                onClick={() => bulk_action.addAction(noteId, actionName)}
                            >{actionTitle}</FormListItem>
                        ))}
                    </div>
                </Fragment>
            ))}
        </Dropdown>
    );
}
