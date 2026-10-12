import "./CalendarProperties.css";

import { useCallback } from "preact/hooks";

import type FNote from "../../../entities/fnote";
import { t } from "../../../services/i18n";
import Modal from "../../react/Modal";
import TemplateSelectionCard from "../../react/TemplateSelectionCard";
import { offeredTemplateIds } from "../../react/TemplateDropdown";
import { type CalendarViewData, DEFAULT_EVENT_TEMPLATES } from "./api";

/** The calendar's settings that the collection properties bar does not hold. */
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
        <Modal
            className="calendar-properties-dialog"
            title={t("calendar_view.properties")}
            size="lg"
            scrollable
            show
            stackable
            onHidden={onClose}
        >
            <TemplateSelectionCard
                heading={t("calendar_view.event_templates")}
                instruction={t("calendar_view.event_templates_hint")}
                note={note}
                newTemplateName={t("calendar_view.new_template_name")}
                templates={offeredTemplateIds(viewConfig, DEFAULT_EVENT_TEMPLATES)}
                onChange={storeTemplates}
            />
        </Modal>
    );
}
