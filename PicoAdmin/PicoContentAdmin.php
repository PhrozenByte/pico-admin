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

    protected $pageNotFound;

    protected $actionError;

    protected $rawRequest;
    protected $rawContent;

    protected $meta;
    protected $yamlContent;
    protected $markdownContent;

    protected $navigation;

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
                    'save', 'save-as', 'preview', 'full-preview',
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

    public function onAdminInitializing(PicoAdmin $admin, array &$modules)
    {
        $this->admin = $admin;

        $modules['content'] = array(
            'title' => 'Pico Content Admin',
            'template' => 'admin-content.twig',
            'plugin' => $this
        );
    }

    public function onAdminRequest(&$module, &$action, &$payload)
    {
        if ($module === 'content') {
            if (!$action) {
                header('307 Temporary Redirect');
                header('Location: ' . $this->admin->getAdminPageUrl('content/edit/index'));
                die();
            } else {
                $this->action = $action;

                if ($payload) {
                    $contentDirLength = strlen($this->getConfig('content_dir'));
                    $contentExtLength = strlen($this->getConfig('content_ext'));

                    $this->page = substr($this->resolveFilePath($payload), $contentDirLength, -$contentExtLength);

                    // allow editing conflicting files (i.e. allow editing sub.md when sub/index.md exists)
                    if ((basename($payload) !== 'index') && (basename($this->page) === 'index')) {
                        $this->page = dirname($this->page);
                    }
                }

                if (!$this->page && ($this->action === 'edit')) {
                    header('307 Temporary Redirect');
                    header('Location: ' . $this->admin->getAdminPageUrl('content/' . $action . '/index'));
                    die();
                }

                return;
            }
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

    public function onAdminInitialized()
    {
        switch ($this->action) {
            case 'edit':
            case 'load':
                $this->rawRequest = (isset($_REQUEST['raw']) && $_REQUEST['raw']);
                break;

            case 'preview':
            case 'fullPreview':
                $this->yamlContent = isset($_POST['yaml']) ? (string) $_POST['yaml'] : '';
                $this->markdownContent = isset($_POST['markdown']) ? (string) $_POST['markdown'] : '';
                break;

            case 'save':
                $this->rawRequest = (isset($_REQUEST['raw']) && $_REQUEST['raw']);

                if ($this->rawRequest) {
                    $this->rawContent = isset($_POST['content']) ? (string) $_POST['content'] : '';
                } else {
                    $this->yamlContent = isset($_POST['yaml']) ? (string) $_POST['yaml'] : '';
                    $this->markdownContent = isset($_POST['markdown']) ? (string) $_POST['markdown'] : '';
                }
                break;

            case 'navigation':
            case 'create':
            case 'delete':
                break;

            default:
                // unknown action; disable module...
                $this->setEnabled(false);
                return;
        }

        // JSON requests
        if (($this->action !== 'create') && ($this->action !== 'edit')) {
            if (!isset($_SERVER['HTTP_X_REQUESTED_WITH']) || ($_SERVER['HTTP_X_REQUESTED_WITH'] !== 'XMLHttpRequest')) {
                header('307 Temporary Redirect');
                header('Location: ' . $this->admin->getAdminPageUrl('content/edit/' . $this->page));
                die();
            }
        }
    }

    public function onRequestFile(&$file)
    {
        switch ($this->action) {
            case 'fullPreview':
                $file = $this->getConfig('content_dir') . $this->page . $this->getConfig('content_ext');
                break;

            case 'save':
                $fileContent = '';
                if ($this->rawRequest) {
                    $fileContent = $this->rawContent;
                } else {
                    if ($this->yamlContent) {
                        $fileContent = "---\n" . $this->yamlContent . "\n" . "---\n\n";
                    }
                    $fileContent .= $this->markdownContent . "\n";
                }

                try {
                    $this->admin->writeFile(
                        $this->getConfig('content_dir'),
                        $this->page . $this->getConfig('content_ext'),
                        $fileContent
                    );
                } catch (RuntimeException $e) {
                    $this->actionError = $e->getMessage();
                }
                break;

            case 'delete':
                try {
                    $this->admin->deleteFile(
                        $this->getConfig('content_dir'),
                        $this->page . $this->getConfig('content_ext')
                    );
                } catch (RuntimeException $e) {
                    $this->actionError = $e->getMessage();
                }
                break;
        }
    }

    public function onContentLoaded(&$rawContent)
    {
        switch ($this->action) {
            case 'create':
                $file = $this->getConfig('content_dir') . $this->page . $this->getConfig('content_ext');
                $this->pageNotFound = !file_exists($file);

                $this->yamlContent = '';
                $this->markdownContent = '';

                $rawContent = '';
                break;

            case 'edit':
            case 'load':
                $file = $this->getConfig('content_dir') . $this->page . $this->getConfig('content_ext');
                $this->pageNotFound = !file_exists($file);

                $fileContent = '';
                if (!$this->pageNotFound) {
                    $fileContent = $this->loadFileContent($file);
                }

                if ($this->rawRequest) {
                    // rescue mode: return raw file contents
                    $this->rawContent = $fileContent;
                    break;
                }

                $pattern = "/^(\/(\*)|---)[[:blank:]]*(?:\r)?\n"
                    . "(?:(.*?)(?:\r)?\n)?(?(2)\*\/|---)[[:blank:]]*"
                    . "(?:$|(?:\r)?\n(?:[[:blank:]]*(?:$|(?:\r)?\n))?)/s";
                if (preg_match($pattern, $fileContent, $matches)) {
                    $this->yamlContent = isset($matches[3]) ? $matches[3] : '';
                    $this->markdownContent = substr($fileContent, strlen($matches[0]));
                } else {
                    $this->yamlContent = '';
                    $this->markdownContent = $fileContent;
                }

                $rawContent = '';
                break;

            case 'preview':
            case 'fullPreview':
                if ($this->yamlContent) {
                    $rawContent = "---\n" . $this->yamlContent . "\n---\n\n";
                }
                $rawContent .= $this->markdownContent;
                break;

            case 'save':
                $fileContent = '';
                if ($this->rawRequest) {
                    $fileContent = $this->rawContent;
                } elseif ($this->yamlContent) {
                    // we don't care about the markdown contents
                    $fileContent = "---\n" . $this->yamlContent . "\n" . "---\n\n";
                }

                $rawContent = '';
                break;

            case 'navigation':
            case 'delete':
                $rawContent = '';
                break;
        }
    }

    public function onMetaParsed(array &$meta)
    {
        switch ($this->action) {
            case 'edit':
            case 'load':
            case 'save':
                $this->meta = array();
                if ($this->yamlContent) {
                    try {
                        $fileContent = "---\n" . $this->yamlContent . "\n" . "---\n\n";
                        $headers = $this->getMetaHeaders();

                        $this->meta = $this->parseFileMeta($fileContent, $headers);
                    } catch (\Symfony\Component\Yaml\Exception\ParseException $e) {
                        $this->meta = $this->parseFileMeta('', $headers);
                        $this->meta['YAML_ParseError'] = $e->getMessage();
                    }
                }
                break;
        }
    }

    public function onPageRendering(Twig_Environment &$twig, array &$twigVariables, &$templateName)
    {
        $twig->getLoader()->addPath(__DIR__ . '/theme');

        // HTML requests
        if (($this->action === 'create') || ($this->action === 'edit')) {
            $templateName = 'admin.twig';

            if ($this->action === 'edit') {
                if ($this->rawRequest) {
                    $twigVariables['raw_content'] = $this->rawContent;
                }

                if ($this->pageNotFound) {
                    header($_SERVER['SERVER_PROTOCOL'] . ' 404 Not Found');

                    $twigVariables['error'] = array(
                        'title' => 'Error 404',
                        'message' => "Woops. Looks like this page doesn't exist.",
                        'type' => 'error',
                        'timeout' => 0
                    );
                }
            } else {
                if (!$this->pageNotFound) {
                    $twigVariables['error'] = array(
                        'title' => 'Conflict',
                        'message' => "There's already a page of this name, "
                            . 'be careful about not accidently overwriting it!',
                        'type' => 'warning',
                        'timeout' => 0
                    );
                }
            }

            $twigVariables['rescue_mode'] = $this->rawRequest;
            $twigVariables['yaml_content'] = $this->yamlContent;
            $twigVariables['markdown_content'] = $this->markdownContent;
            $twigVariables['page_path'] = $this->page;
            $twigVariables['page_title'] = !empty($this->meta['title']) ? $this->meta['title'] : '';
            $twigVariables['navigation'] = $this->getNavigation();

            return;
        }

        // JSON requests
        header('Content-Type: application/json; charset=UTF-8');
        $templateName = 'admin-json.twig';

        $twigVariables['json'] = array();

        switch ($this->action) {
            case 'load':
                if ($this->rawRequest) {
                    $twigVariables['json']['content'] = $this->rawContent;
                    break;
                }

                if ($this->pageNotFound) {
                    header($_SERVER['SERVER_PROTOCOL'] . ' 404 Not Found');

                    $twigVariables['json']['error'] = array(
                        'title' => 'Error 404',
                        'message' => "Woops. Looks like this page doesn't exist.",
                        'type' => 'error'
                    );
                    break;
                }

                $twigVariables['json']['yaml'] = $this->yamlContent;
                $twigVariables['json']['markdown'] = $this->markdownContent;
                $twigVariables['json']['title'] = !empty($this->meta['title']) ? $this->meta['title'] : '';
                break;

            case 'preview':
                $twigVariables['json']['preview'] = $twigVariables['content'];
                break;

            case 'save':
            case 'delete':
                if ($this->actionError) {
                    header($_SERVER['SERVER_PROTOCOL'] . ' 500 Internal Server Error');

                    $twigVariables['json']['error'] = array(
                        'title' => 'Failure',
                        'message' => $this->actionError,
                        'type' => 'error'
                    );
                    break;
                }

                if ($this->action === 'save') {
                    $twigVariables['json']['title'] = !empty($this->meta['title']) ? $this->meta['title'] : '';
                }

                $twigVariables['json']['success'] = true;
                // intentional fallthrough

            case 'navigation':
                $twigVariables['json']['navigation'] = $twig->render(
                    'admin-navigation.twig',
                    array('items' => $this->getNavigation()) + $twigVariables
                );
                break;
        }
    }

    public function getNavigation()
    {
        if ($this->navigation === null) {
            $contentDir = $this->getConfig('content_dir');
            $contentDirLength = strlen($contentDir);
            $contentExt = $this->getConfig('content_ext');
            $contentExtLength = strlen($contentExt);

            $pages = $this->getPages();

            $items = array();
            $files = $this->getFiles($contentDir, $contentExt);
            foreach ($files as $file) {
                $id = substr($file, $contentDirLength, -$contentExtLength);
                $pageData = isset($pages[$id]) ? $pages[$id] : array();

                if (!isset($items[$id])) {
                    $items[$id] = array(
                        'path' => $id,
                        'dirName' => dirname($id),
                        'fileName' => basename($id),
                        'children' => array()
                    );
                }

                $items[$id]['type'] = 'content';
                $items[$id]['url'] = $this->admin->getAdminPageUrl('content/edit/' . $id);
                $items[$id]['fileExt'] = $contentExt;

                if (isset($pageData['title'])) {
                    $items[$id]['title'] = $pageData['title'];
                }
                if (isset($pageData['meta']['YAML_ParseError'])) {
                    $items[$id]['error'] = 'YAML Parse Error: ' . $pageData['meta']['YAML_ParseError'];
                }
                if (!isset($items[$id]['error']) && ($items[$id]['fileName'] !== '404')) {
                    $items[$id]['icon'] = 'fa-file-text-o';
                } else {
                    $items[$id]['icon'] = 'fa-file-o';
                }

                do {
                    $parentId = dirname($id);
                    $fileName = basename($id);

                    if (!isset($items[$parentId])) {
                        $items[$parentId] = array(
                            'path' => $parentId,
                            'dirName' => dirname($parentId),
                            'fileName' => basename($parentId),
                            'type' => 'dir',
                            'children' => array($fileName => &$items[$id])
                        );
                    } elseif (!isset($items[$parentId]['children'][$fileName])) {
                        $items[$parentId]['children'][$fileName] = &$items[$id];
                    }

                    $id = $parentId;
                } while ($parentId !== '.');
            }

            $this->navigation = isset($items['.']['children']) ? $items['.']['children'] : array();
        }

        return $this->navigation;
    }
}
