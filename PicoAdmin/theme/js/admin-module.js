function PicoAdminModule(picoAdmin, moduleName)
{
    this.picoAdmin = picoAdmin;
    this.moduleName = moduleName;

    this.askFileNameModal = null;
}

utils.createClass(PicoAdminModule, function () {
    this.prototype.init = function (options)
    {
        this.picoAdmin.registerModule(this.moduleName, this);

        this.initNavigation();
    };

    this.prototype.initNavigation = function ()
    {
        var moduleNav = document.getElementById('module-' + this.moduleName + '-nav'),
            navigationButton = moduleNav.querySelector('.headline h3 a'),
            landingButton = document.getElementById('module-' + this.moduleName + '-landing'),
            navContainer = moduleNav.querySelector('.nav'),
            navInner = moduleNav.querySelector('.nav > div'),
            self = this;

        var toggleMenuEvent = function (event) {
            event.preventDefault();

            var navWrapper = moduleNav.querySelector('.nav > div');
            if (!navWrapper || (navWrapper.dataset.expanded === 'false')) {
                self.expandNavigation();
            } else {
                self.collapseNavigation();
            }
        };

        if (navigationButton) utils.addNamedEventListener(navigationButton, 'click', 'toggle', toggleMenuEvent);
        if (landingButton)    utils.addNamedEventListener(landingButton, 'click', 'toggle', toggleMenuEvent);

        if (navInner) {
            if (navInner.classList.contains('nav-inner')) {
                // add sliding wrapper
                var navWrapper = document.createElement('div');
                navWrapper.appendChild(navInner);
                navContainer.appendChild(navWrapper);
            } else {
                navInner = navContainer.querySelector('.nav-inner');
            }

            // init action buttons
            var headlineActions = moduleNav.querySelector('.headline .actions'),
                itemActionsList = navInner.querySelectorAll('.item .actions');

            headlineActions.classList.remove('hidden');
            this.initNavigationActions(itemActionsList, headlineActions);

            // init items
            this.initNavigationItems(navInner);
        }
    };

    this.prototype.replaceNavigation = function (navInner, callback)
    {
        var moduleNav = document.getElementById('module-' + this.moduleName + '-nav'),
            navContainer = moduleNav.querySelector('.nav'),
            oldWrapper = moduleNav.querySelector('.nav > div');

        // wrap navigation and add the wrapper to the navigation container
        var navWrapper = document.createElement('div');
        navWrapper.classList.add('hidden');
        navContainer.appendChild(navWrapper);

        if (typeof navInner === 'string') {
            navWrapper.innerHTML = navInner;
            navInner = navWrapper.querySelector('.nav-inner');
        } else {
            navWrapper.appendChild(navInner);
        }

        // init item action buttons
        var itemActionsList = navInner.querySelectorAll('.item .actions');
        this.initNavigationActions(itemActionsList);

        // init items
        this.initNavigationItems(navInner);

        // cross fade new navigation
        utils.crossFade(oldWrapper, navWrapper, function () {
            oldWrapper.parentNode.removeChild(oldWrapper);

            if (callback) callback();
        });
    };

    function loadNavigation(callback)
    {
        var moduleNav = document.getElementById('module-' + this.moduleName + '-nav'),
            navContainer = moduleNav.querySelector('.nav'),
            self = this;

        this.picoAdmin.ajax(this.moduleName, 'navigation', null, {
            responseType: 'json',
            success: function (xhr, statusText, response) {
                if (!response || !response.navigation || !/^\s*<div class="nav-inner">/.test(response.navigation)) {
                    return false;
                }

                // add sliding wrapper
                var navWrapper = document.createElement('div');
                navWrapper.classList.add('hidden');
                navWrapper.innerHTML = response.navigation;
                navContainer.appendChild(navWrapper);

                var navInner = navWrapper.querySelector('.nav-inner');

                // init action buttons
                var headlineActions = moduleNav.querySelector('.headline .actions'),
                    itemActionsList = navInner.querySelectorAll('.item .actions');
                self.initNavigationActions(itemActionsList, headlineActions);

                // init items
                self.initNavigationItems(navInner);

                // call callback
                if (callback) callback();
            }
        });
    }

    this.prototype.initNavigationItems = function (navContainer)
    {
        // overwrite me
    };

    this.prototype.initNavigationActions = function (itemActionsList, headlineActions)
    {
        // overwrite me
    };

    this.prototype.expandNavigation = function ()
    {
        var moduleNav = document.getElementById('module-' + this.moduleName + '-nav'),
            menu = moduleNav.querySelector('.nav > div'),
            self = this;

        // make sure the navigation has been loaded already
        if (!menu) {
            loadNavigation.call(this, function () {
                self.expandNavigation();
            });
            return;
        }

        // expand menu
        menu.dataset.expanded = 'true';
        utils.slideDown(menu);

        // expand headline actions
        var headlineActions = moduleNav.querySelector('.headline .actions');
        if (headlineActions) {
            utils.slideRight(headlineActions);
        }

        // collapse all other module navigations
        utils.forEach(this.picoAdmin.modules, function (moduleName, module) {
            if (moduleName !== self.moduleName) {
                module.collapseNavigation();
            }
        });
    };

    this.prototype.collapseNavigation = function ()
    {
        var moduleNav = document.getElementById('module-' + this.moduleName + '-nav');

        // collapse menu
        var menu = moduleNav.querySelector('.nav > div');
        if (menu) {
            menu.dataset.expanded = 'false';
            utils.slideUp(menu);
        }

        // collapse headline actions
        var headlineActions = moduleNav.querySelector('.headline .actions');
        if (headlineActions) {
            utils.slideLeft(headlineActions);
        }
    };

    this.prototype.enable = function ()
    {
        // overwrite me
    };

    this.prototype.disable = function ()
    {
        var moduleNav = document.getElementById('module-' + this.moduleName + '-nav'),
            activeItem = moduleNav.querySelector('.nav .item.active');
        if (activeItem) activeItem.classList.remove('active');
    };

    this.prototype.selectPath = function (path)
    {
        var moduleNav = document.getElementById('module-' + this.moduleName + '-nav'),
            oldActiveItem = moduleNav.querySelector('.nav .item.active'),
            newActiveItem = moduleNav.querySelector('.nav .item[data-path="' + path + '"]');

        if (oldActiveItem) oldActiveItem.classList.remove('active');
        if (newActiveItem) newActiveItem.classList.add('active');
    };

    this.prototype.restoreHistory = function (historyObject, state)
    {
        // overwrite me
    };

    this.prototype.createHistoryObject = function (historyObject)
    {
        // overwrite me
    };

    this.prototype.showNotification = function (notificationData, alert)
    {
        // overwrite me
    };

    this.prototype.hideNotification = function (notificationData, alert)
    {
        // overwrite me
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
            moduleButtons = navigation.querySelectorAll('.module > .headline h3 a'),
            landingModuleButtons = document.querySelectorAll('#landing .module'),
            actionLists = navigation.querySelectorAll('.module .actions'),
            itemAnchors = navigation.querySelectorAll('.module > .nav .item > a');

        utils.forEach(moduleButtons, function (_, moduleButton) {
            moduleButton.classList.add('disabled');
        });
        utils.forEach(landingModuleButtons, function (_, landingModuleButton) {
            landingModuleButton.classList.add('disabled');
        });

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
        var notification = this.picoAdmin.showNotification(
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
            this.picoAdmin.notifications[notificationId],
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

        return notification;
    };

    this.prototype.closeFileNameModal = function ()
    {
        var notification = this.askFileNameModal.alert;
        if (notification) {
            // reset navigation
            var navigation = document.querySelector('header > nav'),
                moduleButtons = navigation.querySelectorAll('.module > .headline h3 a'),
                landingModuleButtons = document.querySelectorAll('#landing .module'),
                actionLists = navigation.querySelectorAll('.module .actions'),
                itemAnchors = navigation.querySelectorAll('.module > .nav .item > a');

            utils.forEach(moduleButtons, function (_, moduleButton) {
                moduleButton.classList.remove('disabled');
            });
            utils.forEach(landingModuleButtons, function (_, landingModuleButton) {
                landingModuleButton.classList.remove('disabled');
            });

            utils.forEach(actionLists, function (_, actionList) { utils.slideRight(actionList); });

            utils.forEach(itemAnchors, function (_, itemAnchor) {
                utils.removeNamedEventListener(itemAnchor, 'click', 'apply-path');
                if (itemAnchor.getAttribute('href') === '') itemAnchor.removeAttribute('href');

                utils.enableNamedEventListener(itemAnchor, 'click', 'action');
            });

            // close conflict notifications
            var conflictNotifications = this.askFileNameModal.conflictNotifications;
            if (conflictNotifications) {
                for (var i = 0; i < conflictNotifications.length; i++) {
                    this.picoAdmin.hideNotification(conflictNotifications[i]);
                }
            }

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
                this.picoAdmin.hideNotification(notification);
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
                var moduleNav = document.getElementById('module-' + this.moduleName + '-nav'),
                    conflictItem = moduleNav.querySelector('.nav .item[data-path="' + value + '"]');
                if (conflictItem) {
                    var conflictNotification = this.picoAdmin.showNotification(
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

            this.picoAdmin.hideNotification(notification);

            // validate path and call success callback
            if (value.substr(-1) === '/') {
                this.picoAdmin.showNotification(
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
});
