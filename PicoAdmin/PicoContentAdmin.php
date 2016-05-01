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

    protected $previewContent;

    /**
     * Bootstrap the plugin's default configuration
     *
     * @see DummyPlugin::onConfigLoaded()
     */
    public function onConfigLoaded(array &$config)
    {
        $defaultPluginConfig = array(
            'SimpleMDE' => array(
                'autofocus' => true,
                'indentWithTabs' => true,
                'tabSize' => 4
            )
        );

        if (!isset($config['PicoAdmin']['PicoContentAdmin']) || !is_array($config['PicoAdmin']['PicoContentAdmin'])) {
            $config['PicoAdmin']['PicoContentAdmin'] = $defaultPluginConfig;
            return;
        }

        $pluginConfig = &$config['PicoAdmin']['PicoContentAdmin'];

        if (isset($pluginConfig['SimpleMDE']) && is_array($pluginConfig['SimpleMDE'])) {
            $pluginConfig['SimpleMDE'] += $defaultPluginConfig['SimpleMDE'];
        }

        $pluginConfig += $defaultPluginConfig;
    }

    public function onAdminRequest(PicoAdmin $admin, &$module, &$action, &$payload)
    {
        $this->admin = $admin;
        $this->action = !empty($action) ? $action : 'edit';
        $this->page = !empty($payload) ? $payload : 'index';

        if ($module === 'content') {
            switch ($action) {
                default:
                    $action = $this->action;
                    break;

                case 'preview':
                    $this->previewContent = isset($_POST['markdown']) ? (string) $_POST['markdown'] : '';
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
            case 'preview':
                $file = $this->getConfig('content_dir') . $this->page . $this->getConfig('content_ext');
                break;
        }
    }

    public function onContentLoaded(&$rawContent)
    {
        switch ($this->action) {
            case 'preview':
                $rawContent = $this->previewContent;
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
                break;

            case 'preview':
                $templateName = 'admin-content-preview.twig';
                break;
        }
    }
}
