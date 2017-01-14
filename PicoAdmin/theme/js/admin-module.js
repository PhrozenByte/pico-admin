function PicoAdminModule(picoAdmin, moduleName)
{
    this._picoAdmin = picoAdmin;
    this._moduleName = moduleName;

    this._container = null;
    this._navigation = null;
    this._navigationInner = null;

    this._askFileNameModal = null;
}

utils.createClass(PicoAdminModule, function () {
    this.prototype.init = function ()
    {
        this._container = document.getElementById('module-' + this._moduleName);
        this._navigation = document.getElementById('module-' + this._moduleName + '-nav');
        this._navigationInner = this._navigation.querySelector('.nav-inner');

        // register module
        this._picoAdmin.modules[this._moduleName] = this;

        this._initNavigation();
    };

    this.prototype._initNavigation = function ()
    {
        var navigationButton = this._navigation.querySelector('.headline h3 a'),
            landingButton = document.getElementById('module-' + this._moduleName + '-landing'),
            self = this;

        var toggleMenuEvent = function (event) {
            event.preventDefault();

            var wrapper = self._navigationInner ? self._navigationInner.parentNode : null;
            if (!wrapper || (wrapper.dataset.expanded === 'false')) {
                self.expandNavigation();
            } else {
                self.collapseNavigation();
            }
        };

        if (navigationButton) {
            utils.addNamedEventListener(navigationButton, 'click', 'toggle', toggleMenuEvent);
        }
        if (landingButton) {
            utils.addNamedEventListener(landingButton, 'click', 'toggle', toggleMenuEvent);
        }

        if (this._navigationInner) {
            if (this._navigationInner.parentNode.classList.contains('nav')) {
                // add sliding wrapper
                var wrapper = document.createElement('div');
                this._navigationInner.parentNode.appendChild(wrapper);
                wrapper.appendChild(this._navigationInner);
            }

            // show headline actions
            var headlineActions = this._navigation.querySelector('.headline .actions');
            if (headlineActions) {
                headlineActions.classList.remove('hidden');
            }

            // init navigation items
            this._initNavigationItems();
        }
    };

    this.prototype._replaceNavigation = function (html, callback)
    {
        var container = this._navigation.querySelector('.nav'),
            oldWrapper = this._navigationInner ? this._navigationInner.parentNode : null,
            newWrapper = document.createElement('div');

        newWrapper.classList.add('hidden');
        newWrapper.innerHTML = html;
        container.appendChild(newWrapper);

        this._navigationInner = newWrapper.querySelector('.nav-inner');

        // init navigation items
        this._initNavigationItems();

        // highlight active navigation item
        var activePath = this._picoAdmin.getActivePath(),
            activeItem = this._navigationInner.querySelector('.item[data-path="' + activePath + '"]');
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // cross fade new navigation
        if (oldWrapper) {
            utils.crossFade(oldWrapper, newWrapper, function () {
                oldWrapper.parentNode.removeChild(oldWrapper);
                if (callback) {
                    callback();
                }
            });
        } else if (callback) {
            callback();
        }
    };

    this.prototype._initNavigationItems = function ()
    {
        // overwrite me
    };

    this.prototype.expandNavigation = function ()
    {
        var wrapper = this._navigationInner ? this._navigationInner.parentNode : null,
            self = this;

        // make sure the navigation has been loaded already
        if (!wrapper) {
            this._ajax('navigation', null, {
                responseType: 'json',
                success: function (xhr, statusText, response) {
                    if (!response || !response.navigation || !/^\s*<div class="nav-inner">/.test(response.navigation)) {
                        return false;
                    }

                    self._replaceNavigation(response.navigation, function () {
                        self.expandNavigation();
                    });
                }
            });
            return;
        }

        // expand navigation
        wrapper.dataset.expanded = 'true';
        utils.slideDown(wrapper);

        // expand headline actions
        var headlineActions = this._navigation.querySelector('.headline .actions');
        if (headlineActions) {
            utils.slideRight(headlineActions);
        }

        // collapse all other module navigations
        utils.forEach(this._picoAdmin.modules, function (moduleName, module) {
            if (moduleName !== self._moduleName) {
                module.collapseNavigation();
            }
        });
    };

    this.prototype.collapseNavigation = function ()
    {
        // collapse navigation
        var wrapper = this._navigationInner ? this._navigationInner.parentNode : null;
        if (wrapper) {
            wrapper.dataset.expanded = 'false';
            utils.slideUp(wrapper);
        }

        // collapse headline actions
        var headlineActions = this._navigation.querySelector('.headline .actions');
        if (headlineActions) {
            utils.slideLeft(headlineActions);
        }
    };

    this.prototype.restore = function ()
    {
        // did the server session expire accidently?
        // if true, throw away the default page state and restore the old page state instead
        var oldHistoryObject = this._picoAdmin.getHistoryObject(this._picoAdmin.getLatestState());
        if (oldHistoryObject && oldHistoryObject.sessionExpired) {
            if (oldHistoryObject.activeModule === this._moduleName) {
                var urlRegExp = /^(?:https?:\/\/[^/?#]*)?(?:\/)?(.*?)\??(?:#.*)?$/,
                    oldUrl = oldHistoryObject.url.replace(urlRegExp, '/$1'),
                    currentUrl = window.location.href.replace(urlRegExp, '/$1');

                if (oldUrl === currentUrl) {
                    this._picoAdmin.selectModule(this._moduleName, oldHistoryObject.activePath);
                    this._picoAdmin.restoreHistory(this._picoAdmin.getLatestState());

                    return true;
                }
            }
        }

        return false;
    };

    this.prototype.takeOver = function ()
    {
        // overwrite me
    };

    this.prototype.enable = function ()
    {
        // overwrite me
    };

    this.prototype.disable = function ()
    {
        var activeItem = this._navigationInner.querySelector('.item.active');
        if (activeItem) {
            activeItem.classList.remove('active');
        }
    };

    this.prototype.selectPath = function (path)
    {
        var oldActiveItem = this._navigationInner.querySelector('.item.active'),
            newActiveItem = this._navigationInner.querySelector('.item[data-path="' + path + '"]');

        if (oldActiveItem) {
            oldActiveItem.classList.remove('active');
        }
        if (newActiveItem) {
            newActiveItem.classList.add('active');
        }
    };

    this.prototype.getState = function ()
    {
        // overwrite me
    };

    this.prototype.setState = function (data)
    {
        // overwrite me
    };

    this.prototype.getName = function ()
    {
        return this._moduleName;
    };

    this.prototype.getContainer = function ()
    {
        return this._container;
    };

    this.prototype.getNavigation = function ()
    {
        return this._navigation;
    };

    this.prototype._askFileName = function (options)
    {
        var self = this;

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
        if (this._askFileNameModal) {
            return null;
        }
        this._askFileNameModal = {};

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
        );

        var inputGroup = content.querySelector('.input-group'),
            inputField = inputGroup.querySelector('input'),
            submitButton = inputGroup.querySelector('.button');

        if (options.fileExt) {
            inputGroup.insertBefore(
                utils.parse('<div class="file_ext">' + options.fileExt + '</div>'),
                submitButton
            );
        }

        inputField.addEventListener('focus', function () {
            inputGroup.classList.add('focus');
        });
        inputField.addEventListener('blur', function () {
            inputGroup.classList.remove('focus');
        });

        // set default value
        inputField.value = options.value;

        // take over navigation
        var navigation = document.querySelector('header > nav'),
            moduleButtons = navigation.querySelectorAll('.module > .headline h3 a'),
            landingModuleButtons = document.querySelectorAll('#landing .module'),
            actionLists = navigation.querySelectorAll('.module .actions'),
            itemAnchors = navigation.querySelectorAll('.module .nav-inner .item > a');

        for (var i = 0; i < moduleButtons.length; i++) {
            moduleButtons[i].classList.add('disabled');
        }
        for (var i = 0; i < landingModuleButtons.length; i++) {
            landingModuleButtons[i].classList.add('disabled');
        }
        for (var i = 0; i < actionLists.length; i++) {
            utils.slideLeft(actionLists[i]);
        }

        var applyPathEvent = function (event) {
            event.preventDefault();

            var anchor = event.currentTarget,
                item = utils.closest(anchor, '.item'),
                path = item.dataset.path + (item.classList.contains('parent') ? '/' : '');

            self._setFileNameModalValue(path);
        };

        for (var i = 0; i < itemAnchors.length; i++) {
            utils.disableNamedEventListener(itemAnchors[i], 'click', 'action');
            utils.addNamedEventListener(itemAnchors[i], 'click', 'apply-path', applyPathEvent);

            if (!itemAnchors[i].hasAttribute('href')) {
                itemAnchors[i].setAttribute('href', '');
            }
        }

        // create notification
        var notification = this._picoAdmin.showNotification(options.title, content, {
            icon: { iconName: options.iconName, className: options.className },
            timeout: 0,
            closeable: options.closeable,
            closeCallback: function () {
                self._closeFileNameModal();
            }
        });

        var notificationId = notification.dataset.notificationId;
        this._askFileNameModal = utils.extend(
            { alert: notification },
            options
        );

        // make the save button functional
        submitButton.addEventListener('click', function () {
            self._submitFileNameModal();
        });
        inputField.addEventListener('keydown', function (event) {
            if (event.keyCode == 13) {
                self._submitFileNameModal();
            }
        });

        // focus input field
        inputField.focus();

        return notification;
    };

    this.prototype._closeFileNameModal = function ()
    {
        var notification = this._askFileNameModal ? this._askFileNameModal.alert : null;
        if (notification) {
            // reset navigation
            var navigation = document.querySelector('header > nav'),
                moduleButtons = navigation.querySelectorAll('.module > .headline h3 a'),
                landingModuleButtons = document.querySelectorAll('#landing .module'),
                actionLists = navigation.querySelectorAll('.module .actions'),
                itemAnchors = navigation.querySelectorAll('.module .nav-inner .item > a');

            for (var i = 0; i < moduleButtons.length; i++) {
                moduleButtons[i].classList.remove('disabled');
            }
            for (var i = 0; i < landingModuleButtons.length; i++) {
                landingModuleButtons[i].classList.remove('disabled');
            }
            for (var i = 0; i < actionLists.length; i++) {
                utils.slideRight(actionLists[i]);
            }

            for (var i = 0; i < itemAnchors.length; i++) {
                utils.removeNamedEventListener(itemAnchors[i], 'click', 'apply-path');
                utils.enableNamedEventListener(itemAnchors[i], 'click', 'action');

                if (itemAnchors[i].getAttribute('href') === '') {
                    itemAnchors[i].removeAttribute('href');
                }
            }

            // close conflict notifications
            if (this._askFileNameModal.conflicts) {
                var conflicts = this._askFileNameModal.conflicts;
                for (var i = 0; i < conflicts.length; i++) {
                    this._picoAdmin.hideNotification(conflicts[i]);
                }
            }

            this._askFileNameModal = null;
        }
    };

    this.prototype._submitFileNameModal = function ()
    {
        var notification = this._askFileNameModal ? this._askFileNameModal.alert : null;
        if (notification) {
            var value = notification.querySelector('.input-group > input').value,
                submitCallback = this._askFileNameModal.callback;

            // just close the notification when no value has been entered
            if (value === '') {
                this._picoAdmin.hideNotification(notification);
                return;
            }

            // drop file extension when necessary
            var fileExt = this._askFileNameModal.fileExt;
            if (fileExt) {
                var testFileExt = value.substr(-fileExt.length);
                if (testFileExt === fileExt) {
                    var fileNameLength = value.length - fileExt.length;
                    value = value.substr(0, fileNameLength);
                }
            }

            // check for conflicting files
            var defaultValue = this._askFileNameModal.value,
                conflictValue = this._askFileNameModal.conflictValue;
            if ((value !== defaultValue) && (value !== conflictValue)) {
                var conflictItem = this._navigationInner.querySelector('.item[data-path="' + value + '"]');
                if (conflictItem) {
                    var conflictNotification = this._picoAdmin.showNotification(
                        'Conflict',
                        "There's already a page of this name, be careful about not accidently overwriting it! " +
                            'Try again to overwrite the file.',
                        { type: 'warning' }
                    );

                    if (!this._askFileNameModal.conflicts) {
                        this._askFileNameModal.conflicts = [];
                    }

                    this._askFileNameModal.conflicts.push(conflictNotification);
                    this._askFileNameModal.conflictValue = value;

                    return;
                }
            }

            // validate entered value
            if (value.substr(-1) === '/') {
                this._picoAdmin.showNotification(
                    'Invalid Path',
                    'The path you\'ve entered is invalid. Please specify a valid file path.',
                    { type: 'error' }
                );

                return;
            }

            // hide notification and call submit callback
            this._picoAdmin.hideNotification(notification);

            if (submitCallback) {
                submitCallback(value);
            }
        }
    };

    this.prototype._setFileNameModalValue = function (path)
    {
        var notification = this._askFileNameModal ? this._askFileNameModal.alert : null;
        if (notification) {
            var inputField = notification.querySelector('.input-group > input');
            inputField.value = path;
        }
    };

    this.prototype._ajax = function (action, payload, options)
    {
        return this._picoAdmin.ajax(this._moduleName, action, payload, options);
    };
});
