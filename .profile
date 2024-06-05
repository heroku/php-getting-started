export PATH="$PATH:$(cd "$(dirname "$(realpath "$(which composer)")")"; cd ../../..; realpath "$(PHP_INI_SCAN_DIR= COMPOSER_AUTH= composer config --no-plugins bin-dir)")"
