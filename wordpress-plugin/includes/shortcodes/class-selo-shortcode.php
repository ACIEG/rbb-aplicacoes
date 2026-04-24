<?php
/**
 * Shortcode [verificar_selo_acieg].
 *
 * @package AciegRbbVerificador
 */

defined( 'ABSPATH' ) || exit;

/**
 * Renderiza o widget de verificação de selo digital por CNPJ/CPF ou endereço.
 */
class Acieg_Rbb_Selo_Shortcode {

	/**
	 * Registra o shortcode.
	 */
	public static function register() {
		add_shortcode( 'verificar_selo_acieg', array( __CLASS__, 'render' ) );
	}

	/**
	 * Renderiza o markup base (a lógica fica no JS).
	 *
	 * @param array|string $atts Atributos.
	 * @return string
	 */
	public static function render( $atts ) {
		$atts = shortcode_atts(
			array(
				'cnpj'     => '',
				'endereco' => '',
				'mostrar'  => 'completo',
			),
			is_array( $atts ) ? $atts : array(),
			'verificar_selo_acieg'
		);

		$id = 'acieg-selo-' . wp_generate_uuid4();

		ob_start();
		?>
		<div
			class="acieg-rbb-widget acieg-rbb-selo"
			id="<?php echo esc_attr( $id ); ?>"
			data-widget="selo"
			data-cnpj="<?php echo esc_attr( $atts['cnpj'] ); ?>"
			data-endereco="<?php echo esc_attr( $atts['endereco'] ); ?>"
			data-mostrar="<?php echo esc_attr( $atts['mostrar'] ); ?>"
		>
			<form class="acieg-rbb-form" onsubmit="return false;">
				<label for="<?php echo esc_attr( $id ); ?>-input">
					<?php esc_html_e( 'CNPJ/CPF ou endereço 0x...', 'acieg-rbb-verificador' ); ?>
				</label>
				<input
					type="text"
					id="<?php echo esc_attr( $id ); ?>-input"
					class="acieg-rbb-input"
					placeholder="05.613.301/0001-92"
					value="<?php echo esc_attr( $atts['cnpj'] ?: $atts['endereco'] ); ?>"
				/>
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
