import { getTranscriptionModel, TRANSCRIPTION_MODELS, type TranscriptionModelId } from "@triliumnext/commons";

import { t } from "../../../services/i18n";
import { isElectron } from "../../../services/utils";
import { Card, OptionCardSection } from "../../react/Card";
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
