import "./CollabPeopleBadge.css";

import {
    COLLAB_PERSON_COLOR_NAMES, COLLAB_PERSON_COLORS, type Collaboration, type CollabPerson
} from "@triliumnext/commons";

import dialog from "../../services/dialog";
import { t } from "../../services/i18n";
import { BadgeWithDropdown } from "../react/Badge";
import { FormDropdownDivider, FormDropdownSubmenu, FormListItem } from "../react/FormList";
import { useNoteContext, useNoteTitle, useTriliumOption } from "../react/hooks";
import {
    recolorCollabPerson, removeCollabPerson, renameCollabPerson, useCollaborationsInScope,
    useCollabPresences
} from "./collaboration";

/**
 * The people on the pages of the collaborations that show the note, while a guest is among them.
 * Each person's submenu renames them, and removes a guest, which signs them out and closes their
 * pages without keeping them from coming back. Hidden while a sync server serves the
 * collaborations, whose guests never reach this instance.
 */
export default function CollabPeopleBadge() {
    const { note } = useNoteContext();
    const collaborations = useCollaborationsInScope(note);
    const presences = useCollabPresences(collaborations.map((collab) => collab.collabId));
    const [ syncServerHost ] = useTriliumOption("syncServerHost");
    const entries = collaborations.flatMap((collab) =>
        (presences.get(collab.collabId)?.people ?? []).map((person) => ({ collab, person })));

    if (syncServerHost || !entries.some(({ person }) => !person.isHost)) {
        return null;
    }

    return (
        <BadgeWithDropdown
            icon="bx bx-user"
            text={String(entries.length)}
            tooltip={t("collab_people.tooltip")}
            className="collab-people-badge"
        >
            {entries.map(({ collab, person }) => (
                <PersonSubmenu key={`${collab.collabId}:${person.id}`} collab={collab} person={person} />
            ))}
        </BadgeWithDropdown>
    );
}

function PersonSubmenu({ collab, person }: { collab: Collaboration; person: CollabPerson }) {
    const noteTitle = useNoteTitle(person.noteId ?? undefined, undefined);

    return (
        <FormDropdownSubmenu
            icon={person.editing ? "bx bx-pencil" : "bx bx-show"}
            className="collab-people-person"
            title={(
                <span className="collab-people-name" style={`--collab-color: ${person.color}`}>
                    <span className="collab-people-initial">{[ ...person.name ][0]?.toUpperCase()}</span>
                    <span className="collab-people-text">
                        <span className="collab-people-line">
                            <span className="collab-people-label">{person.name}</span>
                            {person.isHost && (
                                <span className="collab-people-host">{t("collab_people.host")}</span>
                            )}
                        </span>
                        {noteTitle && <span className="collab-people-note">{noteTitle}</span>}
                    </span>
                </span>
            )}
        >
            <FormListItem icon="bx bx-rename" onClick={() => void rename(collab, person)}>
                {t("collab_people.rename")}
            </FormListItem>
            <FormDropdownSubmenu icon="bx bx-palette" title={t("collab_people.color")}>
                <FormListItem
                    icon="bx bx-reset"
                    onClick={() => void recolorCollabPerson(collab.collabId, person.id, null)}
                >{t("collab_people.default_color")}</FormListItem>
                <FormDropdownDivider />
                {COLLAB_PERSON_COLORS.map((color, index) => (
                    <FormListItem
                        key={color}
                        checkable
                        checked={color === person.color}
                        onClick={() => void recolorCollabPerson(collab.collabId, person.id, color)}
                    >
                        <span className="collab-people-swatch" style={`--collab-color: ${color}`} />
                        {t(`collab_people.colors.${COLLAB_PERSON_COLOR_NAMES[index]}`)}
                    </FormListItem>
                ))}
            </FormDropdownSubmenu>
            {!person.isHost && (
                <FormListItem icon="bx bx-user-x" onClick={() => void remove(collab, person)}>
                    {t("collab_people.remove")}
                </FormListItem>
            )}
        </FormDropdownSubmenu>
    );
}

async function rename(collab: Collaboration, person: CollabPerson) {
    const name = await dialog.prompt({
        title: t("collab_people.rename_title"),
        message: t("collab_people.rename_message"),
        defaultValue: person.name
    });

    if (name !== null) {
        await renameCollabPerson(collab.collabId, person.id, name);
    }
}

async function remove(collab: Collaboration, person: CollabPerson) {
    // The dialog shows its message as HTML; `t()` escapes the name a guest chose.
    if (await dialog.confirm(t("collab_people.remove_confirm", { name: person.name }))) {
        await removeCollabPerson(collab.collabId, person.id);
    }
}
