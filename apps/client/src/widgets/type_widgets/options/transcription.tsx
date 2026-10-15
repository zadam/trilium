import { t } from "../../../services/i18n";
import { isElectron } from "../../../services/utils";
import NoItems from "../../react/NoItems";
import OptionsPageHeader from "./components/OptionsPageHeader";

export default function TranscriptionSettings() {
    return (
        <>
            <OptionsPageHeader />
            <NoItems
                icon="bx bx-microphone"
                text={isElectron() ? t("transcription_options.placeholder") : t("desktop.web_placeholder")}
            />
        </>
    );
}
