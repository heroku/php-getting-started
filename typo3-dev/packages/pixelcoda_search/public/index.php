<?php

declare(strict_types=1);

use TYPO3\CMS\Core\Core\Bootstrap;
use TYPO3\CMS\Core\Core\SystemEnvironmentBuilder;
use TYPO3\CMS\Frontend\Http\Application;

/*
 * This file is part of the TYPO3 CMS project.
 *
 * It is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License, either version 2
 * of the License, or any later version.
 *
 * For the full copyright and license information, please read the
 * LICENSE.txt file that was distributed with this source code.
 *
 * The TYPO3 project - inspiring people to share!
 */

// Set up the application for the frontend
call_user_func(static function (): void {
    $classLoader = require dirname(__DIR__, 3) . '/vendor/autoload.php';
    SystemEnvironmentBuilder::run(0, SystemEnvironmentBuilder::REQUESTTYPE_FE);
    Bootstrap::init($classLoader)->get(Application::class)->run();
});
