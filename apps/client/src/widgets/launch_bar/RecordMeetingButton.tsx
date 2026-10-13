import { dayjs } from "@triliumnext/commons";
import { useCallback } from "preact/hooks";

import dateNoteService from "../../services/date_notes";
import { t } from "../../services/i18n";
import noteCreateService from "../../services/note_create";
import {
    LaunchBarActionButton,
    LauncherNoteProps,
    useLauncherIconAndTitle
} from "./launch_bar_widgets";

/** The label that identifies a note created by this launcher. */
export const MEETING_RECORDING_LABEL = "meetingRecording";

/**
 * Launcher button that starts a meeting recording. For now it only creates the meeting note in the
 * inbox and opens it.
 */
export default function RecordMeetingButton({ launcherNote }: LauncherNoteProps) {
    const { icon, title } = useLauncherIconAndTitle(launcherNote);
    const handleClick = useCallback(() => {
        void createMeetingNote();
    }, []);

    return (
        <LaunchBarActionButton
            launcherNote={launcherNote}
            icon={icon}
            text={title}
            onClick={handleClick}
        />
    );
}

/** Creates a text note titled with the current date and time in the inbox, and opens it. */
export async function createMeetingNote() {
    const inboxNote = await dateNoteService.getInboxNote();
    if (!inboxNote) {
        console.warn("Missing inbox note.");
        return;
    }

    return await noteCreateService.createNote(inboxNote.noteId, {
        title: t("record_meeting.note_title", { date: dayjs().format("YYYY-MM-DD HH:mm") }),
        type: "text",
        isProtected: inboxNote.isProtected,
        focus: "content",
        attributes: [ { type: "label", name: MEETING_RECORDING_LABEL, value: "" } ]
    });
}
