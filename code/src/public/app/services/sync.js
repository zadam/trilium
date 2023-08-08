import server from './server.js';
import toastService from "./toast.js";

async function syncNow(ignoreNotConfigured = false) {
    const result = await server.post('sync/now');

    if (result.success) {
        toastService.showMessage("Sync finished successfully.");
    }
    else {
        if (result.message.length > 200) {
            result.message = `${result.message.substr(0, 200)}...`;
        }

        if (!ignoreNotConfigured || result.errorCode !== 'NOT_CONFIGURED') {
            toastService.showError(`Sync failed: ${result.message}`);
        }
    }
}

export default {
    syncNow
};
