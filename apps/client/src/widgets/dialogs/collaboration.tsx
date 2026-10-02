import "./collaboration.css";

import {
    type Collaboration, type CollaborationCreateMode, type CollaborationEditMode,
    type CollaborationViewMode, DEFAULT_COLLABORATION_MAX_GUESTS, MAX_COLLAB_NAME_LENGTH,
    MAX_COLLABORATION_MAX_GUESTS
} from "@triliumnext/commons";
import { useEffect, useState } from "preact/hooks";

import type FNote from "../../entities/fnote.js";
import { copyTextWithToast } from "../../services/clipboard_ext.js";
import dialog from "../../services/dialog.js";
import froca from "../../services/froca.js";
import { t } from "../../services/i18n.js";
import { goToLinkExt } from "../../services/link.js";
import { buildCollabLink } from "../../services/share_link.js";
import toast from "../../services/toast.js";
import {
    type CollaborationSettingsPayload, createCollaboration, fetchCollaboration, stopCollaboration,
    updateCollaboration, useCollabPresence
} from "../collab/collaboration.js";
import Alert from "../react/Alert.jsx";
import Button from "../react/Button.jsx";
import FormCheckbox from "../react/FormCheckbox.jsx";
import FormGroup from "../react/FormGroup.js";
import FormPasswordWithConfirmation from "../react/FormPasswordWithConfirmation.jsx";
import FormRadioGroup from "../react/FormRadioGroup.jsx";
import FormTextBox from "../react/FormTextBox.jsx";
import FormToggle from "../react/FormToggle.jsx";
import { useTriliumEvent, useTriliumOption } from "../react/hooks.jsx";
import Modal from "../react/Modal.jsx";

/**
 * A capability's new password as the form holds it: `""` when the host left it alone (kept, or
 * none), `null` while the two fields disagree, otherwise the password to store.
 */
type PasswordDraft = string | null;

export default function CollaborationDialog() {
    const [ shown, setShown ] = useState(false);
    const [ note, setNote ] = useState<FNote | null>(null);
    const [ existing, setExisting ] = useState<Collaboration | null>(null);
    const [ includeSubtree, setIncludeSubtree ] = useState(false);
    const [ viewMode, setViewMode ] = useState<CollaborationViewMode>("open");
    const [ editMode, setEditMode ] = useState<CollaborationEditMode>("none");
    const [ createMode, setCreateMode ] = useState<CollaborationCreateMode>("none");
    const [ slug, setSlug ] = useState("");
    const [ maxGuests, setMaxGuests ] = useState(String(DEFAULT_COLLABORATION_MAX_GUESTS));
    const [ hostName, setHostName ] = useState("");
    const [ viewPassword, setViewPassword ] = useState<PasswordDraft>("");
    const [ editPassword, setEditPassword ] = useState<PasswordDraft>("");
    const [ createPassword, setCreatePassword ] = useState<PasswordDraft>("");
    const [ separateEditPassword, setSeparateEditPassword ] = useState(false);
    const [ separateCreatePassword, setSeparateCreatePassword ] = useState(false);
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ syncServerHost ] = useTriliumOption("syncServerHost");
    const presence = useCollabPresence(existing?.collabId);

    useTriliumEvent("openCollaborationDialog", async ({ noteId }) => {
        const openedNote = await froca.getNote(noteId);

        if (!openedNote) {
            return;
        }

        const current = await fetchCollaboration(noteId);

        setNote(openedNote);
        setExisting(current);
        setIncludeSubtree(current?.includeSubtree ?? false);
        setViewMode(current?.viewMode ?? "open");
        setEditMode(current?.editMode ?? "none");
        setCreateMode(current?.createMode ?? "none");
        setSlug(current?.slug ?? "");
        setMaxGuests(String(current?.maxGuests ?? DEFAULT_COLLABORATION_MAX_GUESTS));
        setHostName(current?.hostName ?? "");
        setViewPassword("");
        setEditPassword("");
        setCreatePassword("");
        setSeparateEditPassword(false);
        setSeparateCreatePassword(false);
        setError(null);
        setShown(true);
    });

    // Adding child notes needs the subtree and editing; editing open to anyone needs viewing open too.
    const canCreate = includeSubtree && editMode !== "none";
    useEffect(() => {
        if (!canCreate) {
            setCreateMode("none");
        }
    }, [ canCreate ]);
    useEffect(() => {
        if (viewMode === "password" && editMode === "open") {
            setEditMode("password");
        }
    }, [ viewMode ]);

    const link = existing ? buildCollabLink(existing.slug ?? existing.collabId, syncServerHost) : null;
    // One password opens viewing and editing unless the host asks for a separate one, and the
    // password for adding notes follows the editing one the same way.
    const sharedPassword = viewMode === "password" && editMode === "password" && !separateEditPassword;
    const createMirrorsEdit = createMode === "password" && editMode === "password"
        && !separateCreatePassword;
    const editDraft = sharedPassword ? viewPassword : editPassword;
    const createDraft = createMirrorsEdit ? editDraft : createPassword;
    const viewCovers: Capability[] = [ "view" ];
    const editCovers: Capability[] = [ "edit" ];
    if (createMirrorsEdit) {
        editCovers.push("create");
    }
    if (sharedPassword) {
        viewCovers.push(...editCovers);
    }
    const missingPassword =
        needsNewPassword(viewMode, viewPassword, existing?.viewMode)
        || needsNewPassword(editMode, editDraft, existing?.editMode)
        || needsNewPassword(createMode, createDraft, existing?.createMode);
    // A field that is not on the form cannot be half-typed, whatever it last reported.
    const halfTyped = (viewMode === "password" && viewPassword === null)
        || (editMode === "password" && editDraft === null)
        || (createMode === "password" && createDraft === null);
    const guestLimit = parseGuestLimit(maxGuests);
    const canSave = !saving && !halfTyped && !missingPassword && guestLimit !== null;

    async function onSubmit() {
        if (!note || !canSave || guestLimit === null) {
            return;
        }

        const settings: CollaborationSettingsPayload = {
            includeSubtree,
            viewMode,
            editMode,
            createMode,
            slug: slug.trim() || null,
            maxGuests: guestLimit,
            hostName: hostName.trim(),
            viewPassword: viewMode === "password" ? viewPassword || undefined : undefined,
            editPassword: editMode === "password" ? editDraft || undefined : undefined,
            createPassword: createMode === "password" ? createDraft || undefined : undefined
        };

        setSaving(true);
        setError(null);

        try {
            const saved = existing
                ? await updateCollaboration(existing.collabId, settings)
                : await createCollaboration(note.noteId, settings);
            setExisting(saved);
            setViewPassword("");
            setEditPassword("");
            setCreatePassword("");
            toast.showMessage(t("collaboration.saved"));
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    async function onStop() {
        if (!existing || !(await dialog.confirm(t("collaboration.stop_confirm")))) {
            return;
        }

        await stopCollaboration(existing.collabId);
        toast.showMessage(t("collaboration.stopped"));
        setShown(false);
    }

    return (
        <Modal
            className="collaboration-dialog"
            title={t("collaboration.title", { title: note?.title ?? "" })}
            size="lg"
            show={shown}
            onHidden={() => setShown(false)}
            onSubmit={onSubmit}
            helpPageId="collaboration"
            footerAlignment="between"
            footer={<>
                {existing && <Button
                    className="collaboration-stop"
                    text={t("collaboration.stop")}
                    icon="bx bx-stop-circle"
                    onClick={onStop}
                />}
                <Button text={t("collaboration.close")} onClick={() => setShown(false)} />
                <Button
                    className="collaboration-save"
                    text={existing ? t("collaboration.save") : t("collaboration.start")}
                    kind="primary"
                    disabled={!canSave}
                    disabledTooltip={missingPassword ? t("collaboration.password_required") : undefined}
                />
            </>}
        >
            <p className="collaboration-intro">{t("collaboration.intro")}</p>

            {link && (
                <div className="collaboration-link">
                    <FormGroup name="collaboration-link" label={t("collaboration.link")}>
                        <FormTextBox currentValue={link} readOnly />
                    </FormGroup>
                    <Button icon="bx bx-copy" text={t("collaboration.copy_link")} onClick={() => copyTextWithToast(link)} />
                    <Button icon="bx bx-link-external" text={t("collaboration.open_link")} onClick={(e) => goToLinkExt(e, link)} />
                    {presence && (
                        <div className="collaboration-presence">
                            {t("collaboration.presence", { count: presence.guests })}
                        </div>
                    )}
                </div>
            )}

            <FormGroup name="include-subtree" description={t("collaboration.include_subtree_hint")}>
                <FormToggle
                    currentValue={includeSubtree}
                    onChange={setIncludeSubtree}
                    switchOnName={t("collaboration.include_subtree")}
                    switchOffName={t("collaboration.include_subtree")}
                />
            </FormGroup>

            <FormGroup name="view-mode" label={t("collaboration.view")} className="collaboration-capability">
                <FormRadioGroup
                    name="viewMode"
                    currentValue={viewMode}
                    values={[
                        { value: "open", label: t("collaboration.anyone_with_link") },
                        { value: "password", label: t("collaboration.with_password") }
                    ]}
                    onChange={(value) => setViewMode(value as CollaborationViewMode)}
                />
            </FormGroup>
            {viewMode === "password" && (
                <FormPasswordWithConfirmation
                    revealable
                    label={passwordLabel(viewCovers)}
                    optional={hadPassword(existing, viewCovers)}
                    onChange={setViewPassword}
                />
            )}

            <FormGroup name="edit-mode" label={t("collaboration.edit")} className="collaboration-capability">
                <FormRadioGroup
                    name="editMode"
                    currentValue={editMode}
                    values={[
                        { value: "none", label: t("collaboration.off") },
                        viewMode === "open" && { value: "open", label: t("collaboration.anyone_with_link") },
                        { value: "password", label: t("collaboration.with_password") }
                    ]}
                    onChange={(value) => setEditMode(value as CollaborationEditMode)}
                />
            </FormGroup>
            {editMode === "open" && <Alert type="warning">{t("collaboration.open_edit_warning")}</Alert>}
            {editMode === "password" && viewMode === "password" && (
                <FormCheckbox
                    name="separate-edit-password"
                    label={t("collaboration.separate_edit_password")}
                    hint={t("collaboration.separate_edit_password_hint")}
                    currentValue={separateEditPassword}
                    onChange={setSeparateEditPassword}
                />
            )}
            {editMode === "password" && !sharedPassword && (
                <FormPasswordWithConfirmation
                    revealable
                    label={passwordLabel(editCovers)}
                    optional={hadPassword(existing, editCovers)}
                    onChange={setEditPassword}
                />
            )}

            <FormGroup
                name="create-mode"
                label={t("collaboration.add_child_notes")}
                className="collaboration-capability"
                description={canCreate ? undefined : t("collaboration.add_child_notes_hint")}
            >
                {canCreate
                    ? <FormRadioGroup
                        name="createMode"
                        currentValue={createMode}
                        values={[
                            { value: "none", label: t("collaboration.off") },
                            { value: "password", label: t("collaboration.with_password") }
                        ]}
                        onChange={(value) => setCreateMode(value as CollaborationCreateMode)}
                    />
                    : <span className="collaboration-create-unavailable" />}
            </FormGroup>
            {createMode === "password" && editMode === "password" && (
                <FormCheckbox
                    name="separate-create-password"
                    label={t("collaboration.separate_create_password")}
                    hint={t("collaboration.separate_create_password_hint")}
                    currentValue={separateCreatePassword}
                    onChange={setSeparateCreatePassword}
                />
            )}
            {createMode === "password" && !createMirrorsEdit && (
                <FormPasswordWithConfirmation
                    revealable
                    label={passwordLabel([ "create" ])}
                    optional={hadPassword(existing, [ "create" ])}
                    onChange={setCreatePassword}
                />
            )}

            <FormGroup
                name="max-guests"
                label={t("collaboration.max_guests")}
                description={t("collaboration.max_guests_hint", { max: MAX_COLLABORATION_MAX_GUESTS })}
                error={guestLimit === null ? t("collaboration.max_guests_invalid") : undefined}
            >
                <FormTextBox
                    type="number"
                    min={1}
                    max={MAX_COLLABORATION_MAX_GUESTS}
                    step={1}
                    currentValue={maxGuests}
                    onChange={setMaxGuests}
                />
            </FormGroup>

            <FormGroup name="slug" label={t("collaboration.slug")} description={t("collaboration.slug_hint")}>
                <FormTextBox currentValue={slug} onChange={setSlug} placeholder={existing?.collabId} />
            </FormGroup>

            <FormGroup
                name="host-name"
                label={t("collaboration.host_name")}
                description={t("collaboration.host_name_hint")}
            >
                <FormTextBox
                    currentValue={hostName}
                    onChange={setHostName}
                    maxLength={MAX_COLLAB_NAME_LENGTH}
                    placeholder={t("collaboration.host_name_placeholder")}
                />
            </FormGroup>

            {error && <Alert type="danger">{error}</Alert>}
        </Modal>
    );
}

/** The guest limit the field holds, or null when it is not a whole number in range. */
export function parseGuestLimit(value: string): number | null {
    const parsed = Number(value.trim());

    return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_COLLABORATION_MAX_GUESTS
        ? parsed
        : null;
}

type Capability = "view" | "edit" | "create";

/** The label of a password field, naming every capability its password opens. */
function passwordLabel(covers: Capability[]) {
    switch (covers.join("_")) {
        case "view":
            return t("collaboration.password_for_view");
        case "view_edit":
            return t("collaboration.password_for_view_edit");
        case "view_edit_create":
            return t("collaboration.password_for_view_edit_create");
        case "edit":
            return t("collaboration.password_for_edit");
        case "edit_create":
            return t("collaboration.password_for_edit_create");
        default:
            return t("collaboration.password_for_create");
    }
}

/** Whether every capability a field covers already has a password, so an empty field keeps them. */
function hadPassword(existing: Collaboration | null, covers: Capability[]) {
    return !!existing && covers.every((capability) => existing[`${capability}Mode`] === "password");
}

/** A capability switched to a password needs one typed, unless it already had one. */
function needsNewPassword(mode: string, draft: PasswordDraft, existingMode: string | undefined) {
    return mode === "password" && existingMode !== "password" && !draft;
}
