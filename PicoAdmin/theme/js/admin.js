var utils = {};

utils.forEach = function (object, callback) {
    var i = 0,
        keys = Object.keys(object),
        length = keys.length;
    for (; i < length; i++) {
        if (callback(keys[i], object[keys[i]]) === false) {
            return;
        }
    }
};

utils.extend = function (target) {
    var mergeCallback = function (key, value) { this[key] = value; };
    for (var i = 1; i < arguments.length; i++) {
        utils.forEach(arguments[i], mergeCallback.bind(target));
    }
    return target;
};

utils.ajax = function (url, options) {
    var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
    xhr.open(options.postData ? 'POST' : 'GET', url);
    if (options.responseType) xhr.responseType = options.responseType;

    xhr.onreadystatechange = function() {
        if (xhr.readyState > 3) {
            if ((xhr.status >= 200) && (xhr.status < 300)) {
                if (options.success) {
                    options.success(xhr, xhr.statusText, xhr.response);
                }
            } else if ((xhr.status >= 400) && (xhr.status <= 600)) {
                if (options.error) {
                    options.error(xhr, xhr.statusText, xhr.response);
                }
            } else if (xhr.status !== 0) {
                console.error('Invalid XMLHttpRequest status', xhr.status);
                return;
            }

            if (options.complete) {
                options.complete(xhr, xhr.statusText, xhr.response);
            }
        }
    };

    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    if (options.postData) {
        var postParams = Object.keys(options.postData).map(function (key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(options.postData[key]);
        }).join('&');

        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.setRequestHeader('Content-length', options.postData.length);

        xhr.send(postParams);
    } else {
        xhr.send();
    }

    return xhr;
};
