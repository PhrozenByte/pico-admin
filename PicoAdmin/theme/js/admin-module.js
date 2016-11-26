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

    this.prototype.askFileName = function (notificationData, alert)
    {
        var navigationButtons = document.querySelectorAll('header > nav .module > .headline h3 a'),
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
        var navigationButtons = document.querySelectorAll('header > nav .module > .headline h3 a'),
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
