<?php

class PicoAdmin extends AbstractPicoPlugin
{
    protected $modules = array();

    protected $requestModule;
    protected $requestAction;
    protected $requestPayload;

    protected $authenticated = false;
    protected $authenticationRequired = false;

    protected $adminThemeUrl;

    private $authClientToken;

    /**
     * Loads built-in admin modules as Pico plugins
     *
     * @see DummyPlugin::onPluginsLoaded()
     */
    public function onPluginsLoaded(array &$plugins)
    {
        // require >= Pico 1.1; Pico::VERSION wasn't defined before Pico 1.1
        if (!defined('Pico::VERSION')) {
            $this->setEnabled(false);
            return;
        }

        // TODO (Pico 2.0): Load built-in admin modules manually
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
            'auth_token' => '',
            'auth_client_salt' => ''
        );

        if (!isset($config['PicoAdmin']) || !is_array($config['PicoAdmin'])) {
            $config['PicoAdmin'] = $defaultPluginConfig;
            return;
        }

        $config['PicoAdmin'] += $defaultPluginConfig;
        if (empty($config['PicoAdmin']['url'])) {
            $config['PicoAdmin']['url'] = 'admin';
        } else {
            $config['PicoAdmin']['url'] = trim($config['PicoAdmin']['url'], '/');
        }
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
        $authClientSalt = $this->getPluginConfig('auth_client_salt');
        if (empty($authToken) || empty($authClientSalt)) {
            // force info screen when no auth token is configured
            $this->requestModule = 'info';
            $this->requestAction = $this->requestPayload = '';
        } elseif (empty($this->requestModule)) {
            // show built-in landing page when no specific module was requested
            // landing page requires authentication, therefore non-authenticated users will end up on the login page
            $this->requestModule = 'landing';
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
        if (!empty($authToken)) {
            if (isset($_POST['password'])) {
                // verify plain password
                // you should use auth_client_token whenever possible (it's faster and more secure)!
                $this->authenticated = password_verify((string) $_POST['password'], $authToken);
            } elseif (isset($_POST['auth_client_token'])) {
                // verify client token
                $this->authenticated = $this->verifyAuthClientToken($_POST['auth_client_token']);
            }
        }

        $this->triggerEvent('onAdminAuthentication', array(
            &$this->authenticationRequired,
            &$this->authenticated
        ));

        if ($this->authenticationRequired && !$this->authenticated) {
            // force login screen when authentication was requested, but user isn't authenticated
            // admin modules which require authentication MUST disable themselves in this case!
            $this->requestModule = 'login';
            $this->requestAction = $this->requestPayload = '';
        }
    }

    public function onRequestFile(&$file)
    {
        // reset requested file
        $file = null;
        switch ($this->requestModule) {
            case 'info':
                $file = __DIR__ . '/content/info.md';
                break;

            case 'login':
                $file = __DIR__ . '/content/login.md';
                break;
        }
    }

    public function onMetaParsed(array &$meta)
    {
        switch ($this->requestModule) {
            case 'info':
                if (isset($_POST['password']) && isset($_POST['auth_client_salt'])) {
                    $meta['admin_auth_token'] = $this->generateAuthToken((string) $_POST['password']);
                    $meta['admin_auth_client_salt'] = (string) $_POST['auth_client_salt'];
                } else {
                    $meta['admin_auth_token'] = '';
                    $meta['admin_auth_client_salt'] = $this->generateAuthClientSalt();
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
        // fallback to frontend theme
        if (($this->requestModule === 'info') || ($this->requestModule === 'login')) {
            return;
        }

        // landing page
        if ($this->requestModule === 'landing') {
            header($_SERVER['SERVER_PROTOCOL'] . ' 200 OK');

            $twig->getLoader()->addPath(__DIR__ . '/theme');
            $templateName = 'admin.twig';
        }

        // register admin_link filter
        $twig->addFilter(new Twig_SimpleFilter('admin_link', array($this, 'getAdminPageUrl')));

        // register include_block filter
        $twig->addFunction(new Twig_SimpleFunction('include_block', function (Twig_Environment $env, $context, $templateName, $blockName) {
            $template = $env->loadTemplate($templateName);
            return $template->renderBlock($blockName, $context);
        }, array('needs_context' => true, 'needs_environment' => true)));

        // send "401 Unauthorized" header when authentication was requested, but user isn't authenticated
        if ($this->authenticationRequired && !$this->authenticated) {
            header($_SERVER['SERVER_PROTOCOL'] . ' 401 Unauthorized');
        }

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

        if ($this->authenticated) {
            $twigVariables['admin_auth_client_token'] = $this->getAuthClientToken();
        }
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

    protected function generateAuthClientSalt()
    {
        $bcrypt = password_hash('PicoAdmin', PASSWORD_BCRYPT, array('cost' => 4));
        if (!$bcrypt) {
            throw new RuntimeException('Unable to generate client salt');
        }

        // we don't care about the hash, just the randomly generated salt
        return substr($bcrypt, 7, 22);
    }

    protected function getAuthClientToken()
    {
        if ($this->authClientToken === null) {
            $authToken = $this->getPluginConfig('auth_token');
            $authTokenInfo = password_get_info($authToken);

            $authClientOptions = $authTokenInfo['options'];
            $authClientOptions['salt'] = $this->getPluginConfig('auth_client_salt');

            if (($authTokenInfo['algo'] === 0) || empty($authClientOptions['salt'])) {
                throw new RuntimeException('Unable to return auth client token; did you configure the auth token?');
            }

            // we slow down verification (i.e. by storing just the salt in the config) on purpose!
            $this->authClientToken = password_hash($authToken, $authTokenInfo['algo'], $authClientOptions);
        }

        return $this->authClientToken;
    }

    protected function verifyAuthClientToken($authClientToken)
    {
        $authClientToken1 = (string) $authClientToken;
        $authClientToken2 = (string) $this->getAuthClientToken();

        if (strlen($authClientToken1) !== strlen($authClientToken2)) {
            return false;
        }

        $result = 0;
        for ($i = 0, $length = strlen($authClientToken1); $i < $length; $i++) {
            $result |= ord($authClientToken1[$i]) ^ ord($authClientToken2[$i]);
        }

        return ($result === 0);
    }

    public function getAdminPageUrl($page, $queryData = null)
    {
        $page = !empty($page) ? $this->getPluginConfig('url') . '/' . $page : $this->getPluginConfig('url');
        return $this->getPageUrl($page, $queryData, false);
    }

    public function getAdminThemeUrl()
    {
        if (!empty($this->adminThemeUrl)) {
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

    public function writeFile($basePath, $path, $content)
    {
        $result = array(
            'dirs' => array(),
            'file' => null,
            'success' => false
        );

        $isWindows = (strncasecmp(PHP_OS, 'WIN', 3) === 0);
        $pathComponents = explode('/', $path);
        $fileName = array_pop($pathComponents);
        $path = '';

        if (empty($fileName)) {
            // invalid file name
            return $result;
        }

        // create directory structure
        foreach ($pathComponents as $pathComponent) {
            $parentPath = $path;
            $path .= $pathComponent . '/';

            if (!file_exists($basePath . $path)) {
                if (
                    !is_writable($basePath . $parentPath)
                    || (!$isWindows && !is_executable($basePath . $parentPath))
                ) {
                    $result['dirs'][$path] = array(
                        'message' => "You don't have permission to create files or directories in "
                            . (!empty($parentPath) ? '"' . $parentPath . '"' : 'the content directory') . '.',
                        'success' => false
                    );
                    return $result;
                }

                // create directory
                $mkdirResult = mkdir($this->getConfig('content_dir') . $path);
                if (!$mkdirResult) {
                    $result['dirs'][$path] = array(
                        'message' => 'Creating directory "' . $path . '" failed for an unknown reason.',
                        'success' => false
                    );
                    return $result;
                }

                $result['dirs'][$path] = array(
                    'message' => 'Successfully created directory "' . $path . '".',
                    'success' => true
                );
            } elseif (!is_dir($this->getConfig('content_dir') . $path)) {
                $result['dirs'][$path] = array(
                    'message' => "You can't create the directory \"" . $path . "\", "
                        . 'because there is already a file of this name.',
                    'success' => false
                );
                return $result;
            }
        }

        // check file permissions
        if (file_exists($basePath . $path . $fileName)) {
            if (!is_file($basePath . $path . $fileName)) {
                $result['file'] = array(
                    'message' => "You can't create the file \"" . $path . $fileName . "\n, "
                        . 'because there is already another directory entry of this name.',
                    'success' => false
                );
                return $result;
            }
            if (!is_writable($basePath . $path . $fileName)) {
                $result['file'] = array(
                    'message' => "You don't have permission to write to \"" . $path . $fileName . '".',
                    'success' => false
                );
                return $result;
            }
        } else {
            if (!is_writable($basePath . $path) || (!$isWindows && !is_executable($basePath . $path))) {
                $result['file'] = array(
                    'message' => "You don't have permission to create files in "
                        . (!empty($path) ? '"' . $path . '"' : 'the content directory') . '.',
                    'success' => false
                );
                return $result;
            }
        }

        // write file
        $writtenBytes = file_put_contents($basePath . $path . $fileName, $content, LOCK_EX);
        if ($writtenBytes === false) {
            $result['file']  = array(
                'message' => 'Writing to file "' . $path . $fileName . '" failed for an unknown reason.',
                'success' => false
            );
            return $result;
        }

        // success
        $result['success'] = true;
        $result['file'] = array(
            'message' => 'Successfully written to file "' . $path . $fileName . '".',
            'success' => true
        );
        return $result;
    }

    public function deleteFile($basePath, $path)
    {
        $result = array(
            'dirs' => array(),
            'file' => null,
            'success' => false
        );

        $isWindows = (strncasecmp(PHP_OS, 'WIN', 3) === 0);
        $pathComponents = explode('/', $path);
        $fileName = array_pop($pathComponents);
        $path = !empty($pathComponents) ? implode('/', $pathComponents) . '/' : '';

        if (empty($fileName)) {
            // invalid file name
            return $result;
        }

        // check file permissions
        if (!file_exists($basePath . $path . $fileName)) {
            $result['file'] = array(
                'message' => "File \"" . $path . $fileName . '" not found.',
                'success' => false
            );
            return $result;
        }
        if (!is_writable($basePath . $path . $fileName)) {
            // this permission actually isn't necessary to delete the file, this is just a safety check
            $result['file'] = array(
                'message' => "You don't have permission to modify file \"" . $path . $fileName . '".',
                'success' => false
            );
            return $result;
        }
        if (!is_writable($basePath . $path) || (!$isWindows && !is_executable($basePath . $path))) {
            $result['file'] = array(
                'message' => "You don't have permission to delete files in "
                    . (!empty($path) ? '"' . $path . '"' : 'the content directory') . '.',
                'success' => false
            );
            return $result;
        }

        // delete file
        $unlinkResult = unlink($basePath . $path . $fileName);
        if (!$unlinkResult) {
            $result['file']  = array(
                'message' => 'Deleting file "' . $path . $fileName . '" failed for an unknown reason.',
                'success' => false
            );
            return $result;
        }

        // success
        $result['success'] = true;
        $result['file'] = array(
            'message' => 'Successfully deleted file "' . $path . $fileName . '".',
            'success' => true
        );

        // delete empty directories
        // this is just a bonus and doesn't affect the overall success
        if ($path !== '') {
            do {
                array_pop($pathComponents);
                $parentPath = implode('/', $pathComponents);

                if (!is_writable($basePath . $path)) {
                    // this permission actually isn't necessary to delete the directory, this is just a safety check
                    $result['dirs'][$path] = array(
                        'message' => "You don't have permission to modify directory \"" . $path . '".',
                        'success' => false
                    );
                    return $result;
                }
                if (!is_writable($basePath . $parentPath) || (!$isWindows && !is_executable($basePath . $parentPath))) {
                    $result['dirs'][$path] = array(
                        'message' => "You don't have permission to delete files or directories in "
                            . (!empty($parentPath) ? '"' . $parentPath . '"' : 'the content directory') . '.',
                        'success' => false
                    );
                    return $result;
                }

                // check whether the directory is empty
                if (is_readable($basePath . $path) && (($handle = @opendir($basePath . $path)) !== false)) {
                    while (($file = readdir($handle)) !== false) {
                        if (($file !== '.') && ($file !== '..')) {
                            // directory not empty; abort...
                            return $result;
                        }
                    }
                    closedir($handle);

                    // directory is empty, proceed deleting it
                    $rmdirResult = rmdir($basePath . $path);
                    if (!$rmdirResult) {
                        $result['dirs'][$path] = array(
                            'message' => 'Deleting empty directory "' . $path . '" failed for an unknown reason.',
                            'success' => false
                        );
                        return $result;
                    }
                } else {
                    // try deleting the dir anyway
                    $rmdirResult = @rmdir($basePath . $path);
                    if (!$rmdirResult) {
                        $result['dirs'][$path] = array(
                            'message' => 'Deleting directory "' . $path . '" failed for an unknown reason. '
                                . "The directory is very likely not empty, but we weren't able to check it.",
                            'success' => false
                        );
                        return $result;
                    }
                }


                $result['dirs'][$path] = array(
                    'message' => 'Successfully deleted empty directory "' . $path . '".',
                    'success' => true
                );
            } while (($path = $parentPath) !== '');
        }

        return $result;
    }
}
