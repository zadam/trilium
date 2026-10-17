import "./template_properties.css";

import { dayjs, evaluateTemplate } from "@triliumnext/commons";
import { useEffect, useState } from "preact/hooks";

import type FNote from "../../entities/fnote";
import attributes from "../../services/attributes";
import froca from "../../services/froca";
import { t } from "../../services/i18n";
import TemplateField, { noteTemplateVariables } from "../bulk_actions/TemplateField";
import { CollectionPropertiesDialog } from "../note_bars/CollectionProperties";
import { Card, OptionCardSection } from "../react/Card";
import { useTriliumEvent } from "../react/hooks";

/** What the server's `getNewNoteTitle()` passes to `evaluateTemplate()` for a title template. */
const TITLE_TEMPLATE_VARIABLES = { now: "date", parentNote: "note" } as const;

/**
 * Edits what a template note sets on the notes created from it, starting with their title, as a
 * column of cards like a collection's properties. Each setting is saved as it is changed.
 */
export default function TemplatePropertiesDialog() {
    const [ note, setNote ] = useState<FNote>();
    const [ shown, setShown ] = useState(false);
    const [ titleTemplate, setTitleTemplate ] = useState("");
    const preview = useTitlePreview(titleTemplate, note);

    useTriliumEvent("showTemplateProperties", async ({ noteId }) => {
        const templateNote = await froca.getNote(noteId);
        if (!templateNote) return;
        setTitleTemplate(templateNote.getOwnedLabelValue("template:titleTemplate") ?? "");
        setNote(templateNote);
        setShown(true);
    });

    async function saveTitleTemplate() {
        if (!note) return;
        const value = titleTemplate;
        if (value === (note.getOwnedLabelValue("template:titleTemplate") ?? "")) return;
        if (value) {
            await attributes.setLabel(note.noteId, "template:titleTemplate", value);
        } else {
            await attributes.removeOwnedLabelByName(note, "template:titleTemplate");
        }
    }

    return (
        <CollectionPropertiesDialog
            className="template-properties-dialog"
            title={t("template_properties.title")}
            show={shown}
            onHidden={() => {
                void saveTitleTemplate();
                setShown(false);
            }}
        >
            {shown && note && (
                <Card heading={t("template_properties.new_notes")}>
                    <OptionCardSection
                        label={t("template_properties.title_template")}
                        description={t("template_properties.title_template_description")}
                    >
                        <TemplateField
                            key={note.noteId}
                            variables={TITLE_TEMPLATE_VARIABLES}
                            placeholder={t("template_properties.title_template_placeholder")}
                            ariaLabel={t("template_properties.title_template")}
                            preview={preview}
                            currentValue={titleTemplate}
                            onChange={setTitleTemplate}
                            onBlur={() => void saveTitleTemplate()}
                        />
                    </OptionCardSection>
                </Card>
            )}
        </CollectionPropertiesDialog>
    );
}

/**
 * The title a note created from `templateNote` would get from `template` now, or `undefined`
 * while it cannot be told. The template's own parent stands in for `parentNote`, since a template
 * has no parent of its own for the notes created from it.
 */
function useTitlePreview(template: string, templateNote: FNote | undefined) {
    const [ parentNote, setParentNote ] = useState<unknown>();

    useEffect(() => {
        let cancelled = false;
        setParentNote(undefined);
        const parent = templateNote?.getParentNotes()[0];
        if (!parent) return;

        // A preview that cannot be built is left out; the field works the same without it.
        parent.getMetadata()
            .then((metadata) => {
                if (!cancelled) setParentNote(noteTemplateVariables(parent, metadata).note);
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [ templateNote ]);

    if (!template || !parentNote) return undefined;
    try {
        return evaluateTemplate(template, { now: dayjs(), parentNote });
    } catch {
        return undefined;
    }
}
