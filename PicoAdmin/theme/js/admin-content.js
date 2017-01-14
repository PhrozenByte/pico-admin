function PicoContentAdmin(picoAdmin, csrfToken, titleTemplate)
{
    PicoAdminModule.call(this, picoAdmin, 'content');

    this._csrfToken = csrfToken;

    this._titleTemplate = titleTemplate;
    this._contentExt = '';

    this._yamlEditorOptions = {};
    this._yamlEditor = null;

    this._markdownEditorOptions = {};
    this._markdownEditor = null;

    this._rescueEditorOptions = {};
    this._rescueEditor = null;

    this._pendingChanges = false;
    this._mode = null;

    this._previewXhr = null;
}

utils.createClass(PicoContentAdmin, PicoAdminModule, function (parent) {
    this.prototype.create = function (page)
    {
        if (this._picoAdmin.getActiveModule() === this._moduleName) {
            this._picoAdmin.updateHistory();
            this._picoAdmin.selectPath(page);
        } else {
            this._picoAdmin.selectModule(this._moduleName, page);
        }

        this.setState({
            mode: 'create',
            title: 'Create New ' + (page ? page + this._contentExt : 'Page')
        });

        this._picoAdmin.pushHistory({ url: this._picoAdmin.getUrl('content', 'create', page) });
    };

    this.prototype.open = function (page)
    {
        var self = this;
        this._load(page, function (yaml, markdown, title) {
            if (self._picoAdmin.getActiveModule() === self._moduleName) {
                self._picoAdmin.updateHistory();
                self._picoAdmin.selectPath(page);
            } else {
                self._picoAdmin.selectModule(self._moduleName, page);
            }

            self.setState({
                mode: 'edit',
                yaml: yaml,
                markdown: markdown,
                title: 'Edit ' + page + self._contentExt + (title ? ' (' + title + ')' : '')
            });

            self._picoAdmin.pushHistory({ url: self._picoAdmin.getUrl('content', 'edit', page) });
        });
    };

    this.prototype.save = function (page)
    {
        assertEnabled.call(this);

        var data = { yaml: this.getYaml(), markdown: this.getMarkdown() };
        return saveCallback.call(this, page, data, false);
    };

    this.prototype.saveRaw = function (page)
    {
        assertEnabled.call(this);

        var data = { content: self.getRescueContent() };
        return saveCallback.call(this, page, data, true);
    };

    function saveCallback(page, data, rawRequest)
    {
        page = page ? page : this._picoAdmin.getActivePath();
        if (!page) {
            return false;
        }

        var self = this;
        requestSave.call(this, page, data, rawRequest, function (xhr, statusText, response) {
            if (!response || !response.success) {
                return false;
            }

            if (response.navigation) {
                if (!/^\s*<div class="nav-inner">/.test(response.navigation)) {
                    return false;
                }

                self._replaceNavigation(response.navigation);
            }

            var oldMode = self._mode;

            if (oldMode === 'rescue') {
                self._pendingChanges = false;
                self._updateToolbar();

                self._picoAdmin.updateHistory();

                self.open(page);
                return true;
            }

            self._pendingChanges = false;
            self._mode = 'edit';
            self._updateToolbar();

            self._updateTitle('Edit ' + page + self._contentExt + (response.title ? ' (' + response.title + ')' : ''));

            if (oldMode === 'create') {
                self._picoAdmin.replaceHistory();
            } else {
                self._picoAdmin.pushHistory({ url: self._picoAdmin.getUrl('content', 'edit', page) });
            }

            return true;
        });

        return true;
    }

    function requestSave(page, data, rawRequest, success, error, complete)
    {
        var queryParams = rawRequest ? { raw: '1' } : {};
        return this._ajax('save', page, {
            queryParams: queryParams,
            postData: data,
            responseType: 'json',
            success: success,
            error: error,
            complete: complete
        });
    }

    this.prototype.saveAs = function ()
    {
        assertEnabled.call(this);

        this._askFileName({
            title: 'Save As',
            value: this._picoAdmin.getActivePath(),
            fileExt: this._contentExt,
            iconName: 'fa-floppy-o',
            callback: this.save.bind(this)
        });
    };

    this.prototype.reset = function ()
    {
        if (this._mode === 'create') {
            this.create();
        } else {
            assertEnabled.call(this);

            this._picoAdmin.replaceHistory();

            var self = this;
            if (this._mode === 'rescue') {
                this._loadRaw(this._picoAdmin.getActivePath(), function (content) {
                    self.setState({
                        mode: 'rescue',
                        rescueContent: content
                    });

                    self._picoAdmin.pushHistory({ url: window.location.href });
                });
            } else {
                this._load(this._picoAdmin.getActivePath(), function (yaml, markdown, title) {
                    self.setState({
                        yaml: yaml,
                        markdown: markdown
                    });

                    self._picoAdmin.pushHistory({ url: window.location.href });
                });
            }
        }
    };

    this.prototype.edit = function ()
    {
        assertEnabled.call(this);

        if (this._markdownEditor.isPreviewActive()) {
            this._markdownEditor.togglePreview();
        }
    };

    this.prototype.preview = function ()
    {
        assertEnabled.call(this);

        if (!this._markdownEditor.isPreviewActive()) {
            this._markdownEditor.togglePreview();
        }
    };

    function requestPreview(yaml, markdown, success, error, complete)
    {
        if (this._previewXhr !== null) {
            this._previewXhr.abort();
        }

        var self = this;
        this._previewXhr = this._ajax('preview', null, {
            postData: {
                yaml: yaml,
                markdown: markdown
            },
            responseType: 'json',
            success: success,
            error: error,
            complete: function (xhr, statusText, response) {
                if (complete) {
                    complete(xhr, statusText, response);
                }
                self._previewXhr = null;
            }
        });

        return this._previewXhr;
    }

    this.prototype.fullPreview = function ()
    {
        assertEnabled.call(this);

        // create a hidden form with the appropiate content
        var url = this._picoAdmin.getUrl('content', 'fullPreview', this._picoAdmin.getActivePath()),
            form = utils.parse(
                '<form action="' + url + '" method="POST" target="_blank" class="hidden">' +
                '    <textarea class="yaml" name="yaml"></textarea>' +
                '    <textarea class="markdown" name="markdown"></textarea>' +
                '</form>'
            );

        utils.forEach(this._csrfToken, function (key, value) {
            form.appendChild(utils.parse(
                '<input type="hidden" name="csrf_token[' + key + ']" value="' + value + '" />'
            ));
        });

        form.querySelector('.yaml').value = this.getYaml();
        form.querySelector('.markdown').value = this.getMarkdown();

        document.body.appendChild(form);

        // submit the form
        // When this method is called synchronously by a user click event
        // (i.e. the user clicked the toolbar button), this will work just fine.
        // However, when this isn't the case (i.e. called by a keyboard shortcut),
        // the browser will block this as a undesirable pop-up and throw a exception.
        try {
            form.submit();
        } catch(e) {
            this._picoAdmin.showNotification(
                'Pop-up blocked',
                'Your web browser has just blocked your attempt to open the full page preview in ' +
                    'a new window or tab. Your web browser falsely thinks that a malicious website ' +
                    'just tried to open a pop-up. You can either use the matching toolbar button ' +
                    'to open the full page preview instead, or configure your web browser to ' +
                    'allow pop-ups on ' + window.location.origin + '/.',
                { type: 'warning', timeout: 0 }
            );
        }

        document.body.removeChild(form);
    };

    this.prototype.delete = function (page)
    {
        assertEnabled.call(this);

        var currentHistoryObject = this._picoAdmin.getHistoryObject(this._picoAdmin.getCurrentState());

        var self = this;
        this._load(page, function (yaml, markdown, title) {
            self._picoAdmin.replaceHistory({
                activeModule: self._moduleName,
                activePath: page,
                title: self._titleTemplate.replace(
                    '{1}',
                    'Recover deleted ' + page + self._contentExt + (title ? ' (' + title + ')' : '')
                ),
                url: self._picoAdmin.getUrl('content', 'edit', page),
                yaml: yaml,
                markdown: markdown,
                pendingChanges: false,
                rescueContent: '',
                mode: 'recover'
            });

            self._picoAdmin.pushHistory(currentHistoryObject);

            requestDelete.call(self, page, function (xhr, statusText, response) {
                if (!response || !response.success) {
                    return false;
                }

                if (response.navigation) {
                    if (!/^\s*<div class="nav-inner">/.test(response.navigation)) {
                        return false;
                    }

                    self._replaceNavigation(response.navigation);
                }
            });
        });
    };

    function requestDelete(page, success, error, complete)
    {
        return this._ajax('delete', page, {
            responseType: 'json',
            success: success,
            error: error,
            complete: complete
        });
    }

    this.prototype._load = function (page, callback)
    {
        requestLoad.call(this, page, false, function (xhr, statusText, response) {
            var isValidResponse = !!response;
            isValidResponse = isValidResponse && (response.yaml !== undefined) && (response.yaml !== null);
            isValidResponse = isValidResponse && (response.markdown !== undefined) && (response.markdown !== null);
            isValidResponse = isValidResponse && (response.title !== undefined) && (response.title !== null);
            if (!isValidResponse) {
                return false;
            }

            callback(response.yaml, response.markdown, response.title);
        });
    };

    this.prototype._loadRaw = function (page, callback)
    {
        requestLoad.call(this, page, true, function (xhr, statusText, response) {
            if (!response || (response.content === undefined) || (response.content === null)) {
                return false;
            }

            callback(response.content);
        });
    };

    function requestLoad(page, rawRequest, success, error, complete)
    {
        var queryParams = rawRequest ? { raw: '1' } : {};
        return this._ajax('load', page, {
            queryParams: queryParams,
            responseType: 'json',
            success: success,
            error: error,
            complete: complete
        });
    }

    this.prototype.init = function (options)
    {
        parent.init.call(this);

        this._contentExt = options.contentExt;
        this._yamlEditorOptions = options.yamlEditorOptions;
        this._markdownEditorOptions = options.markdownEditorOptions;
        this._rescueEditorOptions = options.rescueEditorOptions;
    };

    this.prototype._initNavigation = function ()
    {
        parent._initNavigation.call(this);

        var createPageButton = utils.parse(
            '<a href="" class="action create inverse" title="Create New Page" role="button">' +
            '    <span class="fa fa-plus fa-fw" aria-hidden="true"></span>' +
            '    <span class="sr-only">Create New Page</span>' +
            '</a>'
        );

        createPageButton.href = this._picoAdmin.getUrl('content', 'create');
        utils.addNamedEventListener(createPageButton, 'click', 'action', function (event) {
            event.preventDefault();

            self._askFileName({
                title: 'Create New Page',
                fileExt: self._contentExt,
                iconName: 'fa-plus',
                callback: function (page) {
                    self.create(page);
                }
            });
        });

        this._navigation.querySelector('.headline .actions').appendChild(createPageButton);
    };

    this.prototype._initNavigationItems = function ()
    {
        parent._initNavigationItems.call(this);

        var itemAnchors = this._navigationInner.querySelectorAll('.item > a[href]'),
            itemActionsList = this._navigationInner.querySelectorAll('.item .actions')
            self = this;

        // open page event
        var openPageEvent = function (event) {
            event.preventDefault();

            var item = utils.closest(event.currentTarget, '.item'),
                path = item.dataset.path;
            self.open(path);
        };

        // create page action
        var createPage = utils.parse(
            '<a href="" class="action create inverse" title="Create New Page" role="button">' +
            '    <span class="fa fa-plus fa-fw" aria-hidden="true"></span>' +
            '    <span class="sr-only">Create New Page</span>' +
            '</a>'
        );
        var createPageEvent = function (event) {
            event.preventDefault();

            var item = utils.closest(event.currentTarget, '.item'),
                path = item.dataset.path;

            self._askFileName({
                title: 'Create New Page',
                value: path,
                fileExt: self._contentExt,
                iconName: 'fa-plus',
                callback: function (page) {
                    self.create(page);
                }
            });
        };

        // delete page action
        var deletePage = utils.parse(
            '<a href="" class="action delete inverse" title="Delete Page" role="button">' +
            '    <span class="fa fa-trash-o fa-fw" aria-hidden="true"></span>' +
            '    <span class="sr-only">Delete Page</span>' +
            '</a>'
        );
        var deletePageEvent = function (event) {
            event.preventDefault();

            var item = utils.closest(event.currentTarget, '.item'),
                path = item.dataset.path;
            self.delete(path);
        };

        // register event listener
        for (var i = 0; i < itemAnchors.length; i++) {
            utils.addNamedEventListener(itemAnchors[i], 'click', 'action', openPageEvent);
        }

        for (var i = 0; i < itemActionsList.length; i++) {
            var item = utils.closest(itemActionsList[i], '.item'),
                path = item.dataset.path;

            if ((item.dataset.type === 'content') && (path !== 'index')) {
                var deletePageItem = deletePage.cloneNode(true);
                deletePageItem.href = this._picoAdmin.getUrl('content', 'delete', path);
                utils.addNamedEventListener(deletePageItem, 'click', 'action', deletePageEvent);
                itemActionsList[i].appendChild(deletePageItem);
            }

            if ((item.dataset.type === 'dir') || (item.dataset.children > 0)) {
                var createPageItem = createPage.cloneNode(true);
                createPageItem.href = this._picoAdmin.getUrl('content', 'create', path);
                utils.addNamedEventListener(createPageItem, 'click', 'action', createPageEvent);
                itemActionsList[i].appendChild(createPageItem);
            }
        }
    };

    this.prototype.takeOver = function (mode, title)
    {
        parent.takeOver.call(this);

        this._mode = mode;
        this._updateToolbar();

        var page = this._picoAdmin.getActivePath();
        switch (mode) {
            case 'create':
                this._updateTitle('Create New ' + (page ? page + this._contentExt : 'Page'));
                break;

            case 'edit':
                this._updateTitle('Edit ' + page + this._contentExt + (title ? ' (' + title + ')' : ''));
                break;

            case 'rescue':
                this._updateTitle('Edit ' + page + this._contentExt + ' [Rescue Mode]');
                this._setRescueModeEnabled(true);
                break;
        }
    };

    this.prototype.enable = function ()
    {
        parent.enable.call(this);

        // init YAML editor (plain CodeMirror)
        if (!this._yamlEditor) {
            this._initYamlEditor(
                this._yamlEditorOptions.element,
                this._yamlEditorOptions
            );
        } else {
            this._yamlEditor.refresh();
        }

        // init Markdown editor (SimpleMDE, a CodeMirror wrapper)
        if (!this._markdownEditor) {
            this._initMarkdownEditor(
                this._markdownEditorOptions.element,
                this._markdownEditorOptions
            );

            // move SimpleMDE toolbar and statusbar
            this._container.insertBefore(this._markdownEditor.gui.toolbar, this._container.firstChild);

            var footer = document.querySelector('footer');
            footer.insertBefore(this._markdownEditor.gui.statusbar, footer.firstChild);
        } else {
            this._markdownEditor.codemirror.refresh();
        }

        // init rescue editor
        if (!this._rescueEditor) {
            this._initRescueEditor(
                this._rescueEditorOptions.element,
                this._rescueEditorOptions
            );
        }
    };

    this.prototype.disable = function ()
    {
        // save current state
        this._picoAdmin.updateHistory();

        parent.disable.call(this);
    };

    function assertEnabled()
    {
        if (this._picoAdmin.getActiveModule() !== this._moduleName) {
            throw "PicoContentAdmin Access Violation: You can't enter this mode without explicitly enabling the module";
        }
    }

    this.prototype._initYamlEditor = function (element, options)
    {
        options = options || {};
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        // prepare CodeMirror options
        options = utils.extend({ forceSync: false }, options, {
            element: element,
            mode: 'yaml'
        });

        // init CodeMirror
        this._yamlEditorOptions = options;
        this._yamlEditor = new CodeMirror.fromTextArea(element, options);

        var self = this;
        this._yamlEditor.on('change', function (editor, changeObj) {
            if (changeObj.origin !== 'setValue') {
                self._pendingChanges = true;
                self._updateToolbar();
            }

            // force syncing all changes
            if (options.forceSync) {
                editor.save();
            }
        });

        return this._yamlEditor;
    };

    this.prototype.getYaml = function ()
    {
        return this._yamlEditor ? this._yamlEditor.getValue() : '';
    };

    this.prototype._setYaml = function (value)
    {
        if (this._yamlEditor) {
            this._yamlEditor.setValue(value);
            this._yamlEditor.save();

            var self = this;
            window.requestAnimationFrame(function () {
                self._yamlEditor.refresh();
            });
        }
    };

    this.prototype._initMarkdownEditor = function (element, options)
    {
        options = options || {};
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        var self = this;

        // prepare SimpleMDE options
        utils.extend(options, {
            element: element,
            previewRender: function (plainText, preview) {
                var editor = self._markdownEditor,
                    editorElement = editor.codemirror.getWrapperElement().querySelector('.CodeMirror-scroll'),
                    yamlWrapper = self._yamlEditor.getWrapperElement(),
                    isPreviewActive = preview.classList.contains('active');

                if (!isPreviewActive) {
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

                    requestPreview.call(
                        self,
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
                                window.requestAnimationFrame(function () {
                                    editorButton.classList.add('error');
                                });
                                window.setTimeout(function () {
                                    editorButton.classList.remove('error');
                                }, 5000);
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
                    if (self._previewXhr) {
                        self._previewXhr.abort();
                    }

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
            if (options.shortcuts[key]) {
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

            for (var i = 0, button; i < options.toolbar.length; i++) {
                button = options.toolbar[i];
                if ((typeof button === 'string') && (builtInToolbarButtons[button] !== undefined)) {
                    // append binding of Pico shortcuts to title
                    var toolbarButtonTitle = builtInToolbarButtons[button].title;
                    if ((picoEditorActions[button] !== undefined) && options.shortcuts[button]) {
                        toolbarButtonTitle += ' (' + options.shortcuts[button] + ')';
                    }

                    // built-in toolbar button
                    toolbarButtons.push(utils.extend(
                        builtInToolbarButtons[button],
                        { name: button, title: toolbarButtonTitle }
                    ));
                } else {
                    // new toolbar button or a separator
                    toolbarButtons.push(button);
                }
            }

            options.toolbar = toolbarButtons;
        }

        // init SimpleMDE
        this._markdownEditorOptions = options;
        this._markdownEditor = new SimpleMDE(options);

        if (Object.keys(picoKeyMap).length !== 0) {
            this._markdownEditor.codemirror.addKeyMap(picoKeyMap);
        }

        // update pending changes
        this._pendingChanges = false;
        this._updateToolbar();

        this._markdownEditor.codemirror.on('change', function (editor, changeObj) {
            if (changeObj.origin !== 'setValue') {
                self._pendingChanges = true;
                self._updateToolbar();
            }
        });

        return this._markdownEditor;
    };

    this.prototype.getMarkdown = function ()
    {
        return this._markdownEditor ? this._markdownEditor.codemirror.getValue() : '';
    };

    this.prototype._setMarkdown = function (value)
    {
        if (this._markdownEditor) {
            this._markdownEditor.codemirror.setValue(value);
            this._markdownEditor.codemirror.save();

            var self = this;
            window.requestAnimationFrame(function () {
                self._markdownEditor.codemirror.refresh();
            });
        }
    };

    this.prototype._initRescueEditor = function (element, options)
    {
        options = options || {};
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        options = utils.extend(options, {
            element: element
        });

        var toolbar = {
            save: element.parentNode.querySelector('.editor-toolbar > .save')
        };

        this._rescueEditorOptions = options;
        this._rescueEditor = {
            element: element,
            toolbar: toolbar
        };

        if (toolbar.save) {
            var self = this;
            toolbar.save.addEventListener('click', function (event) {
                event.preventDefault();
                self.saveRaw(self.getRescueContent());
            });
        }

        return this._rescueEditor;
    };

    this.prototype.getRescueContent = function ()
    {
        return this._rescueEditor ? this._rescueEditor.element.value : '';
    };

    this.prototype._setRescueContent = function (value)
    {
        if (this._rescueEditor) {
            this._rescueEditor.element.value = value;
        }
    };

    this.prototype._setRescueModeEnabled = function (enabled)
    {
        var elements = [
            this._markdownEditor.codemirror.getWrapperElement().parentNode,
            this._yamlEditor.getWrapperElement().parentNode,
            this._markdownEditor.gui.toolbar,
            this._markdownEditor.gui.statusbar
        ];
        for (var i = 0; i < elements.length; i++) {
            if (enabled) {
                elements[i].classList.add('hidden');
            } else {
                elements[i].classList.remove('hidden');
            }
        }

        var rescueContainer = this._rescueEditor.element.parentNode;
        if (enabled) {
            rescueContainer.classList.remove('hidden');
        } else {
            rescueContainer.classList.add('hidden');
        }
    };

    this.prototype._updateToolbar = function ()
    {
        var toolbar = this._markdownEditor.toolbarElements;

        // reset toolbar
        if (toolbar.save) {
            toolbar.save.classList.remove('disabled');
            toolbar.save.classList.remove('fa-sub-star');
        }
        if (toolbar.reset) {
            toolbar.reset.classList.remove('disabled');
        }

        // transform toolbar depending on the current mode
        switch (this._mode) {
            case 'create':
                if (toolbar.save) {
                    toolbar.save.classList.add(this._picoAdmin.getActivePath() ? 'fa-sub-star' : 'disabled');
                }
                if (toolbar.reset) {
                    toolbar.reset.classList.add('disabled');
                }
                break;

            case 'recover':
                if (toolbar.reset) {
                    toolbar.reset.classList.add('disabled');
                }
                if (toolbar.save) {
                    toolbar.save.classList.add('fa-sub-star');
                }
                break;
        }

        // transform toolbar whether there are pending changes
        if (this._pendingChanges) {
            if (toolbar.save && !toolbar.save.classList.contains('disabled')) {
                toolbar.save.classList.add('fa-sub-star');
            }
        } else if (toolbar.reset) {
            toolbar.reset.classList.add('disabled');
        }
    };

    this.prototype._updateTitle = function (title)
    {
        document.title = this._titleTemplate.replace('{1}', title);
    };

    this.prototype.getState = function ()
    {
        parent.getState.call(this);

        return {
            yaml: this.getYaml(),
            markdown: this.getMarkdown(),
            pendingChanges: this._pendingChanges,
            rescueContent: this.getRescueContent(),
            mode: this._mode,
            title: document.title
        };
    };

    this.prototype.setState = function (data)
    {
        parent.setState.call(this, data);

        this._setYaml(data.yaml || '');
        this._setMarkdown(data.markdown || '');
        this._pendingChanges = !!data.pendingChanges;

        this._setRescueContent(data.rescueContent || '');
        this._setRescueModeEnabled((data.mode === 'rescue'));

        if (data.mode) {
            this._mode = data.mode;
        }

        this._updateToolbar();

        if (data.title) {
            this._updateTitle(data.title);
        }
    };

    this.prototype._askFileName = function (options)
    {
        parent._askFileName.call(this, options);

        if (this._markdownEditor) {
            var toolbar = this._markdownEditor.toolbarElements;
            if (toolbar['save-as']) {
                toolbar['save-as'].classList.add('disabled');
            }
        }
    };

    this.prototype._closeFileNameModal = function ()
    {
        parent._closeFileNameModal.call(this);

        if (this._markdownEditor) {
            var toolbar = this._markdownEditor.toolbarElements;
            if (toolbar['save-as']) {
                toolbar['save-as'].classList.remove('disabled');
            }
        }
    };

    this.prototype._ajax = function (action, payload, options)
    {
        if (options === undefined) {
            options = { postData: { csrf_token: this._csrfToken } };
        } else if (options.postData === undefined) {
            options.postData = { csrf_token: this._csrfToken };
        } else if (options.postData.csrf_token === undefined) {
            options.postData.csrf_token = this._csrfToken;
        } else if (options.postData.csrf_token === null) {
            delete options.postData.csrf_token;
        }

        return parent._ajax.call(this, action, payload, options);
    };
});
