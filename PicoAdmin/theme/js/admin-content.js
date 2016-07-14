function PicoContentAdmin(authToken, baseUrl) {
    PicoAdmin.call(this, authToken, baseUrl);

    this.yamlEditorOptions = null;
    this.yamlEditor = null;

    this.markdownEditorOptions = null;
    this.markdownEditor = null;

    this.navigation = null;
    this.currentPage = null;
    this.pendingChanges = null;
    this.titleTemplate = null;

    this.openXhr = null;
    this.previewXhr = null;
}

PicoContentAdmin.prototype = Object.create(PicoAdmin.prototype);
PicoContentAdmin.prototype.constructor = PicoAdmin;

PicoContentAdmin.prototype.open = function (page, callback) {
    this.requestOpen(page, (function (xhr, statusText, response) {
        var title = this.titleTemplate.replace('{1}', response.title);
        this.update(page, title, response.yaml, response.markdown);

        this.setPendingChanges(false);

        if (callback) callback(xhr, statusText, response);
    }).bind(this));
};

PicoContentAdmin.prototype.requestOpen = function (page, success, error) {
    if (this.openXhr !== null) {
        this.openXhr.abort();
    }

    this.openXhr = this.ajax('content', 'open', page, {
        responseType: 'json',
        success: success,
        error: error,
        complete: (function () {
            this.openXhr = null;
        }).bind(this)
    });

    return this.openXhr;
};

PicoContentAdmin.prototype.preview = function () {
    if (!this.markdownEditor.isPreviewActive()) {
        this.markdownEditor.togglePreview();
    }
};

PicoContentAdmin.prototype.requestPreview = function (yaml, markdown, success, error) {
    if (this.previewXhr !== null) {
        this.previewXhr.abort();
    }

    this.previewXhr = this.ajax('content', 'preview', null, {
        postData: {
            yaml: yaml,
            markdown: markdown
        },
        success: success,
        error: error,
        complete: (function () {
            this.previewXhr = null;
        }).bind(this)
    });

    return this.previewXhr;
};

PicoContentAdmin.prototype.edit = function () {
    if (this.markdownEditor.isPreviewActive()) {
        this.markdownEditor.togglePreview();
    }
};

PicoContentAdmin.prototype.fullPreview = function () {
    // create a hidden form with the appropiate content
    var url = this.getUrl('content', 'fullPreview', this.currentPage),
        form = utils.parse(
            '<form action="' + url + '" method="POST" target="_blank" style="display: none;">' +
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

PicoContentAdmin.prototype.save = function () {
    console.log('Save current page');
};

PicoContentAdmin.prototype.reset = function () {
    this.open(this.currentPage);
};

PicoContentAdmin.prototype.update = function (page, title, yaml, markdown) {
    this.currentPage = page;

    // update page title
    document.title = title;

    // update navigation
    var activeNavigationItem = this.getNavigation().querySelector('li.active');
    if (activeNavigationItem) activeNavigationItem.classList.remove('active');

    var navigationItem = this.getNavigation().querySelector('li[data-id="' + page + '"]');
    if (navigationItem) navigationItem.classList.add('active');

    // update content
    this.setYaml(yaml);
    this.setMarkdown(markdown);
};

PicoContentAdmin.prototype.initYamlEditor = function (element, options) {
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

PicoContentAdmin.prototype.getYamlEditor = function () {
    return this.yamlEditor;
};

PicoContentAdmin.prototype.getYaml = function () {
    return (this.yamlEditor !== null) ? this.yamlEditor.getValue() : null;
};

PicoContentAdmin.prototype.setYaml = function (value) {
    if (this.yamlEditor !== null) {
        this.yamlEditor.setValue(value);
        this.yamlEditor.save();
    }
};

PicoContentAdmin.prototype.initMarkdownEditor = function (element, options) {
    if (typeof element === 'string') element = document.querySelector(element);
    if (!utils.isPlainObject(options)) options = {};

    // prepare SimpleMDE options
    utils.extend(options, {
        element: element,
        previewRender: (function (plainText, preview) {
            var yamlContent = '',
                markdownContent = plainText;

            if (this.yamlEditorOptions !== null) {
                yamlContent = this.yamlEditorOptions.element.value;
            }

            this.requestPreview(
                yamlContent,
                markdownContent,
                function (xhr, statusText, response) {
                    preview.innerHTML = response;
                },
                function (xhr, statusText, response) {
                    preview.innerHTML = 'Failed!';
                }
            );

            return 'Loading...';
        }).bind(this)
    });

    // user extends/overwrites default shortcuts
    var picoShortcutBindings = {
        'save': this.save,
        'reset': this.reset,
        'full-preview': this.fullPreview
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
        'save': 'Cmd-S',
        'reset': null,
        'full-preview': 'Cmd-Alt-P'
    }, options.shortcuts || {});

    var picoKeyMap = {},
        isMac = /Mac/.test(navigator.platform);
    utils.forEach(picoShortcutBindings, (function (key, callback) {
        if (options.shortcuts[key] !== null) {
            if (isMac) {
                options.shortcuts[key] = options.shortcuts[key].replace('Ctrl', 'Cmd');
            } else {
                options.shortcuts[key] = options.shortcuts[key].replace('Cmd', 'Ctrl');
            }

            picoKeyMap[options.shortcuts[key]] = (function () { picoShortcutBindings[key].call(this); }).bind(this);
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
                'save': {            action: this.save.bind(this),           className: 'fa fa-floppy-o',                             title: 'Save' },
                'reset': {           action: this.reset.bind(this),          className: 'fa fa-times-circle',                         title: 'Discard all changes' },
                'full-preview': {    action: this.fullPreview.bind(this),    className: 'fa fa-home',                                 title: 'Open full page preview' },
                'docs': {            action: 'http://picocms.org/docs/',     className: 'fa fa-question-circle',                      title: 'Pico Documentation' },
            };

        utils.forEach(options.toolbar, function (_, button) {
            if ((typeof button === 'string') && (builtInToolbarButtons[button] !== undefined)) {
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
    this.markdownEditor.codemirror.on('changes', (function () {
        this.setPendingChanges(true);
    }).bind(this));

    return this.markdownEditor;
};

PicoContentAdmin.prototype.getMarkdownEditor = function () {
    return this.markdownEditor;
};

PicoContentAdmin.prototype.getMarkdown = function () {
    return (this.markdownEditor !== null) ? this.markdownEditor.codemirror.getValue() : null;
};

PicoContentAdmin.prototype.setMarkdown = function (value) {
    if (this.markdownEditor !== null) {
        this.markdownEditor.codemirror.setValue(value);
        this.markdownEditor.codemirror.save();
    }
};

PicoContentAdmin.prototype.setPendingChanges = function (pendingChanges) {
    var toolbar = this.getMarkdownEditor().toolbarElements;

    if (pendingChanges) {
        if (!this.pendingChanges) {
            if (toolbar.save) {
                toolbar.save.classList.remove('fa-floppy');
                toolbar.save.classList.add('fa-floppy-star');
            }
            if (toolbar.reset) {
                toolbar.reset.classList.remove('disabled');
            }
        }
    } else if (this.pendingChanges || (this.pendingChanges === null)) {
        if (toolbar.save) {
            toolbar.save.classList.remove('fa-floppy-star');
            toolbar.save.classList.add('fa-floppy');
        }
        if (toolbar.reset) {
            toolbar.reset.classList.add('disabled');
        }
    }

    this.pendingChanges = pendingChanges;
};

PicoContentAdmin.prototype.initNavigation = function (element, currentPage, titleTemplate) {
    this.navigation = element;
    this.currentPage = currentPage;
    this.titleTemplate = titleTemplate;

    // update navigation
    var navigationItem = element.querySelector('li[data-id="' + currentPage + '"]');
    if (navigationItem) navigationItem.classList.add('active');

    // restore old editor states when navigating back/forward
    // without the need of reloading the page
    window.addEventListener('popstate', (function (event) {
        if (event.state && event.state.PicoContentAdmin) {
            this.update(
                event.state.PicoContentAdmin.page,
                event.state.PicoContentAdmin.title,
                event.state.PicoContentAdmin.yaml,
                event.state.PicoContentAdmin.markdown
            );
        }
    }).bind(this));

    // users shouldn't use the browser's reload button
    window.addEventListener('beforeunload', function (event) {
        if (window.history.state && window.history.state.PicoContentAdmin) {
            event.preventDefault();
        }
    });

    // clickable navigation items
    utils.forEach(element.querySelectorAll('li > a'), (function (_, anchor) {
        var page = anchor.parentNode.dataset.id,
            path = '/' + anchor.href.replace(/^(?:https?:\/\/[^/]+(?:\/|$))?/, '');

        anchor.addEventListener('click', (function (event) {
            event.preventDefault();

            // before navigating to the new page,
            // store the current page data to allow fast back navigation
            window.history.replaceState({
                PicoContentAdmin: {
                    page: this.currentPage,
                    title: document.title,
                    yaml: this.getYaml(),
                    markdown: this.getMarkdown()
                }
            }, document.title, window.location.pathname);

            this.open(page, (function (xhr, statusText, response) {
                // update browser history
                window.history.pushState({
                    PicoContentAdmin: {
                        page: page,
                        title: document.title,
                        yaml: response.yaml,
                        markdown: response.markdown
                    }
                }, document.title, path);
            }).bind(this));
        }).bind(this));
    }).bind(this));
};

PicoContentAdmin.prototype.getNavigation = function () {
    return this.navigation;
};

PicoContentAdmin.prototype.getCurrentPage = function () {
    return this.currentPage;
};
