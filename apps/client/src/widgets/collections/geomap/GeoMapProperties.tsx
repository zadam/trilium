import "./GeoMapProperties.css";

import { useEffect, useState } from "preact/hooks";

import type FNote from "../../../entities/fnote";
import attributes from "../../../services/attributes";
import { t } from "../../../services/i18n";
import {
    CollectionPropertiesDialog, IncludedNotesCard
} from "../../note_bars/CollectionProperties";
import { bookPropertiesConfig } from "../../note_bars/collection-properties-config";
import Admonition from "../../react/Admonition";
import { Card, CardSection, OptionCardSection } from "../../react/Card";
import FormDropdownList from "../../react/FormDropdownList";
import FormTextBox from "../../react/FormTextBox";
import FormToggle from "../../react/FormToggle";
import { useNoteLabel, useNoteLabelBoolean, useNoteRelation } from "../../react/hooks";
import NoteAutocomplete from "../../react/NoteAutocomplete";
import { type BookProperty, ViewPropertySection } from "../../react/NotePropertyMenu";
import SegmentedChoice from "../../react/SegmentedChoice";
import { formatImageExtent, type ImageSize, parseImageExtent } from "./space";

/** What the map knows of its image: none, loading, unusable, or loaded at its natural size. */
export type GeoMapImageState =
    | { status: "geo" | "loading" }
    | { status: "error"; reason: "unloadable" | "svg" }
    | { status: "image"; size: ImageSize };

/** What a geo map is drawn over: a world map in one of its styles, or an image note. */
type BackgroundKind = "map" | "image";

interface BackgroundOption {
    value: BackgroundKind;
    title: string;
    description: string;
    icon: string;
}

/** The longest side, in pixels, that practically every graphics card can draw an image at. */
const SAFE_IMAGE_SIDE = 4096;

/**
 * The geo map's settings: those of the collection's settings dropdown, and what the map is drawn
 * over, which this dialog sets up in full.
 */
export default function GeoMapProperties({ note, image, onClose }: {
    note: FNote;
    image: GeoMapImageState;
    onClose: () => void;
}) {
    return (
        <CollectionPropertiesDialog
            className="geo-map-properties-dialog"
            title={t("geo-map.properties-title")}
            show
            onHidden={onClose}
        >
            <Card className="geo-map-properties-general" heading={t("geo-map.general")}>
                {GENERAL_PROPERTIES.map((property, index) => (
                    <ViewPropertySection key={index} note={note} property={property} />
                ))}
            </Card>

            <IncludedNotesCard note={note} />

            <BackgroundCard note={note} image={image} />
        </CollectionPropertiesDialog>
    );
}

/** The settings dropdown's map style, which the Background card holds instead of General. */
const MAP_STYLE_PROPERTY = bookPropertiesConfig.geoMap.properties.find(isMapStyle);

/** What the settings dropdown offers for a geo map, which the General card repeats. */
const GENERAL_PROPERTIES = bookPropertiesConfig.geoMap.properties
    .filter((property) => !isMapStyle(property));

function isMapStyle(property: BookProperty) {
    return "bindToLabel" in property && property.bindToLabel === "map:style";
}

/**
 * A world map with its style, or an image with its coordinates. Choosing the image writes nothing
 * until an image note is picked, so the map stays drawn as it was until then.
 */
function BackgroundCard({ note, image }: { note: FNote; image: GeoMapImageState }) {
    const [ imageNoteId, setImageNoteId ] = useNoteRelation(note, "map:image");
    const [ kind, setKind ] = useState<BackgroundKind>(imageNoteId ? "image" : "map");

    useEffect(() => {
        if (imageNoteId) setKind("image");
    }, [ imageNoteId ]);

    function changeKind(newKind: BackgroundKind) {
        setKind(newKind);
        if (newKind === "map") {
            void attributes.removeOwnedRelationByName(note, "map:image");
        }
    }

    return (
        <Card className="geo-map-properties-background" heading={t("geo-map.background")}>
            <OptionCardSection
                className="geo-map-background-type"
                label={t("geo-map.background-type")}
            >
                <FormDropdownList
                    values={BACKGROUND_OPTIONS}
                    keyProperty="value"
                    titleProperty="title"
                    descriptionProperty="description"
                    iconProperty="icon"
                    currentValue={kind}
                    onChange={(value) => changeKind(value as BackgroundKind)}
                />
            </OptionCardSection>

            {kind === "map" && MAP_STYLE_PROPERTY && (
                <ViewPropertySection note={note} property={MAP_STYLE_PROPERTY} />
            )}

            {kind === "image" && (
                <ImageSettings
                    note={note}
                    image={image}
                    imageNoteId={imageNoteId}
                    onPickImage={setImageNoteId}
                />
            )}
        </Card>
    );
}

const BACKGROUND_OPTIONS: BackgroundOption[] = [
    {
        value: "map",
        title: t("geo-map.background-map"),
        description: t("geo-map.background-map-description"),
        icon: "bx bx-world"
    },
    {
        value: "image",
        title: t("geo-map.background-image"),
        description: t("geo-map.background-image-description"),
        icon: "bx bx-image"
    }
];

function ImageSettings({ note, image, imageNoteId, onPickImage }: {
    note: FNote;
    image: GeoMapImageState;
    imageNoteId: string | null | undefined;
    onPickImage: (noteId: string) => void;
}) {
    const [ isDarkImage, setDarkImage ] = useNoteLabelBoolean(note, "map:darkStyle");
    const notice = imageNotice(image);

    return <>
        <OptionCardSection
            label={t("geo-map.image-note")}
            description={t("geo-map.image-note-description")}
            stacked
        >
            <NoteAutocomplete
                noteId={imageNoteId ?? undefined}
                placeholder={t("geo-map.image-note-placeholder")}
                noteIdChanged={onPickImage}
            />
        </OptionCardSection>

        {imageNoteId && notice && (
            <CardSection>
                <Admonition type={notice.type} className="geo-map-image-notice">
                    {notice.text}
                </Admonition>
            </CardSection>
        )}

        {imageNoteId && <>
            <ImageCoordinates
                note={note}
                size={image.status === "image" ? image.size : undefined}
            />
            <OptionCardSection
                name="geo-map-dark-image"
                label={t("geo-map.dark-image")}
                description={t("geo-map.dark-image-description")}
            >
                <FormToggle currentValue={isDarkImage} onChange={setDarkImage} />
            </OptionCardSection>
        </>}
    </>;
}

/**
 * Whether positions are measured in the image's pixels or in coordinates of the map's own, and the
 * corners those coordinates give the image (`#map:imageBounds`).
 */
function ImageCoordinates({ note, size }: { note: FNote; size: ImageSize | undefined }) {
    const [ boundsValue, setBoundsValue ] = useNoteLabel(note, "map:imageBounds");
    const isCustom = boundsValue !== null && boundsValue !== undefined;
    const [ corners, setCorners ] = useState(() => cornersOf(boundsValue));
    const [ isInvalid, setInvalid ] = useState(false);

    useEffect(() => {
        setCorners(cornersOf(boundsValue));
        setInvalid(false);
    }, [ boundsValue ]);

    function changeMode(mode: string) {
        if (mode === "custom") {
            // Starts from the pixels, so that switching leaves every marker where it is.
            setBoundsValue(formatImageExtent({
                topLeft: [ 0, 0 ],
                bottomRight: [ size?.width ?? 100, size?.height ?? 100 ]
            }));
        } else {
            setBoundsValue(null);
        }
    }

    function commitCorner(index: number, value: string) {
        const next = [ ...corners ];
        next[index] = value;
        setCorners(next);

        const extent = parseImageExtent(`${next[0]},${next[1]} ${next[2]},${next[3]}`);
        setInvalid(!extent);
        if (extent) {
            setBoundsValue(formatImageExtent(extent));
        }
    }

    return (
        <OptionCardSection
            className="geo-map-coordinates"
            label={t("geo-map.coordinates")}
            description={t("geo-map.coordinates-description")}
            subSectionsVisible
            subSections={isCustom ? <>
                <CornerSection
                    label={t("geo-map.top-left-corner")}
                    x={corners[0]} y={corners[1]}
                    onCommit={commitCorner}
                />
                <CornerSection
                    label={t("geo-map.bottom-right-corner")}
                    x={corners[2]} y={corners[3]}
                    onCommit={(axis, value) => commitCorner(2 + axis, value)}
                />
                {isInvalid && (
                    <CardSection>
                        <Admonition type="caution" className="geo-map-coordinates-error">
                            {t("geo-map.coordinates-invalid")}
                        </Admonition>
                    </CardSection>
                )}
            </> : undefined}
        >
            <SegmentedChoice
                options={[
                    { value: "pixels", label: t("geo-map.coordinates-pixels") },
                    { value: "custom", label: t("geo-map.coordinates-custom") }
                ]}
                currentValue={isCustom ? "custom" : "pixels"}
                onChange={changeMode}
            />
        </OptionCardSection>
    );
}

/** One corner of the image, as an `x` and a `y` committed when either box is left. */
function CornerSection({ label, x, y, onCommit }: {
    label: string;
    x: string;
    y: string;
    /** Called with 0 for `x` and 1 for `y`. */
    onCommit: (axis: 0 | 1, value: string) => void;
}) {
    return (
        <OptionCardSection className="geo-map-corner" label={label}>
            <FormTextBox
                type="number" step="any" placeholder="x" aria-label={`${label} x`}
                currentValue={x} onBlur={(value) => onCommit(0, value)}
            />
            <FormTextBox
                type="number" step="any" placeholder="y" aria-label={`${label} y`}
                currentValue={y} onBlur={(value) => onCommit(1, value)}
            />
        </OptionCardSection>
    );
}

/** The four numbers of a `#map:imageBounds` value, empty where it names no corners. */
function cornersOf(value: string | null | undefined): string[] {
    const extent = parseImageExtent(value);
    return extent ? [ ...extent.topLeft, ...extent.bottomRight ].map(String) : [ "", "", "", "" ];
}

interface ImageNotice {
    type: "caution" | "warning";
    text: string;
}

/** What the dialog says about an image that cannot be drawn, or might not be on every device. */
function imageNotice(image: GeoMapImageState): ImageNotice | null {
    if (image.status === "error") {
        return {
            type: "caution",
            text: t(image.reason === "svg"
                ? "geo-map.image-svg-unsupported"
                : "geo-map.image-unavailable")
        };
    }
    if (image.status !== "image") return null;

    const { width, height } = image.size;
    if (Math.max(width, height) <= SAFE_IMAGE_SIDE) return null;
    return {
        type: "warning",
        text: t("geo-map.image-too-large", { width, height, limit: SAFE_IMAGE_SIDE })
    };
}
