import { useCallback } from "preact/hooks";

import type FNote from "../../../entities/fnote";
import { t } from "../../../services/i18n";
import {
    CollectionPropertiesDialog, INCLUDE_ARCHIVED_PROPERTY
} from "../../note_bars/CollectionProperties";
import { bookPropertiesConfig } from "../../note_bars/collection-properties-config";
import { Card } from "../../react/Card";
import { ViewPropertySection } from "../../react/NotePropertyMenu";
import TemplateSelectionCard from "../../react/TemplateSelectionCard";
import { offeredTemplateIds } from "../../react/TemplateDropdown";
import { type CalendarViewData, DEFAULT_EVENT_TEMPLATES } from "./api";

/**
 * The calendar's settings: those of the collection's settings dropdown, and the event templates,
 * which only this dialog holds.
 */
export default function CalendarProperties({ note, viewConfig, saveConfig, onClose }: {
    /** The calendar note, which is the parent of any template created here. */
    note: FNote;
    viewConfig: CalendarViewData | undefined;
    saveConfig: (config: CalendarViewData) => void;
    onClose: () => void;
}) {
    // An empty list would leave nothing to make an event from.
    const storeTemplates = useCallback((templates: string[]) => {
        if (templates.length) {
            saveConfig({ ...viewConfig, templates });
        }
    }, [ viewConfig, saveConfig ]);

    return (
        <CollectionPropertiesDialog
            className="calendar-properties-dialog"
            title={t("calendar_view.properties")}
            show
            stackable
            onHidden={onClose}
        >
            <Card className="calendar-properties-general" heading={t("calendar_view.general")}>
                {GENERAL_PROPERTIES.map((property, index) => (
                    <ViewPropertySection key={index} note={note} property={property} />
                ))}
            </Card>

            <TemplateSelectionCard
                heading={t("calendar_view.event_templates")}
                instruction={t("calendar_view.event_templates_hint")}
                note={note}
                newTemplateName={t("calendar_view.new_template_name")}
                templates={offeredTemplateIds(viewConfig, DEFAULT_EVENT_TEMPLATES)}
                onChange={storeTemplates}
            />
        </CollectionPropertiesDialog>
    );
}

/** What the settings dropdown offers for a calendar, which the General card repeats. */
const GENERAL_PROPERTIES = [
    ...bookPropertiesConfig.calendar.properties, INCLUDE_ARCHIVED_PROPERTY
];
