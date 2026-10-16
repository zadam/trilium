import "./RecordMeetingButton.css";

import {
    dayjs, getTranscriptionResources, MEETING_RECORDING_LABEL, type TranscriptionState,
    type TranscriptionStatus, type TranscriptSource
} from "@triliumnext/commons";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import dateNoteService from "../../services/date_notes";
import { requireResources } from "../../services/dialog";
import { t } from "../../services/i18n";
import noteCreateService from "../../services/note_create";
import options from "../../services/options";
import toast from "../../services/toast";
import { Badge } from "../react/Badge";
import { useTriliumOptionBool } from "../react/hooks";
import Icon from "../react/Icon";
import Popover from "../react/Popover";
import {
    LaunchBarActionButton,
    LauncherNoteProps,
    useLaunchBarTitlePosition,
    useLauncherIconAndTitle
} from "./launch_bar_widgets";

/**
 * Launcher button that records a meeting: the first click creates the meeting note and starts the
 * recording, the second stops it. Desktop only, since the main process does the recording, and
 * shown only while `transcriptionEnabled` is on and the computer can transcribe. Its corner badge reads "Beta" while idle and the
 * time elapsed while recording, which turns red, with a message once, when a source stops
 * delivering audio. A recording started from this window opens a reminder beside the button, for
 * 10 s, to ask the people in the meeting for their consent.
 */
export default function RecordMeetingButton({ launcherNote }: LauncherNoteProps) {
    const { icon, title } = useLauncherIconAndTitle(launcherNote);
    const { status, error, startedAt, stalledSources } = useTranscriptionState();
    const [ isEnabled ] = useTriliumOptionBool("transcriptionEnabled");
    const isSupported = useTranscriptionSupported(isEnabled);
    const [ keepsRecordings ] = useTriliumOptionBool("transcriptionKeepRecordings");
    const [ now, setNow ] = useState(Date.now);
    const [ isRemindingConsent, setRemindingConsent ] = useState(false);
    const launcherRef = useRef<HTMLDivElement>(null);
    const handleClick = useCallback(() => {
        void toggleRecording(status).then((started) => {
            if (started) {
                setRemindingConsent(true);
            }
        });
    }, [ status ]);
    const dismissConsent = useCallback(() => setRemindingConsent(false), []);

    useEffect(() => {
        if (status !== "recording" && status !== "starting") {
            setRemindingConsent(false);
        }
    }, [ status ]);

    const isShowingConsent = isRemindingConsent && status === "recording";
    useEffect(() => {
        if (!isShowingConsent) {
            return;
        }
        const timeout = setTimeout(dismissConsent, CONSENT_REMINDER_MS);
        return () => clearTimeout(timeout);
    }, [ isShowingConsent, dismissConsent ]);

    useEffect(() => {
        if (error) {
            toast.showError(error);
        }
    }, [ error ]);

    useStalledSourceWarnings(stalledSources);

    useEffect(() => {
        if (status !== "recording") {
            return;
        }
        setNow(Date.now());
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [ status ]);

    // A recording outlives the switch turning off, so its stop button stays until it ends.
    if ((!isEnabled || !isSupported) && status === "idle") {
        return null;
    }

    return (
        <div ref={launcherRef} className="record-meeting-launcher">
            <LaunchBarActionButton
                launcherNote={launcherNote}
                onClick={handleClick}
                {...getAppearance(status, icon, title, keepsRecordings, !!stalledSources?.length)}
            />
            {status === "idle" && (
                <Badge text={t("common.beta")} className="record-meeting-beta-badge" />
            )}
            {status === "recording" && startedAt !== undefined && (
                <Badge
                    text={formatElapsed(now - startedAt)}
                    className={clsx("record-meeting-time-badge", {
                        stalled: !!stalledSources?.length
                    })}
                />
            )}
            {isShowingConsent && (
                <ConsentReminder
                    getAnchorRect={() =>
                        launcherRef.current?.getBoundingClientRect() ?? new DOMRect()}
                    keepsRecordings={keepsRecordings}
                    onDismiss={dismissConsent}
                />
            )}
        </div>
    );
}

/** How long the consent reminder stays open unless dismissed first. */
const CONSENT_REMINDER_MS = 10_000;

/**
 * A card beside the launcher asking to tell the people in the meeting and ask their consent. Only a
 * click on the card dismisses it, so the first click into the meeting note leaves it to be read.
 */
function ConsentReminder({ getAnchorRect, keepsRecordings, onDismiss }: {
    getAnchorRect(): DOMRect;
    keepsRecordings: boolean;
    onDismiss(): void;
}) {
    return (
        <Popover
            className="record-meeting-consent"
            getAnchorRect={getAnchorRect}
            placement={useLaunchBarTitlePosition()}
        >
            <div className="record-meeting-consent-body" role="status" onClick={onDismiss}>
                <Icon icon="bx bx-info-circle" />
                <span>
                    {keepsRecordings
                        ? t("record_meeting.consent_keeping_recordings")
                        : t("record_meeting.consent")}
                </span>
            </div>
        </Popover>
    );
}

/** Shows an error once for each source that joins `stalledSources`. */
function useStalledSourceWarnings(stalledSources: TranscriptSource[] | undefined) {
    const warned = useRef<TranscriptSource[]>([]);
    const key = stalledSources?.join() ?? "";

    useEffect(() => {
        const stalled = stalledSources ?? [];
        for (const source of stalled.filter((source) => !warned.current.includes(source))) {
            toast.showError(source === "microphone"
                ? t("record_meeting.no_audio_microphone")
                : t("record_meeting.no_audio_system"));
        }
        warned.current = stalled;
    }, [ key ]);
}

const BUSY_ICON = "bx bx-loader-alt bx-spin";

/**
 * The icon and tooltip for each state. While recordings are kept, the idle tooltip says so, since
 * starting is when the people in the meeting would need to agree to it.
 */
function getAppearance(
    status: TranscriptionStatus, idleIcon: string, idleTitle: string, keepsRecordings: boolean,
    isStalled: boolean
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
                text: isStalled ? t("record_meeting.stop_no_audio") : t("record_meeting.stop"),
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

/**
 * Whether this computer can transcribe, from `electronApi.transcription.isSupported()`, which
 * starts a process to find out: asked only once `shouldAsk` holds. `false` outside the desktop
 * app, `undefined` until the main process answers.
 */
export function useTranscriptionSupported(shouldAsk: boolean) {
    const [ isSupported, setIsSupported ] = useState<boolean | undefined>(
        window.electronApi?.transcription ? undefined : false);

    useEffect(() => {
        const api = window.electronApi?.transcription;
        if (!api || !shouldAsk) {
            return;
        }

        let mounted = true;
        void api.isSupported().then((value) => {
            if (mounted) {
                setIsSupported(value);
            }
        });
        return () => {
            mounted = false;
        };
    }, [ shouldAsk ]);

    return isSupported;
}

/**
 * Starts a recording into a new meeting note when idle, stops the running one when recording.
 *
 * @returns Whether a recording started.
 */
export async function toggleRecording(status: TranscriptionStatus) {
    const api = window.electronApi?.transcription;
    if (!api) {
        return false;
    }

    if (status === "recording") {
        await api.stop();
        return false;
    }
    if (status !== "idle") {
        return false;
    }
    const resources = getTranscriptionResources(
        options.get("transcriptionModel"), options.is("transcriptionSpeakersEnabled"));
    if (!await requireResources(resources)) {
        return false;
    }

    const note = (await createMeetingNote())?.note;
    if (!note) {
        return false;
    }
    const error = await api.start(note.noteId);
    if (error) {
        toast.showError(error);
    }
    return !error;
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
