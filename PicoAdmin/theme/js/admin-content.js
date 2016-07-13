var simplemdeXhr = null;
utils.extend(simplemdeOptions, {
    element: '.markdownContainer textarea',
    yamlElement: '.yamlContainer textarea',
    autoDownloadFontAwesome: false,
    previewRender: function(plainText, preview) {
        if (simplemdeXhr !== null) {
            simplemdeXhr.abort();
        }

        simplemdeXhr = utils.ajax(simplemdePreviewUrl, {
            postData: {
                yaml: this.yamlElement.value,
                markdown: plainText,
                auth_client_token: AUTH_CLIENT_TOKEN
            },
            success: function (xhr, statusText, response) {
                preview.innerHTML = response;
            },
            error: function (xhr, statusText, response) {
                preview.innerHTML = 'Failed!';
            },
            complete: function () {
                simplemdeXhr = null;
            }
        });

        return "Loading...";
    },
    toolbar: [
        {
            name: "bold",
            action: SimpleMDE.toggleBold,
            className: "fa fa-bold",
            title: "Bold"
        },
        {
            name: "italic",
            action: SimpleMDE.toggleItalic,
            className: "fa fa-italic",
            title: "Italic"
        },
        {
            name: "heading",
            action: SimpleMDE.toggleHeadingSmaller,
            className: "fa fa-header",
            title: "Heading"
        },
        '|',
        {
            name: "code",
            action: SimpleMDE.toggleCodeBlock,
            className: "fa fa-code",
            title: "Code"
        },
        {
            name: "quote",
            action: SimpleMDE.toggleBlockquote,
            className: "fa fa-quote-left",
            title: "Quote"
        },
        {
            name: "unordered-list",
            action: SimpleMDE.toggleUnorderedList,
            className: "fa fa-list-ul",
            title: "Generic List"
        },
        {
            name: "ordered-list",
            action: SimpleMDE.toggleOrderedList,
            className: "fa fa-list-ol",
            title: "Numbered List"
        },
        '|',
        {
            name: "link",
            action: SimpleMDE.drawLink,
            className: "fa fa-link",
            title: "Create Link"
        },
        {
            name: "image",
            action: SimpleMDE.drawImage,
            className: "fa fa-picture-o",
            title: "Insert Image"
        },
        {
            name: "table",
            action: SimpleMDE.drawTable,
            className: "fa fa-table",
            title: "Insert Table"
        },
        {
            name: "horizontal-rule",
            action: SimpleMDE.drawHorizontalRule,
            className: "fa fa-minus",
            title: "Insert Horizontal Line"
        },
        '|',
        {
            name: "undo",
            action: SimpleMDE.undo,
            className: "fa fa-undo no-disable",
            title: "Undo"
        },
        {
            name: "redo",
            action: SimpleMDE.redo,
            className: "fa fa-repeat no-disable",
            title: "Redo"
        },
        '|',
        {
            name: "preview",
            action: SimpleMDE.togglePreview,
            className: "fa fa-eye no-disable",
            title: "Toggle Preview"
        }
    ],
    shortcuts: {
        "toggleSideBySide": null,
        "toggleFullScreen": null
    }
});