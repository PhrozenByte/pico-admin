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

    this.load(page, (function (yaml, markdown, title) {
        this.setYaml(yaml);
        this.setMarkdown(markdown);
        this.setPendingChanges(false);

        title = this.titleTemplate.replace('{1}', 'Edit ' + title);
        this.updateNavigation(page, title);

        this.pushHistory(this.getUrl('content', 'edit', page));
    }).bind(this));
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

        this.load(this.currentPage, (function (yaml, markdown, title) {
            this.setYaml(yaml);
            this.setMarkdown(markdown);
            this.setPendingChanges(false);

            this.pushHistory(window.location.href);
        }).bind(this));
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

    this.load(page, (function (yaml, markdown, title) {
        this.updateHistory({
            page: page,
            title: this.titleTemplate.replace('{1}', 'Recover deleted ' + title),
            yaml: yaml,
            markdown: markdown,
            pendingChanges: false,
            url: this.getUrl('content', 'edit', page)
        });

        this.pushHistory(currentHistoryObject);

        this.requestDelete(page);
    }).bind(this));
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
    this.requestLoad(page, (function (xhr, statusText, response) {
        if (
            !response
            || (response.yaml === undefined) || (response.yaml === null)
            || (response.markdown === undefined) || (response.markdown === null)
            || (response.title === undefined) || (response.title === null)
        ) {
            return false;
        }

        callback(response.yaml, response.markdown, response.title);
    }).bind(this));
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

    var content = utils.parse(
            '<div class="input-group">' +
            '    <input type="text" />' +
            '    <div class="button" role="button">' +
            '        <span class="fa fa-floppy-o" aria-hidden="true"></span>' +
            '        <span class="sr-only">Save</span>' +
            '    </div>' +
            '</div>'
        ),
        inputField = content.querySelector('div > input'),
        submitButton = content.querySelector('div > .button');

    if (options.fileExtension) {
        content.insertBefore(
            utils.parse('<div class="file_ext">' + options.fileExtension + '</div>'),
            submitButton
        );
    }

    inputField.value = options.value;

    var notification = this.showNotification(
        options.title,
        content,
        { iconName: options.iconName, className: options.className },
        null,
        options.closeable
    );

    submitButton.addEventListener('click', function () {
        notification.close();
        if (options.callback) options.callback(inputField.value);
    });
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

    this.yamlEditor.on('change', (function (editor) {
        this.setPendingChanges(true);

        // force syncing all changes
        if (options.forceSync) editor.save();
    }).bind(this));

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

    // prepare SimpleMDE options
    utils.extend(options, {
        element: element,
        previewRender: (function (plainText, preview) {
            var editor = this.getMarkdownEditor(),
                yamlWrapper = this.yamlEditor.getWrapperElement(),
                previewButton = editor.toolbarElements.preview,
                sideBySideButton = editor.toolbarElements['side-by-side'],
                requestPreview = null;

            if (previewButton) requestPreview = previewButton.classList.contains('active') ? 'previewButton' : false;
            if (sideBySideButton) requestPreview = sideBySideButton.classList.contains('active') ? 'sideBySideButton' : false;

            // rely on .active class of built-in buttons to determine whether preview is opened or closed
            // if this isn't possible, assume that the preview is being opened
            if (requestPreview || (requestPreview === null)) {
                var markdownContent = plainText,
                    yamlContent = this.getYaml();

                // keep the editor preview hidden
                // until the content is actually loaded
                preview.classList.add('hidden');

                this.requestPreview(
                    yamlContent,
                    markdownContent,
                    (function (xhr, statusText, response) {
                        if (!response || (response.preview === undefined) || (response.preview === null)) {
                            return false;
                        }

                        // show preview content
                        preview.innerHTML = response.preview;

                        // hide YAML editor
                        if (requestPreview !== null) {
                            yamlWrapper.classList.add('hidden');
                        }
                    }).bind(this),
                    (function (xhr, statusText, response) {
                        var button = null;
                        if (requestPreview === 'previewButton') {
                            button = previewButton;
                        } else if (requestPreview === 'sideBySideButton') {
                            button = sideBySideButton;
                        }

                        // highlight button for 5 seconds
                        if (button) {
                            window.requestAnimationFrame(function() { button.classList.add('error'); });
                            window.setTimeout(function () { button.classList.remove('error'); }, 5000);
                        }

                        // return to edit mode
                        this.edit();
                    }).bind(this),
                    function (xhr, statusText, response, wasSuccesful) {
                        // reset editor preview visibility
                        // (usually makes it visible again)
                        preview.classList.remove('hidden');
                    }
                );
            } else if (requestPreview !== null) {
                // reset YAML editor visibility
                yamlWrapper.classList.remove('hidden');
            }
        }).bind(this)
    });

    // user extends/overwrites default shortcuts
    var picoKeyMap = {},
        picoShortcutBindings = {
            'create': this.create.bind(this),
            'save': this.save.bind(this),
            'save-as': this.saveAs.bind(this),
            'reset': this.reset.bind(this),
            'full-preview': this.fullPreview.bind(this)
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
    utils.forEach(picoShortcutBindings, (function (key, callback) {
        if (options.shortcuts[key] !== null) {
            if (isMac) {
                options.shortcuts[key] = options.shortcuts[key].replace('Ctrl', 'Cmd');
            } else {
                options.shortcuts[key] = options.shortcuts[key].replace('Cmd', 'Ctrl');
            }

            picoKeyMap[options.shortcuts[key]] = function () { picoShortcutBindings[key](); };
        }
    }).bind(this));

    // allow user to configure toolbar with button identifiers
    if (options.toolbar) {
        var toolbarButtons = [],
            builtInToolbarButtons = {
                'bold': {            action: SimpleMDE.toggleBold,           className: 'fa fa-bold',                                 title: 'Bold' },
                'italic': {          action: SimpleMDE.toggleItalic,         className: 'fa fa-italic',                               title: 'Italic' },
                'strikethrough': {   action: SimpleMDE.toggleStrikethrough,  className: 'fa fa-strikethrough',                        title: 'Strikethrough' },
                'heading': {         action: SimpleMDE.toggleHeadingSmaller, className: 'fa fa-header',                               title: 'Heading' },
                'heading-smaller': { action: SimpleMDE.toggleHeadingSmaller, className: 'fa fa-header fa-header-x fa-header-smaller', title: 'Smaller Heading' },
                'heading-bigger': {  action: SimpleMDE.toggleHeadingBigger,  className: 'fa fa-header fa-header-x fa-header-bigger',  title: 'Bigger Heading' },
                'heading-1': {       action: SimpleMDE.toggleHeading1,       className: 'fa fa-header fa-header-x fa-header-1',       title: 'Big Heading' },
                'heading-2': {       action: SimpleMDE.toggleHeading2,       className: 'fa fa-header fa-header-x fa-header-2',       title: 'Medium Heading' },
                'heading-3': {       action: SimpleMDE.toggleHeading3,       className: 'fa fa-header fa-header-x fa-header-3',       title: 'Small Heading' },
                'code': {            action: SimpleMDE.toggleCodeBlock,      className: 'fa fa-code',                                 title: 'Code' },
                'quote': {           action: SimpleMDE.toggleBlockquote,     className: 'fa fa-quote-left',                           title: 'Quote' },
                'unordered-list': {  action: SimpleMDE.toggleUnorderedList,  className: 'fa fa-list-ul',                              title: 'Generic List' },
                'ordered-list': {    action: SimpleMDE.toggleOrderedList,    className: 'fa fa-list-ol',                              title: 'Numbered List' },
                'clean-block': {     action: SimpleMDE.cleanBlock,           className: 'fa fa-eraser fa-clean-block',                title: 'Clean block' },
                'link': {            action: SimpleMDE.drawLink,             className: 'fa fa-link',                                 title: 'Create Link' },
                'image': {           action: SimpleMDE.drawImage,            className: 'fa fa-picture-o',                            title: 'Insert Image' },
                'table': {           action: SimpleMDE.drawTable,            className: 'fa fa-table',                                title: 'Insert Table' },
                'horizontal-rule': { action: SimpleMDE.drawHorizontalRule,   className: 'fa fa-minus',                                title: 'Insert Horizontal Line' },
                'preview': {         action: SimpleMDE.togglePreview,        className: 'fa fa-eye no-disable',                       title: 'Toggle Preview' },
                'side-by-side': {    action: SimpleMDE.toggleSideBySide,     className: 'fa fa-columns no-disable no-mobile',         title: 'Toggle Side by Side' },
                'fullscreen': {      action: SimpleMDE.toggleFullScreen,     className: 'fa fa-arrows-alt no-disable no-mobile',      title: 'Toggle Fullscreen' },
                'undo': {            action: SimpleMDE.undo,                 className: 'fa fa-undo no-disable',                      title: 'Undo' },
                'redo': {            action: SimpleMDE.redo,                 className: 'fa fa-repeat no-disable',                    title: 'Redo' },
                'create': {          action: this.create.bind(this),         className: 'fa fa-file-o',                               title: 'Create New Page' },
                'save': {            action: this.save.bind(this),           className: 'fa fa-floppy-o',                             title: 'Save' },
                'save-as': {         action: this.saveAs.bind(this),         className: 'fa fa-floppy-o fa-sub-arrow',                title: 'Save As' },
                'reset': {           action: this.reset.bind(this),          className: 'fa fa-times-circle',                         title: 'Discard all changes' },
                'full-preview': {    action: this.fullPreview.bind(this),    className: 'fa fa-home',                                 title: 'Open full page preview' },
                'docs': {            action: 'http://picocms.org/docs/',     className: 'fa fa-question-circle',                      title: 'Pico Documentation' },
            };

        utils.forEach(options.toolbar, function (_, button) {
            if ((typeof button === 'string') && (builtInToolbarButtons[button] !== undefined)) {
                // append binding of Pico shortcuts to title
                var toolbarButtonTitle = builtInToolbarButtons[button].title;
                if ((picoShortcutBindings[button] !== undefined) && (options.shortcuts[button] !== null)) {
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

    this.setPendingChanges(false);
    this.markdownEditor.codemirror.on('change', (function () {
        this.setPendingChanges(true);
    }).bind(this));

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

        this.currentState++;
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
    window.addEventListener('beforeunload', (function (event) {
        event.preventDefault();
        this.updateHistory();
    }).bind(this));

    // clickable navigation items
    utils.forEach(element.querySelectorAll('.nav .item a'), (function (_, anchor) {
        var page = utils.closest(anchor, 'li').dataset.id;
        anchor.addEventListener('click', (function (event) {
            event.preventDefault();
            this.open(page);
        }).bind(this));
    }).bind(this));

    // clickable action icons
    var createPageEvent = function (event) {
        event.preventDefault();

        var icon = event.currentTarget,
            path = '';

        if (utils.closest(icon, '.actions').parentNode.classList.contains('item')) {
            var li = utils.closest(event.target, 'li');
            path = li.dataset.file || li.dataset.dir;
        }

        this.askFileName({
            title: 'Create New Page',
            value: path ? path + '/' : '',
            fileExtension: '.md',
            iconName: 'fa-plus',
            callback: (function (page) {
                this.create();
                this.currentPage = page;
            }).bind(this)
        });
    };

    element.querySelector('.headline .actions .create').addEventListener('click', createPageEvent.bind(this));

    utils.forEach(element.querySelectorAll('.nav .item .actions .create'), (function (_, icon) {
        icon.addEventListener('click', createPageEvent.bind(this));
    }).bind(this));

    utils.forEach(element.querySelectorAll('.nav .item .actions .delete'), (function (_, icon) {
        var page = utils.closest(icon, 'li').dataset.id;
        icon.addEventListener('click', (function (event) {
            event.preventDefault();
            this.delete(page);
        }).bind(this));
    }).bind(this));
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
