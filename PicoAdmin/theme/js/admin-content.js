function PicoContentAdmin(authToken, baseUrl) {
    PicoAdmin.call(this, authToken, baseUrl);

    this.yamlEditorOptions = null;
    this.yamlEditor = null;

    this.markdownEditorOptions = null;
    this.markdownEditor = null;

    this.previewXhr = null;
}

PicoContentAdmin.prototype = Object.create(PicoAdmin.prototype);
PicoContentAdmin.prototype.constructor = PicoAdmin;

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

PicoContentAdmin.prototype.initYamlEditor = function (element, options) {
    if (typeof element === 'string') element = document.querySelector(element);
    if (!utils.isPlainObject(options)) options = {};

    // prepare CodeMirror options
    utils.extend(options, {
        element: element,
        mode: 'yaml'
    });

    // init CodeMirror
    this.yamlEditorOptions = options;
    this.yamlEditor = new CodeMirror.fromTextArea(element, options);

    // autosave changes
    this.yamlEditor.on('change', function (editor) { editor.save(); });

    return this.yamlEditor;
};

PicoContentAdmin.prototype.getYamlEditor = function () {
    return this.yamlEditor;
};

PicoContentAdmin.prototype.getYamlEditorElement = function () {
    return (this.yamlEditor !== null) ? this.yamlEditor.getTextArea() : null;
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

PicoContentAdmin.prototype.getMarkdownEditorElement = function () {
    return (this.markdownEditor !== null) ? this.markdownEditor.element : null;
};
