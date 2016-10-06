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

    utils.detach = function (element, callback) {
        if (element.classList.contains('detached')) {
            if (callback) callback();
            return;
        }

        var isHidden = element.classList.contains('hidden');
        if (isHidden) element.classList.remove('hidden');

        element.style.top = element.offsetTop + 'px';
        element.style.left = element.offsetLeft + 'px';
        element.style.width = element.offsetWidth + 'px';
        element.style.height = element.offsetHeight + 'px';

        element.classList.add('detached');
        if (isHidden) element.classList.add('hidden');

        if (callback) {
            window.requestAnimationFrame(callback);
        }
    };

    utils.attach = function (element, callback) {
        element.style.height = null;
        element.style.width = null;
        element.style.left = null;
        element.style.top = null;
        element.classList.remove('detached');

        if (callback) {
            window.requestAnimationFrame(callback);
        }
    };

    utils.fadeOut = function (element, finishCallback, startCallback) {
        element.style.opacity = window.getComputedStyle(element).opacity || '1';
        element.classList.remove('fade');

        var fadeId = parseInt(element.dataset.fadeId) || 0;
        element.dataset.fadeId = ++fadeId;

        window.requestAnimationFrame(function () {
            element.classList.add('fade');

            window.requestAnimationFrame(function () {
                element.style.opacity = '0';

                if (startCallback) {
                    startCallback();
                }

                window.setTimeout(function () {
                    if (parseInt(element.dataset.fadeId) !== fadeId) return;

                    element.classList.add('hidden');
                    element.classList.remove('fade');
                    element.classList.remove('slow');
                    element.style.opacity = null;

                    if (finishCallback) {
                        window.requestAnimationFrame(finishCallback);
                    }
                }, element.classList.contains('slow') ? 600 : 300);
            });
        });
    };

    utils.fadeIn = function (element, finishCallback, startCallback) {
        var fadeId = parseInt(element.dataset.fadeId) || 0;
        element.dataset.fadeId = ++fadeId;

        if (element.classList.contains('hidden')) {
            element.style.opacity = '0';
            element.classList.remove('hidden');
        } else {
            element.style.opacity = window.getComputedStyle(element).opacity || '0';
        }
        element.classList.remove('fade');

        window.requestAnimationFrame(function () {
            element.classList.add('fade');
            window.requestAnimationFrame(function () {
                element.style.opacity = '1';

                if (startCallback) {
                    startCallback();
                }

                window.setTimeout(function () {
                    if (parseInt(element.dataset.fadeId) !== fadeId) return;

                    element.classList.remove('fade');
                    element.classList.remove('slow');
                    element.style.opacity = null;

                    if (finishCallback) {
                        window.requestAnimationFrame(finishCallback);
                    }
                }, element.classList.contains('slow') ? 600 : 300);
            });
        });
    };

    utils.slideUp = function (element, finishCallback, startCallback) {
        utils.slideOut(element, {
            cssRule: 'height',
            cssRuleRef: 'offsetHeight',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slideDown = function (element, finishCallback, startCallback) {
        utils.slideIn(element, {
            cssRule: 'height',
            cssRuleRef: 'offsetHeight',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slideLeft = function (element, finishCallback, startCallback) {
        utils.slideOut(element, {
            cssRule: 'width',
            cssRuleRef: 'offsetWidth',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slideRight = function (element, finishCallback, startCallback) {
        utils.slideIn(element, {
            cssRule: 'width',
            cssRuleRef: 'offsetWidth',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slideOut = function (element, options) {
        element.style[options.cssRule] = element[options.cssRuleRef] + 'px';
        element.classList.remove('slide');

        var slideId = parseInt(element.dataset.slideId) || 0;
        element.dataset.slideId = ++slideId;

        window.requestAnimationFrame(function () {
            element.classList.add('slide');

            window.requestAnimationFrame(function () {
                element.style[options.cssRule] = (options.cssRuleValue || 0) + 'px';

                if (options.startCallback) {
                    options.startCallback();
                }

                window.setTimeout(function () {
                    if (parseInt(element.dataset.slideId) !== slideId) return;

                    element.classList.remove('slide');
                    if (options.cssRuleReset || (options.cssRuleReset === undefined)) {
                        element.classList.add('hidden');
                        element.style[options.cssRule] = null;
                    }

                    if (options.finishCallback) {
                        window.requestAnimationFrame(options.finishCallback);
                    }
                }, 600);
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
        var cssRuleValue = (options.cssRuleValue || element[options.cssRuleRef]) + 'px';

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
                    if (options.cssRuleReset || (options.cssRuleReset === undefined)) {
                        element.style[options.cssRule] = null;
                    }

                    if (options.finishCallback) {
                        window.requestAnimationFrame(options.finishCallback);
                    }
                }, 600);
            });
        });
    };

    utils.crossFade = function (element1, element2, finishCallback, startCallback) {
        var hideElement, showElement;
        if (!element1 || !element2 || (element1.parentNode !== element2.parentNode) || (element1 === element2)) {
            throw 'Unable to call utils.crossFade(…): The given elements must be siblings';
        }

        var parentElement = element1.parentNode;
        for (var i = 0, childElement; i < parentElement.children.length; i++) {
            childElement = parentElement.children[i];
            if ((childElement === element1) || (childElement === element2)) {
                if (!utils.isElementVisible(childElement) || childElement.classList.contains('cross-fade-hide')) {
                    if (showElement === undefined) {
                        showElement = childElement;
                        continue;
                    }
                } else if (hideElement === undefined) {
                    hideElement = childElement;
                    continue;
                }
            } else if (!utils.isElementVisible(childElement) || childElement.classList.contains('cross-fade-hide')) {
                continue;
            }

            throw 'Unable to call utils.crossFade(…): One of the given elements must be the only visible child';
        }

        // get scroll position to restore it after we've detached the elements
        var scrollTop = window.pageYOffset;

        // reset the parent element's dimensions
        var parentElementWidth = parentElement.offsetWidth,
            parentElementHeight = parentElement.offsetHeight;
        parentElement.style.width = null;
        parentElement.style.height = null;

        // prepare elements
        parentElement.classList.add('cross-fade');
        var crossFadeId = parseInt(parentElement.dataset.crossFadeId) || 0;
        parentElement.dataset.crossFadeId = ++crossFadeId;

        hideElement.classList.add('cross-fade-hide');
        hideElement.classList.remove('cross-fade-show');
        var hideElementCrossFadeId = parseInt(hideElement.dataset.crossFadeId) || 0;
        hideElement.dataset.crossFadeId = ++hideElementCrossFadeId;

        showElement.classList.add('cross-fade-show');
        showElement.classList.remove('cross-fade-hide');

        var resetParentElement = function () {
            parentElement.classList.remove('cross-fade');
            parentElement.style.width = null;
            parentElement.style.height = null;
        };
        var resetHideElement = function () {
            if (parseInt(hideElement.dataset.crossFadeId) !== hideElementCrossFadeId) return;
            hideElement.classList.remove('cross-fade-hide');
            utils.attach(hideElement);
        };
        var resetShowElement = function () {
            showElement.classList.remove('cross-fade-show');
            utils.attach(showElement);
        };

        // detach elements
        utils.detach(hideElement);
        utils.detach(showElement);

        // let the parent element's dimensions smoothly change to those of the element to show
        var showElementWidth = parseInt(showElement.style.width.replace(/px$/, '')),
            showElementHeight = parseInt(showElement.style.height.replace(/px$/, ''));

        parentElement.style.width = parentElementWidth + 'px';
        parentElement.style.height = parentElementHeight + 'px';

        if (parentElementWidth !== showElementWidth) {
            var slideHoricontalOptions = {
                cssRule: 'width',
                cssRuleRef: 'offsetWidth',
                cssRuleReset: false,
                cssRuleValue: showElementWidth
            };

            if (parentElementWidth > showElementWidth) {
                utils.slideOut(parentElement, slideHoricontalOptions);
            } else {
                utils.slideIn(parentElement, slideHoricontalOptions);
            }
        }
        if (parentElementHeight !== showElementHeight) {
            var slideVerticalOptions = {
                cssRule: 'height',
                cssRuleRef: 'offsetHeight',
                cssRuleReset: false,
                cssRuleValue: showElementHeight,
            };

            if (parentElementHeight > showElementHeight) {
                utils.slideOut(parentElement, slideVerticalOptions);
            } else {
                utils.slideIn(parentElement, slideVerticalOptions);
            }
        }

        window.requestAnimationFrame(function () {
            // restore scroll position
            window.scrollTo(window.pageXOffset, scrollTop);

            // do fading and reset the elements
            hideElement.classList.add('slow');
            utils.fadeOut(hideElement, resetHideElement, function () {
                if (parseInt(parentElement.dataset.crossFadeId) !== crossFadeId) return;

                showElement.classList.add('slow');
                utils.fadeIn(showElement, function () {
                    if (parseInt(parentElement.dataset.crossFadeId) !== crossFadeId) return;

                    resetShowElement();
                    resetParentElement();

                    if (finishCallback) {
                        window.requestAnimationFrame(finishCallback);
                    }
                }, startCallback);
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

    utils.isElementVisible = function (element) {
        return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
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

    var namedEventListener = {};

    function getNamedEventListener(element, type, name) {
        var elementEventId = element.dataset.eventId;

        if (!elementEventId) return null;
        if (!namedEventListener[elementEventId]) return null;
        if (!namedEventListener[elementEventId][type]) return null;
        if (!namedEventListener[elementEventId][type][name]) return null;

        return namedEventListener[elementEventId][type][name];
    }

    utils.addNamedEventListener = function (element, type, name, listener) {
        var elementEventId = element.dataset.eventId;
        if (!elementEventId) {
            do {
                elementEventId = Math.floor(Math.random() * 10000000 + 10000000).toString();
            } while (namedEventListener[elementEventId]);
        }

        if (!namedEventListener[elementEventId]) namedEventListener[elementEventId] = {};
        if (!namedEventListener[elementEventId][type]) namedEventListener[elementEventId][type] = {};

        if (namedEventListener[elementEventId][type][name]) {
            // remove a previously added, conflicting event (event names must be unique)
            element.removeEventListener(type, namedEventListener[elementEventId][type][name]);
        }
        namedEventListener[elementEventId][type][name] = listener;

        element.dataset.eventId = elementEventId;
        element.addEventListener(type, listener);
    };

    utils.removeNamedEventListener = function (element, type, name) {
        var listener = getNamedEventListener(element, type, name);
        if (listener) {
            element.removeEventListener(type, listener);
            delete namedEventListener[element.dataset.eventId][type][name];
        }
    };

    utils.enableNamedEventListener = function (element, type, name) {
        var listener = getNamedEventListener(element, type, name);
        if (listener) {
            // browsers won't add the same event listener multiple times, thus this is completely safe
            element.addEventListener(type, listener);
        }
    };

    utils.disableNamedEventListener = function (element, type, name) {
        var listener = getNamedEventListener(element, type, name);
        if (listener) {
            element.removeEventListener(type, listener);
        }
    };
})();
