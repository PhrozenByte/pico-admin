function PicoAdmin(authToken, baseUrl) {
    this.authToken = authToken;
    this.baseUrl = baseUrl;
}

PicoAdmin.prototype.ajax = function (module, action, payload, options) {
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

    if (options.postData === undefined) {
        options.postData = { auth_client_token: this.authToken };
    } else if (options.postData.auth_client_token === undefined) {
        options.postData.auth_client_token = this.authToken;
    } else if (options.postData.auth_client_token === null) {
        delete options.postData.auth_client_token;
    }

    return utils.ajax(url, options);
};

PicoAdmin.prototype.getAuthToken = function () {
    return this.authToken;
};

PicoAdmin.prototype.getBaseUrl = function () {
    return this.baseUrl;
};
