/**
 * replaces exlicraw.com and unpkg.com with own assets
 * 
 * workaround until https://github.com/excalidraw/excalidraw/pull/5065 is merged and published
 * 
 * @param {string} string 
 * @returns 
 */
const replaceExternalAssets = (string) => {
    let result = string;
    // exlidraw.com asset in react usage
    result = result.replaceAll("https://excalidraw.com/", window.EXCALIDRAW_ASSET_PATH+"excalidraw-assets/");
    return result;
}

export default replaceExternalAssets;