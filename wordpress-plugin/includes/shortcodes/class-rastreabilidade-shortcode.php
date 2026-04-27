<?php
/**
 * Shortcode [rastrear_lote].
 *
 * @package AciegRbbVerificador
 */

defined( 'ABSPATH' ) || exit;

/**
 * Renderiza a timeline completa da cadeia de custódia de um lote rastreável.
 */
class Acieg_Rbb_Rastreabilidade_Shortcode {

	/**
	 * Registra o shortcode.
	 */
	public static function register() {
		add_shortcode( 'rastrear_lote', array( __CLASS__, 'render' ) );
	}

	/**
	 * Renderiza o markup base.
	 *
	 * @param array|string $atts Atributos.
	 * @return string
	 */
	public static function render( $atts ) {
		$atts = shortcode_atts(
			array(
				'id'     => '',
				'codigo' => '',
			),
			is_array( $atts ) ? $atts : array(),
			'rastrear_lote'
		);

		$id = 'acieg-rastreio-' . wp_generate_uuid4();

		ob_start();
		?>
		<div
			class="acieg-rbb-widget acieg-rbb-rastreabilidade"
			id="<?php echo esc_attr( $id ); ?>"
			data-widget="rastreabilidade"
			data-lote-id="<?php echo esc_attr( $atts['id'] ); ?>"
			data-codigo="<?php echo esc_attr( $atts['codigo'] ); ?>"
		>
			<form class="acieg-rbb-form" onsubmit="return false;">
				<label for="<?php echo esc_attr( $id ); ?>-input">
					<?php esc_html_e( 'ID do lote (NFT) — ex: 2 — para ver a trilha completa da origem à entrega final:', 'acieg-rbb-verificador' ); ?>
				</label>
				<input
					type="text"
					id="<?php echo esc_attr( $id ); ?>-input"
					class="acieg-rbb-input"
					placeholder="1"
					value="<?php echo esc_attr( $atts['id'] ); ?>"
				/>
				<button type="submit" class="acieg-rbb-btn">
					<?php esc_html_e( 'Rastrear', 'acieg-rbb-verificador' ); ?>
				</button>
			</form>
			<div class="acieg-rbb-result" role="status" aria-live="polite"></div>
		</div>
		<?php
		return ob_get_clean();
	}
}
