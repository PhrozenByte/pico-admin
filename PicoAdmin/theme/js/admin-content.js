function PicoContentAdmin(picoAdmin, csrfToken)
{
    PicoAdminModule.call(this, picoAdmin, 'content');

    this.csrfToken = csrfToken;

    this.titleTemplate = null;
    this.contentExt = null;

    this.yamlEditorOptions = null;
    this.yamlEditor = null;

    this.markdownEditorOptions = null;
    this.markdownEditor = null;

    this.rescueEditorOptions = null;
    this.rescueEditor = null;

    this.pendingChanges = null;

    this.currentMode = null;

    this.saveXhr = null;
    this.previewXhr = null;
    this.loadXhr = null;
}

utils.createClass(PicoContentAdmin, PicoAdminModule, function (parent) {
    this.prototype.create = function (page)
    {
        if (this.picoAdmin.activeModule === this.moduleName) {
            this.picoAdmin.updateHistory();
            this.picoAdmin.selectPath(page);
        } else {
            this.picoAdmin.selectModule(this.moduleName, page);
        }

        setContent.call(this, {
            mode: 'create',
            title: 'Create New ' + (page ? page + this.contentExt : 'Page')
        });

        this.picoAdmin.pushHistory(this.picoAdmin.getUrl('content', 'create', page));
    };

    this.prototype.open = function (page)
    {
        var self = this;
        this.load(page, function (yaml, markdown, title) {
            if (self.picoAdmin.activeModule === self.moduleName) {
                self.picoAdmin.updateHistory();
                self.picoAdmin.selectPath(page);
            } else {
                self.picoAdmin.selectModule(self.moduleName, page);
            }

            setContent.call(self, {
                mode: 'edit',
                yaml: yaml,
                markdown: markdown,
                title: 'Edit ' + page + self.contentExt + (title ? ' (' + title + ')' : '')
            });

            self.picoAdmin.pushHistory(self.picoAdmin.getUrl('content', 'edit', page));
        });
    };

    this.prototype.save = function (page)
    {
        assertEnabled.call(this);

        page = page ? page : this.picoAdmin.activePath;
        if (!page) return false;

        var data = { yaml: this.getYaml(), markdown: this.getMarkdown() },
            self = this;
        requestSave.call(this, page, data, false, function (xhr, statusText, response) {
            if (!response || !response.success) {
                return false;
            }

            return saveCallback.call(self, page, response.title, response.navigation);
        });
        return true;
    };

    this.prototype.saveRaw = function (page)
    {
        assertEnabled.call(this);

        page = page ? page : this.picoAdmin.activePath;
        if (!page) return false;

        var data = { content: self.getRescueContent() },
            self = this;
        requestSave.call(this, page, data, true, function (xhr, statusText, response) {
            if (!response || !response.success) {
                return false;
            }

            return saveCallback.call(self, page, response.title, response.navigation);
        });
        return true;
    };

    function saveCallback(page, title, navigation)
    {
        if (navigation) {
            if (!/^\s*<div class="nav-inner">/.test(navigation)) {
                return false;
            }

            var self = this;
            this.replaceNavigation(navigation, function () {
                self.picoAdmin.selectPath(page);
            });
        }

        var oldMode = this.currentMode;

        if (oldMode === 'rescue') {
            this.setPendingChanges(false);
            this.updateToolbar();

            this.picoAdmin.updateHistory();

            this.open(page);
            return true;
        }

        this.setPendingChanges(false);
        this.setMode('edit');
        this.updateToolbar();

        this.updateTitle('Edit ' + page + this.contentExt + (title ? ' (' + title + ')' : ''));

        if (oldMode === 'create') {
            this.picoAdmin.updateHistory();
        } else {
            this.picoAdmin.pushHistory(this.picoAdmin.getUrl('content', 'edit', page));
        }

        return true;
    }

    function requestSave(page, data, rawRequest, success, error, complete)
    {
        var queryParams = rawRequest ? { raw: '1' } : {};
        return this.ajax('save', page, {
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

        this.askFileName({
            title: 'Save As',
            value: this.picoAdmin.activePath,
            fileExt: this.contentExt,
            iconName: 'fa-floppy-o',
            callback: this.save.bind(this)
        });
    };

    this.prototype.reset = function ()
    {
        if (this.picoAdmin.activePath) {
            assertEnabled.call(this);

            this.picoAdmin.updateHistory();

            var self = this;
            this.load(this.picoAdmin.activePath, function (yaml, markdown, title) {
                setContent.call(self, {
                    yaml: yaml,
                    markdown: markdown,
                    pendingChanges: false
                });

                self.picoAdmin.pushHistory(window.location.href);
            });
        } else {
            this.create();
        }
    };

    this.prototype.edit = function ()
    {
        assertEnabled.call(this);

        if (this.markdownEditor.isPreviewActive()) {
            this.markdownEditor.togglePreview();
        }
    };

    this.prototype.preview = function ()
    {
        assertEnabled.call(this);

        if (!this.markdownEditor.isPreviewActive()) {
            this.markdownEditor.togglePreview();
        }
    };

    function requestPreview(yaml, markdown, success, error, complete)
    {
        if (this.previewXhr !== null) {
            this.previewXhr.abort();
        }

        var self = this;
        this.previewXhr = this.ajax('preview', null, {
            postData: {
                yaml: yaml,
                markdown: markdown
            },
            responseType: 'json',
            success: success,
            error: error,
            complete: function (xhr, statusText, response) {
                if (complete) complete(xhr, statusText, response);
                self.previewXhr = null;
            }
        });

        return this.previewXhr;
    }

    this.prototype.fullPreview = function ()
    {
        assertEnabled.call(this);

        // create a hidden form with the appropiate content
        var url = this.picoAdmin.getUrl('content', 'fullPreview', this.picoAdmin.activePath),
            form = utils.parse(
                '<form action="' + url + '" method="POST" target="_blank" class="hidden">' +
                '   <textarea class="yaml" name="yaml"></textarea>' +
                '   <textarea class="markdown" name="markdown"></textarea>' +
                '</form>'
            );

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
            this.picoAdmin.showNotification(
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

        var currentHistoryObject = this.picoAdmin.getHistoryObject();

        var self = this;
        this.load(page, function (yaml, markdown, title) {
            self.picoAdmin.updateHistory({
                activeModule: self.moduleName,
                activePath: page,
                title: self.titleTemplate.replace(
                    '{1}',
                    'Recover deleted ' + page + self.contentExt + (title ? ' (' + title + ')' : '')
                ),
                url: self.picoAdmin.getUrl('content', 'edit', page),
                yaml: yaml,
                markdown: markdown,
                pendingChanges: false,
                rescueContent: '',
                mode: 'recover'
            });

            self.picoAdmin.pushHistory(currentHistoryObject);

            requestDelete.call(self, page, function (xhr, statusText, response) {
                if (!response || !response.success) {
                    return false;
                }

                if (response.navigation) {
                    if (!/^\s*<div class="nav-inner">/.test(response.navigation)) {
                        return false;
                    }

                    self.replaceNavigation(response.navigation);
                }
            });
        });
    };

    function requestDelete(page, success, error, complete)
    {
        return this.ajax('delete', page, {
            responseType: 'json',
            success: success,
            error: error,
            complete: complete
        });
    }

    this.prototype.load = function (page, callback)
    {
        requestLoad.call(this, page, false, function (xhr, statusText, response) {
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

    this.prototype.loadRaw = function (page, callback)
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
        if (this.loadXhr !== null) {
            this.loadXhr.abort();
        }

        var queryParams = rawRequest ? { raw: '1' } : {},
            self = this;

        this.loadXhr = this.ajax('load', page, {
            queryParams: queryParams,
            responseType: 'json',
            success: success,
            error: error,
            complete: function (xhr, statusText, response) {
                if (complete) complete(xhr, statusText, response);
                self.loadXhr = null;
            }
        });

        return this.loadXhr;
    }

    this.prototype.init = function (options)
    {
        parent.init.call(this, options);

        this.titleTemplate = options.title;
        this.contentExt = options.contentExt;

        this.yamlEditorOptions = options.yamlEditorOptions;
        this.markdownEditorOptions = options.markdownEditorOptions;
        this.rescueEditorOptions = options.rescueEditorOptions;
    };

    this.prototype.initNavigationItems = function (navContainer)
    {
        parent.initNavigationItems.call(this, navContainer);
        var self = this;

        var openPageEvent = function (event) {
            event.preventDefault();

            var item = utils.closest(event.currentTarget, '.item'),
                path = item.dataset.path;
            self.open(path);
        };

        utils.forEach(navContainer.querySelectorAll('.item > a[href]'), function (_, anchor) {
            utils.addNamedEventListener(anchor, 'click', 'action', openPageEvent);
        });
    };

    this.prototype.initNavigationActions = function (itemActionsList, headlineActions)
    {
        parent.initNavigationActions.call(this, itemActionsList, headlineActions);
        var self = this;

        // create page action
        var createPage = utils.parse(
            '<a href="" class="action create inverse" title="Create New Page" role="button">' +
            '    <span class="fa fa-plus fa-fw" aria-hidden="true"></span>' +
            '    <span class="sr-only">Create New Page</span>' +
            '</a>'
        );
        var createPageEvent = function (event) {
            event.preventDefault();

            var actions = utils.closest(event.currentTarget, '.actions'),
                path = actions.parentNode.classList.contains('item') ? actions.parentNode.dataset.path + '/' : '';

            self.askFileName({
                title: 'Create New Page',
                value: path,
                fileExt: self.contentExt,
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

        // headline actions
        if (headlineActions) {
            var createPageHeadline = createPage.cloneNode(true);
            createPageHeadline.href = this.picoAdmin.getUrl('content', 'create');
            utils.addNamedEventListener(createPageHeadline, 'click', 'action', createPageEvent);
            headlineActions.appendChild(createPageHeadline);
        }

        // item actions
        utils.forEach(itemActionsList, function (_, actions) {
            var item = utils.closest(actions, '.item'),
                path = item.dataset.path;

            if ((item.dataset.type === 'content') && (path !== 'index')) {
                var deletePageItem = deletePage.cloneNode(true);
                deletePageItem.href = self.picoAdmin.getUrl('content', 'delete', path);
                utils.addNamedEventListener(deletePageItem, 'click', 'action', deletePageEvent);
                actions.appendChild(deletePageItem);
            }

            if ((item.dataset.type === 'dir') || (item.dataset.children > 0)) {
                var createPageItem = createPage.cloneNode(true);
                createPageItem.href = self.picoAdmin.getUrl('content', 'create', path);
                utils.addNamedEventListener(createPageItem, 'click', 'action', createPageEvent);
                actions.appendChild(createPageItem);
            }
        });
    };

    this.prototype.takeOver = function (page, mode, title)
    {
        parent.takeOver.call(this, page);

        // init editor
        this.setMode(mode);
        this.updateToolbar();

        switch (mode) {
            case 'create':
                this.updateTitle('Create New ' + (page ? page + this.contentExt : 'Page'));
                break;

            case 'edit':
                this.updateTitle('Edit ' + page + this.contentExt + (title ? ' (' + title + ')' : ''));
                break;

            case 'rescue':
                this.updateTitle('Edit ' + page + this.contentExt + ' [Rescue Mode]');
                this.setRescueModeEnabled(true);
                break;
        }

        // update history
        this.picoAdmin.updateHistory();
    };

    this.prototype.enable = function ()
    {
        // init YAML editor (plain CodeMirror)
        if (!this.yamlEditor) {
            this.initYamlEditor(
                this.yamlEditorOptions.element,
                this.yamlEditorOptions
            );
        } else {
            this.yamlEditor.refresh();
        }

        // init Markdown editor (SimpleMDE, a CodeMirror wrapper)
        if (!this.markdownEditor) {
            this.initMarkdownEditor(
                this.markdownEditorOptions.element,
                this.markdownEditorOptions
            );

            // move SimpleMDE toolbar and statusbar
            var content = document.getElementById('module-' + this.moduleName);
            content.insertBefore(this.markdownEditor.gui.toolbar, content.firstChild);

            var footer = document.querySelector('footer');
            footer.insertBefore(this.markdownEditor.gui.statusbar, footer.firstChild);
        } else {
            this.markdownEditor.codemirror.refresh();
        }

        // init rescue editor
        if (!this.rescueEditor) {
            this.initRescueEditor(
                this.rescueEditorOptions.element,
                this.rescueEditorOptions
            );
        }

        parent.enable.call(this);
    };

    this.prototype.disable = function ()
    {
        // save current state
        this.picoAdmin.updateHistory();

        parent.disable.call(this);
    };

    function assertEnabled()
    {
        if (this.picoAdmin.activeModule !== this.moduleName) {
            throw "PicoContentAdmin Access Violation: You can't enter this mode without explicitly enabling the module";
        }
    }

    this.prototype.setRescueModeEnabled = function (enabled)
    {
        var markdownContainer = this.markdownEditor.codemirror.getWrapperElement().parentNode,
            yamlContainer = this.yamlEditor.getWrapperElement().parentNode,
            rescueContainer = this.rescueEditor.element.parentNode,
            toolbar = this.markdownEditor.gui.toolbar,
            statusbar = this.markdownEditor.gui.statusbar;

        utils.forEach([ markdownContainer, yamlContainer, toolbar, statusbar ], function (_, element) {
            if (enabled) {
                element.classList.add('hidden');
            } else {
                element.classList.remove('hidden');
            }
        });

        if (enabled) {
            rescueContainer.classList.remove('hidden');
        } else {
            rescueContainer.classList.add('hidden');
        }
    };

    this.prototype.initYamlEditor = function (element, options)
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
        this.yamlEditor.on('change', function (editor, changeObj) {
            if (changeObj.origin !== 'setValue') {
                self.setPendingChanges(true);
                self.updateToolbar();
            }

            // force syncing all changes
            if (options.forceSync) editor.save();
        });

        return this.yamlEditor;
    };

    this.prototype.getYaml = function ()
    {
        return this.yamlEditor ? this.yamlEditor.getValue() : '';
    };

    this.prototype.setYaml = function (value)
    {
        if (this.yamlEditor) {
            this.yamlEditor.setValue(value);
            this.yamlEditor.save();

            var self = this;
            window.requestAnimationFrame(function () {
                self.yamlEditor.refresh();
            });
        }
    };

    this.prototype.initMarkdownEditor = function (element, options)
    {
        if (typeof element === 'string') element = document.querySelector(element);
        if (!utils.isPlainObject(options)) options = {};
        var self = this;

        // prepare SimpleMDE options
        utils.extend(options, {
            element: element,
            previewRender: function (plainText, preview) {
                var editor = self.markdownEditor,
                    editorElement = editor.codemirror.getWrapperElement().querySelector('.CodeMirror-scroll'),
                    yamlWrapper = self.yamlEditor.getWrapperElement(),
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

            utils.forEach(options.toolbar, function (_, button) {
                if ((typeof button === 'string') && (builtInToolbarButtons[button] !== undefined)) {
                    // append binding of Pico shortcuts to title
                    var toolbarButtonTitle = builtInToolbarButtons[button].title;
                    if ((picoEditorActions[button] !== undefined) && options.shortcuts[button]) {
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
        this.updateToolbar();

        this.markdownEditor.codemirror.on('change', function (editor, changeObj) {
            if (changeObj.origin === 'setValue') return;

            self.setPendingChanges(true);
            self.updateToolbar();
        });

        return this.markdownEditor;
    };

    this.prototype.getMarkdown = function ()
    {
        return this.markdownEditor ? this.markdownEditor.codemirror.getValue() : '';
    };

    this.prototype.setMarkdown = function (value)
    {
        if (this.markdownEditor) {
            this.markdownEditor.codemirror.setValue(value);
            this.markdownEditor.codemirror.save();

            var self = this;
            window.requestAnimationFrame(function () {
                self.markdownEditor.codemirror.refresh();
            });
        }
    };

    this.prototype.initRescueEditor = function (element, options)
    {
        if (typeof element === 'string') element = document.querySelector(element);
        if (!utils.isPlainObject(options)) options = {};

        options = utils.extend(options, {
            element: element
        });

        var toolbar = {
            save: element.parentNode.querySelector('.editor-toolbar > .save')
        };

        this.rescueEditorOptions = options;
        this.rescueEditor = {
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

        return this.rescueEditor;
    };

    this.prototype.getRescueContent = function ()
    {
        return this.rescueEditor ? this.rescueEditor.element.value : '';
    };

    this.prototype.setRescueContent = function (value)
    {
        if (this.rescueEditor) {
            this.rescueEditor.element.value = value;
        }
    };

    this.prototype.setPendingChanges = function (pendingChanges)
    {
        this.pendingChanges = pendingChanges;
    };

    this.prototype.getPendingChanges = function ()
    {
        return this.pendingChanges;
    };

    this.prototype.setMode = function (mode)
    {
        this.currentMode = mode;
    };

    this.prototype.getMode = function ()
    {
        return this.currentMode;
    };

    this.prototype.updateToolbar = function ()
    {
        var toolbar = this.markdownEditor.toolbarElements;

        // reset toolbar
        if (toolbar.save) {
            toolbar.save.classList.remove('disabled');
            toolbar.save.classList.remove('fa-sub-star');
        }
        if (toolbar.reset) {
            toolbar.reset.classList.remove('disabled');
        }

        // transform toolbar depending on the current mode
        switch (this.currentMode) {
            case 'create':
                if (toolbar.save) {
                    toolbar.save.classList.add(this.picoAdmin.activePath ? 'fa-sub-star' : 'disabled');
                }
                if (toolbar.reset) {
                    toolbar.reset.classList.add('disabled');
                }
                break;

            case 'recover':
                if (toolbar.reset) toolbar.reset.classList.add('disabled');
                if (toolbar.save) toolbar.save.classList.add('fa-sub-star');
                break;
        }

        // transform toolbar whether there are pending changes
        if (this.pendingChanges) {
            if (toolbar.save && !toolbar.save.classList.contains('disabled')) {
                toolbar.save.classList.add('fa-sub-star');
            }
        } else if (toolbar.reset) {
            toolbar.reset.classList.add('disabled');
        }
    };

    this.prototype.updateTitle = function (title)
    {
        document.title = this.titleTemplate.replace('{1}', title);
    };

    function setContent(data)
    {
        this.setYaml(data.yaml || '');
        this.setMarkdown(data.markdown || '');
        this.setPendingChanges(!!data.pendingChanges);

        this.setRescueContent(data.rescueContent || '');
        this.setRescueModeEnabled((data.mode === 'rescue'));

        if (data.mode) this.setMode(data.mode);
        this.updateToolbar();

        if (data.title) this.updateTitle(data.title);
    }

    this.prototype.restoreHistory = function (historyObject, state)
    {
        parent.restoreHistory.call(this, historyObject, state);

        setContent.call(this, {
            yaml: historyObject.yaml,
            markdown: historyObject.markdown,
            pendingChanges: historyObject.pendingChanges,
            rescueContent: historyObject.rescueContent,
            mode: historyObject.mode
        });
    };

    this.prototype.createHistoryObject = function (historyObject)
    {
        parent.createHistoryObject.call(this, historyObject);

        return utils.extend(historyObject, {
            yaml: this.getYaml(),
            markdown: this.getMarkdown(),
            pendingChanges: this.getPendingChanges(),
            rescueContent: this.getRescueContent(),
            mode: this.getMode()
        });
    };

    this.prototype.askFileName = function (callback, options)
    {
        parent.askFileName.call(this, callback, options);

        if (this.markdownEditor) {
            var toolbar = this.markdownEditor.toolbarElements;
            if (toolbar['save-as']) toolbar['save-as'].classList.add('disabled');
        }
    };

    this.prototype.closeFileNameModal = function ()
    {
        parent.closeFileNameModal.call(this);

        if (this.markdownEditor) {
            var toolbar = this.markdownEditor.toolbarElements;
            if (toolbar['save-as']) toolbar['save-as'].classList.remove('disabled');
        }
    };

    this.prototype.ajax = function (action, payload, options)
    {
        if (options === undefined) {
            options = { postData: { csrf_token: this.csrfToken } };
        } else if (options.postData === undefined) {
            options.postData = { csrf_token: this.csrfToken };
        } else if (options.postData.csrf_token === undefined) {
            options.postData.csrf_token = this.csrfToken;
        } else if (options.postData.csrf_token === null) {
            delete options.postData.csrf_token;
        }

        return parent.ajax.call(this, action, payload, options);
    };
});
