function PicoAdminModule(picoAdmin, moduleName)
{
    this.picoAdmin = picoAdmin;
    this.moduleName = moduleName;
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
            menu = moduleNav.querySelector('.nav > div'),
            self = this;

        var toggleMenuEvent = function (event) {
            event.preventDefault();

            var menu = moduleNav.querySelector('.nav > div');
            if (!menu || (menu.dataset.expanded === 'false')) {
                self.expandNavigation();
            } else {
                self.collapseNavigation();
            }
        };

        if (navigationButton) utils.addNamedEventListener(navigationButton, 'click', 'toggle', toggleMenuEvent);
        if (landingButton)    utils.addNamedEventListener(landingButton, 'click', 'toggle', toggleMenuEvent);

        if (menu) {
            // init action buttons
            var headlineActions = moduleNav.querySelector('.headline .actions'),
                itemActionsList = moduleNav.querySelectorAll('.nav .item .actions');

            headlineActions.classList.remove('hidden');
            utils.forEach(itemActionsList, function (_, itemActions) { itemActions.classList.remove('hidden'); });
            self.initNavigationActions(headlineActions, itemActionsList);

            // init items
            self.initNavigationItems(moduleNav.querySelector('.nav'));
        }
    };

    function loadNavigation(callback)
    {
        var moduleNav = document.getElementById('module-' + this.moduleName + '-nav'),
            navContainer = moduleNav.querySelector('.nav'),
            self = this;

        this.picoAdmin.ajax(this.moduleName, 'navigation', null, {
            responseType: 'text',
            success: function (xhr, statusText, response) {
                if (!response || (response === '') || !/^\s*<div class="nav-inner">/.test(response)) {
                    return false;
                }

                // add sliding wrapper
                var wrapper = document.createElement('div');
                wrapper.classList.add('hidden');
                wrapper.innerHTML = response;
                navContainer.appendChild(wrapper);

                // init action buttons
                var headlineActions = moduleNav.querySelector('.headline .actions'),
                    itemActionsList = moduleNav.querySelectorAll('.nav .item .actions');

                utils.forEach(itemActionsList, function (_, itemActions) { itemActions.classList.remove('hidden'); });
                self.initNavigationActions(headlineActions, itemActionsList);

                // init items
                self.initNavigationItems(navContainer);

                // call callback
                callback();
            }
        });
    }

    this.prototype.initNavigationItems = function (navContainer)
    {
        // overwrite me
    };

    this.prototype.initNavigationActions = function (headlineActions, itemActionsList)
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
        var modulePage = document.getElementById('module-' + this.moduleName);
        utils.fadeIn(modulePage);
    };

    this.prototype.disable = function ()
    {
        var modulePage = document.getElementById('module-' + this.moduleName),
            moduleNav = document.getElementById('module-' + this.moduleName + '-nav'),
            activeItem = moduleNav.querySelector('.nav .item.active');

        utils.fadeOut(modulePage);
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

    this.prototype.askFileName = function (notificationData, alert)
    {
        var navigationButtons = document.querySelectorAll('main > aside > nav .module .headline h3 a'),
            landingButtons = document.querySelectorAll('#landing .module');

        utils.forEach(navigationButtons, function (_, navigationButton) {
            navigationButton.classList.add('disabled');
        });
        utils.forEach(landingButtons, function (_, landingButton) {
            landingButton.classList.add('disabled');
        });
    };

    this.prototype.closeFileNameModal = function (notificationData, alert)
    {
        var navigationButtons = document.querySelectorAll('main > aside > nav .module .headline h3 a'),
            landingButtons = document.querySelectorAll('#landing .module');

        utils.forEach(navigationButtons, function (_, navigationButton) {
            navigationButton.classList.remove('disabled');
        });
        utils.forEach(landingButtons, function (_, landingButton) {
            landingButton.classList.remove('disabled');
        });
    };

    this.prototype.submitFileNameModal = function (notificationData, alert)
    {
        // overwrite me
    };
});
