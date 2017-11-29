const server = (function() {
    function initAjax() {
        $.ajaxSetup({
            headers: {
                'x-protected-session-id': typeof protected_session !== 'undefined' ? protected_session.getProtectedSessionId() : null
            }
        });
    }

    async function get(url) {
        return await ajax('GET', url);
    }

    async function post(url, data) {
        return await ajax('POST', url, data);
    }

    async function put(url, data) {
        return await ajax('PUT', url, data);
    }

    async function remove(url) {
        return await ajax('DELETE', url);
    }

    async function ajax(method, url, data) {
        const options = {
            url: baseApiUrl + url,
            type: method
        };

        if (data) {
            options.data = JSON.stringify(data);
            options.contentType = "application/json";
        }

        return await $.ajax(options).catch(e => {
            showError("Error when calling " + method + " " + url + ": " + e);
        });
    }

    initAjax();

    return {
        get,
        post,
        put,
        remove,
        initAjax
    }
})();