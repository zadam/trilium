import { useEffect, useState } from "preact/hooks";

import { t } from "../../../../services/i18n.js";
import server from "../../../../services/server.js";
import Button from "../../../react/Button.js";

interface Inventory {
    providers: {
        id: string;
        name: string;
        configured: boolean;
        stale: boolean;
        refreshing: boolean;
        authenticationExpired: boolean;
        authenticationRequired: boolean;
        refreshFailed: boolean;
        boundedToolsSupported: boolean;
        endpointLocation: string;
    }[];
}

export default function GoslingInventory({ onRefresh }: { onRefresh: () => void }) {
    const [inventory, setInventory] = useState<Inventory>();
    const [error, setError] = useState("");
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const read = async (requestRefresh: boolean) => {
            try {
                const result = await server.post<Inventory>("gosling/inventory", {
                    refresh: requestRefresh
                });
                if (disposed) return;
                setInventory(result);
                setError("");
                if (result.providers.some((provider) => provider.refreshing)) {
                    timer = setTimeout(() => {
                        void read(false);
                    }, 2000);
                } else if (refresh) {
                    onRefresh();
                }
            } catch {
                if (!disposed) setError(t("llm.gosling_inventory_error"));
            }
        };
        void read(refresh > 0);
        return () => {
            disposed = true;
            clearTimeout(timer);
        };
    }, [refresh]);
    return (
        <div className="gosling-inventory">
            <p>{t("llm.gosling_inventory_help")}</p>
            <Button
                size="small"
                text={t("llm.gosling_refresh")}
                onClick={() => setRefresh((current) => current + 1)}
            />
            {error && <p role="alert">{error}</p>}
            <ul>
                {inventory?.providers.map((provider) => (
                    <li key={provider.id}>
                        {provider.name} ({provider.id}) —{" "}
                        {t(
                            !provider.configured
                                ? "llm.gosling_not_configured"
                                : "llm.gosling_configured"
                        )}
                        {provider.authenticationRequired && ` · ${t("llm.gosling_auth_required")}`}
                        {provider.authenticationExpired && ` · ${t("llm.gosling_auth_expired")}`}
                        {provider.stale && ` · ${t("llm.gosling_stale")}`}
                        {provider.refreshing && ` · ${t("llm.gosling_refreshing")}`}
                        {provider.refreshFailed && ` · ${t("llm.gosling_refresh_failed")}`}
                        {!provider.boundedToolsSupported &&
                            ` · ${t("llm.gosling_runtime_unsupported")}`}
                        {` · ${t("llm.gosling_endpoint", { location: provider.endpointLocation })}`}
                    </li>
                ))}
            </ul>
        </div>
    );
}
