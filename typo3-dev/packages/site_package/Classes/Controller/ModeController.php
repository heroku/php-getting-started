<?php
declare(strict_types=1);

namespace Pixelcoda\SitePackage\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Backend\Template\ModuleTemplateFactory;
use TYPO3\CMS\Core\Configuration\SiteConfiguration;
use TYPO3\CMS\Core\Messaging\FlashMessage;
use TYPO3\CMS\Core\Messaging\FlashMessageService;
use TYPO3\CMS\Core\Type\ContextualFeedbackSeverity;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Extbase\Mvc\Controller\ActionController;

/**
 * Controller for switching between Headless and Standard rendering modes
 */
class ModeController extends ActionController
{
    protected ModuleTemplateFactory $moduleTemplateFactory;
    protected SiteConfiguration $siteConfiguration;

    public function __construct(
        ModuleTemplateFactory $moduleTemplateFactory,
        SiteConfiguration $siteConfiguration
    ) {
        $this->moduleTemplateFactory = $moduleTemplateFactory;
        $this->siteConfiguration = $siteConfiguration;
    }

    /**
     * Display current mode and switch interface
     */
    public function indexAction(): ResponseInterface
    {
        $siteIdentifier = 'main'; // or get from request
        $site = $this->siteConfiguration->load($siteIdentifier);
        
        $currentMode = $site['customConfiguration']['renderingMode'] ?? 'standard';
        
        $this->view->assignMultiple([
            'currentMode' => $currentMode,
            'modes' => [
                'headless' => [
                    'label' => 'Headless Mode',
                    'description' => 'JSON output for React, Vue, Next.js frontends',
                    'icon' => 'actions-code',
                    'active' => $currentMode === 'headless'
                ],
                'standard' => [
                    'label' => 'Standard Mode',
                    'description' => 'Traditional TYPO3 with Fluid templates',
                    'icon' => 'actions-template',
                    'active' => $currentMode === 'standard'
                ]
            ]
        ]);
        
        $moduleTemplate = $this->moduleTemplateFactory->create($this->request);
        $moduleTemplate->setContent($this->view->render());
        
        return $this->htmlResponse($moduleTemplate->renderContent());
    }

    /**
     * Switch rendering mode
     */
    public function switchAction(string $mode): ResponseInterface
    {
        $allowedModes = ['headless', 'standard'];
        
        if (!in_array($mode, $allowedModes, true)) {
            $this->addFlashMessage(
                'Invalid mode selected',
                'Error',
                ContextualFeedbackSeverity::ERROR
            );
            return $this->redirect('index');
        }
        
        $siteIdentifier = 'main';
        $site = $this->siteConfiguration->load($siteIdentifier);
        
        // Update the mode
        $site['customConfiguration']['renderingMode'] = $mode;
        
        // Save the configuration
        $this->siteConfiguration->write($siteIdentifier, $site);
        
        // Clear caches
        $cacheManager = GeneralUtility::makeInstance(\TYPO3\CMS\Core\Cache\CacheManager::class);
        $cacheManager->flushCaches();
        
        $this->addFlashMessage(
            sprintf('Successfully switched to %s mode', ucfirst($mode)),
            'Success',
            ContextualFeedbackSeverity::OK
        );
        
        return $this->redirect('index');
    }
}
