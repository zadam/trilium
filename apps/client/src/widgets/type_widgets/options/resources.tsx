import "./resources.css";

import type { ResourceInfo, ResourcesStatusResponse, WebSocketMessage } from "@triliumnext/commons";
import { useCallback, useEffect, useState } from "preact/hooks";

import dialogService from "../../../services/dialog";
import { t } from "../../../services/i18n";
import openService from "../../../services/open";
import server from "../../../services/server";
import { formatSize, isElectron } from "../../../services/utils";
import { subscribeToMessages, unsubscribeToMessage } from "../../../services/ws";
import ActionButton from "../../react/ActionButton";
import { Card, CardSection } from "../../react/Card";
import Icon from "../../react/Icon";
import NoItems from "../../react/NoItems";
import OptionsPageHeader from "./components/OptionsPageHeader";

/** Lists the resources installed on this device, and the ones an interrupted download left partly fetched. */
export default function ResourcesSettings() {
    const [ resources, refresh ] = useResources();

    return (
        <>
            <OptionsPageHeader />
            {resources && (
                <Card
                    className="resources-list"
                    heading={t("resources_options.list_title")}
                    description={t("resources_options.list_description")}
                >
                    {resources.length > 0 ? (
                        <ResourceRows resources={resources} onDeleted={refresh} />
                    ) : (
                        <CardSection>
                            <NoItems icon="bx bx-download" text={t("resources_options.no_resources")} size="small" />
                        </CardSection>
                    )}
                </Card>
            )}
        </>
    );
}

/** The resources installed or partly downloaded, fetched again whenever a download ends. */
function useResources() {
    const [ resources, setResources ] = useState<ResourceInfo[]>();
    const refresh = useCallback(() => {
        void server.get<ResourcesStatusResponse>("resources")
            .then((status) => setResources(status.resources.filter(
                ({ downloadedSize }) => downloadedSize > 0)));
    }, []);

    useEffect(() => {
        const handler = (message: WebSocketMessage) => {
            if (message.type === "resource-download" && message.download.status !== "downloading") {
                refresh();
            }
        };
        refresh();
        subscribeToMessages(handler);
        return () => unsubscribeToMessage(handler);
    }, [ refresh ]);

    return [ resources, refresh ] as const;
}

/** The resources and the space they use, every size in one unit so that the column adds up. */
function ResourceRows({ resources, onDeleted }: { resources: ResourceInfo[]; onDeleted: () => void }) {
    const used = resources.reduce((total, { downloadedSize }) => total + downloadedSize, 0);
    const unitOf = Math.max(used, ...resources.map(({ size }) => size));
    return (
        <>
            {resources.map((resource) => (
                <ResourceRow key={resource.id} resource={resource} unitOf={unitOf} onDeleted={onDeleted} />
            ))}
            <CardSection className="tn-card-option resources-total">
                <div className="tn-card-option-label">
                    <span className="tn-card-option-title">{t("resources_options.space_used")}</span>
                </div>
                <span className="tn-card-option-value resources-size">{formatSize(used, 2, unitOf)}</span>
                <div className="resources-actions" />
            </CardSection>
        </>
    );
}

interface ResourceRowProps {
    resource: ResourceInfo;
    unitOf: number;
    onDeleted: () => void;
}

function ResourceRow({ resource, unitOf, onDeleted }: ResourceRowProps) {
    const { directory } = resource;
    async function remove() {
        if (!await dialogService.confirm(t("resources_options.delete_confirmation", { title: resource.title }))) {
            return;
        }
        await server.remove(`resources/${encodeURIComponent(resource.id)}`);
        onDeleted();
    }

    return (
        <CardSection className="tn-card-option resources-item">
            <Icon icon={resource.icon} className="resources-icon" />
            <div className="tn-card-option-label">
                <span className="tn-card-option-title">{resource.title}</span>
                <small className="tn-card-option-description">{resource.description}</small>
                <small className="tn-card-option-description">
                    {t("resource_download.sources", { sources: resource.sources.join(", ") })}
                    {" · "}
                    {t("resource_download.license", { license: resource.license })}
                </small>
            </div>
            <div className="tn-card-option-value resources-status">
                <span className="resources-size">{formatSize(resource.size, 2, unitOf)}</span>
                <small className="tn-card-option-description">{getStatusText(resource)}</small>
            </div>
            <div className="resources-actions">
                {directory && isElectron() && (
                    <ActionButton
                        icon="bx bx-folder-open"
                        text={t("resources_options.open_folder")}
                        onClick={() => void openService.openDirectory(directory)}
                    />
                )}
                <ActionButton
                    className="destructive-action-icon"
                    icon="bx bx-trash"
                    text={t("resources_options.delete")}
                    onClick={() => void remove()}
                />
            </div>
        </CardSection>
    );
}

function getStatusText({ installed, size, downloadedSize }: ResourceInfo) {
    if (installed) {
        return t("resources_options.installed");
    }
    return t("resources_options.partially_downloaded", {
        downloaded: formatSize(downloadedSize, 2, size),
        size: formatSize(size)
    });
}
