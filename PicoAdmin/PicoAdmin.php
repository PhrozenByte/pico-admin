<?php

class PicoAdmin extends AbstractPicoPlugin
{
    protected $requestModule;
    protected $requestAction;
    protected $requestPayload;

    protected $authenticated = false;
    protected $authenticationRequired = false;

    /**
     * Loads built-in admin modules as Pico plugins
     *
     * @see DummyPlugin::onPluginsLoaded()
     */
    public function onPluginsLoaded(array &$plugins)
    {
        require_once(__DIR__ . '/PicoContentAdmin.php');
        $this->loadPlugin('PicoContentAdmin');
    }

    /**
     * Bootstrap the plugin's default configuration
     *
     * @see DummyPlugin::onConfigLoaded()
     */
    public function onConfigLoaded(array &$config)
    {
        $defaultPluginConfig = array(
            'url' => '',
            'auth_token' => '',
            'auth_client_salt' => ''
        );

        if (isset($config['PicoAdmin']) && is_array($config['PicoAdmin'])) {
            $config['PicoAdmin'] += $defaultPluginConfig;
        } else {
            $config['PicoAdmin'] = $defaultPluginConfig;
        }

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
        if (empty($authToken)) {
            $this->requestModule = 'info';
            $this->requestAction = $this->requestPayload = '';
        } elseif (empty($this->requestModule)) {
            $this->requestModule = 'content';
            $this->requestAction = 'show';
            $this->requestPayload = 'index';
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
        $authToken = $this->getPluginConfig('auth_token');
        if (!empty($authToken) && isset($_POST['auth_token'])) {
            $this->authenticated = password_verify((string) $_POST['auth_token'], $authToken);
        }

        $this->triggerEvent('onAdminAuthentication', array(
            &$this->authenticationRequired,
            &$this->authenticated
        ));

        if ($this->authenticationRequired && !$this->authenticated) {
            $this->requestModule = 'login';
            $this->requestAction = $this->requestPayload = '';
        }
    }

    public function onRequestFile(&$file)
    {
        if ($this->requestModule === 'info') {
            $file = __DIR__ . '/content/info.md';
        }
    }

    public function onMetaParsed(array &$meta)
    {
        if ($this->requestModule === 'info') {
            if (isset($_POST['auth_token']) && isset($_POST['auth_client_salt'])) {
                $meta['admin_auth_token'] = $this->generateAuthToken((string) $_POST['auth_token']);
                $meta['admin_auth_client_salt'] = (string) $_POST['auth_client_salt'];
            } else {
                $meta['admin_auth_token'] = '';
                $meta['admin_auth_client_salt'] = $this->generateAuthClientSalt();
            }
        }
    }

    public function onPageRendering(Twig_Environment &$twig, array &$twigVariables, &$templateName)
    {
        if (($this->requestModule === 'info') || ($this->requestModule === 'login')) {
            // reset "404 Not Found" header
            // TODO (Pico 2.0): skip the appropriate events instead
            header($_SERVER['SERVER_PROTOCOL'] . ' 200 OK');

            // use plugin-specific templates
            // Note: you may replace all plugin templates by adding
            // a equally named template to your custom theme
            $twig->getLoader()->addPath(__DIR__ . '/theme');
            $templateName = 'admin-' . $this->requestModule . '.twig';

            if (($this->requestModule === 'login') && isset($_POST['password'])) {
                $twigVariables['admin_auth_plaintext'] = true;
            }
        }

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

    protected function generateAuthClientSalt()
    {
        $bcrypt = password_hash('PicoAdmin', PASSWORD_BCRYPT, array('cost' => 4));
        if (!$bcrypt) {
            throw new RuntimeException('Unable to generate client salt');
        }

        // we don't care about the actual hash, just the randomly generated salt
        return substr($bcrypt, 7, 22);
    }
}