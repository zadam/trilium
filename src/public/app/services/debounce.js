/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing. The function also has a property 'clear'
 * that is a function which will clear the timer to prevent previously scheduled executions.
 *
 * @source underscore.js
 * @see http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
 * @param {Function} func to wrap
 * @param {Number} waitMs in ms (`100`)
 * @param {Boolean} [immediate=false] whether to execute at the beginning (`false`)
 * @api public
 */
function debounce(func, waitMs, immediate = false) {
    let timeout, args, context, timestamp, result;
    if (null == waitMs) waitMs = 100;

    function later() {
        const last = Date.now() - timestamp;

        if (last < waitMs && last >= 0) {
            timeout = setTimeout(later, waitMs - last);
        } else {
            timeout = null;
            if (!immediate) {
                result = func.apply(context, args);
                context = args = null;
            }
        }
    }

    const debounced = function () {
        context = this;
        args = arguments;
        timestamp = Date.now();
        const callNow = immediate && !timeout;
        if (!timeout) timeout = setTimeout(later, waitMs);
        if (callNow) {
            result = func.apply(context, args);
            context = args = null;
        }

        return result;
    };

    debounced.clear = function() {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
    };

    debounced.flush = function() {
        if (timeout) {
            result = func.apply(context, args);
            context = args = null;

            clearTimeout(timeout);
            timeout = null;
        }
    };

    return debounced;
}

// Adds compatibility for ES modules
debounce.debounce = debounce;

export default debounce;
