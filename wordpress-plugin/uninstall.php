<?php
/**
 * Uninstall script — remove opções ao desinstalar o plugin.
 *
 * @package AciegRbbVerificador
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'acieg_rbb_settings' );
