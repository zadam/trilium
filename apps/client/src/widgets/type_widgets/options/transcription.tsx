import "./transcription.css";

import { getTranscriptionModel, TRANSCRIPTION_MODELS, type TranscriptionModelId } from "@triliumnext/commons";
import { useEffect, useState } from "preact/hooks";

import { t } from "../../../services/i18n";
import { isElectron } from "../../../services/utils";
import { Card, OptionCardSection } from "../../react/Card";
import { DirectoryLocation } from "../../react/DirectoryLink";
import FormSelect from "../../react/FormSelect";
import FormToggle from "../../react/FormToggle";
import { useTriliumOption, useTriliumOptionBool } from "../../react/hooks";
import NoItems from "../../react/NoItems";
import OptionsPageHeader from "./components/OptionsPageHeader";

export default function TranscriptionSettings() {
    if (!isElectron()) {
        return (
            <>
                <OptionsPageHeader />
                <NoItems icon="bx bx-microphone" text={t("desktop.web_placeholder")} />
            </>
        );
    }

    return (
        <>
            <OptionsPageHeader />
            <RecognitionSettings />
            <TroubleshootingSettings />
        </>
    );
}

function RecognitionSettings() {
    const [ model, setModel ] = useTriliumOption("transcriptionModel");
    const [ speakersEnabled, setSpeakersEnabled ] = useTriliumOptionBool("transcriptionSpeakersEnabled");
    const labels: Record<TranscriptionModelId, string> = {
        "parakeet-int8": t("transcription_options.model_standard"),
        "parakeet-fp32": t("transcription_options.model_high_accuracy")
    };

    return (
        <Card heading={t("transcription_options.recognition_title")}>
            <OptionCardSection
                name="transcription-model"
                label={t("transcription_options.european_languages")}
                description={t("transcription_options.european_languages_description")}
            >
                <FormSelect
                    name="transcription-model"
                    currentValue={getTranscriptionModel(model).id}
                    onChange={setModel}
                    keyProperty="id"
                    titleProperty="label"
                    values={Object.values(TRANSCRIPTION_MODELS).map(({ id }) => ({ id, label: labels[id] }))}
                />
            </OptionCardSection>

            <OptionCardSection
                name="identify-speakers"
                label={t("transcription_options.identify_speakers")}
                description={t("transcription_options.identify_speakers_description")}
            >
                <FormToggle currentValue={speakersEnabled} onChange={setSpeakersEnabled} />
            </OptionCardSection>
        </Card>
    );
}

function TroubleshootingSettings() {
    const [ keepRecordings, setKeepRecordings ] = useTriliumOptionBool("transcriptionKeepRecordings");
    const [ directory, setDirectory ] = useState<string>();

    // Asking for the folder creates it, so it is asked for only once recordings are to be kept.
    useEffect(() => {
        if (!keepRecordings) {
            return;
        }
        let isCurrent = true;
        void window.electronApi?.transcription.getRecordingsDirectory().then((result) => {
            if (isCurrent) {
                setDirectory(result);
            }
        });
        return () => {
            isCurrent = false;
        };
    }, [ keepRecordings ]);

    return (
        <Card heading={t("transcription_options.troubleshooting_title")}>
            <OptionCardSection
                name="keep-recordings"
                className="transcription-keep-recordings"
                label={t("transcription_options.keep_recordings")}
                description={t("transcription_options.keep_recordings_description")}
            >
                <FormToggle currentValue={keepRecordings} onChange={setKeepRecordings} />
            </OptionCardSection>

            {keepRecordings && directory && (
                <DirectoryLocation label={t("transcription_options.saved_in")} directory={directory} />
            )}
        </Card>
    );
}
