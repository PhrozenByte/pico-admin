<?php

class PicoAdmin extends AbstractPicoPlugin
{
    protected $dependsOn = array('PicoSession');

    protected $session;

    protected $modules = array();

    protected $requestModule;
    protected $requestAction;
    protected $requestPayload;

    protected $authenticated = false;
    protected $authenticationRequired = false;

    protected $adminThemeUrl;

    /**
     * Loads built-in admin modules as Pico plugins
     *
     * @see DummyPlugin::onPluginsLoaded()
     */
    public function onPluginsLoaded(array &$plugins)
    {
        // require >= Pico 2.0; Pico::VERSION wasn't defined before Pico 2.0
        if (!defined('Pico::VERSION')) {
            $this->setEnabled(false);
            return;
        }

        // load built-in admin module PicoContentAdmin
        require_once(__DIR__ . '/PicoContentAdmin.php');
        $this->loadPlugin(new PicoContentAdmin($this->getPico()));
    }

    /**
     * Bootstrap the plugin's default configuration
     *
     * @see DummyPlugin::onConfigLoaded()
     */
    public function onConfigLoaded(array &$config)
    {
        $defaultPluginConfig = array(
            'url' => 'admin',
            'auth_token' => ''
        );

        if (!isset($config['PicoAdmin']) || !is_array($config['PicoAdmin'])) {
            $config['PicoAdmin'] = $defaultPluginConfig;
            return;
        }

        $config['PicoAdmin'] += $defaultPluginConfig;
        if (!$config['PicoAdmin']['url']) {
            $config['PicoAdmin']['url'] = $defaultPluginConfig['url'];
        } else {
            $config['PicoAdmin']['url'] = trim($config['PicoAdmin']['url'], '/');
        }
    }

    public function onSessionInit(PicoSession $session, &$pluginsReadOnly, &$plugins)
    {
        $this->session = $session;
        $plugins['PicoAdmin'] = $this;
    }

    public function onRequestUrl(&$url)
    {
        $adminUrlPrefix = $this->getPluginConfig('url');
        $adminUrlRegex = '#^' . preg_quote($adminUrlPrefix, '#') . '(?:/(\w+)(?:/(\w+)(?:/(.+))?)?)?$#';
        if (preg_match($adminUrlRegex, $url, $adminUrlMatches)) {
            $this->requestModule = isset($adminUrlMatches[1]) ? $adminUrlMatches[1] : '';
            $this->requestAction = isset($adminUrlMatches[2]) ? $adminUrlMatches[2] : '';
            $this->requestPayload = isset($adminUrlMatches[3]) ? $adminUrlMatches[3] : '';

            $this->triggerEvent('onAdminInitializing', array($this, &$this->modules));

            $this->handleAdminRequest();
            $this->handleAuthentication();

            $this->triggerEvent('onAdminInitialized');
            return;
        }

        // the user wasn't requesting a page of this plugin
        $this->setEnabled(false);
    }

    protected function handleAdminRequest()
    {
        $authToken = $this->getPluginConfig('auth_token');
        if (!$authToken) {
            // force info screen when no auth token is configured
            $this->requestModule = 'info';
            $this->requestAction = $this->requestPayload = '';
        } elseif (!$this->requestModule) {
            // when only a single module is registered, redirect to the main page of this module
            if (count($this->modules) === 1) {
                foreach ($this->modules as $moduleName => $module) {
                    header($_SERVER['SERVER_PROTOCOL'] . ' 307 Temporary Redirect');
                    header('Location: ' . $this->getAdminPageUrl($moduleName));
                    die();
                }
            }

            // show built-in landing page when no specific module was requested
            // landing page requires authentication, therefore non-authenticated users will end up on the login page
            $this->requestModule = 'landing';
            $this->requestAction = $this->requestPayload = '';
            $this->authenticationRequired = true;
        }

        $this->triggerEvent('onAdminRequest', array(
            &$this->requestModule,
            &$this->requestAction,
            &$this->requestPayload
        ));
    }

    protected function handleAuthentication()
    {
        // check auth token
        $authToken = $this->getPluginConfig('auth_token');
        if ($authToken) {
            if (isset($_REQUEST['logout'])) {
                // perform logout
                $this->authenticated = false;

                $this->session->set('PicoAdmin', 'authenticated', false);
                $this->session->migrateSession();
            } elseif (isset($_POST['password'])) {
                // verify password
                $this->authenticated = password_verify((string) $_POST['password'], $authToken);

                $this->session->migrateSession();
                $this->session->set('PicoAdmin', 'authenticated', $this->authenticated);
            } else {
                // already authenticated session
                $this->authenticated = (bool) $this->session->get('PicoAdmin', 'authenticated');
            }

            $this->session->close('PicoAdmin');
        }

        $this->triggerEvent('onAdminAuthentication', array(
            &$this->authenticationRequired,
            &$this->authenticated
        ));

        if ($this->authenticationRequired && !$this->authenticated) {
            // force login screen when authentication was requested, but the user isn't authenticated
            // admin modules which require authentication MUST disable themselves in this case!
            $this->requestModule = 'login';
            $this->requestAction = $this->requestPayload = '';
        }
    }

    public function onRequestFile(&$file)
    {
        // reset requested file
        switch ($this->requestModule) {
            case 'info':
                $file = __DIR__ . '/content/info.md';
                break;

            case 'login':
                $file = __DIR__ . '/content/login.md';
                break;

            default:
                $file = __DIR__ . '/content/admin.md';
                break;
        }
    }

    public function onMetaParsed(array &$meta)
    {
        switch ($this->requestModule) {
            case 'info':
                if (isset($_POST['password'])) {
                    $meta['admin_auth_token'] = $this->generateAuthToken((string) $_POST['password']);
                } else {
                    $meta['admin_auth_token'] = '';
                }
                break;
        }
    }

    public function onContentPrepared(&$content)
    {
        $variables = array();
        $variables['%admin_url%'] = rtrim($this->getPageUrl($this->getPluginConfig('url')), '/');
        $variables['%admin_theme_url%'] = rtrim($this->getAdminThemeUrl(), '/');

        $content = str_replace(array_keys($variables), $variables, $content);
    }

    public function onPageRendering(Twig_Environment &$twig, array &$twigVariables, &$templateName)
    {
        // send "401 Unauthorized" header when authentication was requested, but user isn't authenticated
        if ($this->authenticationRequired && !$this->authenticated) {
            header($_SERVER['SERVER_PROTOCOL'] . ' 401 Unauthorized');
        }

        // requesting login page with a JSON request - send auth status
        if (($this->requestModule === 'login') && $this->isJsonRequest()) {
            $twig->getLoader()->addPath(__DIR__ . '/theme');
            $templateName = 'admin-json.twig';

            $twigVariables['json'] = array();
            $twigVariables['json']['admin_auth'] = $this->authenticated;
            $twigVariables['json']['admin_auth_required'] = $this->authenticationRequired;
        }

        // fallback to frontend theme
        if (in_array($this->requestModule, array('info', 'login'), true)) {
            return;
        }

        // landing page
        if ($this->requestModule === 'landing') {
            $twig->getLoader()->addPath(__DIR__ . '/theme');
            $templateName = 'admin.twig';
        }

        // register admin_link filter
        $twig->addFilter(new Twig_SimpleFilter('admin_link', array($this, 'getAdminPageUrl')));

        // register include_block filter
        $twig->addFunction(new Twig_SimpleFunction(
            'include_block',
            function (Twig_Environment $env, $context, $templateName, $blockName) {
                $template = $env->loadTemplate($templateName);
                return $template->renderBlock($blockName, $context);
            },
            array('needs_context' => true, 'needs_environment' => true)
        ));

        // register variables
        $twigVariables['admin_modules'] = $this->modules;

        $twigVariables['admin_url'] = rtrim($this->getPageUrl($this->getPluginConfig('url')));
        $twigVariables['admin_theme_url'] = rtrim($this->getAdminThemeUrl(), '/');

        $twigVariables['admin_request'] = array(
            'module' => $this->requestModule,
            'action' => $this->requestAction,
            'payload' => $this->requestPayload
        );

        $twigVariables['admin_auth'] = $this->authenticated;
        $twigVariables['admin_auth_required'] = $this->authenticationRequired;
    }

    protected function generateAuthToken($password)
    {
        $authToken = null;
        for ($time = 0, $timeTarget = 0.2, $cost = 10; $time < $timeTarget; $cost++) {
            $startTime = microtime(true);
            $authToken = password_hash($password, PASSWORD_DEFAULT, array('cost' => $cost));
            $time = (microtime(true) - $startTime);

            if (!$authToken) {
                throw new RuntimeException('Unable to generate auth token');
            }
        }

        return $authToken;
    }

    public function isAuthenticated()
    {
        return $this->authenticated;
    }

    public function getAdminPageUrl($page, $queryData = null)
    {
        $page = $page ? $this->getPluginConfig('url') . '/' . $page : $this->getPluginConfig('url');
        return $this->getPageUrl($page, $queryData, false);
    }

    public function getAdminThemeUrl()
    {
        if ($this->adminThemeUrl) {
            return $this->adminThemeUrl;
        }

        $basePath = dirname($_SERVER['SCRIPT_FILENAME']) . '/';
        $basePathLength = strlen($basePath);
        if (substr(__DIR__, 0, $basePathLength) === $basePath) {
            $this->adminThemeUrl = $this->getBaseUrl() . substr(__DIR__, $basePathLength) . '/theme/';
        } else {
            $this->adminThemeUrl = $this->getBaseUrl() . 'plugins/PicoAdmin/theme/';
        }

        return $this->adminThemeUrl;
    }

    public function isJsonRequest()
    {
        return (isset($_SERVER['HTTP_ACCEPT']) && ($_SERVER['HTTP_ACCEPT'] === 'application/json'));
    }

    public function writeFile($basePath, $path, $content)
    {
        $isWindows = (strncasecmp(PHP_OS, 'WIN', 3) === 0);
        $pathComponents = explode('/', $path);
        $fileName = array_pop($pathComponents);
        $path = '';

        if (!$fileName) {
            throw new RuntimeException('The given file path is invalid');
        }

        // create directory structure
        foreach ($pathComponents as $pathComponent) {
            $parentPath = $path;
            $path .= $pathComponent . '/';

            if (!file_exists($basePath . $path)) {
                if (!is_writable($basePath . $parentPath) || (!$isWindows && !is_executable($basePath . $parentPath))) {
                    throw new RuntimeException(
                        "You don't have permission to create files or directories in "
                            . ($parentPath ? '"' . $parentPath . '"' : 'the content directory')
                    );
                }

                // create directory
                $mkdirResult = @mkdir($this->getConfig('content_dir') . $path);
                if (!$mkdirResult) {
                    throw new RuntimeException('Creating directory "' . $path . '" failed for an unknown reason');
                }
            } elseif (!is_dir($this->getConfig('content_dir') . $path)) {
                throw new RuntimeException(
                    "You can't create the directory \"" . $path . '", '
                        . 'because there is already another directory entry of this name'
                );
            }
        }

        // check file permissions
        if (file_exists($basePath . $path . $fileName)) {
            if (!is_file($basePath . $path . $fileName)) {
                throw new RuntimeException(
                    "You can't create the file \"" . $path . $fileName . '", '
                        . 'because there is already another directory entry of this name'
                );
            }
            if (!is_writable($basePath . $path . $fileName)) {
                throw new RuntimeException("You don't have permission to write to \"" . $path . $fileName . '"');
            }
        } else {
            if (!is_writable($basePath . $path) || (!$isWindows && !is_executable($basePath . $path))) {
                $pathName = $path ? '"' . $path . '"' : 'the content directory';
                throw new RuntimeException("You don't have permission to create files in " . $pathName);
            }
        }

        // write file
        // LOCK_EX delays concurrent write attempts from other PHP processes,
        // but doesn't prevent Pico from reading a not completely written file
        // that's because file_get_contents() doesn't observe locks
        $writtenBytes = @file_put_contents($basePath . $path . $fileName, $content, LOCK_EX);
        if ($writtenBytes === false) {
            throw new RuntimeException('Writing to file "' . $path . $fileName . '" failed for an unknown reason');
        }
    }

    public function deleteFile($basePath, $path)
    {
        $isWindows = (strncasecmp(PHP_OS, 'WIN', 3) === 0);
        $pathComponents = explode('/', $path);
        $fileName = array_pop($pathComponents);
        $path = $pathComponents ? implode('/', $pathComponents) . '/' : '';

        if (!$fileName) {
            throw new RuntimeException('The given file path is invalid');
        }

        // check file permissions
        if (!file_exists($basePath . $path . $fileName)) {
            throw new RuntimeException('File "' . $path . $fileName . '" not found');
        }
        if (!is_writable($basePath . $path . $fileName)) {
            // this permission actually isn't necessary to delete the file, it's just a safety check
            throw new RuntimeException("You don't have permission to modify file \"" . $path . $fileName . '"');
        }
        if (!is_writable($basePath . $path) || (!$isWindows && !is_executable($basePath . $path))) {
            $pathName = $path ? '"' . $path . '"' : 'the content directory';
            throw new RuntimeException("You don't have permission to delete files in " . $pathName);
        }

        // delete file
        $unlinkResult = @unlink($basePath . $path . $fileName);
        if (!$unlinkResult) {
            throw new RuntimeException('Deleting file "' . $path . $fileName . '" failed for an unknown reason');
        }

        // delete empty directories
        if ($path !== '') {
            do {
                array_pop($pathComponents);
                $parentPath = implode('/', $pathComponents);

                if (!is_writable($basePath . $path)) {
                    // this permission actually isn't necessary to delete the directory, it's just a safety check
                    throw new RuntimeException("You don't have permission to modify directory \"" . $path . '"');
                }
                if (!is_writable($basePath . $parentPath) || (!$isWindows && !is_executable($basePath . $parentPath))) {
                    throw new RuntimeException(
                        "You don't have permission to delete files or directories in "
                            . ($parentPath ? '"' . $parentPath . '"' : 'the content directory')
                    );
                }

                // check whether the directory is empty
                if (is_readable($basePath . $path) && (($handle = @opendir($basePath . $path)) !== false)) {
                    while (($file = readdir($handle)) !== false) {
                        if (($file !== '.') && ($file !== '..')) {
                            // directory not empty; abort...
                            closedir($handle);
                            return;
                        }
                    }
                    closedir($handle);

                    // directory is empty, proceed deleting it
                    $rmdirResult = @rmdir($basePath . $path);
                    if (!$rmdirResult) {
                        throw new RuntimeException(
                            'Deleting empty directory "' . $path . '" failed for an unknown reason'
                        );
                    }
                } else {
                    // try deleting the dir anyway
                    // we don't care about the result because a failure is likely caused by other files
                    @rmdir($basePath . $path);
                }
            } while (($path = $parentPath) !== '');
        }
    }

    /**
     * @see PicoPluginInterface::setEnabled()
     */
    public function setEnabled($enabled, $recursive = true, $auto = false)
    {
        if (!$enabled && $this->session) {
            $this->session->close('PicoAdmin');
        }

        parent::setEnabled($enabled, $recursive, $auto);
    }
}
