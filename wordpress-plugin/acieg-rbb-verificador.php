<?php
/**
 * Plugin Name: ACIEG RBB Verificador
 * Plugin URI: https://github.com/ACIEG/rbb-aplicacoes
 * Description: Shortcodes e blocos Gutenberg para verificar on-chain (Rede Blockchain Brasil) selos de associados ACIEG, certificados de capacitação e rastreabilidade "Feito em Goiás".
 * Version: 0.1.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: ACIEG - Associação Comercial, Industrial e de Serviços do Estado de Goiás
 * Author URI: https://acieg.com.br
 * License: Apache-2.0
 * License URI: https://www.apache.org/licenses/LICENSE-2.0.txt
 * Text Domain: acieg-rbb-verificador
 * Domain Path: /languages
 *
 * @package AciegRbbVerificador
 */

defined( 'ABSPATH' ) || exit;

define( 'ACIEG_RBB_VERSION', '0.1.0' );
define( 'ACIEG_RBB_PLUGIN_FILE', __FILE__ );
define( 'ACIEG_RBB_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'ACIEG_RBB_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once ACIEG_RBB_PLUGIN_DIR . 'includes/class-acieg-rbb-plugin.php';
require_once ACIEG_RBB_PLUGIN_DIR . 'includes/shortcodes/class-selo-shortcode.php';
require_once ACIEG_RBB_PLUGIN_DIR . 'includes/shortcodes/class-certificado-shortcode.php';
require_once ACIEG_RBB_PLUGIN_DIR . 'includes/shortcodes/class-rastreabilidade-shortcode.php';
require_once ACIEG_RBB_PLUGIN_DIR . 'admin/class-admin-settings.php';

add_action( 'plugins_loaded', array( 'Acieg_Rbb_Plugin', 'instance' ) );
