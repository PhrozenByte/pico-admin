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
                    'save', 'preview', 'full-preview',
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
                $this->action = 'edit';
                $this->page = !empty($payload) ? $payload : 'index';

                header('307 Temporary Redirect');
                header('Location: ' . $this->admin->getAdminPageUrl('content/edit/' . $this->page));
                die();
            } else {
                $this->action = $action;
                $this->page = $payload;
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
            case 'open':
            case 'fullPreview':
                $file = $this->getConfig('content_dir') . $this->page . $this->getConfig('content_ext');
                break;
        }
    }

    public function onContentLoaded(&$rawContent)
    {
        switch ($this->action) {
            case 'edit':
            case 'open':
                $pattern = "/^(?:(\/(\*)|---)[[:blank:]]*(?:\r)?\n"
                    . "(?:(.*?)(?:\r)?\n)?(?(2)\*\/|---)[[:blank:]]*"
                    . "(?:(?:\r)?\n(?:[[:blank:]]*(?:\r)?\n)?(.*?))?|(.*))$/s";
                if (preg_match($pattern, $rawContent, $rawMetaMatches)) {
                    $this->yamlContent = isset($rawMetaMatches[3]) ? $rawMetaMatches[3] : '';
                    $this->markdownContent = isset($rawMetaMatches[5]) ? $rawMetaMatches[5] : (isset($rawMetaMatches[4]) ? $rawMetaMatches[4] : '');
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
                $templateName = 'admin-content.twig';

                $twigVariables['yaml_content'] = $this->yamlContent;
                $twigVariables['markdown_content'] = $this->markdownContent;
                $twigVariables['file_navigation'] = $this->getFileNavigation();
                break;

            case 'open':
                $meta = $this->getFileMeta();

                header('Content-Type: application/json; charset=UTF-8');
                $templateName = 'admin-ajax.twig';

                $twigVariables['json'] = array(
                    'yaml' => $this->yamlContent,
                    'markdown' => $this->markdownContent,
                    'title' => $this->page . (isset($meta['title']) ? ' (' . $meta['title'] . ')' : '')
                );
                break;

            case 'preview':
                $templateName = 'admin-content-preview.twig';
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

            if (!isset($files[$id])) {
                $files[$id] = array(
                    'id' => $id,
                    'path' => dirname($id),
                    'fileName' => basename($id),
                    'title' => isset($pages[$id]) ? $pages[$id]['title'] : null,
                    'children' => array()
                );
            } else {
                // conflicting "sub.md" although "sub/index.md" exists
                $files[$id]['id'] = $id;
                $files[$id]['title'] = isset($pages[$id]) ? $pages[$id]['title'] : null;
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
