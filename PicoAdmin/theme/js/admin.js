function PicoAdmin(authToken, baseUrl) {
    this.authToken = authToken;
    this.baseUrl = baseUrl;
}

PicoAdmin.prototype.ajax = function (module, action, payload, options) {
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

PicoAdmin.prototype.getUrl = function (module, action, payload) {
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

PicoAdmin.prototype.showLoading = function () {
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

PicoAdmin.prototype.hideLoading = function () {
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

PicoAdmin.prototype.getAuthToken = function () {
    return this.authToken;
};

PicoAdmin.prototype.getBaseUrl = function () {
    return this.baseUrl;
};
