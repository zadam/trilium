import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    electron: true,
    stored: "" as string,
    saved: [] as string[],
    bools: {} as Record<string, boolean>,
    getRecordingsDirectory: vi.fn(),
    savedBools: [] as [ string, boolean ][]
}));

vi.mock("../../../services/utils", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../services/utils")>()),
    isElectron: () => mocks.electron
}));

vi.mock("../../../services/i18n", () => ({ t: (key: string) => key }));

vi.mock("../../react/hooks", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../react/hooks")>()),
    useTriliumOption: (name: string) => [
        name === "transcriptionModel" ? mocks.stored : "",
        (value: string) => void mocks.saved.push(value)
    ],
    useTriliumOptionBool: (name: string) => [
        mocks.bools[name] ?? false,
        (value: boolean) => void mocks.savedBools.push([ name, value ])
    ]
}));


vi.mock("./components/OptionsPageHeader", () => ({ default: () => <div className="header-stub" /> }));

import TranscriptionSettings from "./transcription";

let host: HTMLElement;

beforeEach(() => {
    mocks.electron = true;
    mocks.stored = "parakeet-fp32";
    mocks.saved = [];
    mocks.bools = { transcriptionSpeakersEnabled: true, transcriptionKeepRecordings: false };
    mocks.savedBools = [];
    mocks.getRecordingsDirectory.mockReset().mockResolvedValue("/data/transcription-recordings");
    window.electronApi = {
        transcription: { getRecordingsDirectory: mocks.getRecordingsDirectory }
    } as unknown as typeof window.electronApi;
    host = document.body.appendChild(document.createElement("div"));
});

afterEach(() => {
    render(null, host);
    window.electronApi = undefined;
    document.body.innerHTML = "";
});

function open() {
    act(() => {
        render(<TranscriptionSettings />, host);
    });
    return host.querySelector<HTMLSelectElement>("select");
}

describe("TranscriptionSettings", () => {
    it("selects the model a recording runs on, and saves another choice", () => {
        const select = open();
        if (!select) {
            throw new Error("The model selector is missing.");
        }
        expect([ ...select.options ].map((option) => [ option.value, option.textContent ])).toEqual([
            [ "parakeet-int8", "transcription_options.model_standard" ],
            [ "parakeet-fp32", "transcription_options.model_high_accuracy" ]
        ]);
        expect(select.value).toBe("parakeet-fp32");

        act(() => {
            select.value = "parakeet-int8";
            select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        expect(mocks.saved).toEqual([ "parakeet-int8" ]);
    });

    it("turns speaker identification off", () => {
        open();
        const toggle = findToggle("identify-speakers");
        expect(toggle.checked).toBe(true);

        act(() => {
            toggle.checked = false;
            toggle.dispatchEvent(new Event("input", { bubbles: true }));
        });
        expect(mocks.savedBools).toEqual([ [ "transcriptionSpeakersEnabled", false ] ]);
    });

    it("keeps recordings for troubleshooting on request, on a switch tinted as a warning", async () => {
        open();
        const toggle = findToggle("keep-recordings");
        expect(toggle.checked).toBe(false);
        expect(toggle.closest(".transcription-keep-recordings")).not.toBeNull();

        act(() => {
            toggle.checked = true;
            toggle.dispatchEvent(new Event("input", { bubbles: true }));
        });
        expect(mocks.savedBools).toEqual([ [ "transcriptionKeepRecordings", true ] ]);
    });

    it("asks for the recordings folder, which creates it, only while recordings are kept", async () => {
        open();
        await act(async () => {});
        expect(mocks.getRecordingsDirectory).not.toHaveBeenCalled();
        expect(host.querySelector(".directory-location")).toBeNull();

        act(() => render(null, host));
        mocks.bools.transcriptionKeepRecordings = true;
        open();
        await act(async () => {});
        expect(mocks.getRecordingsDirectory).toHaveBeenCalledOnce();
        expect(host.querySelector(".directory-location-path")?.textContent).toBe("/data/transcription-recordings");
    });

    it("shows the default model for a value it does not know", () => {
        mocks.stored = "whisper";
        expect(open()?.value).toBe("parakeet-int8");
    });

    it("explains that the page applies to desktop builds only, elsewhere", () => {
        mocks.electron = false;
        expect(open()).toBeNull();
        expect(host.textContent).toContain("desktop.web_placeholder");
    });
});

/** The switch of the section `name`, whose id is `<name>-<random>`. */
function findToggle(name: string) {
    const toggle = host.querySelector<HTMLInputElement>(`input.switch-toggle[id^='${name}-']`);
    if (!toggle) {
        throw new Error(`The ${name} switch is missing.`);
    }
    return toggle;
}
