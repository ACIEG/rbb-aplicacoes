<?php
/**
 * Classe principal do plugin.
 *
 * @package AciegRbbVerificador
 */

defined( 'ABSPATH' ) || exit;

/**
 * Bootstrap do plugin: registra shortcodes, enqueues assets, configura admin.
 */
class Acieg_Rbb_Plugin {

	const OPTION_KEY = 'acieg_rbb_settings';

	/**
	 * Singleton.
	 *
	 * @var self|null
	 */
	private static $instance = null;

	/**
	 * Recupera instância única.
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
	 * Construtor.
	 */
	private function __construct() {
		load_plugin_textdomain(
			'acieg-rbb-verificador',
			false,
			dirname( plugin_basename( ACIEG_RBB_PLUGIN_FILE ) ) . '/languages/'
		);

		add_action( 'init', array( $this, 'register_shortcodes' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );

		if ( is_admin() ) {
			Acieg_Rbb_Admin_Settings::instance();
		}
	}

	/**
	 * Registra os três shortcodes do plugin.
	 */
	public function register_shortcodes() {
		Acieg_Rbb_Selo_Shortcode::register();
		Acieg_Rbb_Certificado_Shortcode::register();
		Acieg_Rbb_Rastreabilidade_Shortcode::register();
	}

	/**
	 * Enqueue de CSS e JS no frontend.
	 */
	public function enqueue_assets() {
		if ( ! self::page_has_shortcode() ) {
			return;
		}

		wp_enqueue_style(
			'acieg-rbb-public',
			ACIEG_RBB_PLUGIN_URL . 'assets/css/public.css',
			array(),
			ACIEG_RBB_VERSION
		);

		wp_enqueue_script(
			'ethers',
			'https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.umd.min.js',
			array(),
			'6.13.4',
			true
		);

		wp_enqueue_script(
			'acieg-rbb-verificador',
			ACIEG_RBB_PLUGIN_URL . 'assets/js/verificador.js',
			array( 'ethers' ),
			ACIEG_RBB_VERSION,
			true
		);

		wp_localize_script(
			'acieg-rbb-verificador',
			'aciegRbbConfig',
			self::frontend_config()
		);
	}

	/**
	 * Verifica se a página/post atual contém algum dos shortcodes do plugin.
	 *
	 * @return bool
	 */
	public static function page_has_shortcode() {
		global $post;
		if ( ! $post instanceof WP_Post ) {
			return false;
		}
		$shortcodes = array( 'verificar_selo_acieg', 'verificar_certificado', 'rastrear_lote' );
		foreach ( $shortcodes as $sc ) {
			if ( has_shortcode( $post->post_content, $sc ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Configurações a serem expostas ao JS do frontend.
	 *
	 * @return array
	 */
	public static function frontend_config() {
		$settings = self::get_settings();
		return array(
			'rpcUrl'       => esc_url_raw( $settings['rpc_url'] ),
			'chainId'      => (int) $settings['chain_id'],
			'contracts'    => array(
				'selo'              => $settings['address_selo'],
				'certificado'       => $settings['address_certificado'],
				'registroProdutor'  => $settings['address_registro_produtores'],
				'rastreabilidade'   => $settings['address_rastreabilidade'],
				'certificadosConf'  => $settings['address_certificados_conformidade'],
			),
			'explorerBase' => esc_url_raw( $settings['explorer_base'] ),
			'i18n'         => array(
				'loading'        => __( 'Consultando a blockchain...', 'acieg-rbb-verificador' ),
				'notFound'       => __( 'Registro não encontrado.', 'acieg-rbb-verificador' ),
				'active'         => __( 'ATIVO', 'acieg-rbb-verificador' ),
				'revoked'        => __( 'REVOGADO', 'acieg-rbb-verificador' ),
				'expired'        => __( 'EXPIRADO', 'acieg-rbb-verificador' ),
				'valid'          => __( 'VÁLIDO', 'acieg-rbb-verificador' ),
				'invalid'        => __( 'INVÁLIDO', 'acieg-rbb-verificador' ),
				'consultError'   => __( 'Erro ao consultar a RBB. Tente novamente.', 'acieg-rbb-verificador' ),
				'verify'         => __( 'Verificar', 'acieg-rbb-verificador' ),
				'seloTitle'      => __( 'Selo Digital de Associado ACIEG', 'acieg-rbb-verificador' ),
				'certTitle'      => __( 'Certificado de Capacitação ACIEG', 'acieg-rbb-verificador' ),
				'rastreioTitle'  => __( 'Rastreabilidade "Feito em Goiás"', 'acieg-rbb-verificador' ),
				'razaoSocial'    => __( 'Razão social', 'acieg-rbb-verificador' ),
				'setor'          => __( 'Setor', 'acieg-rbb-verificador' ),
				'validoAte'      => __( 'Válido até', 'acieg-rbb-verificador' ),
				'emitidoEm'      => __( 'Emitido em', 'acieg-rbb-verificador' ),
				'curso'          => __( 'Curso', 'acieg-rbb-verificador' ),
				'aluno'          => __( 'Aluno', 'acieg-rbb-verificador' ),
				'cargaHoraria'   => __( 'Carga horária', 'acieg-rbb-verificador' ),
				'dataConclusao'  => __( 'Data de conclusão', 'acieg-rbb-verificador' ),
				'hashPdf'        => __( 'Hash SHA-256 do PDF', 'acieg-rbb-verificador' ),
				'verNaBlockchain' => __( 'Ver no block explorer', 'acieg-rbb-verificador' ),
				'cadeiaCustodia' => __( 'Cadeia de custódia', 'acieg-rbb-verificador' ),
				'certificados'   => __( 'Certificados de conformidade', 'acieg-rbb-verificador' ),
				'produtor'       => __( 'Produtor', 'acieg-rbb-verificador' ),
				'quantidade'     => __( 'Quantidade (kg)', 'acieg-rbb-verificador' ),
				'codigoLote'     => __( 'Código do lote', 'acieg-rbb-verificador' ),
			),
		);
	}

	/**
	 * Configurações do plugin (com defaults).
	 *
	 * @return array
	 */
	public static function get_settings() {
		$defaults = array(
			'rpc_url'                            => 'http://127.0.0.1:8545',
			'chain_id'                           => 121200149999,
			'address_selo'                       => '',
			'address_certificado'                => '',
			'address_registro_produtores'        => '',
			'address_rastreabilidade'            => '',
			'address_certificados_conformidade'  => '',
			'explorer_base'                      => '',
		);
		$saved = get_option( self::OPTION_KEY, array() );
		return array_merge( $defaults, is_array( $saved ) ? $saved : array() );
	}
}
