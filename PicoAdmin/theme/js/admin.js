function PicoAdmin(authToken, baseUrl)
{
    this.authToken = authToken;
    this.baseUrl = baseUrl;

    this.modules = {};

    this.activeModule = 'landing';
    this.activePath = null;

    this.currentState = null;
    this.latestState = null;

    this.notifications = [];
    this.askFileNameModal = null;
}

utils.createClass(PicoAdmin, function () {
    this.prototype.init = function ()
    {
        this.initNotification();
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
            event.preventDefault();
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
        if (!oldHistoryObject || (historyObject.title !== oldHistoryObject.title) || (historyObject.url !== oldHistoryObject.url)) {
            // make sure we don't accidently replace other states than the expected
            // this e.g. happens when navigating back accross modules (PicoContentAdmin.disable() via popstate event)
            if ((window.history.state === null) || (window.history.state === this.currentState)) {
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

        if (options === undefined) {
            options = { postData: { auth_client_token: this.authToken } };
        } else if (options.postData === undefined) {
            options.postData = { auth_client_token: this.authToken };
        } else if (options.postData.auth_client_token === undefined) {
            options.postData.auth_client_token = this.authToken;
        } else if (options.postData.auth_client_token === null) {
            delete options.postData.auth_client_token;
        }

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

                self.showNotification(errorTitle, 'An unexpected error has occured.', 'error', 0);
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

    this.prototype.initNotification = function ()
    {
        notification = utils.parse('<div id="notification"></div>');
        document.body.appendChild(notification);
    };

    this.prototype.showNotification = function (title, message, type, timeout, closeable, closeCallback)
    {
        if ((timeout === undefined) || (timeout === null)) timeout = 5;
        if ((closeable === undefined) || (closeable === null)) closeable = true;

        var className = '',
            iconName = '';
        if (typeof(type) === 'object') {
            if (type.className) className = ' ' + type.className;
            if (type.iconName) iconName = ' ' + type.iconName;
        } else {
            switch (type) {
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

        notificationData.type = type;

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

        var addCloseButton = closeable,
            self = this;
        if (timeout > 0) {
            notificationData.timeout = timeout;

            if (timeout >= 100) {
                var timeoutCallback = this.hideNotification.bind(this, alert);
                notificationData.timerTimeout = setTimeout(timeoutCallback, (timeout * 1000));
            } else {
                var dismiss;
                if (closeable) {
                    dismiss = utils.parse(
                        '<a href="" class="dismiss countdown closeable" role="button">' +
                        '    <span class="close" aria-hidden="true">&times;</span>' +
                        '    <span class="timer" aria-hidden="true">' + timeout + '</span>' +
                        '    <span class="sr-only">Close</span>' +
                        '</a>'
                    );
                } else {
                    dismiss = utils.parse(
                        '<span class="dismiss countdown">' +
                        '    <span class="timer" aria-hidden="true">' + timeout + '</span>' +
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

                if (closeable) {
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

        notificationData.closeable = closeable;

        if (closeCallback) {
            notificationData.closeCallback = closeCallback;
        }

        var module = this.modules[this.activeModule];
        if (module) module.showNotification(notificationData, alert);

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

            var module = this.modules[this.activeModule];
            if (module) module.hideNotification(notificationData, alert);

            utils.slideUp(alert, function() {
                alert.parentNode.removeChild(alert);
            });

            return true;
        }

        return false;
    };

    this.prototype.askFileName = function (callback, options)
    {
        var self = this;

        if ((options === undefined) && utils.isPlainObject(callback)) {
            options = callback;
        } else {
            if (!options) options = {};
            if (callback) options.callback = callback;
        }

        options = utils.extend({
            title: null,
            value: '',
            fileExt: null,
            iconName: null,
            className: null,
            closeable: true,
            callback: null
        }, options);

        // disallow opening multiple file name notifications at the same time
        if (this.askFileNameModal) return null;
        this.askFileNameModal = {};

        // prepare notification content
        var content = utils.parse(
                '<div class="input-group">' +
                '    <input type="text" />' +
                '    <div class="button" role="button">' +
                '        <span class="fa fa-floppy-o" aria-hidden="true"></span>' +
                '        <span class="sr-only">Save</span>' +
                '    </div>' +
                '</div>' +
                '<small>' +
                '    <span class="fa fa-lightbulb-o" aria-hidden="true"></span>' +
                '    <strong>Pro Tip:</strong> Click on a item in the file navigation to copy its path.' +
                '</small>'
            ),
            inputGroup = content.querySelector('div > .input-group'),
            inputField = inputGroup.querySelector('div > input'),
            submitButton = inputGroup.querySelector('div > .button');

        if (options.fileExt) {
            inputGroup.insertBefore(
                utils.parse('<div class="file_ext">' + options.fileExt + '</div>'),
                submitButton
            );
        }

        inputField.addEventListener('focus', function () { inputGroup.classList.add('focus'); });
        inputField.addEventListener('blur', function () { inputGroup.classList.remove('focus'); });

        // set default value
        inputField.value = options.value;

        // take over navigation
        var navigation = document.querySelector('header > nav'),
            actionLists = navigation.querySelectorAll('.module .actions'),
            itemAnchors = navigation.querySelectorAll('.module > .nav .item > a');

        var applyPathEvent = function (event) {
            event.preventDefault();

            var anchor = event.currentTarget,
                item = utils.closest(anchor, '.item'),
                path = item.dataset.path + (item.classList.contains('parent') ? '/' : '');

            self.setFileNameModalValue(path);
        };

        utils.forEach(itemAnchors, function (_, itemAnchor) {
            utils.disableNamedEventListener(itemAnchor, 'click', 'action');

            if (!itemAnchor.hasAttribute('href')) itemAnchor.setAttribute('href', '');
            utils.addNamedEventListener(itemAnchor, 'click', 'apply-path', applyPathEvent);
        });

        utils.forEach(actionLists, function (_, actionList) { utils.slideLeft(actionList); });

        // create notification
        var notification = this.showNotification(
            options.title,
            content,
            { iconName: options.iconName, className: options.className },
            0,
            options.closeable,
            function () { self.closeFileNameModal(); }
        );

        var notificationId = notification.dataset.notificationId;
        this.askFileNameModal = utils.extend(
            { alert: notification},
            this.notifications[notificationId],
            {
                defaultValue: options.value,
                fileExt: options.fileExt,
                submitCallback: options.callback
            }
        );

        // make the save button functional
        submitButton.addEventListener('click', function () {
            self.submitFileNameModal();
        });
        inputField.addEventListener('keydown', function (event) {
            if (event.keyCode == 13) {
                self.submitFileNameModal();
            }
        });

        // focus input field
        inputField.focus();

        var module = this.modules[this.activeModule];
        if (module) module.askFileName(this.askFileNameModal, notification);

        return notification;
    };

    this.prototype.closeFileNameModal = function ()
    {
        var notification = this.askFileNameModal.alert;
        if (notification) {
            var navigation = document.querySelector('header > nav'),
                actionLists = navigation.querySelectorAll('.module .actions'),
                itemAnchors = navigation.querySelectorAll('.module > .nav .item > a');

            utils.forEach(actionLists, function (_, actionList) { utils.slideRight(actionList); });

            utils.forEach(itemAnchors, function (_, itemAnchor) {
                utils.removeNamedEventListener(itemAnchor, 'click', 'apply-path');
                if (itemAnchor.getAttribute('href') === '') itemAnchor.removeAttribute('href');

                utils.enableNamedEventListener(itemAnchor, 'click', 'action');
            });

            var conflictNotifications = this.askFileNameModal.conflictNotifications;
            if (conflictNotifications) {
                for (var i = 0; i < conflictNotifications.length; i++) {
                    this.hideNotification(conflictNotifications[i]);
                }
            }

            var module = this.modules[this.activeModule];
            if (module) module.closeFileNameModal(this.askFileNameModal, notification);

            this.askFileNameModal = null;
        }
    };

    this.prototype.submitFileNameModal = function ()
    {
        var notification = this.askFileNameModal.alert;
        if (notification) {
            var inputField = notification.querySelector('.input-group > input'),
                value = inputField.value,
                submitCallback = this.askFileNameModal.submitCallback;

            // just close the notification when no value has been entered
            if (value === '') {
                this.hideNotification(notification);
                return;
            }

            // drop file extension when necessary
            var fileExt = this.askFileNameModal.fileExt;
            if (fileExt) {
                var testFileExt = value.substr(-fileExt.length);
                if (testFileExt === fileExt) {
                    var fileNameLength = value.length - fileExt.length;
                    value = value.substr(0, fileNameLength);
                }
            }

            // check for conflicting files
            var defaultValue = this.askFileNameModal.defaultValue,
                conflictValue = this.askFileNameModal.conflictValue;
            if ((value !== defaultValue) && (value !== conflictValue)) {
                var moduleNav = document.getElementById('module-' + this.activeModule + '-nav'),
                    conflictItem = moduleNav.querySelector('.nav .item[data-path="' + value + '"]');
                if (conflictItem) {
                    var conflictNotification = this.showNotification(
                        'Conflict',
                        "There's already a page of this name, be careful about not accidently overwriting it! " +
                            'Try again to overwrite the file.',
                        'warning'
                    );

                    this.askFileNameModal.conflictValue = value;

                    if (!this.askFileNameModal.conflictNotifications) {
                        this.askFileNameModal.conflictNotifications = [ conflictNotification ];
                    } else {
                        this.askFileNameModal.conflictNotifications.push(conflictNotification);
                    }
                    return;
                }
            }

            var module = this.modules[this.activeModule];
            if (module) module.submitFileNameModal(this.askFileNameModal, notification);

            this.hideNotification(notification);

            // validate path and call success callback
            if (value.substr(-1) === '/') {
                this.showNotification(
                    'Invalid Path',
                    'The path you\'ve entered is invalid. Please specify a valid file path.',
                    'error'
                );
            } else if (submitCallback) {
                submitCallback(value);
            }
        }
    };

    this.prototype.setFileNameModalValue = function (path)
    {
        var notification = this.askFileNameModal.alert;
        if (notification) {
            var inputField = notification.querySelector('.input-group > input');
            inputField.value = path;
        }
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
            var requestCount = parseInt(loading.dataset.requests) || 0;
            loading.dataset.requests = requestCount - 1;

            if (requestCount == 1) {
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

        return false;
    };
});
