import "./resources.css";

import type { ResourceInfo, ResourcesStatusResponse, WebSocketMessage } from "@triliumnext/commons";
import { useEffect, useState } from "preact/hooks";

import { t } from "../../../services/i18n";
import server from "../../../services/server";
import { formatSize } from "../../../services/utils";
import { subscribeToMessages, unsubscribeToMessage } from "../../../services/ws";
import { Card, CardSection } from "../../react/Card";
import DirectoryLink from "../../react/DirectoryLink";
import Icon from "../../react/Icon";
import NoItems from "../../react/NoItems";
import OptionsPageHeader from "./components/OptionsPageHeader";

/** Lists the resources the features of this device can download, and which of them are installed. */
export default function ResourcesSettings() {
    const resources = useResources();

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
                        <ResourceRows resources={resources} />
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

/** The registered resources, fetched again whenever a download of any of them ends. */
function useResources() {
    const [ resources, setResources ] = useState<ResourceInfo[]>();

    useEffect(() => {
        const refresh = () => {
            void server.get<ResourcesStatusResponse>("resources")
                .then((status) => setResources(status.resources));
        };
        const handler = (message: WebSocketMessage) => {
            if (message.type === "resource-download" && message.download.status !== "downloading") {
                refresh();
            }
        };
        refresh();
        subscribeToMessages(handler);
        return () => unsubscribeToMessage(handler);
    }, []);

    return resources;
}

function ResourceRows({ resources }: { resources: ResourceInfo[] }) {
    const used = resources.reduce((total, { downloadedSize }) => total + downloadedSize, 0);
    return (
        <>
            {resources.map((resource) => (
                <ResourceRow key={resource.id} resource={resource} />
            ))}
            <CardSection className="tn-card-option resources-total">
                <div className="tn-card-option-label">
                    <span className="tn-card-option-title">{t("resources_options.space_used")}</span>
                </div>
                <span className="tn-card-option-value resources-size">{formatSize(used)}</span>
            </CardSection>
        </>
    );
}

function ResourceRow({ resource }: { resource: ResourceInfo }) {
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
                {resource.directory && (
                    <small className="tn-card-option-description resources-directory">
                        <DirectoryLink directory={resource.directory} />
                    </small>
                )}
            </div>
            <div className="tn-card-option-value resources-status">
                <span className="resources-size">{formatSize(resource.size)}</span>
                <small className="tn-card-option-description">{getStatusText(resource)}</small>
            </div>
        </CardSection>
    );
}

function getStatusText({ installed, size, downloadedSize }: ResourceInfo) {
    if (installed) {
        return t("resources_options.installed");
    }
    if (downloadedSize > 0) {
        return t("resources_options.partially_downloaded", {
            downloaded: formatSize(downloadedSize, 2, size),
            size: formatSize(size)
        });
    }
    return t("resources_options.not_downloaded");
}
