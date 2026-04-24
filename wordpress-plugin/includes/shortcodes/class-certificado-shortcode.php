<?php
/**
 * Shortcode [verificar_certificado].
 *
 * @package AciegRbbVerificador
 */

defined( 'ABSPATH' ) || exit;

/**
 * Verificação de certificado de capacitação por hash SHA-256 do PDF, tokenId ou upload de arquivo.
 */
class Acieg_Rbb_Certificado_Shortcode {

	/**
	 * Registra o shortcode.
	 */
	public static function register() {
		add_shortcode( 'verificar_certificado', array( __CLASS__, 'render' ) );
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
				'hash'     => '',
				'token_id' => '',
			),
			is_array( $atts ) ? $atts : array(),
			'verificar_certificado'
		);

		$id = 'acieg-cert-' . wp_generate_uuid4();

		ob_start();
		?>
		<div
			class="acieg-rbb-widget acieg-rbb-certificado"
			id="<?php echo esc_attr( $id ); ?>"
			data-widget="certificado"
			data-hash="<?php echo esc_attr( $atts['hash'] ); ?>"
			data-token-id="<?php echo esc_attr( $atts['token_id'] ); ?>"
		>
			<div class="acieg-rbb-tabs">
				<button type="button" class="acieg-rbb-tab acieg-rbb-tab-active" data-tab="pdf">
					<?php esc_html_e( 'PDF do certificado', 'acieg-rbb-verificador' ); ?>
				</button>
				<button type="button" class="acieg-rbb-tab" data-tab="hash">
					<?php esc_html_e( 'Hash SHA-256', 'acieg-rbb-verificador' ); ?>
				</button>
			</div>
			<form class="acieg-rbb-form" onsubmit="return false;">
				<div class="acieg-rbb-pane acieg-rbb-pane-pdf" data-pane="pdf">
					<label for="<?php echo esc_attr( $id ); ?>-file">
						<?php esc_html_e( 'Anexe o PDF do certificado que deseja verificar:', 'acieg-rbb-verificador' ); ?>
					</label>
					<input type="file" id="<?php echo esc_attr( $id ); ?>-file" accept="application/pdf" class="acieg-rbb-file" />
				</div>
				<div class="acieg-rbb-pane acieg-rbb-pane-hash" data-pane="hash" hidden>
					<label for="<?php echo esc_attr( $id ); ?>-hash">
						<?php esc_html_e( 'Hash SHA-256 (64 caracteres hex, com ou sem 0x):', 'acieg-rbb-verificador' ); ?>
					</label>
					<input
						type="text"
						id="<?php echo esc_attr( $id ); ?>-hash"
						class="acieg-rbb-input"
						placeholder="0x3a4b..."
						value="<?php echo esc_attr( $atts['hash'] ); ?>"
					/>
				</div>
				<button type="submit" class="acieg-rbb-btn">
					<?php esc_html_e( 'Verificar', 'acieg-rbb-verificador' ); ?>
				</button>
			</form>
			<div class="acieg-rbb-result" role="status" aria-live="polite"></div>
		</div>
		<?php
		return ob_get_clean();
	}
}
