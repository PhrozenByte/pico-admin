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

PicoAdmin.prototype.getAuthToken = function () {
    return this.authToken;
};

PicoAdmin.prototype.getBaseUrl = function () {
    return this.baseUrl;
};
