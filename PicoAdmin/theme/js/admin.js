function PicoAdmin(baseUrl)
{
    this._baseUrl = baseUrl;

    this.modules = {};

    this._activeModule = 'landing';
    this._activePath = null;

    this._currentState = null;
    this._latestState = null;

    this._notification = null;
    this._inhibitor = null;
    this._loading = null;

    this._notifications = [];
}

utils.createClass(PicoAdmin, function () {
    this.prototype.init = function ()
    {
        this._initHistory();
        this._initNavigation();

        this._notification = utils.parse('<div id="notification"></div>');
        document.body.appendChild(this._notification);

        this._inhibitor = utils.parse('<div id="inhibitor" class="hidden"></div>');
        document.body.appendChild(this._inhibitor);

        this._loading = utils.parse('<div id="loading"><div class="glow"></div></div>');
        document.body.appendChild(this._loading);
    };

    this.prototype.selectModule = function (activeModule, activePath, intermediateCallback)
    {
        var oldModule = this._activeModule ? this.modules[this._activeModule] : null,
            newModule = activeModule ? this.modules[activeModule] : null;

        // disable old module
        if (oldModule && (!newModule || (oldModule.getName() !== newModule.getName()))) {
            oldModule.disable();
        }

        // call intermediate callback
        if (intermediateCallback) {
            intermediateCallback(oldModule, newModule);
        }

        // enable new module
        if (newModule) {
            if (!oldModule || (oldModule.getName() !== newModule.getName())) {
                newModule.enable();
            }

            // actually select module and path
            this._activeModule = newModule.getName();
            this.selectPath(activePath);
        } else {
            this._activeModule = null;
            this._activePath = null;
        }

        // cross-fade old and new module page
        if (oldModule ? (!newModule || (oldModule.getName() !== newModule.getName())) : !!newModule) {
            window.requestAnimationFrame(function () {
                utils.crossFade(
                    oldModule ? oldModule.getContainer() : document.getElementById('landing'),
                    newModule ? newModule.getContainer() : document.getElementById('landing')
                );
            });
        }
    };

    this.prototype.selectPath = function (path)
    {
        this._activePath = path || null;

        var module = this.modules[this._activeModule];
        if (module) {
            module.selectPath(path);
        }
    };

    this.prototype.getActiveModule = function ()
    {
        return this._activeModule;
    };

    this.prototype.getActivePath = function ()
    {
        return this._activePath;
    };

    this.prototype.takeOver = function (moduleName, path, takeOverOptions, restoreOptions)
    {
        var module = this.modules[moduleName];

        if (!module) {
            throw 'Unable to call PicoAdmin.takeOver(): Module "' + moduleName + '" not found';
        }

        module.enable();

        this._activeModule = moduleName;
        this.selectPath(path);

        if (!module.restore.apply(module, restoreOptions || [])) {
            module.takeOver.apply(module, takeOverOptions || []);
            this.replaceHistory();
        }
    };

    this.prototype._initHistory = function ()
    {
        var self = this;

        // restore old page states when navigating back/forward
        // without the need of reloading the page
        window.addEventListener('popstate', function (event) {
            if (self._currentState === self._latestState) {
                // navigating away from latest page; update history object
                // TODO: open question: is this (explicitly added) limitation really favored?
                self.updateHistory({ url: self.getHistoryObject(self._currentState).url });
            }

            if (event.state && event.state.PicoAdmin) {
                self.restoreHistory(event.state.PicoAdmin);
            }
        });

        // update page state before navigating to another page
        window.addEventListener('beforeunload', function (event) {
            self.updateHistory();
        });

        // restore up to 10 page states of a previous session
        this._latestState = parseInt(sessionStorage.getItem('PicoAdminHistory')) || null;
        if (!this._latestState) {
            this._currentState = this._latestState = 1;
            sessionStorage.setItem('PicoAdminHistory', this._latestState);

            this.replaceHistory();
        } else {
            var currentHistoryObject = this.createHistoryObject(),
                historyAction = 'replaceState',
                historyObject = null;

            this._currentState = Math.max(0, this._latestState - 10);
            do {
                this._currentState++;
                historyObject = this.getHistoryObject(this._currentState);
                if (!historyObject.isLost) {
                    window.history[historyAction](
                        { PicoAdmin: this._currentState },
                        historyObject.title,
                        '/' + historyObject.url.replace(/^(?:https?:\/\/[^/]+)?(?:\/)?/, '')
                    );
                    historyAction = 'pushState';
                }
            } while (this._currentState < this._latestState);

            // did the server session expire accidently?
            // if true, throw away the initial page state and let the module restore the previous state
            var oldHistoryObject = this.getHistoryObject(this._latestState);
            if (oldHistoryObject && oldHistoryObject.sessionExpired) {
                var urlRegExp = /^(?:https?:\/\/[^/?#]*)?(?:\/)?(.*?)(?:#.*)?$/,
                    oldUrl = oldHistoryObject.url.replace(urlRegExp, '/$1'),
                    currentUrl = window.location.href.replace(urlRegExp, '/$1');

                if (oldUrl === currentUrl) {
                    return;
                }
            }

            this.pushHistory(currentHistoryObject);
        }
    };

    this.prototype.pushHistory = function (historyObject)
    {
        // mark unreachable history states as lost
        if (this._currentState < this._latestState) {
            for (var lostState = (this._currentState + 1); lostState <= this._latestState; lostState++) {
                var lostStateObject = this.getHistoryObject(lostState);
                utils.extend(lostStateObject, { isLost: true });
                setHistoryObject.call(this, lostState, lostStateObject);
            }
        }

        // push new history state
        pushHistoryState.call(this, utils.extend(
            { lastUpdate: (new Date()).getTime() },
            this.createHistoryObject(),
            historyObject || {}
        ));
    };

    function pushHistoryState(historyObject)
    {
        this._latestState++;
        setHistoryObject.call(this, this._latestState, historyObject);
        this._currentState = this._latestState;

        window.history.pushState(
            { PicoAdmin: this._currentState },
            historyObject.title,
            '/' + historyObject.url.replace(/^(?:https?:\/\/[^/]+)?(?:\/)?/, '')
        );

        sessionStorage.setItem('PicoAdminHistory', this._latestState);
    }

    this.prototype.replaceHistory = function (historyObject)
    {
        replaceHistoryState.call(this, utils.extend(
            { lastUpdate: (new Date()).getTime() },
            this.createHistoryObject(),
            historyObject || {}
        ));
    };

    this.prototype.updateHistory = function (historyObject)
    {
        replaceHistoryState.call(this, utils.extend(
            { lastUpdate: (new Date()).getTime() },
            this.getHistoryObject(this._currentState) || {},
            this.createHistoryObject(),
            historyObject || {}
        ));
    };

    function replaceHistoryState(historyObject)
    {
        var oldHistoryObject = this.getHistoryObject(this._currentState);
        setHistoryObject.call(this, this._currentState, historyObject);

        // replace the history object only when necessary
        var isDifferentState = !oldHistoryObject;
        isDifferentState = isDifferentState || (historyObject.title !== oldHistoryObject.title);
        isDifferentState = isDifferentState || (historyObject.url !== oldHistoryObject.url);
        if (isDifferentState) {
            // make sure we don't accidently replace other states than the expected
            // this e.g. happens when navigating back accross modules (PicoAdminModule.disable() via popstate event)
            var historyState = window.history.state;
            if (!historyState || !historyState.PicoAdmin || (historyState.PicoAdmin == this._currentState)) {
                window.history.replaceState(
                    { PicoAdmin: this._currentState },
                    historyObject.title,
                    '/' + historyObject.url.replace(/^(?:https?:\/\/[^/]+)?(?:\/)?/, '')
                );
            }
        }
    }

    this.prototype.restoreHistory = function (state)
    {
        var historyObject = this.getHistoryObject(state),
            self = this;

        // select module and path
        this.selectModule(historyObject.activeModule, historyObject.activePath, function () {
            self._currentState = state;
        });

        // update title
        document.title = historyObject.title;

        // let the new module handle everything else
        var module = this.modules[historyObject.activeModule];
        if (module) {
            module.setState(historyObject);
        }
    };

    this.prototype.createHistoryObject = function ()
    {
        var historyObject = {
            activeModule: this._activeModule,
            activePath: this._activePath,
            title: document.title,
            url: window.location.href
        };

        var module = this.modules[this._activeModule];
        if (module) {
            historyObject = utils.extend(historyObject, module.getState());
        }

        return historyObject;
    };

    this.prototype.getHistoryObject = function (state)
    {
        return JSON.parse(sessionStorage.getItem('PicoAdminHistory' + state) || 'null');
    };

    function setHistoryObject(state, historyObject)
    {
        sessionStorage.setItem('PicoAdminHistory' + state, JSON.stringify(historyObject));
    }

    this.prototype.getCurrentState = function ()
    {
        return this._currentState;
    };

    this.prototype.getLatestState = function ()
    {
        return this._latestState;
    };

    this.prototype._initNavigation = function ()
    {
        var landingPageButton = document.querySelector('#module-landing-nav .headline h3 a'),
            self = this;

        utils.addNamedEventListener(landingPageButton, 'click', 'open', function (event) {
            event.preventDefault();

            self.selectModule('landing');
            self.pushHistory();
        });
    };

    this.prototype.showNotification = function (title, message, options)
    {
        options = options || {};
        if ((options.timeout === undefined) || (options.timeout === null)) {
            options.timeout = 5;
        }
        if ((options.closeable === undefined) || (options.closeable === null)) {
            options.closeable = true;
        }

        var className = '',
            iconName = '';
        if (typeof(options.type) === 'object') {
            className = options.type.className ? ' ' + options.type.className : '';
            iconName = options.type.iconName ? ' ' + options.type.iconName : '';
        } else if (options.type) {
            switch (options.type) {
                case 'success':
                    className = ' alert-success';
                    iconName = ' fa-check';
                    break;

                case 'info':
                    className = ' alert-info';
                    iconName = ' fa-info';
                    break;

                case 'warning':
                    className = ' alert-warning';
                    iconName = ' fa-exclamation-triangle';
                    break;

                case 'error':
                    className = ' alert-error';
                    iconName = ' fa-ban';
                    break;
            }
        }

        var alert = utils.parse('<div class="alert' + className + ' hidden" role="alert"></div>');
        this._notification.appendChild(alert);

        var notificationId = this._notifications.length,
            notificationData = utils.extend({}, options);
        this._notifications.push(notificationData);
        alert.dataset.notificationId = notificationId;

        if ((title !== undefined) && (title !== null)) {
            alert.appendChild(utils.parse('<h1><span class="fa' + iconName + ' fa-fw"></span> ' + title + '</h1>'));
        }

        if ((message !== undefined) && (message !== null)) {
            if (typeof message === 'string') {
                alert.appendChild(utils.parse('<p>' + message + '</p>'));
            } else {
                alert.appendChild(message);
            }
        }

        if (options.button) {
            alert.appendChild(utils.parse(
                '<a href="' + options.button.href + '" class="button" role="button">' +
                '    <span class="fa ' + options.button.iconName + '" aria-hidden="true"></span>' +
                '    <span>' + options.button.title + '</span>' +
                '</a>'
            ));
        }

        var addCloseButton = options.closeable,
            self = this;
        if (options.timeout > 0) {
            if (options.timeout >= 100) {
                var timeoutCallback = this.hideNotification.bind(this, alert);
                notificationData.timerTimeout = setTimeout(timeoutCallback, (options.timeout * 1000));
            } else {
                var dismiss;
                if (options.closeable) {
                    dismiss = utils.parse(
                        '<a href="" class="dismiss countdown closeable" role="button">' +
                        '    <span class="close" aria-hidden="true">&times;</span>' +
                        '    <span class="timer" aria-hidden="true">' + options.timeout + '</span>' +
                        '    <span class="sr-only">Close</span>' +
                        '</a>'
                    );
                } else {
                    dismiss = utils.parse(
                        '<span class="dismiss countdown">' +
                        '    <span class="timer" aria-hidden="true">' + options.timeout + '</span>' +
                        '</span>'
                    );
                }

                alert.appendChild(dismiss);
                addCloseButton = false;

                notificationData.timerInterval = setInterval(function () {
                    if (dismiss.classList.contains('pause')) {
                        return;
                    }

                    var valueElement = dismiss.querySelector('.timer'),
                        value = parseInt(valueElement.textContent);

                    if (value > 0) {
                        valueElement.textContent = value - 1;
                    }
                    if (value === 1) {
                        self.hideNotification(alert);
                    }
                }, 1000);

                if (options.closeable) {
                    dismiss.addEventListener('click', function (event) {
                        event.preventDefault();
                        self.hideNotification(alert);
                    });
                }

                alert.addEventListener('mouseenter', function (event) {
                    dismiss.classList.add('pause');
                });
                alert.addEventListener('mouseleave', function (event) {
                    dismiss.classList.remove('pause');
                });
            }
        }

        if (addCloseButton) {
            var closeButton = utils.parse(
                '<a href="" class="dismiss closeable" role="button">' +
                '    <span class="close" aria-hidden="true">&times;</span>' +
                '    <span class="sr-only">Close</span>' +
                '</a>'
            );
            closeButton.addEventListener('click', function (event) {
                event.preventDefault();
                self.hideNotification(alert);
            });
            alert.appendChild(closeButton);
        }

        utils.slideDown(alert);
        return alert;
    };

    this.prototype.hideNotification = function (alert)
    {
        var notificationId = alert.dataset.notificationId;
        if (notificationId) {
            var notificationData = this._notifications[notificationId];

            if (notificationData.closeCallback) {
                if (notificationData.closeCallback(alert) === false) {
                    return false;
                }
            }

            delete this._notifications[notificationId];
            delete alert.dataset.notificationId;

            if (notificationData.timerTimeout) {
                clearTimeout(notificationData.timerTimeout);
            }
            if (notificationData.timerInterval) {
                clearInterval(notificationData.timerInterval);
            }

            utils.slideUp(alert, function () {
                alert.parentNode.removeChild(alert);
            });

            return true;
        }

        return false;
    };

    this.prototype.showInhibitor = function ()
    {
        var layers = parseInt(this._inhibitor.dataset.layers) || 0;
        this._inhibitor.dataset.layers = layers + 1;
        utils.fade(this._inhibitor, { fadeTo: 0.5, reset: false });

        if (layers === 0) {
            utils.addNamedEventListener(document.body, 'keypress', 'inhibitor', function (event) {
                event.preventDefault();
            });
        }
    };

    this.prototype.hideInhibitor = function ()
    {
        var layers = parseInt(this._inhibitor.dataset.layers) || 0;
        if (layers > 0) {
            this._inhibitor.dataset.layers = layers - 1;

            if (layers === 1) {
                utils.fadeOut(this._inhibitor);
                utils.removeNamedEventListener(document.body, 'keypress', 'inhibitor');
            }
        }
    };

    this.prototype.showLoading = function ()
    {
        this._loading.dataset.requests = (parseInt(this._loading.dataset.requests) || 0) + 1;

        if (this._loading.classList.contains('finish')) {
            window.clearTimeout(this._loading.dataset.timeout);
            delete this._loading.dataset.timeout;

            this._loading.classList.remove('finish');

            this._loading.classList.add('wait');
            this._loading.style.width = (50 + Math.random() * 30) + '%';
        } else if (!this._loading.classList.contains('wait')) {
            this._loading.classList.add('wait');
            this._loading.style.width = (50 + Math.random() * 30) + '%';
        }
    };

    this.prototype.hideLoading = function ()
    {
        var requests = parseInt(this._loading.dataset.requests) || 0;
        if (requests > 0) {
            this._loading.dataset.requests = requests - 1;

            if (requests === 1) {
                this._loading.classList.remove('wait');
                this._loading.classList.add('finish');
                this._loading.style.width = null;

                var self = this;
                this._loading.dataset.timeout = window.setTimeout(function () {
                    self._loading.classList.remove('finish');
                    delete self._loading.dataset.timeout;
                }, 800);
            }
        }
    };

    this.prototype.ajax = function (module, action, payload, options)
    {
        var self = this;

        this.showLoading();

        var completeCallback = options.complete;
        options.complete = function (xhr, statusText, response, isSuccessful) {
            self.hideLoading();

            if (completeCallback) {
                completeCallback(xhr, statusText, response, isSuccessful);
            }
        };

        var errorCallback = options.error;
        options.error = function (xhr, statusText, response) {
            var errorNotification = null;

            if (utils.isPlainObject(response)) {
                if (response.error) {
                    errorNotification = response.error;
                } else if (xhr.status === 401) {
                    if ((response.admin_auth !== undefined) && (response.admin_auth_required !== undefined)) {
                        if (response.admin_auth_required && !response.admin_auth) {
                            errorNotification = {
                                title: 'Session Expired',
                                message: "For security reasons you have to login again. We'll save your changes, " +
                                    "however, the action that lead to this error has not been taken.",
                                button: { title: 'Login', iconName: 'fa-sign-in', href: '' },
                                closeable: false
                            };

                            // show inhibitor
                            self.showInhibitor();

                            // mark state as expired to restore it after logging in again
                            self.updateHistory({ sessionExpired: true });
                        }
                    }
                }
            }

            if (!errorNotification) {
                errorNotification = {
                    title: 'Unknown Error',
                    message: 'An unexpected error has occured.'
                };

                if ((xhr.status >= 400) && (xhr.status < 600)) {
                    errorNotification.title = '' + xhr.status + ' ' + statusText;
                }
            }

            self.showNotification(errorNotification.title, errorNotification.message, {
                type: errorNotification.type || 'error',
                button: errorNotification.button,
                timeout: errorNotification.timeout || 0,
                closeable: errorNotification.closeable
            });

            if (errorCallback) {
                errorCallback(xhr, statusText, response);
            }
        };

        return utils.ajax(this.getUrl(module, action, payload), options);
    };

    this.prototype.getUrl = function (module, action, payload, queryParams)
    {
        var url = this._baseUrl;

        if (module) {
            url += '/' + module;
            if (action) {
                url += '/' + action;
                if (payload) {
                    url += '/' + (Array.isArray(payload) ? payload.join('/') : payload);
                }
            }
        }

        if (queryParams) {
            var queryString = utils.encodeUriParams(queryParams);
            url += queryString ? '?' + queryString : '';
        }

        return url;
    };
});
