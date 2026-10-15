import "./RecordMeetingButton.css";

import {
    dayjs, MEETING_RECORDING_LABEL, TRANSCRIPTION_MODEL_RESOURCE_ID, type TranscriptionState,
    type TranscriptionStatus
} from "@triliumnext/commons";
import { useCallback, useEffect, useState } from "preact/hooks";

import dateNoteService from "../../services/date_notes";
import { requireResources } from "../../services/dialog";
import { t } from "../../services/i18n";
import noteCreateService from "../../services/note_create";
import toast from "../../services/toast";
import {
    LaunchBarActionButton,
    LauncherNoteProps,
    useLauncherIconAndTitle
} from "./launch_bar_widgets";

/**
 * Launcher button that records a meeting: the first click creates the meeting note and starts the
 * recording, the second stops it. Desktop only, since the main process does the recording.
 */
export default function RecordMeetingButton({ launcherNote }: LauncherNoteProps) {
    const { icon, title } = useLauncherIconAndTitle(launcherNote);
    const { status, error } = useTranscriptionState();
    const handleClick = useCallback(() => {
        void toggleRecording(status);
    }, [ status ]);

    useEffect(() => {
        if (error) {
            toast.showError(error);
        }
    }, [ error ]);

    return (
        <LaunchBarActionButton
            launcherNote={launcherNote}
            onClick={handleClick}
            {...getAppearance(status, icon, title)}
        />
    );
}

const BUSY_ICON = "bx bx-loader-alt bx-spin";

function getAppearance(status: TranscriptionStatus, idleIcon: string, idleTitle: string) {
    switch (status) {
        case "idle":
            return { icon: idleIcon, text: idleTitle };
        case "starting":
            return { icon: BUSY_ICON, text: t("record_meeting.starting"), disabled: true };
        case "recording":
            return {
                icon: "bx bx-stop-circle",
                text: t("record_meeting.stop"),
                className: "record-meeting-active"
            };
        case "stopping":
            return { icon: BUSY_ICON, text: t("record_meeting.stopping"), disabled: true };
    }
}

/** Follows the main process's recording, which every window shares. */
export function useTranscriptionState() {
    const [ state, setState ] = useState<TranscriptionState>({
        status: "idle", noteId: null, pendingSources: []
    });

    useEffect(() => {
        const api = window.electronApi?.transcription;
        if (!api) {
            return;
        }

        let mounted = true;
        void api.getState().then((current) => {
            if (mounted) {
                setState(current);
            }
        });
        const unsubscribe = api.onStateChanged(setState);
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    return state;
}

/** Starts a recording into a new meeting note when idle, stops the running one when recording. */
export async function toggleRecording(status: TranscriptionStatus) {
    const api = window.electronApi?.transcription;
    if (!api) {
        return;
    }

    if (status === "recording") {
        await api.stop();
        return;
    }
    if (status !== "idle") {
        return;
    }
    if (!await requireResources([ TRANSCRIPTION_MODEL_RESOURCE_ID ])) {
        return;
    }

    const note = (await createMeetingNote())?.note;
    if (!note) {
        return;
    }
    const error = await api.start(note.noteId);
    if (error) {
        toast.showError(error);
    }
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
