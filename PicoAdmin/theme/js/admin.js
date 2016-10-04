function PicoAdmin(authToken, baseUrl)
{
    this.authToken = authToken;
    this.baseUrl = baseUrl;

    this.notifications = [];

    this.init();
}

utils.createClass(PicoAdmin, function () {
    this.prototype.init = function ()
    {
        this.initNotification();
        this.initLoading();
    };

    this.prototype.ajax = function (module, action, payload, options)
    {
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

        var completeCallback = options.complete,
            self = this;
        options.complete = function (xhr, statusText, response) {
            self.hideLoading();

            if (completeCallback) {
                completeCallback(xhr, statusText, response);
            }
        };

        // TODO: globally catch errors and print them somewhere

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
        if (timeout === undefined) timeout = 5;
        if (closeable === undefined) closeable = true;

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

                    if (value > 0) valueElement.textContent = value - 1;
                    if (value === 1) self.hideNotification(alert);
                }, 1000);

                if (closeable) {
                    dismiss.addEventListener('click', function (event) {
                        event.preventDefault();
                        self.hideNotification(alert);
                    });
                }
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

    this.prototype.getAuthToken = function ()
    {
        return this.authToken;
    };

    this.prototype.getBaseUrl = function ()
    {
        return this.baseUrl;
    };
});
