<?php

class PicoAdmin extends AbstractPicoPlugin
{
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

            $this->handleAdminRequest();
            $this->handleAuthentication();
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
            // show built-in content module when no specific module was requested
            $this->requestModule = 'content';
        }

        $this->triggerEvent('onAdminRequest', array(
            $this,
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

            case 'login':
                $meta['title'] = 'Login';
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
        if (($this->requestModule === 'info') || ($this->requestModule === 'login')) {
            // reset "404 Not Found" header
            // TODO (Pico 2.0): skip the appropriate events instead
            header($_SERVER['SERVER_PROTOCOL'] . ' 200 OK');

            // use plugin-specific templates
            // Note: you can replace all admin templates by adding
            // a equally named template to your custom theme (e.g. admin-login.twig)
            $twig->getLoader()->addPath(__DIR__ . '/theme');
            $templateName = 'admin-' . $this->requestModule . '.twig';
        }

        // register admin_link filter
        $twig->addFilter(new Twig_SimpleFilter('admin_link', array($this, 'getAdminPageUrl')));

        // send "401 Unauthorized" header when authentication was requested, but user isn't authenticated
        if ($this->authenticationRequired && !$this->authenticated) {
            header($_SERVER['SERVER_PROTOCOL'] . ' 401 Unauthorized');
        }

        // register variables
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
        return $this->getPageUrl($page, $queryData);
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
}
