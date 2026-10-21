import "./content_embed.css";

import { useCallback, useRef, useState } from "preact/hooks";
import { getEmbedBoxSize } from "../../services/content_renderer";
import { t } from "../../services/i18n";
import { Card, OptionCardSection } from "../react/Card";
import FormSelect from "../react/FormSelect";
import Modal from "../react/Modal";
import NoteAutocomplete, { type NoteAutocompleteHandle } from "../react/NoteAutocomplete";
import Button from "../react/Button";
import { Suggestion } from "../../services/note_autocomplete";
import tree from "../../services/tree";
import froca from "../../services/froca";
import { useNote, useTriliumEvent } from "../react/hooks";
import type { BoxSize, CKEditorApi } from "../type_widgets/text/CKEditor";

export interface ContentEmbedOpts {
    editorApi: Pick<CKEditorApi, "addContentEmbed" | "addImage">;
}

export default function ContentEmbedDialog() {
    const editorApiRef = useRef<Pick<CKEditorApi, "addContentEmbed" | "addImage">>(null);
    const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
    // The size chosen by hand, otherwise the one that suits the picked note.
    const [chosenBoxSize, setChosenBoxSize] = useState<BoxSize | null>(null);
    const [shown, setShown] = useState(false);
    const note = useNote(suggestion?.notePath ? tree.getNoteIdFromUrl(suggestion.notePath) : null);
    const boxSize = chosenBoxSize ?? (note ? getEmbedBoxSize(note) : "medium");

    useTriliumEvent("showContentEmbedDialog", ({ editorApi }) => {
        editorApiRef.current = editorApi;
        autocompleteRef.current?.clear();
        setSuggestion(null);
        setChosenBoxSize(null);
        setShown(true);
    });

    const changeSuggestion = useCallback((newSuggestion: Suggestion | null) => {
        setSuggestion(newSuggestion);
        setChosenBoxSize(null);
    }, []);

    const autocompleteRef = useRef<NoteAutocompleteHandle>(null);

    return (
        <Modal
            className="include-note-dialog"
            title={t("include_note.dialog_title")}
            size="lg"
            helpPageId="nBAXQFj20hS1"
            onShown={() => autocompleteRef.current?.showRecentNotes()}
            onHidden={() => setShown(false)}
            onSubmit={async () => {
                if (!suggestion?.notePath || !editorApiRef.current) return;
                setShown(false);
                await embedNote(suggestion.notePath, editorApiRef.current, boxSize);
            }}
            footer={<Button text={t("include_note.button_include")} keyboardShortcut="Enter" />}
            show={shown}
        >
            <Card>
                <OptionCardSection
                    className="include-note-note" name="note" label={t("include_note.label_note")}
                >
                    <NoteAutocomplete
                        onChange={changeSuggestion}
                        handleRef={autocompleteRef}
                        opts={{
                            hideGoToSelectedNoteButton: true,
                            allowCreatingNotes: true
                        }}
                    />
                </OptionCardSection>

                <OptionCardSection
                    className="include-note-size"
                    name="box-size"
                    label={t("include_note.box_size")}
                    description={t(`include_note.size_${boxSize}_description`)}
                >
                    <FormSelect
                        values={BOX_SIZES.map((size) => ({
                            value: size, title: t(`include_note.size_${size}`)
                        }))}
                        keyProperty="value"
                        titleProperty="title"
                        currentValue={boxSize}
                        onChange={(value) => setChosenBoxSize(value as BoxSize)}
                    />
                </OptionCardSection>
            </Card>
        </Modal>
    )
}

const BOX_SIZES: BoxSize[] = [ "tiny", "small", "medium", "full", "expandable" ];

async function embedNote(notePath: string, editorApi: Pick<CKEditorApi, "addContentEmbed" | "addImage">, boxSize: BoxSize) {
    const noteId = tree.getNoteIdFromUrl(notePath);
    if (!noteId) {
        return;
    }
    const note = await froca.getNote(noteId);

    if (["image", "canvas", "mermaid"].includes(note?.type ?? "")) {
        // there's no benefit to use insert note functionlity for images,
        // so we'll just add an IMG tag
        editorApi.addImage(noteId);
    } else {
        editorApi.addContentEmbed(noteId, boxSize);
    }
}
