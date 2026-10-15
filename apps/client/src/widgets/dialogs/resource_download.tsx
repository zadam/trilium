import "./resource_download.css";

import type {
    ResourceDownloadProgress, ResourceDownloadState, ResourceInfo, ResourcesStatusResponse,
    WebSocketMessage
} from "@triliumnext/commons";
import { useEffect, useRef, useState } from "preact/hooks";

import { t } from "../../services/i18n";
import server from "../../services/server";
import { formatSize } from "../../services/utils";
import { subscribeToMessages, unsubscribeToMessage } from "../../services/ws";
import { ExtendedAdmonition } from "../react/Admonition";
import Button from "../react/Button";
import { Card, CardSection } from "../react/Card";
import { useTriliumEvent } from "../react/hooks";
import Icon from "../react/Icon";
import Modal from "../react/Modal";
import ProgressBar from "../react/ProgressBar";

export interface ResourceDownloadDialogOptions {
    ids: string[];
    status: ResourcesStatusResponse;
    /** Called once the dialog closes, with whether every resource is now installed. */
    callback: (installed: boolean) => void;
}

/**
 * Asks to download the resources a feature needs, then shows the download until it finishes.
 * Closing the dialog cancels a running download.
 */
export default function ResourceDownloadDialog() {
    const [ opts, setOpts ] = useState<ResourceDownloadDialogOptions>();
    const [ shown, setShown ] = useState(false);
    const [ download, setDownload ] = useState<ResourceDownloadProgress | null>(null);
    const downloadRef = useRef(download);
    downloadRef.current = download;

    useTriliumEvent("showResourceDownloadDialog", (newOpts) => {
        setOpts(newOpts);
        setDownload(newOpts.status.download);
        setShown(true);
    });

    useEffect(() => {
        if (!shown || !opts) {
            return;
        }
        // Matched by resource rather than by download ID, which a fast download can report
        // before the request that started it returns.
        const handler = (message: WebSocketMessage) => {
            if (message.type === "resource-download"
                && message.download.resourceIds.some((id) => opts.ids.includes(id))) {
                setDownload(message.download);
            }
        };
        subscribeToMessages(handler);
        return () => unsubscribeToMessage(handler);
    }, [ shown, opts ]);

    useEffect(() => {
        if (download?.status === "succeeded") {
            setShown(false);
        }
    }, [ download ]);

    async function startDownload() {
        if (!opts) {
            return;
        }
        setDownload(null);
        const started = await server.post<ResourceDownloadProgress>("resources/download", { ids: opts.ids });
        setDownload((current) => current?.downloadId === started.downloadId ? current : started);
    }

    function cancelDownload() {
        const running = downloadRef.current;
        if (running?.status === "downloading") {
            void server.post(`resources/download/${running.downloadId}/cancel`);
        }
    }

    const isDownloading = download?.status === "downloading";
    const isFailed = download?.status === "failed";
    const remaining = opts ? getRemainingSize(opts.status) : 0;
    const freeBytes = opts?.status.freeBytes ?? null;
    const lacksSpace = freeBytes !== null && freeBytes < remaining;

    return (
        <Modal
            className="resource-download-dialog"
            size="lg"
            title={t("resource_download.title")}
            show={shown}
            onHidden={() => {
                cancelDownload();
                opts?.callback(downloadRef.current?.status === "succeeded");
                setShown(false);
            }}
            footer={<>
                <Button text={t("resource_download.cancel")} onClick={() => setShown(false)} />
                {!isDownloading && (
                    <Button
                        text={isFailed ? t("resource_download.retry") : t("resource_download.download")}
                        icon="bx bx-download"
                        kind="primary"
                        disabled={lacksSpace}
                        disabledTooltip={t("resource_download.not_enough_space_title")}
                        onClick={startDownload}
                    />
                )}
            </>}
        >
            {opts && (
                <ResourceList status={opts.status} remaining={remaining} download={download} />
            )}
            {lacksSpace && (
                <ExtendedAdmonition
                    type="caution"
                    icon="bx bx-error-circle"
                    title={t("resource_download.not_enough_space_title")}
                >
                    {t("resource_download.not_enough_space", {
                        size: formatSize(remaining),
                        free: formatSize(freeBytes)
                    })}
                </ExtendedAdmonition>
            )}
            {isFailed && (
                <ExtendedAdmonition
                    type="caution"
                    icon="bx bx-error-circle"
                    title={t("resource_download.failed_title")}
                >
                    {download.error}
                </ExtendedAdmonition>
            )}
        </Modal>
    );
}

interface ResourceListProps {
    status: ResourcesStatusResponse;
    remaining: number;
    download: ResourceDownloadProgress | null;
}

function ResourceList({ status, remaining, download }: ResourceListProps) {
    const missing = status.resources.filter(({ installed }) => !installed);
    const activeId = download?.status === "downloading"
        ? download.resources.find(({ done }) => !done)?.id
        : undefined;

    return (
        <>
            <p>{t("resource_download.intro")}</p>
            <Card className="resource-download-list">
                {missing.map((resource) => (
                    <ResourceItem
                        key={resource.id}
                        resource={resource}
                        unitOf={remaining}
                        state={download?.resources.find(({ id }) => id === resource.id)}
                        file={resource.id === activeId ? download?.file ?? null : undefined}
                    />
                ))}
                <CardSection className="tn-card-option resource-download-total">
                    <div className="tn-card-option-label">
                        <span className="tn-card-option-title">{t("resource_download.total")}</span>
                        {status.freeBytes !== null && (
                            <small className="tn-card-option-description">
                                {t("resource_download.free_space", {
                                    size: formatSize(status.freeBytes)
                                })}
                            </small>
                        )}
                    </div>
                    <span className="tn-card-option-value resource-download-size">
                        {formatSize(remaining, 2, remaining)}
                    </span>
                </CardSection>
            </Card>
        </>
    );
}

interface ResourceItemProps {
    resource: ResourceInfo;
    unitOf: number;
    /** How far a download has got with the resource, once one has started. */
    state?: ResourceDownloadState;
    /** The file being downloaded, `null` before the first one, while this resource downloads. */
    file?: string | null;
}

/**
 * One resource as a settings row: its icon, what it is and where it comes from, and what is left
 * to download of it, so that the rows add up to the download size. Once a download starts, the
 * icon shows whether the resource is done, downloading or waiting, as the setup's sync steps do.
 * The resource downloading carries a progress bar, and so does one an earlier download left
 * partly fetched, filled as far as it got.
 */
function ResourceItem({ resource, unitOf, state, file }: ResourceItemProps) {
    const isActive = file !== undefined;
    const isPartial = !state?.done && resource.downloadedSize > 0;
    return (
        <CardSection className="tn-card-option resource-download-item">
            <Icon icon={getRowIcon(resource, state, isActive)} className="resource-download-icon" />
            <div className="tn-card-option-label">
                <span className="tn-card-option-title">{resource.title}</span>
                <small className="tn-card-option-description">{resource.description}</small>
                <small className="tn-card-option-description resource-download-meta">
                    {t("resource_download.sources", { sources: resource.sources.join(", ") })}
                    {" · "}
                    <span className="resource-download-license">
                        {t("resource_download.license", { license: resource.license })}
                    </span>
                </small>
                {isActive && state && (
                    <RowProgress
                        received={state.receivedBytes}
                        total={state.totalBytes}
                        label={file && t("resource_download.current_file", { file })}
                    />
                )}
                {!isActive && isPartial && (
                    <RowProgress
                        received={resource.downloadedSize}
                        total={resource.size}
                        label={t("resource_download.partially_downloaded")}
                    />
                )}
            </div>
            <span className="tn-card-option-value resource-download-size">
                {formatSize(resource.size - resource.downloadedSize, 2, unitOf)}
            </span>
        </CardSection>
    );
}

interface RowProgressProps {
    received: number;
    total: number;
    /** What the bar shows, on its leading edge below it. */
    label: string | null;
}

function RowProgress({ received, total, label }: RowProgressProps) {
    return (
        <div className="resource-download-progress">
            <ProgressBar value={received} max={total} />
            <small className="tn-card-option-description resource-download-progress-detail">
                <span>{label}</span>
                <span>
                    {t("resource_download.progress", {
                        received: formatSize(received, 2, total),
                        total: formatSize(total)
                    })}
                </span>
            </small>
        </div>
    );
}

function getRowIcon(resource: ResourceInfo, state: ResourceDownloadState | undefined,
    isActive: boolean) {
    if (!state) {
        return resource.icon;
    }
    if (state.done) {
        return "bx bx-check-circle";
    }
    return isActive ? "bx bx-loader-circle bx-spin" : "bx bx-circle";
}

/** The bytes still to download for the resources not installed. */
function getRemainingSize(status: ResourcesStatusResponse) {
    return status.resources
        .filter(({ installed }) => !installed)
        .reduce((total, { size, downloadedSize }) => total + size - downloadedSize, 0);
}
