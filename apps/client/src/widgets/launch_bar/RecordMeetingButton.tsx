import "./RecordMeetingButton.css";

import {
    dayjs, getTranscriptionResources, MEETING_RECORDING_LABEL, type TranscriptionState,
    type TranscriptionStatus
} from "@triliumnext/commons";
import { useCallback, useEffect, useState } from "preact/hooks";

import dateNoteService from "../../services/date_notes";
import { requireResources } from "../../services/dialog";
import { t } from "../../services/i18n";
import noteCreateService from "../../services/note_create";
import options from "../../services/options";
import toast from "../../services/toast";
import { Badge } from "../react/Badge";
import { useTriliumOptionBool } from "../react/hooks";
import {
    LaunchBarActionButton,
    LauncherNoteProps,
    useLauncherIconAndTitle
} from "./launch_bar_widgets";

/**
 * Launcher button that records a meeting: the first click creates the meeting note and starts the
 * recording, the second stops it. Desktop only, since the main process does the recording, and
 * shown only while `transcriptionEnabled` is on. Its corner badge reads "Beta" while idle and the
 * time elapsed while recording.
 */
export default function RecordMeetingButton({ launcherNote }: LauncherNoteProps) {
    const { icon, title } = useLauncherIconAndTitle(launcherNote);
    const { status, error, startedAt } = useTranscriptionState();
    const [ isEnabled ] = useTriliumOptionBool("transcriptionEnabled");
    const [ keepsRecordings ] = useTriliumOptionBool("transcriptionKeepRecordings");
    const [ now, setNow ] = useState(Date.now);
    const handleClick = useCallback(() => {
        void toggleRecording(status);
    }, [ status ]);

    useEffect(() => {
        if (error) {
            toast.showError(error);
        }
    }, [ error ]);

    useEffect(() => {
        if (status !== "recording") {
            return;
        }
        setNow(Date.now());
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [ status ]);

    if (!isEnabled) {
        return null;
    }

    return (
        <div className="record-meeting-launcher">
            <LaunchBarActionButton
                launcherNote={launcherNote}
                onClick={handleClick}
                {...getAppearance(status, icon, title, keepsRecordings)}
            />
            {status === "idle" && (
                <Badge text={t("common.beta")} className="record-meeting-beta-badge" />
            )}
            {status === "recording" && startedAt !== undefined && (
                <Badge
                    text={formatElapsed(now - startedAt)}
                    className="record-meeting-time-badge"
                />
            )}
        </div>
    );
}

const BUSY_ICON = "bx bx-loader-alt bx-spin";

/**
 * The icon and tooltip for each state. While recordings are kept, the idle tooltip says so, since
 * starting is when the people in the meeting would need to agree to it.
 */
function getAppearance(
    status: TranscriptionStatus, idleIcon: string, idleTitle: string, keepsRecordings: boolean
) {
    switch (status) {
        case "idle":
            return {
                icon: idleIcon,
                text: keepsRecordings
                    ? t("record_meeting.title_keeping_recordings", { title: idleTitle })
                    : idleTitle
            };
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
    const resources = getTranscriptionResources(
        options.get("transcriptionModel"), options.is("transcriptionSpeakersEnabled"));
    if (!await requireResources(resources)) {
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

/** Formats a recording's length as `m:ss` within its first hour and as `h:mm` from then on. */
export function formatElapsed(elapsedMs: number) {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60) % 60;
    if (hours) {
        return `${hours}:${String(minutes).padStart(2, "0")}`;
    }
    return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
