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

    public function onAdminRequest(PicoAdmin $admin, &$module, &$action, &$payload)
    {
        $this->admin = $admin;

        if ($module === 'content') {
            switch ($action) {
                case 'show':
                    // TODO: $payload obviously needs to be validated...
                    $this->action = $action;
                    $this->page = $payload;
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

    public function onRequestFile(&$file)
    {
        $file = $this->getConfig('content_dir') . $this->page . $this->getConfig('content_ext');
    }

    public function onPageRendering(Twig_Environment &$twig, array &$twigVariables, &$templateName)
    {
        $twig->getLoader()->addPath(__DIR__ . '/theme');
        $templateName = 'admin-content.twig';
    }
}
