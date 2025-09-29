.PHONY: help test test-unit test-functional test-js fix fix-php fix-rector fix-js check check-php check-rector check-phpstan clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  %-20s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

test: test-unit test-functional test-js ## Run all tests

test-unit: ## Run PHPUnit unit tests
	@echo "Running unit tests..."
	@../../vendor/bin/phpunit -c Tests/Build/UnitTests.xml

test-functional: ## Run PHPUnit functional tests
	@echo "Running functional tests..."
	@../../vendor/bin/phpunit -c Tests/Build/FunctionalTests.xml

test-js: ## Run JavaScript tests
	@echo "Running JavaScript tests..."
	@yarn test

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	@../../vendor/bin/phpunit -c Tests/Build/UnitTests.xml --coverage-html Tests/Coverage/Unit
	@../../vendor/bin/phpunit -c Tests/Build/FunctionalTests.xml --coverage-html Tests/Coverage/Functional
	@yarn test:coverage

fix: fix-php fix-rector ## Run all fixers

fix-php: ## Fix PHP code style
	@echo "Fixing PHP code style..."
	@../../vendor/bin/php-cs-fixer fix

fix-rector: ## Apply Rector fixes
	@echo "Applying Rector fixes..."
	@../../vendor/bin/rector process

fix-js: ## Fix JavaScript code style
	@echo "Fixing JavaScript code style..."
	@yarn lint:fix

check: check-php check-rector check-phpstan ## Run all checks

check-php: ## Check PHP code style
	@echo "Checking PHP code style..."
	@../../vendor/bin/php-cs-fixer fix --dry-run --diff

check-rector: ## Check Rector rules
	@echo "Checking Rector rules..."
	@../../vendor/bin/rector process --dry-run

check-phpstan: ## Run PHPStan analysis
	@echo "Running PHPStan analysis..."
	@../../vendor/bin/phpstan analyse -c phpstan.neon

check-js: ## Check JavaScript code style
	@echo "Checking JavaScript code style..."
	@yarn lint

install: ## Install all dependencies
	@echo "Installing PHP dependencies..."
	@composer install
	@echo "Installing JavaScript dependencies..."
	@yarn install

update: ## Update all dependencies
	@echo "Updating PHP dependencies..."
	@composer update
	@echo "Updating JavaScript dependencies..."
	@yarn upgrade

clean: ## Clean generated files
	@echo "Cleaning generated files..."
	@rm -rf Tests/Coverage
	@rm -rf .phpunit.cache
	@rm -rf .php-cs-fixer.cache
	@rm -rf node_modules
	@rm -rf composer.lock
	@rm -rf yarn.lock

ci: check test ## Run CI pipeline locally
	@echo "CI pipeline completed successfully!"

ddev-test: ## Run tests in DDEV environment
	@echo "Running tests in DDEV..."
	@cd ../.. && ddev exec -d packages/pixelcoda_search make test

ddev-fix: ## Run fixers in DDEV environment
	@echo "Running fixers in DDEV..."
	@cd ../.. && ddev exec -d packages/pixelcoda_search make fix

ddev-check: ## Run checks in DDEV environment
	@echo "Running checks in DDEV..."
	@cd ../.. && ddev exec -d packages/pixelcoda_search make check
