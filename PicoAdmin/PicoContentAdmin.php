<?php

class PicoContentAdmin extends AbstractPicoPlugin
{
    /**
     * This plugin depends on PicoAdmin
     *
     * @see AbstractPicoPlugin::$dependsOn
     */
    protected $dependsOn = array('PicoAdmin');

    /**
     * Current instance of the PicoAdmin plugin
     *
     * @var PicoAdmin
     */
    protected $admin;

    protected $action;
    protected $page;

    protected $yamlContent;
    protected $markdownContent;

    /**
     * Bootstrap the plugin's default configuration
     *
     * @see DummyPlugin::onConfigLoaded()
     */
    public function onConfigLoaded(array &$config)
    {
        $defaultPluginConfig = array(
            'yamlEditor' => array(),
            'markdownEditor' => array(
                'autofocus' => true,
                'indentWithTabs' => true,
                'tabSize' => 4,
                'spellChecker' => false,
                'toolbar' => array(
                    'create', 'save', 'save-as', 'preview', 'full-preview',
                    '|', 'bold', 'italic', 'heading',
                    '|', 'code', 'quote', 'unordered-list', 'ordered-list',
                    '|', 'link', 'image', 'table', 'horizontal-rule',
                    '|', 'reset', 'undo', 'redo',
                    '|', 'docs'
                )
            )
        );

        if (!isset($config['PicoAdmin']['PicoContentAdmin']) || !is_array($config['PicoAdmin']['PicoContentAdmin'])) {
            $config['PicoAdmin']['PicoContentAdmin'] = $defaultPluginConfig;
            return;
        }

        $pluginConfig = &$config['PicoAdmin']['PicoContentAdmin'];

        if (isset($pluginConfig['yamlEditor']) && is_array($pluginConfig['yamlEditor'])) {
            $pluginConfig['yamlEditor'] += $defaultPluginConfig['yamlEditor'];
        }

        if (isset($pluginConfig['markdownEditor']) && is_array($pluginConfig['markdownEditor'])) {
            $pluginConfig['markdownEditor'] += $defaultPluginConfig['markdownEditor'];
        }

        $pluginConfig += $defaultPluginConfig;
    }

    public function onAdminRequest(PicoAdmin $admin, &$module, &$action, &$payload)
    {
        $this->admin = $admin;

        if ($module === 'content') {
            if (empty($action)) {
                header('307 Temporary Redirect');
                header('Location: ' . $this->admin->getAdminPageUrl('content/edit/index'));
                die();
            } else {
                $this->action = $action;

                $contentDirLength = strlen($this->getConfig('content_dir'));
                $contentExtLength = strlen($this->getConfig('content_ext'));
                $this->page = substr($this->resolveFilePath($payload), $contentDirLength, -$contentExtLength);

                // allow editing conflicting files (i.e. allow editing sub.md when sub/index.md exists)
                if ((basename($payload) !== 'index') && (basename($this->page) === 'index')) {
                    $this->page = dirname($this->page);
                }
            }

            switch ($this->action) {
                case 'preview':
                case 'fullPreview':
                    $this->yamlContent = isset($_POST['yaml']) ? (string) $_POST['yaml'] : '';
                    $this->markdownContent = isset($_POST['markdown']) ? (string) $_POST['markdown'] : '';
                    break;
            }

            return;
        }

        // the user wasn't requesting a page of this admin module
        $this->setEnabled(false);
    }

    public function onAdminAuthentication(&$authenticationRequired, &$authenticated)
    {
        // require authentication and disable this module when the user isn't authenticated
        $authenticationRequired = true;
        if (!$authenticated) {
            $this->setEnabled(false);
        }
    }

    public function onRequestFile(&$file)
    {
        switch ($this->action) {
            case 'edit':
            case 'load':
            case 'fullPreview':
                $file = $this->getConfig('content_dir') . $this->page . $this->getConfig('content_ext');
                break;
        }
    }

    public function on404ContentLoaded(&$rawContent)
    {
        switch ($this->action) {
            case 'edit':
            case 'load':
                // reset content of non-existing files
                if (basename($this->page) !== '404') {
                    $rawContent = '';
                }
                break;
        }
    }

    public function onContentLoaded(&$rawContent)
    {
        switch ($this->action) {
            case 'create':
                $rawContent = '';
                $this->yamlContent = '';
                $this->markdownContent = '';
                break;

            case 'edit':
            case 'load':
                $pattern = "/^(?:(\/(\*)|---)[[:blank:]]*(?:\r)?\n"
                    . "(?:(.*?)(?:\r)?\n)?(?(2)\*\/|---)[[:blank:]]*"
                    . "(?:(?:\r)?\n(?:[[:blank:]]*(?:\r)?\n)?(.*?))?|(.*))$/s";
                if (preg_match($pattern, $rawContent, $rawMetaMatches)) {
                    $this->yamlContent = isset($rawMetaMatches[3]) ? $rawMetaMatches[3] : '';

                    if (isset($rawMetaMatches[5])) {
                        $this->markdownContent = $rawMetaMatches[5];
                    } elseif (isset($rawMetaMatches[4])) {
                        $this->markdownContent = $rawMetaMatches[4];
                    } else {
                        $this->markdownContent = '';
                    }
                }
                break;

            case 'preview':
            case 'fullPreview':
                $rawContent = '';
                if (!empty($this->yamlContent)) {
                    $rawContent .= "---\n" . $this->yamlContent . "\n---\n\n";
                }
                $rawContent .= $this->markdownContent;
                break;
        }
    }

    public function onPageRendering(Twig_Environment &$twig, array &$twigVariables, &$templateName)
    {
        // reset "404 Not Found" header
        // TODO (Pico 2.0): skip the appropriate events instead
        header($_SERVER['SERVER_PROTOCOL'] . ' 200 OK');

        $twig->getLoader()->addPath(__DIR__ . '/theme');
        switch ($this->action) {
            case 'edit':
                $meta = $this->getFileMeta();
                $twigVariables['title'] = $this->page . $this->getConfig('content_ext')
                    . (!empty($meta['title']) ? ' (' . $meta['title'] . ')' : '');
                // intentional fallthrough

            case 'create':
                $templateName = 'admin-content.twig';

                $twigVariables['yaml_content'] = $this->yamlContent;
                $twigVariables['markdown_content'] = $this->markdownContent;
                $twigVariables['file_navigation'] = $this->getFileNavigation();
                break;

            case 'load':
                $meta = $this->getFileMeta();

                header('Content-Type: application/json; charset=UTF-8');
                $templateName = 'admin-ajax.twig';

                $twigVariables['json'] = array(
                    'yaml' => $this->yamlContent,
                    'markdown' => $this->markdownContent,
                    'title' => $this->page . $this->getConfig('content_ext')
                        . (!empty($meta['title']) ? ' (' . $meta['title'] . ')' : '')
                );
                break;

            case 'preview':
                header('Content-Type: application/json; charset=UTF-8');
                $templateName = 'admin-ajax.twig';
                $twigVariables['json'] = array('preview' => $twigVariables['content']);
                break;
        }
    }

    protected function getFileNavigation()
    {
        $contentDir = $this->getConfig('content_dir');
        $contentDirLength = strlen($contentDir);
        $contentExt = $this->getConfig('content_ext');
        $contentExtLength = strlen($contentExt);

        $pages = $this->getPages();

        $files = array();
        $rawFiles = $this->getFiles($contentDir, $contentExt);
        foreach ($rawFiles as $file) {
            $id = substr($file, $contentDirLength, -$contentExtLength);
            $pageData = isset($pages[$id]) ? $pages[$id] : array();

            if (!isset($files[$id])) {
                $files[$id] = array(
                    'path' => dirname($id),
                    'fileName' => basename($id),
                    'children' => array()
                );
            }

            $files[$id]['id'] = $id;

            if (isset($pageData['title'])) {
                $files[$id]['title'] = $pageData['title'];
            }
            if (isset($pageData['meta']['YAML_ParseError'])) {
                $files[$id]['error'] = 'YAML Parse Error: ' . $pageData['meta']['YAML_ParseError'];
            }

            do {
                $parentId = dirname($id);
                $fileName = basename($id);

                if (!isset($files[$parentId])) {
                    $files[$parentId] = array(
                        'path' => dirname($parentId),
                        'fileName' => basename($parentId),
                        'children' => array($fileName => &$files[$id])
                    );
                } elseif (!isset($files[$parentId]['children'][$fileName])) {
                    $files[$parentId]['children'][$fileName] = &$files[$id];
                }

                $id = $parentId;
            } while ($parentId !== '.');
        }

        return $files;
    }
}
