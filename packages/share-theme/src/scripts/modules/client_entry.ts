/** What the client build writes next to each entry it exposes to these pages. */
interface ClientEntryManifest {
    entry: string;
    files: string[];
}

/**
 * Imports one of the client's entries, which the server, the standalone build and the share-theme
 * export each place at `client/` next to this script, described by `client/<name>.json`. The
 * entry's stylesheets are linked first: a chunk imported directly brings none of its own.
 */
export async function loadClientEntry<T>(name: string): Promise<T> {
    const manifestUrl = new URL(`client/${name}.json`, import.meta.url);
    const response = await fetch(manifestUrl);
    if (!response.ok) {
        throw new Error(`Failed to load ${manifestUrl.href}: HTTP ${response.status}.`);
    }

    const manifest = await response.json() as ClientEntryManifest;

    for (const file of manifest.files) {
        if (file.endsWith(".css")) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = new URL(file, manifestUrl).href;
            document.head.append(link);
        }
    }

    const module = await import(new URL(manifest.entry, manifestUrl).href) as { default: T };
    return module.default;
}
