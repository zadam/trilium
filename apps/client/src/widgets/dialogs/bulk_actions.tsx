import { useEffect, useState, useCallback, useRef } from "preact/hooks";
import { t } from "../../services/i18n";
import Modal from "../react/Modal";
import "./bulk_actions.css";
import { BulkActionAffectedNotes } from "@triliumnext/commons";
import server from "../../services/server";
import Button from "../react/Button";
import { Card, CardSection } from "../react/Card";
import NoItems from "../react/NoItems";
import { OptionsRowWithToggle } from "../type_widgets/options/components/OptionsRow";
import bulk_action from "../../services/bulk_action";
import AddBulkActionButton from "../bulk_actions/AddBulkActionButton";
import { TemplatePreviewNoteContext } from "../bulk_actions/TemplateField";
import Icon from "../react/Icon";
import dialog from "../../services/dialog";
import toast from "../../services/toast";
import AbstractBulkAction from "../bulk_actions/abstract_bulk_action";
import FNote from "../../entities/fnote";
import froca from "../../services/froca";
import { useTriliumEvent } from "../react/hooks";
import Chip from "../react/Chip";
import NoteLink from "../react/NoteLink";
import LinkButton from "../react/LinkButton";

const COLLAPSED_NOTE_CHIP_COUNT = 5;

export default function BulkActionsDialog() {
    const [ selectedOrActiveNoteIds, setSelectedOrActiveNoteIds ] = useState<string[]>();
    const [ bulkActionNote, setBulkActionNote ] = useState<FNote | null>();
    const [ includeDescendants, setIncludeDescendants ] = useState(false);
    const [ affectedNoteCount, setAffectedNoteCount ] = useState<number>();
    const [ existingActions, setExistingActions ] = useState<AbstractBulkAction[]>([]);
    const [ executing, setExecuting ] = useState(false);
    // Read by `onSubmit`, which a second submit reaches before the re-render that `executing` needs.
    const executingRef = useRef(false);
    const [ shown, setShown ] = useState(false);

    useTriliumEvent("openBulkActionsDialog", async ({ selectedOrActiveNoteIds }) => {
        setSelectedOrActiveNoteIds(selectedOrActiveNoteIds);
        setAffectedNoteCount(undefined);
        setBulkActionNote(await froca.getNote("_bulkAction"));
        setShown(true);
    });

    useEffect(() => {
        if (!selectedOrActiveNoteIds || !bulkActionNote) return;

        let stale = false;
        server.post<BulkActionAffectedNotes>("bulk-action/affected-notes", {
            noteIds: selectedOrActiveNoteIds,
            includeDescendants
        }).then(({ affectedNoteCount }) => {
            if (!stale) setAffectedNoteCount(affectedNoteCount);
        });
        return () => { stale = true; };
    }, [ selectedOrActiveNoteIds, includeDescendants, bulkActionNote ]);

    const refreshExistingActions = useCallback(() => {
        if (!bulkActionNote) return;
        setExistingActions(bulk_action.parseActions(bulkActionNote));
    }, [bulkActionNote]);
    
    useEffect(() => {
        refreshExistingActions();
    }, [refreshExistingActions]);
    
    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (loadResults.getAttributeRows().find((row) =>
            row.type === "label" && row.name === "action" && row.noteId === "_bulkAction")) {
                refreshExistingActions();
        }
    });

    const disabledReason = !existingActions.length
        ? t("bulk_actions.no_actions_to_execute")
        : affectedNoteCount === 0 ? t("bulk_actions.no_notes_to_execute_on") : undefined;
    const canExecute = !disabledReason && affectedNoteCount !== undefined && !executing;

    return (
        <Modal
            className="bulk-actions-dialog"
            size="xl"
            title={t("bulk_actions.bulk_actions")}
            footer={<>
                <Button text={t("modal.cancel")} onClick={() => setShown(false)} />
                <Button
                    name="execute-bulk-actions"
                    kind="primary"
                    // Until the server has counted, the selection is the best estimate: it is exact
                    // unless descendants are included.
                    text={t("bulk_actions.execute_bulk_actions", {
                        count: affectedNoteCount ?? selectedOrActiveNoteIds?.length ?? 0
                    })}
                    disabled={!canExecute}
                    disabledTooltip={disabledReason}
                />
            </>}
            show={shown}
            onSubmit={async () => {
                if (!canExecute || executingRef.current) return;
                executingRef.current = true;
                setExecuting(true);
                try {
                    // Let actions surface a confirmation prompt (e.g. lossy conversions) before executing.
                    const confirmMessages = existingActions
                        .map((action) => action.getConfirmationMessage())
                        .filter((message): message is string => !!message);
                    if (confirmMessages.length && !await dialog.confirm(confirmMessages.join("\n\n"))) {
                        return;
                    }

                    // Submit the in-memory action definitions rather than letting the server re-read the
                    // stored labels, so a still-in-flight action save can't make the batch run against a
                    // stale/empty choice.
                    const actions = existingActions.map((action) => ({
                        ...action.actionDef,
                        name: (action.constructor as typeof AbstractBulkAction).actionName
                    }));

                    await server.post("bulk-action/execute", {
                        noteIds: selectedOrActiveNoteIds,
                        includeDescendants,
                        actions
                    });

                    toast.showMessage(t("bulk_actions.bulk_actions_executed"), 3000);
                    setShown(false);
                } finally {
                    executingRef.current = false;
                    setExecuting(false);
                }
            }}
            onHidden={() => setShown(false)}
        >
            <Card heading={t("bulk_actions.selected_notes")}>
                {selectedOrActiveNoteIds && (
                    <CardSection>
                        <SelectedNotes noteIds={selectedOrActiveNoteIds} onChange={setSelectedOrActiveNoteIds} />
                    </CardSection>
                )}
                <CardSection>
                    <OptionsRowWithToggle
                        name="include-descendants"
                        label={t("bulk_actions.include_descendants")}
                        description={t("bulk_actions.affected_note_count", { count: affectedNoteCount ?? 0 })}
                        currentValue={includeDescendants} onChange={setIncludeDescendants}
                    />
                </CardSection>
            </Card>

            <Card className="bulk-actions-chosen-actions" heading={t("bulk_actions.chosen_actions")}>
                <TemplatePreviewNoteContext.Provider value={selectedOrActiveNoteIds?.[0]}>
                    <ExistingActionsList existingActions={existingActions} />
                </TemplatePreviewNoteContext.Provider>
                <CardSection className="bulk-actions-add-action">
                    <AddBulkActionButton
                        noteId="_bulkAction"
                        buttonClassName="btn-secondary btn-micro"
                        text={<><Icon icon="bx bx-plus" />{" "}{t("bulk_actions.add_action")}</>}
                    />
                </CardSection>
            </Card>
        </Modal>
    );
}

function SelectedNotes({ noteIds, onChange }: { noteIds: string[]; onChange(noteIds: string[]): void }) {
    const [ expanded, setExpanded ] = useState(false);
    const shownNoteIds = expanded ? noteIds : noteIds.slice(0, COLLAPSED_NOTE_CHIP_COUNT);
    const hiddenCount = noteIds.length - shownNoteIds.length;

    return (
        <div className="bulk-actions-selected-notes">
            {shownNoteIds.map((noteId) => (
                <Chip
                    key={noteId}
                    removeButtonText={t("bulk_actions.remove_from_selection")}
                    disabled={noteIds.length === 1}
                    onRemove={() => onChange(noteIds.filter((id) => id !== noteId))}
                >
                    <NoteLink notePath={noteId} showNoteIcon />
                </Chip>
            ))}
            {hiddenCount > 0 && (
                <LinkButton
                    className="bulk-actions-more-notes"
                    text={t("bulk_actions.more_notes", { count: hiddenCount })}
                    onClick={() => setExpanded(true)}
                />
            )}
        </div>
    );
}

function ExistingActionsList({ existingActions }: { existingActions: AbstractBulkAction[] }) {
    if (!existingActions.length) {
        return (
            <CardSection>
                <NoItems icon="bx bx-list-plus" text={t("bulk_actions.none_yet")} size="small" />
            </CardSection>
        );
    }

    return (
        <CardSection noPadding>
            <table class="bulk-existing-action-list">
                <tbody>
                    {existingActions.map((action) => action.doRender())}
                </tbody>
            </table>
        </CardSection>
    );
}
