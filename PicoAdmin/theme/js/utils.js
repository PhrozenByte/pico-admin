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

utils.ajax = function (url, options) {
    var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
    xhr.open(options.postData ? 'POST' : 'GET', url);
    if (options.responseType) xhr.responseType = options.responseType;

    xhr.onreadystatechange = function() {
        if (xhr.readyState > 3) {
            var isSuccessful = null;
            if ((xhr.status >= 200) && (xhr.status < 300)) {
                isSuccessful = true;
            } else if ((xhr.status >= 400) && (xhr.status <= 600)) {
                isSuccessful = false;
            } else {
                console.error('Invalid XMLHttpRequest status', xhr.status);
                return;
            }

            if (isSuccessful && options.success) {
                var callbackResult = options.success(xhr, xhr.statusText, xhr.response);
                isSuccessful = (callbackResult || (callbackResult === undefined) || (callbackResult === null));
            }
            if (!isSuccessful && options.error) {
                options.error(xhr, xhr.statusText, xhr.response);
            }

            if (options.complete) {
                options.complete(xhr, xhr.statusText, xhr.response, isSuccessful);
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

/**
 * Create a HTML element from a string
 *
 * based on jQuery.buildFragment()
 * https://github.com/jquery/jquery/blob/1.11.3/src/manipulation.js
 *
 * jQuery JavaScript Library v1.11.3
 * http://jquery.com/
 *
 * Copyright 2005, 2015 jQuery Foundation and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 */
utils.parse = function (html) {
    var rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
        rtagName = /<([\w:]+)/,
        rhtml = /<|&#?\w+;/,
        wrapMap = {
            option: [ 1, "<select multiple='multiple'>", "</select>" ],
            legend: [ 1, "<fieldset>", "</fieldset>" ],
            area: [ 1, "<map>", "</map>" ],
            param: [ 1, "<object>", "</object>" ],
            thead: [ 1, "<table>", "</table>" ],
            tr: [ 2, "<table><tbody>", "</tbody></table>" ],
            col: [ 2, "<table><tbody></tbody><colgroup>", "</colgroup></table>" ],
            td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
            _default: [ 0, "", "" ]
        },
        nodes = [];
    wrapMap.optgroup = wrapMap.option, wrapMap.th = wrapMap.td,
    wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;

    if (!rhtml.test(html)) {
        // convert non-html into a text node
        return document.createTextNode(html);
    } else {
        // convert html into DOM nodes
        var tmp = document.createElement('div');

        // deserialize a standard representation
        var tag = (rtagName.exec(html) || ["", ""])[1].toLowerCase();
        var wrap = wrapMap[tag] || wrapMap._default;

        tmp.innerHTML = wrap[1] + html.replace(rxhtmlTag, "<$1></$2>" ) + wrap[2];

        // descend through wrappers to the right content
        var j = wrap[0] + 1;
        while (j--) tmp = tmp.lastChild;

        return tmp;
    }
};
