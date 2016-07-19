function PicoAdmin(authToken, baseUrl)
{
    this.authToken = authToken;
    this.baseUrl = baseUrl;
}

PicoAdmin.prototype.ajax = function (module, action, payload, options)
{
    if (options.postData === undefined) {
        options.postData = { auth_client_token: this.authToken };
    } else if (options.postData.auth_client_token === undefined) {
        options.postData.auth_client_token = this.authToken;
    } else if (options.postData.auth_client_token === null) {
        delete options.postData.auth_client_token;
    }

    this.showLoading();

    var completeCallback = options.complete;
    options.complete = (function (xhr, statusText, response) {
        this.hideLoading();

        if (completeCallback) {
            completeCallback(xhr, statusText, response);
        }
    }).bind(this);

    // TODO: globally catch errors and print them somewhere

    return utils.ajax(this.getUrl(module, action, payload), options);
};

PicoAdmin.prototype.getUrl = function (module, action, payload)
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

    return url;
};

PicoAdmin.prototype.showNotification = function (title, message, type, timeout, closeable)
{
    if (timeout === undefined) timeout = 5;
    if (closeable === undefined) closeable = true;

    var className = 'alert-info',
        iconName = 'fa-info';
    switch (type) {
        case 'success':
            className = 'alert-success';
            iconName = 'fa-check';
            break;

        case 'warning':
            className = 'alert-warning';
            iconName = 'fa-exclamation-triangle';
            break;

        case 'error':
            className = 'alert-error';
            iconName = 'fa-ban';
            break;
    }

    var notification = document.getElementById('notification');
    if (!notification) {
        notification = utils.parse('<div id="notification"></div>');
        document.body.appendChild(notification);
    }

    var alert = utils.parse('<div class="alert ' + className + ' hidden" role="alert"/>');
    notification.appendChild(alert);

    if ((title !== undefined) && (title !== null)) {
        var titleElement = utils.parse('<h1><span class="fa ' + iconName + ' fa-fw"></span> ' + title + '</h1>');
        alert.appendChild(titleElement);
    }

    if ((message !== undefined) && (message !== null)) {
        var messageElement = utils.parse('<p>' + message + '</p>');
        alert.appendChild(messageElement);
    }

    var closeCallback = function () {
        utils.slideUp(alert, function() {
            notification.removeChild(alert);
        });
    };

    if (timeout > 0) {
        if (timeout >= 100) {
            setTimeout(closeCallback, (timeout * 1000));
        } else {
            var alertTimer = utils.parse(
                '<a href="" class="timer" role="button">' +
                '    <span class="timer-value" aria-hidden="true">' + timeout + '</span>' +
                '    <span class="sr-only">Close</span>' +
                '</a>'
            );

            if (closeable) {
                alertTimer.classList.add('closeable');
                alertTimer.insertBefore(
                    utils.parse('<span class="timer-close" aria-hidden="true">&times;</span>'),
                    alertTimer.firstChild
                );
            } else {
                alertTimer.addEventListener('click', function (e) { e.preventDefault(); });
            }

            alert.appendChild(alertTimer);

            var alertTimerInterval = setInterval(function() {
                var valueElement = alertTimer.querySelector('.timer-value'),
                    value = parseInt(valueElement.textContent);

                if (value > 0) {
                    valueElement.textContent = value - 1;
                }
                if (value === 1) {
                    clearInterval(alertTimerInterval);
                    closeCallback();
                }
            }, 1000);
        }
    }

    if (closeable) {
        if (!(timeout > 0) || (timeout >= 100)) {
            alert.appendChild(utils.parse(
                '<a href="" class="close" role="button">' +
                '    <span aria-hidden="true">&times;</span>' +
                '    <span class="sr-only">Close</span>' +
                '</a>'
            ));
        }

        var closeButton = alert.querySelector('.timer, .close');
        if (closeButton) {
            closeButton.addEventListener('click', function (e) {
                e.preventDefault();
                closeCallback();
            });
        }
    }

    utils.slideDown(alert);
    return alert;
};

PicoAdmin.prototype.showLoading = function ()
{
    var loading = document.getElementById('loading'),
        animateProgress = function () { loading.style.width = (50 + Math.random() * 30) + '%'; };

    if (loading) {
        loading.dataset.requests = parseInt(loading.dataset.requests) + 1;

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
    } else {
        loading = utils.parse('<div id="loading" class="wait"><div class="glow"></div></div>');
        loading.dataset.requests = 1;

        window.requestAnimationFrame(function () {
            document.body.appendChild(loading);
            window.requestAnimationFrame(animateProgress);
        });
    }
};

PicoAdmin.prototype.hideLoading = function ()
{
    var loading = document.getElementById('loading');
    if (loading) {
        var requestCount = parseInt(loading.dataset.requests);
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

PicoAdmin.prototype.getAuthToken = function ()
{
    return this.authToken;
};

PicoAdmin.prototype.getBaseUrl = function ()
{
    return this.baseUrl;
};
