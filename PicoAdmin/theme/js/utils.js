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

    utils.multiCallback = function (finishCallback) {
        var callbackStatusList = [],
            finishedCallbackCount = 0;

        return function (intermediateCallback) {
            var callbackId = callbackStatusList.length;
            var callback = function () {
                if (!callbackStatusList[callbackId]) {
                    callbackStatusList[callbackId] = true;
                    finishedCallbackCount++;

                    if (intermediateCallback) {
                        intermediateCallback();
                    }
                    if (finishedCallbackCount >= callbackStatusList.length) {
                        finishCallback();
                    }
                }
            };

            callbackStatusList.push(false);
            return callback;
        };
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
            if (options.responseType === 'text') xhr.setRequestHeader('Accept', 'text/plain');
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
            if (callback) window.requestAnimationFrame(callback);
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
        utils.fade(element, {
            fadeTo: '0',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.fadeIn = function (element, finishCallback, startCallback) {
        utils.fade(element, {
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.fade = function (element, options) {
        var fadeFrom = options.fadeFrom,
            fadeTo = options.fadeTo;

        if ((options.fadeFrom === undefined) || (options.fadeFrom === null)) {
            fadeFrom = !element.classList.contains('hidden') && window.getComputedStyle(element).opacity || '0';
        }
        if ((options.fadeTo === undefined) || (options.fadeTo === null)) {
            fadeTo = '1';
        }

        element.classList.remove('fade');
        element.classList.remove('hidden');
        element.style.opacity = fadeFrom;

        window.requestAnimationFrame(function () {
            element.classList.add('fade');

            window.requestAnimationFrame(function () {
                element.style.opacity = fadeTo;

                if (options.startCallback) {
                    options.startCallback();
                }

                utils.addNamedEventListener(element, 'transitionend', 'fade', function (event) {
                    if (event.propertyName !== 'opacity') return;
                    utils.removeNamedEventListener(element, 'transitionend', 'fade');

                    element.classList.remove('fade');
                    element.classList.remove('slow');
                    if (options.reset || (options.reset === undefined)) {
                        element.style.opacity = null;

                        if (fadeTo == '0') {
                            element.classList.add('hidden');
                        }
                    }

                    if (options.finishCallback) {
                        window.requestAnimationFrame(options.finishCallback);
                    }
                });
            });
        });
    };

    utils.slideUp = function (element, finishCallback, startCallback) {
        utils.slide(element, {
            slideTo: '0px',
            cssRule: 'height',
            cssRuleRef: 'offsetHeight',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slideDown = function (element, finishCallback, startCallback) {
        utils.slide(element, {
            cssRule: 'height',
            cssRuleRef: 'offsetHeight',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slideLeft = function (element, finishCallback, startCallback) {
        utils.slide(element, {
            slideTo: '0px',
            cssRule: 'width',
            cssRuleRef: 'offsetWidth',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slideRight = function (element, finishCallback, startCallback) {
        utils.slide(element, {
            cssRule: 'width',
            cssRuleRef: 'offsetWidth',
            startCallback: startCallback,
            finishCallback: finishCallback
        });
    };

    utils.slide = function (element, options) {
        var slideFrom = options.slideFrom,
            slideTo = options.slideTo;

        if ((options.slideFrom === undefined) || (options.slideFrom === null)) {
            slideFrom = element[options.cssRuleRef] + 'px';
        }

        element.classList.remove('slide');
        element.classList.remove('hidden');

        if ((options.slideTo === undefined) || (options.slideTo === null)) {
            element.style[options.cssRule] = null;
            slideTo = element[options.cssRuleRef] + 'px';
        }

        element.style[options.cssRule] = slideFrom;

        window.requestAnimationFrame(function () {
            element.classList.add('slide');

            window.requestAnimationFrame(function () {
                element.style[options.cssRule] = slideTo;

                if (options.startCallback) {
                    options.startCallback();
                }

                utils.addNamedEventListener(element, 'transitionend', 'slide-' + options.cssRule, function (event) {
                    if (event.propertyName !== options.cssRule) return;
                    utils.removeNamedEventListener(element, 'transitionend', 'slide-' + options.cssRule);

                    element.classList.remove('slide');
                    if (options.reset || (options.reset === undefined)) {
                        element.style[options.cssRule] = null;

                        if (slideTo === '0px') {
                            element.classList.add('hidden');
                        }
                    }

                    if (options.finishCallback) {
                        window.requestAnimationFrame(options.finishCallback);
                    }
                });
            });
        });
    };

    utils.crossFade = function (hideElement, showElement, finishCallback, startCallback) {
        if (
            !hideElement || !showElement || (hideElement === showElement) ||
            !hideElement.parentNode || (hideElement.parentNode !== showElement.parentNode)
        ) {
            throw 'Unable to call utils.crossFade(…): The given elements must be siblings';
        }

        var parentElement = hideElement.parentNode,
            placeholderElement = null;
        for (var i = 0, childElement; i < parentElement.children.length; i++) {
            childElement = parentElement.children[i];

            if (!placeholderElement && childElement.classList.contains('cross-fade-placeholder')) {
                placeholderElement = childElement;
                continue;
            }

            if (!utils.isElementVisible(childElement) || childElement.classList.contains('cross-fade-hide')) {
                if (childElement !== hideElement) continue;
            } else {
                if (childElement === hideElement) continue;
            }

            throw 'Unable to call utils.crossFade(…): The element to hide must be the only visible sibling';
        }

        // get scroll position to restore it after we've detached the elements
        var scrollTop = window.pageYOffset;

        // get the initial parent element's dimensions
        var parentElementWidth = parentElement.offsetWidth,
            parentElementHeight = parentElement.offsetHeight;

        // prepare elements
        parentElement.classList.add('cross-fade');

        hideElement.classList.add('cross-fade-hide');
        hideElement.classList.remove('cross-fade-show');

        showElement.classList.add('cross-fade-show');
        showElement.classList.remove('cross-fade-hide');

        // detach element to hide, make sure element to show is attached
        utils.detach(hideElement);
        utils.attach(showElement);

        // let the parent element's dimensions smoothly change to those of the
        // element to show by either shrinking a placeholder element or growing
        // the element to show
        showElement.classList.remove('hidden');
        showElement.style.opacity = '0';

        var showElementWidth = showElement.offsetWidth,
            showElementHeight = showElement.offsetHeight;

        if (!placeholderElement) {
            placeholderElement = document.createElement('div');
            placeholderElement.classList.add('cross-fade-placeholder');
            placeholderElement.classList.add('hidden');
            parentElement.appendChild(placeholderElement);
        }

        if (parentElementWidth !== showElementWidth) {
            // there might be a unexpected horicontal slide due to appearing or
            // disapprearing scrollbars. we explicitly do *not* support large
            // width changes, as we always animate the element to show, what
            // might lead to a visible overexpansion or compression of its
            // contents. however, usually you don't want a width change anyway
            utils.slide(showElement, {
                slideFrom: parentElementWidth + 'px',
                slideTo: showElementWidth + 'px',
                cssRule: 'width',
                cssRuleRef: 'offsetWidth'
            });
        }
        if (parentElementHeight !== showElementHeight) {
            var slideOptions = {
                cssRule: 'height',
                cssRuleRef: 'offsetHeight'
            };

            if (parentElementHeight > showElementHeight) {
                showElement.style.height = showElementHeight + 'px';

                utils.slide(placeholderElement, utils.extend(slideOptions, {
                    slideFrom: (parentElementHeight - showElementHeight) + 'px',
                    slideTo: '0px',
                    finishCallback: function () {
                        showElement.style.height = null;
                    }
                }));
            } else {
                placeholderElement.classList.add('hidden');

                utils.slide(showElement, utils.extend(slideOptions, {
                    slideFrom: parentElementHeight + 'px',
                    slideTo: showElementHeight + 'px'
                }));
            }
        }

        // fade and reset elements
        var finishCallbackGenerator = utils.multiCallback(function () {
            parentElement.classList.remove('cross-fade');

            if (finishCallback) {
                window.requestAnimationFrame(finishCallback);
            }
        });

        hideElement.classList.add('slow');
        utils.fadeOut(hideElement, finishCallbackGenerator(function () {
            hideElement.classList.remove('cross-fade-hide');
            utils.attach(hideElement);
        }));

        showElement.classList.add('slow');
        utils.fadeIn(showElement, finishCallbackGenerator(function () {
            showElement.classList.remove('cross-fade-show');
        }));

        // restore scroll position
        window.scrollTo(window.pageXOffset, scrollTop);

        // execute start callback
        if (startCallback) {
            window.requestAnimationFrame(startCallback);
        }
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
            throw 'Unable to call utils.matches(…): Not supported';
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
