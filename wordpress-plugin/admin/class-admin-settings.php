<?php
/**
 * Página de configuração do plugin no admin.
 *
 * @package AciegRbbVerificador
 */

defined( 'ABSPATH' ) || exit;

/**
 * Settings API para configurar RPC URL e endereços de contratos.
 */
class Acieg_Rbb_Admin_Settings {

	/**
	 * @var self|null
	 */
	private static $instance = null;

	/**
	 * Instância única.
	 *
	 * @return self
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Hooks.
	 */
	private function __construct() {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
	}

	/**
	 * Adiciona item de menu em "Configurações".
	 */
	public function menu() {
		add_options_page(
			__( 'ACIEG RBB Verificador', 'acieg-rbb-verificador' ),
			__( 'ACIEG RBB', 'acieg-rbb-verificador' ),
			'manage_options',
			'acieg-rbb-verificador',
			array( $this, 'render_page' )
		);
	}

	/**
	 * Registra settings e campos.
	 */
	public function register_settings() {
		register_setting(
			'acieg_rbb_settings_group',
			Acieg_Rbb_Plugin::OPTION_KEY,
			array( $this, 'sanitize' )
		);
	}

	/**
	 * Sanitização.
	 *
	 * @param array $input Entrada.
	 * @return array
	 */
	public function sanitize( $input ) {
		$clean = array();
		$clean['rpc_url']       = isset( $input['rpc_url'] ) ? esc_url_raw( $input['rpc_url'] ) : '';
		$clean['chain_id']      = isset( $input['chain_id'] ) ? absint( $input['chain_id'] ) : 0;
		$clean['explorer_base'] = isset( $input['explorer_base'] ) ? esc_url_raw( $input['explorer_base'] ) : '';
		foreach ( array(
			'address_selo',
			'address_certificado',
			'address_registro_produtores',
			'address_rastreabilidade',
			'address_certificados_conformidade',
		) as $addr_key ) {
			$value            = isset( $input[ $addr_key ] ) ? trim( $input[ $addr_key ] ) : '';
			$clean[ $addr_key ] = self::sanitize_address( $value );
		}
		return $clean;
	}

	/**
	 * Valida endereço 0x...
	 *
	 * @param string $addr Endereço.
	 * @return string
	 */
	public static function sanitize_address( $addr ) {
		$addr = strtolower( trim( $addr ) );
		if ( '' === $addr ) {
			return '';
		}
		if ( preg_match( '/^0x[a-f0-9]{40}$/', $addr ) ) {
			return $addr;
		}
		return '';
	}

	/**
	 * Renderiza a página.
	 */
	public function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		include ACIEG_RBB_PLUGIN_DIR . 'admin/views/settings-page.php';
	}
}
