function PicoAdmin(baseUrl)
{
    this.baseUrl = baseUrl;

    this.modules = {};

    this.activeModule = 'landing';
    this.activePath = null;

    this.currentState = null;
    this.latestState = null;

    this.notifications = [];
}

utils.createClass(PicoAdmin, function () {
    this.prototype.init = function ()
    {
        this.initNotification();
        this.initInhibitor();
        this.initLoading();
        this.initHistory();
    };

    this.prototype.registerModule = function (moduleName, instance)
    {
        this.modules[moduleName] = instance;
    };

    this.prototype.selectModule = function (activeModule, activePath, intermediateCallback)
    {
        var landingPage = document.getElementById('landing'),
            oldModule = this.activeModule ? this.modules[this.activeModule] : null,
            oldModulePage = oldModule ? document.getElementById('module-' + oldModule.moduleName) : landingPage,
            newModule = activeModule ? this.modules[activeModule] : null,
            newModulePage = newModule ? document.getElementById('module-' + newModule.moduleName) : landingPage;

        // disable old module
        if (oldModule && (!newModule || (oldModule.moduleName !== newModule.moduleName))) {
            oldModule.disable();
        }

        // call intermediate callback
        if (intermediateCallback) {
            intermediateCallback(oldModule, newModule);
        }

        // enable new module
        if (newModule) {
            if (!oldModule || (oldModule.moduleName !== newModule.moduleName)) {
                newModule.enable();
            }

            // actually select module and path
            this.activeModule = newModule.moduleName;
            this.selectPath(activePath);
        } else {
            this.activeModule = null;
            this.activePath = null;
        }

        // cross-fade old and new module page
        if (oldModulePage && newModulePage) {
            window.requestAnimationFrame(function () {
                try {
                    utils.crossFade(oldModulePage, newModulePage);
                } catch (e) {}
            });
        }
    };

    this.prototype.selectPath = function (path)
    {
        this.activePath = path || null;

        var module = this.modules[this.activeModule];
        if (module) {
            module.selectPath(path);
        }
    };

    this.prototype.initHistory = function ()
    {
        var self = this;

        // restore old page states when navigating back/forward
        // without the need of reloading the page
        window.addEventListener('popstate', function (event) {
            if (self.currentState === self.latestState) {
                // navigating away from latest page; update history object
                // TODO: open question: is this (explicitly added) limitation really favored?
                self.updateHistory({ url: self.getHistoryObject(self.currentState).url });
            }

            if (event.state && event.state.PicoAdmin) {
                self.restoreHistory(event.state.PicoAdmin);
            }
        });

        // users shouldn't use the browser's reload button
        window.addEventListener('beforeunload', function (event) {
            self.updateHistory();
        });

        // restore history objects of a previous session
        this.latestState = parseInt(sessionStorage.getItem('PicoAdminHistory')) || null;
        if (!this.latestState) {
            this.currentState = this.latestState = 1;
            sessionStorage.setItem('PicoAdminHistory', this.latestState);

            this.updateHistory();
        } else {
            var currentHistoryObject = this.createHistoryObject();

            this.currentState = 1;
            for (var historyObject; this.currentState <= this.latestState; this.currentState++) {
                historyObject = this.getHistoryObject(this.currentState);
                if (!historyObject.isLost) {
                    window.history.pushState(
                        { PicoAdmin: this.currentState },
                        historyObject.title,
                        '/' + historyObject.url.replace(/^(?:https?:\/\/[^/]+)?(?:\/)?/, '')
                    );
                }
            }

            this.pushHistory(currentHistoryObject);
        }
    };

    this.prototype.pushHistory = function (url, historyObject)
    {
        if (!historyObject) {
            historyObject = utils.isPlainObject(url) ? url : { url: url };
        } else if (url) {
            utils.extend(historyObject, { url: url });
        }

        // mark unreachable history states as lost
        if (this.currentState < this.latestState) {
            for (var lostState = (this.currentState + 1); lostState <= this.latestState; lostState++) {
                var lostStateObject = this.getHistoryObject(lostState);
                utils.extend(lostStateObject, { isLost: true });
                this.setHistoryObject(lostState, lostStateObject);
            }
        }

        // push new history state
        historyObject = utils.extend(
            { lastUpdate: (new Date()).getTime() },
            this.createHistoryObject(),
            historyObject
        );

        this.latestState++;
        this.setHistoryObject(this.latestState, historyObject);
        this.currentState = this.latestState;

        window.history.pushState(
            { PicoAdmin: this.currentState },
            historyObject.title,
            '/' + historyObject.url.replace(/^(?:https?:\/\/[^/]+)?(?:\/)?/, '')
        );

        // update number of history states
        sessionStorage.setItem('PicoAdminHistory', this.latestState);
    };

    this.prototype.updateHistory = function (historyObject)
    {
        historyObject = utils.extend(
            { lastUpdate: (new Date()).getTime() },
            this.createHistoryObject(),
            historyObject || {}
        );

        var oldHistoryObject = this.getHistoryObject(this.currentState);
        this.setHistoryObject(this.currentState, historyObject);

        // replace the history object only when necessary
        if (
            !oldHistoryObject
            || (historyObject.title !== oldHistoryObject.title)
            || (historyObject.url !== oldHistoryObject.url)
        ) {
            // make sure we don't accidently replace other states than the expected
            // this e.g. happens when navigating back accross modules (PicoContentAdmin.disable() via popstate event)
            var historyState = window.history.state;
            if (!historyState || !historyState.PicoAdmin || (historyState.PicoAdmin == this.currentState)) {
                window.history.replaceState(
                    { PicoAdmin: this.currentState },
                    historyObject.title,
                    '/' + historyObject.url.replace(/^(?:https?:\/\/[^/]+)?(?:\/)?/, '')
                );
            }
        }
    };

    this.prototype.restoreHistory = function (state)
    {
        var historyObject = this.getHistoryObject(state),
            self = this;

        // select module and path
        this.selectModule(historyObject.activeModule, historyObject.activePath, function () {
            self.currentState = state;
        });

        // update title
        document.title = historyObject.title;

        // transfer responsibility to the new module
        var module = this.modules[historyObject.activeModule];
        if (module) {
            module.restoreHistory(historyObject, state);
        }
    };

    this.prototype.createHistoryObject = function ()
    {
        var historyObject = {
            activeModule: this.activeModule,
            activePath: this.activePath,
            title: document.title,
            url: window.location.href
        };

        var module = this.modules[this.activeModule];
        if (module) {
            historyObject = module.createHistoryObject(historyObject);
        }

        return historyObject;
    };

    this.prototype.setHistoryObject = function (state, historyObject)
    {
        sessionStorage.setItem('PicoAdminHistory' + state, JSON.stringify(historyObject));
    };

    this.prototype.getHistoryObject = function (state)
    {
        if (!state) state = this.currentState;
        return JSON.parse(sessionStorage.getItem('PicoAdminHistory' + state) || 'null');
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
            if (utils.isPlainObject(response) && (response.error !== undefined)) {
                self.showNotification(
                    response.error.title,
                    response.error.message,
                    response.error.type || 'error',
                    response.error.timeout,
                    response.error.closeable
                );
            } else {
                var errorTitle;
                if ((xhr.status >= 400) && (xhr.status <= 600)) {
                    errorTitle = '' + xhr.status + ' ' + statusText;
                } else {
                    errorTitle = 'Fatal Error';
                }

                self.showNotification(errorTitle, 'An unexpected error has occured.', { type: 'error', timeout: 0 });
            }

            if (errorCallback) {
                errorCallback(xhr, statusText, response);
            }
        };

        return utils.ajax(this.getUrl(module, action, payload), options);
    };

    this.prototype.getUrl = function (module, action, payload, queryParams)
    {
        var url = this.baseUrl;

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
            if (queryString !== '') url += '?' + queryString;
        }

        return url;
    };

    this.prototype.initInhibitor = function ()
    {
        inhibitor = utils.parse('<div id="inhibitor" class="hidden"></div>');
        document.body.appendChild(inhibitor);
    };

    this.prototype.showInhibitor = function ()
    {
        var inhibitor = document.getElementById('inhibitor');
        if (inhibitor) {
            var layers = parseInt(inhibitor.dataset.layers) || 0;
            inhibitor.dataset.layers = layers + 1;
            utils.fade(inhibitor, { fadeTo: 0.5, reset: false });

            if (layers === 0) {
                utils.addNamedEventListener(document.body, 'keypress', 'inhibitor', function (event) {
                    event.preventDefault();
                });
            }
        }
    };

    this.prototype.hideInhibitor = function ()
    {
        var inhibitor = document.getElementById('inhibitor');
        if (inhibitor) {
            var layers = parseInt(inhibitor.dataset.layers) || 0;
            if (layers > 0) {
                inhibitor.dataset.layers = layers - 1;

                if (layers === 1) {
                    utils.fadeOut(inhibitor);
                    utils.removeNamedEventListener(document.body, 'keypress', 'inhibitor');
                }
            }
        }
    };

    this.prototype.initNotification = function ()
    {
        notification = utils.parse('<div id="notification"></div>');
        document.body.appendChild(notification);
    };

    this.prototype.showNotification = function (title, message, options)
    {
        if (!options) options = {};
        if ((options.timeout === undefined) || (options.timeout === null)) options.timeout = 5;
        if ((options.closeable === undefined) || (options.closeable === null)) options.closeable = true;

        var className = '',
            iconName = '';
        if (typeof(options.type) === 'object') {
            if (options.type.className) className = ' ' + options.type.className;
            if (options.type.iconName) iconName = ' ' + options.type.iconName;
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

        var notification = document.getElementById('notification');
        if (!notification) return null;

        var alert = utils.parse('<div class="alert' + className + ' hidden" role="alert"></div>');
        notification.appendChild(alert);

        var notificationId = this.notifications.length,
            notificationData = {};
        this.notifications.push(notificationData);
        alert.dataset.notificationId = notificationId;

        notificationData.type = options.type;

        if ((title !== undefined) && (title !== null)) {
            var titleElement = utils.parse('<h1><span class="fa' + iconName + ' fa-fw"></span> ' + title + '</h1>');
            alert.appendChild(titleElement);
            notificationData.title = title;
        }

        if ((message !== undefined) && (message !== null)) {
            var messageElement;
            if (typeof message === 'string') {
                messageElement = utils.parse('<p>' + message + '</p>');
            } else {
                messageElement = document.createElement('p');
                messageElement.appendChild(message);
            }
            alert.appendChild(messageElement);
            notificationData.message = message;
        }

        var addCloseButton = options.closeable,
            self = this;
        if (options.timeout > 0) {
            notificationData.timeout = options.timeout;

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

                notificationData.timerInterval = setInterval(function() {
                    var valueElement = dismiss.querySelector('.timer'),
                        value = parseInt(valueElement.textContent);

                    if (dismiss.classList.contains('pause')) return;
                    if (value > 0) valueElement.textContent = value - 1;
                    if (value === 1) self.hideNotification(alert);
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

        notificationData.closeable = options.closeable;

        if (options.closeCallback) {
            notificationData.closeCallback = options.closeCallback;
        }

        utils.slideDown(alert);
        return alert;
    };

    this.prototype.hideNotification = function (alert)
    {
        var notificationId = alert.dataset.notificationId;

        if (notificationId) {
            var notificationData = this.notifications[notificationId];

            if (notificationData.closeCallback) {
                if (notificationData.closeCallback(alert) === false) {
                    return false;
                }
            }

            delete this.notifications[notificationId];
            delete alert.dataset.notificationId;

            if (notificationData.timerTimeout) clearTimeout(notificationData.timerTimeout);
            if (notificationData.timerInterval) clearInterval(notificationData.timerInterval);

            utils.slideUp(alert, function() {
                alert.parentNode.removeChild(alert);
            });

            return true;
        }

        return false;
    };

    this.prototype.initLoading = function ()
    {
        loading = utils.parse('<div id="loading"><div class="glow"></div></div>');
        document.body.appendChild(loading);
    };

    this.prototype.showLoading = function ()
    {
        var loading = document.getElementById('loading'),
            animateProgress = function () { loading.style.width = (50 + Math.random() * 30) + '%'; };

        if (loading) {
            loading.dataset.requests = (parseInt(loading.dataset.requests) || 0) + 1;

            if (loading.classList.contains('finish')) {
                window.clearTimeout(loading.dataset.timeout);
                delete loading.dataset.timeout;

                loading.classList.remove('finish');

                loading.classList.add('wait');
                animateProgress();
            } else if (!loading.classList.contains('wait')) {
                loading.classList.add('wait');
                animateProgress();
            }
        }
    };

    this.prototype.hideLoading = function ()
    {
        var loading = document.getElementById('loading');
        if (loading) {
            var requests = parseInt(loading.dataset.requests) || 0;
            if (requests > 0) {
                loading.dataset.requests = requests - 1;

                if (requests === 1) {
                    loading.classList.remove('wait');
                    loading.classList.add('finish');
                    loading.style.width = null;

                    loading.dataset.timeout = window.setTimeout(function () {
                        loading.classList.remove('finish');
                        delete loading.dataset.timeout;
                    }, 800);

                    return true;
                }
            }
        }

        return false;
    };
});
