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

utils.isPlainObject = function (object) {
    if ((object !== null) && (typeof object === 'object')) {
        if (typeof Object.getPrototypeOf === 'function') {
            var objectPrototype = Object.getPrototypeOf(object);
            return ((objectPrototype === Object.prototype) || (objectPrototype === null));
        }

        return (Object.prototype.toString.call(object) === '[object Object]');
    }

    return false;
};

utils.magicArgs = function (args, validators) {
    var i = 0, magicArgs = {};
    utils.forEach(validators, function (name, validator) {
        if ((i < args.length) && validator(args[i])) {
            magicArgs[name] = args[i];
            i++;
        } else {
            magicArgs[name] = null;
        }
    });
    return magicArgs;
};

utils.ajax = function (url, postData, responseType, successCallback, errorCallback, completeCallback) {
    var args = utils.magicArgs(arguments, {
        url: function (value) { return true; },
        postData: function (value) { return utils.isPlainObject(value); },
        responseType: function (value) { return ((value === 'document') || (value === 'json') || (value === 'text')); },
        successCallback: function (value) { return (typeof value === 'function'); },
        errorCallback: function (value) { return (typeof value === 'function'); },
        completeCallback: function (value) { return (typeof value === 'function'); }
    });
    if (args.successCallback && !args.errorCallback && !args.completeCallback) {
        args.completeCallback = args.successCallback;
        args.successCallback = null;
    }

    var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
    xhr.open(args.postData ? 'POST' : 'GET', args.url);
    if (args.responseType) xhr.responseType = args.responseType;

    xhr.onreadystatechange = function() {
        if (xhr.readyState > 3) {
            if ((xhr.status >= 200) && (xhr.status < 300)) {
                if (args.successCallback) {
                    args.successCallback(xhr, xhr.statusText, xhr.response);
                }
            } else if ((xhr.status >= 400) && (xhr.status <= 600)) {
                if (args.errorCallback) {
                    args.errorCallback(xhr, xhr.statusText, xhr.response);
                }
            } else if (xhr.status !== 0) {
                console.error('Invalid XMLHttpRequest status', xhr.status);
                return;
            }

            if (args.completeCallback) {
                args.completeCallback(xhr, xhr.statusText, xhr.response);
            }
        }
    };

    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    if (args.postData) {
        var postParams = Object.keys(args.postData).map(function (key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(postData[key]);
        }).join('&');

        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.setRequestHeader('Content-length', postData.length);

        xhr.send(postParams);
    } else {
        xhr.send();
    }

    return xhr;
};
