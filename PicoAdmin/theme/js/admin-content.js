function PicoContentAdmin(authToken, baseUrl)
{
    PicoAdmin.call(this, authToken, baseUrl);

    this.yamlEditorOptions = null;
    this.yamlEditor = null;

    this.markdownEditorOptions = null;
    this.markdownEditor = null;

    this.navigation = null;
    this.currentPage = null;
    this.pendingChanges = null;
    this.titleTemplate = null;

    this.currentState = null;
    this.latestState = null;

    this.saveXhr = null;
    this.previewXhr = null;
    this.loadXhr = null;

    this.askFileNameNotification = null;
}

PicoContentAdmin.prototype = Object.create(PicoAdmin.prototype);
PicoContentAdmin.prototype.constructor = PicoAdmin;

PicoContentAdmin.prototype.create = function ()
{
    this.updateHistory();

    this.setYaml('');
    this.setMarkdown('');
    this.setPendingChanges(false);

    var title = this.titleTemplate.replace('{1}', 'Create New Page');
    this.updateNavigation(null, title);

    this.pushHistory(this.getUrl('content', 'create'));
};

PicoContentAdmin.prototype.open = function (page)
{
    this.updateHistory();

    var self = this;
    this.load(page, function (yaml, markdown, title) {
        self.setYaml(yaml);
        self.setMarkdown(markdown);
        self.setPendingChanges(false);

        title = self.getTitleTemplate().replace('{1}', 'Edit ' + title);
        self.updateNavigation(page, title);

        self.pushHistory(self.getUrl('content', 'edit', page));
    });
};

PicoContentAdmin.prototype.save = function (page)
{
    page = page ? page : this.currentPage;
    if (!page) return false;

    console.log('Save page', page);
    return true;
};

PicoContentAdmin.prototype.saveAs = function ()
{
    this.askFileName({
        title: 'Save As',
        value: this.currentPage,
        fileExtension: '.md',
        iconName: 'fa-floppy-o',
        callback: this.save.bind(this)
    });
};

PicoContentAdmin.prototype.reset = function ()
{
    if (this.currentPage !== null) {
        this.updateHistory();

        var self = this;
        this.load(this.currentPage, function (yaml, markdown, title) {
            self.setYaml(yaml);
            self.setMarkdown(markdown);
            self.setPendingChanges(false);

            self.pushHistory(window.location.href);
        });
    } else {
        this.create();
    }
};

PicoContentAdmin.prototype.edit = function ()
{
    if (this.markdownEditor.isPreviewActive()) {
        this.markdownEditor.togglePreview();
    }
};

PicoContentAdmin.prototype.preview = function ()
{
    if (!this.markdownEditor.isPreviewActive()) {
        this.markdownEditor.togglePreview();
    }
};

PicoContentAdmin.prototype.requestPreview = function (yaml, markdown, success, error, complete)
{
    if (this.previewXhr !== null) {
        this.previewXhr.abort();
    }

    this.previewXhr = this.ajax('content', 'preview', null, {
        postData: {
            yaml: yaml,
            markdown: markdown
        },
        responseType: 'json',
        success: success,
        error: error,
        complete: (function (xhr, statusText, response) {
            if (complete) complete(xhr, statusText, response);
            this.previewXhr = null;
        }).bind(this)
    });

    return this.previewXhr;
};

PicoContentAdmin.prototype.fullPreview = function ()
{
    // create a hidden form with the appropiate content
    var url = this.getUrl('content', 'fullPreview', this.currentPage),
        form = utils.parse(
            '<form action="' + url + '" method="POST" target="_blank" class="hidden">' +
            '   <textarea class="yaml" name="yaml"></textarea>' +
            '   <textarea class="markdown" name="markdown"></textarea>' +
            '   <input class="auth_client_token" type="hidden" name="auth_client_token" value="" />' +
            '</form>'
        );

    form.querySelector('.yaml').value = this.getYaml();
    form.querySelector('.markdown').value = this.getMarkdown();
    form.querySelector('.auth_client_token').value = this.getAuthToken();

    document.body.appendChild(form);

    // submit the form
    // When this method is called synchronously by a user click event
    // (i.e. the user clicked the toolbar button), this will work just fine.
    // However, when this isn't the case (i.e. called by a keyboard shortcut),
    // the browser will block this as a undesirable pop-up and throw a exception.
    try {
        form.submit();
    } catch(e) {
        window.alert(
            'Your web browser has just blocked your attempt to open the full page preview in ' +
            'a new window or tab. Your web browser falsely thinks that a malicious website ' +
            'just tried to open a pop-up. You can either use the matching toolbar button ' +
            'to open the full page preview instead, or configure your web browser to ' +
            'allow pop-ups on ' + window.location.origin + '/.'
        );
    }

    document.body.removeChild(form);
};

PicoContentAdmin.prototype.delete = function (page)
{
    var currentHistoryObject = this.getHistoryObject(this.currentState);

    var self = this;
    this.load(page, function (yaml, markdown, title) {
        self.updateHistory({
            page: page,
            title: self.getTitleTemplate().replace('{1}', 'Recover deleted ' + title),
            yaml: yaml,
            markdown: markdown,
            pendingChanges: false,
            url: self.getUrl('content', 'edit', page)
        });

        self.pushHistory(currentHistoryObject);

        self.requestDelete(page);
    });
};

PicoContentAdmin.prototype.requestDelete = function (page, success, error, complete)
{
    return this.ajax('content', 'delete', page, {
        success: success,
        error: error,
        complete: complete
    });
};

PicoContentAdmin.prototype.load = function (page, callback)
{
    this.requestLoad(page, function (xhr, statusText, response) {
        if (
            !response
            || (response.yaml === undefined) || (response.yaml === null)
            || (response.markdown === undefined) || (response.markdown === null)
            || (response.title === undefined) || (response.title === null)
        ) {
            return false;
        }

        callback(response.yaml, response.markdown, response.title);
    });
};

PicoContentAdmin.prototype.requestLoad = function (page, success, error, complete)
{
    if (this.loadXhr !== null) {
        this.loadXhr.abort();
    }

    this.loadXhr = this.ajax('content', 'load', page, {
        responseType: 'json',
        success: success,
        error: error,
        complete: (function (xhr, statusText, response) {
            if (complete) complete(xhr, statusText, response);
            this.loadXhr = null;
        }).bind(this)
    });

    return this.loadXhr;
};

PicoContentAdmin.prototype.askFileName = function (callback, options) {
    if (utils.isPlainObject(callback)) {
        options = callback;
    } else {
        if (!options) options = {};
        if (callback) options.callback = callback;
    }

    options = utils.extend({
        title: null,
        value: '',
        fileExtension: null,
        iconName: null,
        className: null,
        closeable: true,
        callback: null
    }, options);

    // disallow opening multiple file name notifications at the same time
    if (this.askFileNameNotification) return false;

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

    if (options.fileExtension) {
        inputGroup.insertBefore(
            utils.parse('<div class="file_ext">' + options.fileExtension + '</div>'),
            submitButton
        );
    }

    inputField.addEventListener('focus', function () { inputGroup.classList.add('focus'); });
    inputField.addEventListener('blur', function () { inputGroup.classList.remove('focus'); });

    // set default value
    inputField.value = options.value;

    // instead of opening files, take the path of the clicked page in the navigation as value
    var navContainer = this.getNavigation().querySelector('.nav'),
        anchors = navContainer.querySelectorAll('.item > a'),
        applyPathEvent = function (event) {
            var anchor = event.currentTarget,
                li = utils.closest(anchor, 'li'),
                path = li.dataset.file || li.dataset.dir;

            if (path) {
                event.preventDefault();
                inputField.value = path;
            }
        };

    navContainer.classList.remove('allow-open');
    utils.forEach(anchors, function (_, anchor) {
        if (!anchor.hasAttribute('href')) anchor.setAttribute('href', '#');
        anchor.addEventListener('click', applyPathEvent);
    });

    // hide all action buttons in the navigation
    var actionLists = this.getNavigation().querySelectorAll('.headline .actions, .nav .item > .actions');
    utils.forEach(actionLists, function (_, actionList) { utils.slideLeft(actionList); });

    // disable the "Save As" toolbar button
    var toolbar = this.getMarkdownEditor().toolbarElements;
    if (toolbar['save-as']) toolbar['save-as'].classList.add('disabled');

    // rollback the above changes when the notification is being closed
    var closeCallback = (function () {
        navContainer.classList.add('allow-open');
        utils.forEach(anchors, function (_, anchor) {
            if (anchor.getAttribute('href') === '#') anchor.removeAttribute('href');
            anchor.removeEventListener('click', applyPathEvent);
        });

        utils.forEach(actionLists, function (_, actionList) { utils.slideRight(actionList); });
        if (toolbar['save-as']) toolbar['save-as'].classList.remove('disabled');

        this.askFileNameNotification = null;
    }).bind(this);

    // create the notification
    var notification = this.showNotification(
        options.title,
        content,
        { iconName: options.iconName, className: options.className },
        null,
        options.closeable,
        closeCallback
    );

    // make the save button functional
    var self = this;
    submitButton.addEventListener('click', function () {
        self.hideNotification(notification);
        if (options.callback) options.callback(inputField.value);
    });

    this.askFileNameNotification = notification;

    return true;
};

PicoContentAdmin.prototype.initYamlEditor = function (element, options)
{
    if (typeof element === 'string') element = document.querySelector(element);
    if (!utils.isPlainObject(options)) options = {};

    // prepare CodeMirror options
    options = utils.extend({ forceSync: false }, options, {
        element: element,
        mode: 'yaml'
    });

    // init CodeMirror
    this.yamlEditorOptions = options;
    this.yamlEditor = new CodeMirror.fromTextArea(element, options);

    var self = this;
    this.yamlEditor.on('change', function (editor) {
        self.setPendingChanges(true);

        // force syncing all changes
        if (options.forceSync) editor.save();
    });

    return this.yamlEditor;
};

PicoContentAdmin.prototype.getYamlEditor = function ()
{
    return this.yamlEditor;
};

PicoContentAdmin.prototype.getYaml = function ()
{
    return (this.yamlEditor !== null) ? this.yamlEditor.getValue() : null;
};

PicoContentAdmin.prototype.setYaml = function (value)
{
    if (this.yamlEditor !== null) {
        this.yamlEditor.setValue(value);
        this.yamlEditor.save();
    }
};

PicoContentAdmin.prototype.initMarkdownEditor = function (element, options)
{
    if (typeof element === 'string') element = document.querySelector(element);
    if (!utils.isPlainObject(options)) options = {};
    var self = this;

    // prepare SimpleMDE options
    utils.extend(options, {
        element: element,
        previewRender: function (plainText, preview) {
            var editor = self.getMarkdownEditor(),
                editorElement = editor.codemirror.getWrapperElement().querySelector('.CodeMirror-scroll'),
                yamlWrapper = self.getYamlEditor().getWrapperElement(),
                requestPreview = !preview.classList.contains('active');

            if (requestPreview) {
                var markdownContent = plainText,
                    yamlContent = self.getYaml(),
                    previewButton = editor.toolbarElements.preview,
                    sideBySideButton = editor.toolbarElements['side-by-side'],
                    editorButton = null;

                if (previewButton && previewButton.classList.contains('active')) {
                    editorButton = previewButton;
                } else if (sideBySideButton && sideBySideButton.classList.contains('active')) {
                    editorButton = sideBySideButton;
                }

                // we're now officially in preview mode
                preview.classList.add('active');

                // keep the editor preview hidden
                // until the content is actually loaded
                preview.classList.add('hidden');

                self.requestPreview(
                    yamlContent,
                    markdownContent,
                    function (xhr, statusText, response) {
                        if (!response || (response.preview === undefined) || (response.preview === null)) {
                            return false;
                        }

                        // show preview content
                        preview.innerHTML = response.preview;

                        // hide markdown and YAML editors
                        yamlWrapper.classList.add('hidden');
                        editorElement.classList.add('hidden');
                    },
                    function (xhr, statusText, response) {
                        // highlight button for 5 seconds
                        if (editorButton) {
                            window.requestAnimationFrame(function() { editorButton.classList.add('error'); });
                            window.setTimeout(function () { editorButton.classList.remove('error'); }, 5000);
                        }

                        // return to edit mode
                        self.edit();
                    },
                    function (xhr, statusText, response, wasSuccesful) {
                        // reset editor preview visibility
                        preview.classList.remove('hidden');
                    }
                );
            } else {
                // abort possibly still ongoing request
                if (self.previewXhr) self.previewXhr.abort();

                // show markdown and YAML editors
                yamlWrapper.classList.remove('hidden');
                editorElement.classList.remove('hidden');

                // preview is now deactivated
                preview.classList.remove('active');
            }
        }
    });

    // user extends/overwrites default shortcuts
    var picoKeyMap = {},
        picoEditorActions = {
            'create': function () { self.create(); },
            'save': function () { self.save(); },
            'save-as': function () { self.saveAs(); },
            'reset': function () { self.reset(); },
            'full-preview': function () { self.fullPreview(); }
        };

    options.shortcuts = utils.extend({
        'toggleBold': 'Cmd-B',
        'toggleItalic': 'Cmd-I',
        'drawLink': 'Cmd-K',
        'toggleHeadingSmaller': 'Cmd-H',
        'toggleHeadingBigger': 'Shift-Cmd-H',
        'drawImage': 'Cmd-Alt-I',
        'toggleBlockquote': 'Cmd-\'',
        'toggleOrderedList': 'Cmd-Alt-L',
        'toggleUnorderedList': 'Cmd-L',
        'toggleCodeBlock': 'Cmd-Alt-C',
        'togglePreview': 'Cmd-P',
        'toggleStrikethrough': null,
        'toggleHeading1': null,
        'toggleHeading2': null,
        'toggleHeading3': null,
        'cleanBlock': 'Cmd-E',
        'drawTable': 'Cmd-T',
        'drawHorizontalRule': null,
        'undo': 'Cmd-Z',
        'redo': 'Shift-Cmd-Z',
        'toggleSideBySide': null,
        'toggleFullScreen': null,
        'create': 'Cmd-N',
        'save': 'Cmd-S',
        'save-as': 'Cmd-Alt-S',
        'reset': null,
        'full-preview': 'Cmd-Alt-P'
    }, options.shortcuts || {});

    var isMac = /Mac/.test(navigator.platform);
    utils.forEach(picoEditorActions, function (key, callback) {
        if (options.shortcuts[key] !== null) {
            if (isMac) {
                options.shortcuts[key] = options.shortcuts[key].replace('Ctrl', 'Cmd');
            } else {
                options.shortcuts[key] = options.shortcuts[key].replace('Cmd', 'Ctrl');
            }

            picoKeyMap[options.shortcuts[key]] = picoEditorActions[key];
        }
    });

    // allow user to configure toolbar with button identifiers
    if (options.toolbar) {
        var toolbarButtons = [],
            builtInToolbarButtons = {
                'bold': {            action: SimpleMDE.toggleBold,              className: 'fa fa-bold',                                 title: 'Bold' },
                'italic': {          action: SimpleMDE.toggleItalic,            className: 'fa fa-italic',                               title: 'Italic' },
                'strikethrough': {   action: SimpleMDE.toggleStrikethrough,     className: 'fa fa-strikethrough',                        title: 'Strikethrough' },
                'heading': {         action: SimpleMDE.toggleHeadingSmaller,    className: 'fa fa-header',                               title: 'Heading' },
                'heading-smaller': { action: SimpleMDE.toggleHeadingSmaller,    className: 'fa fa-header fa-header-x fa-header-smaller', title: 'Smaller Heading' },
                'heading-bigger': {  action: SimpleMDE.toggleHeadingBigger,     className: 'fa fa-header fa-header-x fa-header-bigger',  title: 'Bigger Heading' },
                'heading-1': {       action: SimpleMDE.toggleHeading1,          className: 'fa fa-header fa-header-x fa-header-1',       title: 'Big Heading' },
                'heading-2': {       action: SimpleMDE.toggleHeading2,          className: 'fa fa-header fa-header-x fa-header-2',       title: 'Medium Heading' },
                'heading-3': {       action: SimpleMDE.toggleHeading3,          className: 'fa fa-header fa-header-x fa-header-3',       title: 'Small Heading' },
                'code': {            action: SimpleMDE.toggleCodeBlock,         className: 'fa fa-code',                                 title: 'Code' },
                'quote': {           action: SimpleMDE.toggleBlockquote,        className: 'fa fa-quote-left',                           title: 'Quote' },
                'unordered-list': {  action: SimpleMDE.toggleUnorderedList,     className: 'fa fa-list-ul',                              title: 'Generic List' },
                'ordered-list': {    action: SimpleMDE.toggleOrderedList,       className: 'fa fa-list-ol',                              title: 'Numbered List' },
                'clean-block': {     action: SimpleMDE.cleanBlock,              className: 'fa fa-eraser fa-clean-block',                title: 'Clean block' },
                'link': {            action: SimpleMDE.drawLink,                className: 'fa fa-link',                                 title: 'Create Link' },
                'image': {           action: SimpleMDE.drawImage,               className: 'fa fa-picture-o',                            title: 'Insert Image' },
                'table': {           action: SimpleMDE.drawTable,               className: 'fa fa-table',                                title: 'Insert Table' },
                'horizontal-rule': { action: SimpleMDE.drawHorizontalRule,      className: 'fa fa-minus',                                title: 'Insert Horizontal Line' },
                'preview': {         action: SimpleMDE.togglePreview,           className: 'fa fa-eye no-disable',                       title: 'Toggle Preview' },
                'side-by-side': {    action: SimpleMDE.toggleSideBySide,        className: 'fa fa-columns no-disable no-mobile',         title: 'Toggle Side by Side' },
                'fullscreen': {      action: SimpleMDE.toggleFullScreen,        className: 'fa fa-arrows-alt no-disable no-mobile',      title: 'Toggle Fullscreen' },
                'undo': {            action: SimpleMDE.undo,                    className: 'fa fa-undo no-disable',                      title: 'Undo' },
                'redo': {            action: SimpleMDE.redo,                    className: 'fa fa-repeat no-disable',                    title: 'Redo' },
                'create': {          action: picoEditorActions.create,          className: 'fa fa-file-o',                               title: 'Create New Page' },
                'save': {            action: picoEditorActions.save,            className: 'fa fa-floppy-o',                             title: 'Save' },
                'save-as': {         action: picoEditorActions['save-as'],      className: 'fa fa-floppy-o fa-sub-arrow',                title: 'Save As' },
                'reset': {           action: picoEditorActions.reset,           className: 'fa fa-times-circle',                         title: 'Discard all changes' },
                'full-preview': {    action: picoEditorActions['full-preview'], className: 'fa fa-home',                                 title: 'Open full page preview' },
                'docs': {            action: 'http://picocms.org/docs/',        className: 'fa fa-question-circle',                      title: 'Pico Documentation' },
            };

        utils.forEach(options.toolbar, function (_, button) {
            if ((typeof button === 'string') && (builtInToolbarButtons[button] !== undefined)) {
                // append binding of Pico shortcuts to title
                var toolbarButtonTitle = builtInToolbarButtons[button].title;
                if ((picoEditorActions[button] !== undefined) && (options.shortcuts[button] !== null)) {
                    toolbarButtonTitle += ' (' + options.shortcuts[button] + ')';
                }

                // built-in toolbar button
                toolbarButtons.push(utils.extend(builtInToolbarButtons[button], { name: button, title: toolbarButtonTitle }));
            } else {
                // new toolbar button or a separator
                toolbarButtons.push(button);
            }
        });

        options.toolbar = toolbarButtons;
    }

    // init SimpleMDE
    this.markdownEditorOptions = options;
    this.markdownEditor = new SimpleMDE(options);

    if (Object.keys(picoKeyMap).length !== 0) {
        this.markdownEditor.codemirror.addKeyMap(picoKeyMap);
    }

    // update pending changes
    this.setPendingChanges(false);
    this.markdownEditor.codemirror.on('change', function () {
        self.setPendingChanges(true);
    });

    return this.markdownEditor;
};

PicoContentAdmin.prototype.getMarkdownEditor = function ()
{
    return this.markdownEditor;
};

PicoContentAdmin.prototype.getMarkdown = function ()
{
    return (this.markdownEditor !== null) ? this.markdownEditor.codemirror.getValue() : null;
};

PicoContentAdmin.prototype.setMarkdown = function (value)
{
    if (this.markdownEditor !== null) {
        this.markdownEditor.codemirror.setValue(value);
        this.markdownEditor.codemirror.save();
    }
};

PicoContentAdmin.prototype.setPendingChanges = function (pendingChanges)
{
    var toolbar = this.getMarkdownEditor().toolbarElements;

    if (pendingChanges) {
        if (!this.pendingChanges) {
            if (toolbar.save) toolbar.save.classList.add('fa-sub-star');
            if (toolbar.reset) toolbar.reset.classList.remove('disabled');
        }
    } else if (this.pendingChanges || (this.pendingChanges === null)) {
        if (toolbar.save) toolbar.save.classList.remove('fa-sub-star');
        if (toolbar.reset) toolbar.reset.classList.add('disabled');
    }

    this.pendingChanges = pendingChanges;
};

PicoContentAdmin.prototype.getPendingChanges = function ()
{
    return this.pendingChanges;
};

PicoContentAdmin.prototype.initNavigation = function (element, currentPage, titleTemplate)
{
    var self = this;
    this.navigation = element;
    this.currentPage = currentPage;
    this.titleTemplate = titleTemplate;

    // update navigation
    this.updateNavigation(currentPage);

    // restore old editor states when navigating back/forward
    // without the need of reloading the page
    window.addEventListener('popstate', (function (event) {
        if (this.currentState === this.latestState) {
            // navigating away from latest page; update history object
            // TODO: open question: is this (explicitly added) limitation really favored?
            this.updateHistory({ url: this.getHistoryObject(this.currentState).url });
        }

        if (event.state && event.state.PicoContentAdmin) {
            this.currentState = event.state.PicoContentAdmin;
            var historyObject = this.getHistoryObject(this.currentState);

            this.setYaml(historyObject.yaml);
            this.setMarkdown(historyObject.markdown);
            this.setPendingChanges(historyObject.pendingChanges);

            this.updateNavigation(historyObject.page, historyObject.title);
        }
    }).bind(this));

    // restore history objects of a previous session
    this.latestState = parseInt(sessionStorage.getItem('picoContentAdminHistory')) || null;
    if (!this.latestState) {
        this.currentState = this.latestState = 1;
        this.updateHistory();
    } else {
        var currentHistoryObject = this.getHistoryObject();

        this.currentState = 1;
        for (var historyObject; this.currentState <= this.latestState; this.currentState++) {
            historyObject = this.getHistoryObject(this.currentState);
            if (!historyObject.isLost) {
                window.history.pushState(
                    { PicoContentAdmin: this.currentState },
                    historyObject.title,
                    '/' + historyObject.url.replace(/^(?:https?:\/\/[^/]+)?(?:\/)?/, '')
                );
            }
        }

        this.pushHistory(currentHistoryObject);
    }

    // users shouldn't use the browser's reload button
    window.addEventListener('beforeunload', function (event) {
        event.preventDefault();
        self.updateHistory();
    });

    // clickable navigation items
    var openPageEvent = function (event) {
        var anchor = event.currentTarget,
            page = utils.closest(anchor, 'li').dataset.id,
            container = utils.closest(anchor, '.nav');

        if (page && container.classList.contains('allow-open')) {
            event.preventDefault();
            self.open(page);
        }
    };

    utils.forEach(element.querySelectorAll('.nav .item > a[href]'), function (_, anchor) {
        anchor.addEventListener('click', openPageEvent);
    });

    // clickable action icons
    var createPageEvent = function (event) {
        event.preventDefault();

        var icon = event.currentTarget,
            path = '';

        if (utils.closest(icon, '.actions').parentNode.classList.contains('item')) {
            var li = utils.closest(event.target, 'li');
            path = li.dataset.file || li.dataset.dir;
        }

        self.askFileName({
            title: 'Create New Page',
            value: path ? path + '/' : '',
            fileExtension: '.md',
            iconName: 'fa-plus',
            callback: (function (page) {
                this.create();
                this.currentPage = page;
            }).bind(self)
        });
    };

    element.querySelector('.headline .actions .create').addEventListener('click', createPageEvent);

    utils.forEach(element.querySelectorAll('.nav .item > .actions .create'), function (_, icon) {
        icon.addEventListener('click', createPageEvent);
    });

    utils.forEach(element.querySelectorAll('.nav .item > .actions .delete'), function (_, icon) {
        var page = utils.closest(icon, 'li').dataset.id;
        icon.addEventListener('click', function (event) {
            event.preventDefault();
            self.delete(page);
        });
    });
};

PicoContentAdmin.prototype.updateNavigation = function (page, title)
{
    // update page title
    if (title) document.title = title;

    // update navigation
    var activeNavigationItem = this.getNavigation().querySelector('li.active');
    if (activeNavigationItem) activeNavigationItem.classList.remove('active');

    if (page) {
        var navigationItem = this.getNavigation().querySelector('li[data-id="' + page + '"]');
        if (navigationItem) navigationItem.classList.add('active');
    }

    // update toolbar
    var toolbar = this.getMarkdownEditor().toolbarElements;
    if (page) {
        if (toolbar.save) toolbar.save.classList.remove('disabled');
    } else {
        if (toolbar.save) toolbar.save.classList.add('disabled');
    }

    // update current page
    this.currentPage = page;
};

PicoContentAdmin.prototype.updateHistory = function (historyObject)
{
    historyObject = utils.extend(
        { lastUpdate: (new Date()).getTime() },
        this.getHistoryObject(),
        historyObject || {}
    );

    var oldHistoryObject = this.getHistoryObject(this.currentState);
    this.setHistoryObject(this.currentState, historyObject);

    // replace the history object only when necessary
    if (!oldHistoryObject || (historyObject.title !== oldHistoryObject.title) || (historyObject.url !== oldHistoryObject.url)) {
        window.history.replaceState(
            { PicoContentAdmin: this.currentState },
            historyObject.title,
            '/' + historyObject.url.replace(/^(?:https?:\/\/[^/]+)?(?:\/)?/, '')
        );
    }
};

PicoContentAdmin.prototype.pushHistory = function (url, historyObject)
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
        this.getHistoryObject(),
        historyObject
    );

    this.setHistoryObject(++this.latestState, historyObject);
    this.currentState = this.latestState;

    window.history.pushState(
        { PicoContentAdmin: this.currentState },
        historyObject.title,
        '/' + historyObject.url.replace(/^(?:https?:\/\/[^/]+)?(?:\/)?/, '')
    );

    // update number of history states
    sessionStorage.setItem('picoContentAdminHistory', this.latestState);
};

PicoContentAdmin.prototype.setHistoryObject = function (state, historyObject)
{
    sessionStorage.setItem('picoContentAdminHistory' + state, JSON.stringify(historyObject));
};

PicoContentAdmin.prototype.getHistoryObject = function (state)
{
    // return new history object
    if (state === undefined) {
        return {
            page: this.currentPage,
            title: document.title,
            yaml: this.getYaml(),
            markdown: this.getMarkdown(),
            pendingChanges: this.pendingChanges,
            url: window.location.href
        };
    }

    // return existing history object
    // however, this might fail; return null in this case
    return JSON.parse(sessionStorage.getItem('picoContentAdminHistory' + state) || 'null');
};

PicoContentAdmin.prototype.getNavigation = function ()
{
    return this.navigation;
};

PicoContentAdmin.prototype.getCurrentPage = function ()
{
    return this.currentPage;
};

PicoContentAdmin.prototype.getTitleTemplate = function ()
{
    return this.titleTemplate;
};
