var utils = {};

(function () {
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

    utils.createClass = function (constructor, baseClass, blueprint) {
        if (blueprint === undefined) {
            blueprint = baseClass;
            baseClass = undefined;
        }
        if (baseClass) {
            constructor.prototype = Object.create(baseClass.prototype);
            constructor.prototype.constructor = constructor;
        }
        if (blueprint) {
            var parent = baseClass ? baseClass.prototype : undefined;
            blueprint.call(constructor, parent);
        }
        return constructor;
    };

    utils.encodeUriParams = function(params) {
        var iterator = function (params, keyPrefix) {
            var result = '';
            utils.forEach(params, function (key, value) {
                key = encodeURIComponent(key);
                key = keyPrefix ? (keyPrefix + "[" + key + "]") : key;

                if (Array.isArray(value) || utils.isPlainObject(value)) {
                    result += iterator(value, key);
                } else {
                    result += "&" + key + "=" + encodeURIComponent(value);
                }
            });
            return result;
        };

        var result = iterator(params);
        return (params !== '') ? result.slice(1) : '';
    };

    utils.ajax = function (url, options) {
        if (options.queryParams) {
            var queryString = utils.encodeUriParams(options.queryParams);
            if (queryString !== '') url += (url.indexOf('?') === -1) ? '?' + queryString : '&' + queryString;
        }

        var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
        xhr.open(options.postData ? 'POST' : 'GET', url);

        if (options.responseType) {
            xhr.responseType = options.responseType;
            if (options.responseType === 'json') xhr.setRequestHeader('Accept', 'application/json');
        }

        if (options.header) {
            utils.forEach(options.header, function (header, value) {
                xhr.setRequestHeader(header, value);
            });
        }

        xhr.onreadystatechange = function() {
            if (xhr.readyState > 3) {
                var isSuccessful = null;
                if ((xhr.status >= 200) && (xhr.status < 300)) {
                    isSuccessful = true;
                } else if ((xhr.status === 0) || ((xhr.status >= 400) && (xhr.status <= 600))) {
                    isSuccessful = false;
                } else {
                    if (options.complete) {
                        options.complete(xhr, xhr.statusText, xhr.response, null);
                    }

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
            var postParams = utils.encodeUriParams(options.postData);

            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhr.setRequestHeader('Content-Length', options.postData.length);

            xhr.send(postParams);
        } else {
            xhr.send();
        }

        return xhr;
    };

    utils.slideUp = function (element, finishCallback, startCallback) {
        utils.slideOut(element, {
            cssRule: 'height',
            cssRuleRef: 'clientHeight',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slideDown = function (element, finishCallback, startCallback) {
        utils.slideIn(element, {
            cssRule: 'height',
            cssRuleRef: 'clientHeight',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slideLeft = function (element, finishCallback, startCallback) {
        utils.slideOut(element, {
            cssRule: 'width',
            cssRuleRef: 'clientWidth',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slideRight = function (element, finishCallback, startCallback) {
        utils.slideIn(element, {
            cssRule: 'width',
            cssRuleRef: 'clientWidth',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slideOut = function (element, options) {
        element.style[options.cssRule] = element[options.cssRuleRef] + 'px';

        var slideId = parseInt(element.dataset.slideId) || 0;
        element.dataset.slideId = ++slideId;

        window.requestAnimationFrame(function () {
            element.classList.add('slide');

            window.requestAnimationFrame(function () {
                element.style[options.cssRule] = '0px';

                if (options.startCallback) {
                    options.startCallback();
                }

                window.setTimeout(function () {
                    if (parseInt(element.dataset.slideId) !== slideId) return;

                    element.classList.add('hidden');
                    element.classList.remove('slide');
                    element.style[options.cssRule] = null;

                    if (options.finishCallback) {
                        window.requestAnimationFrame(options.finishCallback);
                    }
                }, 500);
            });
        });
    };

    utils.slideIn = function (element, options) {
        var cssRuleOriginalValue = element[options.cssRuleRef] + 'px',
            slideId = parseInt(element.dataset.slideId) || 0;

        element.dataset.slideId = ++slideId;

        element.style[options.cssRule] = null;
        element.classList.remove('hidden');
        element.classList.remove('slide');
        var cssRuleValue = element[options.cssRuleRef] + 'px';

        element.style[options.cssRule] = cssRuleOriginalValue;

        window.requestAnimationFrame(function () {
            element.classList.add('slide');

            window.requestAnimationFrame(function () {
                element.style[options.cssRule] = cssRuleValue;

                if (options.startCallback) {
                    options.startCallback();
                }

                window.setTimeout(function () {
                    if (parseInt(element.dataset.slideId) !== slideId) return;

                    element.classList.remove('slide');
                    element.style[options.cssRule] = null;

                    if (options.finishCallback) {
                        window.requestAnimationFrame(options.finishCallback);
                    }
                }, 500);
            });
        });
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
            var tag = (rtagName.exec(html) || ["", ""])[1].toLowerCase(),
                wrap = wrapMap[tag] || wrapMap._default;

            tmp.innerHTML = wrap[1] + html.replace(rxhtmlTag, "<$1></$2>" ) + wrap[2];

            // descend through wrappers to the right content
            var j = wrap[0];
            while (j--) tmp = tmp.lastChild;

            return (tmp.childNodes.length) > 1 ? tmp : tmp.lastChild;
        }
    };

    utils.matches = function (element, selector) {
        if (element.matches) {
            return element.matches(selector);
        } else if (element.webkitMatchesSelector) {
            return element.webkitMatchesSelector(selector);
        } else if (element.msMatchesSelector) {
            return element.msMatchesSelector(selector);
        } else {
            console.error('Unable to call utils.matches(…): Not supported');
            return false;
        }
    };

    utils.closest = function (element, selector) {
        if (element.closest) {
            return element.closest(selector);
        }

        do {
            if (utils.matches(element, selector)) {
                return element;
            }
        } while ((element = element.parentElement) !== null);

        return null;
    };
})();
