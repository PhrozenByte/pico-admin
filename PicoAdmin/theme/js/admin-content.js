function PicoContentAdmin(authToken, baseUrl) {
    PicoAdmin.call(this, authToken, baseUrl);

    this.yamlEditorOptions = null;
    this.yamlEditor = null;

    this.markdownEditorOptions = null;
    this.markdownEditor = null;

    this.navigation = null;
    this.currentPage = null;
    this.titleTemplate = null;

    this.openXhr = null;
    this.previewXhr = null;
}

PicoContentAdmin.prototype = Object.create(PicoAdmin.prototype);
PicoContentAdmin.prototype.constructor = PicoAdmin;

PicoContentAdmin.prototype.navigateTo = function (page, callback) {
    this.requestOpen(page, (function (xhr, statusText, response) {
        var title = this.titleTemplate.replace('{1}', response.title);
        this.update(page, title, response.yaml, response.markdown);
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

    // force syncing all changes
    if (options.forceSync) {
        this.yamlEditor.on('change', function (editor) { editor.save(); });
    }

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
        'toggleFullScreen': null
    }, options.shortcuts || {});

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
                'redo': {            action: SimpleMDE.redo,                 className: 'fa fa-repeat no-disable',                    title: 'Redo' }
            };

        utils.forEach(options.toolbar, function (_, button) {
            if ((typeof button === 'string') && (builtInToolbarButtons[button] !== undefined)) {
                // built-in toolbar button
                toolbarButtons.push(utils.extend({ name: button }, builtInToolbarButtons[button]));
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
        if (event.state.PicoContentAdmin !== undefined) {
            this.update(
                event.state.PicoContentAdmin.page,
                event.state.PicoContentAdmin.title,
                event.state.PicoContentAdmin.yaml,
                event.state.PicoContentAdmin.markdown
            );
        }
    }).bind(this));

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

            this.navigateTo(page, (function (xhr, statusText, response) {
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
