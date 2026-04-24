<?php
/**
 * View da página de configurações.
 *
 * @package AciegRbbVerificador
 */

defined( 'ABSPATH' ) || exit;

$settings = Acieg_Rbb_Plugin::get_settings();
?>
<div class="wrap">
	<h1><?php esc_html_e( 'ACIEG RBB Verificador', 'acieg-rbb-verificador' ); ?></h1>
	<p>
		<?php
		printf(
			/* translators: %s: project URL */
			esc_html__( 'Configure o nó RPC da Rede Blockchain Brasil (RBB) e os endereços dos contratos. Código-fonte e documentação em %s.', 'acieg-rbb-verificador' ),
			'<a href="https://github.com/ACIEG/rbb-aplicacoes" target="_blank" rel="noopener">github.com/ACIEG/rbb-aplicacoes</a>'
		);
		?>
	</p>

	<form method="post" action="options.php">
		<?php settings_fields( 'acieg_rbb_settings_group' ); ?>

		<h2><?php esc_html_e( 'Conexão com a RBB', 'acieg-rbb-verificador' ); ?></h2>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row">
					<label for="rpc_url"><?php esc_html_e( 'RPC URL', 'acieg-rbb-verificador' ); ?></label>
				</th>
				<td>
					<input
						type="url"
						id="rpc_url"
						name="<?php echo esc_attr( Acieg_Rbb_Plugin::OPTION_KEY ); ?>[rpc_url]"
						value="<?php echo esc_attr( $settings['rpc_url'] ); ?>"
						class="regular-text"
						placeholder="http://127.0.0.1:8545"
					/>
					<p class="description">
						<?php esc_html_e( 'Endpoint JSON-RPC de um nó observer da RBB (ou rede local). Exemplo em produção: http://rbb-observer-boot01.bndes.gov.br:60002', 'acieg-rbb-verificador' ); ?>
					</p>
				</td>
			</tr>
			<tr>
				<th scope="row">
					<label for="chain_id"><?php esc_html_e( 'Chain ID', 'acieg-rbb-verificador' ); ?></label>
				</th>
				<td>
					<input
						type="number"
						id="chain_id"
						name="<?php echo esc_attr( Acieg_Rbb_Plugin::OPTION_KEY ); ?>[chain_id]"
						value="<?php echo esc_attr( $settings['chain_id'] ); ?>"
						class="regular-text"
					/>
					<p class="description">
						<?php esc_html_e( 'RBB produção: 12120014. Rede local deste repositório: 121200149999.', 'acieg-rbb-verificador' ); ?>
					</p>
				</td>
			</tr>
			<tr>
				<th scope="row">
					<label for="explorer_base"><?php esc_html_e( 'Block explorer base URL', 'acieg-rbb-verificador' ); ?></label>
				</th>
				<td>
					<input
						type="url"
						id="explorer_base"
						name="<?php echo esc_attr( Acieg_Rbb_Plugin::OPTION_KEY ); ?>[explorer_base]"
						value="<?php echo esc_attr( $settings['explorer_base'] ); ?>"
						class="regular-text"
						placeholder="https://blockscout.rbb.bndes.gov.br"
					/>
					<p class="description">
						<?php esc_html_e( 'Opcional. Permite linkar transações no Blockscout/Chainlens no frontend.', 'acieg-rbb-verificador' ); ?>
					</p>
				</td>
			</tr>
		</table>

		<h2><?php esc_html_e( 'Endereços dos contratos', 'acieg-rbb-verificador' ); ?></h2>
		<table class="form-table" role="presentation">
			<?php
			$addr_fields = array(
				'address_selo'                      => __( 'Selo Digital de Associado', 'acieg-rbb-verificador' ),
				'address_certificado'               => __( 'Certificado de Capacitação', 'acieg-rbb-verificador' ),
				'address_registro_produtores'       => __( 'Registro de Produtores', 'acieg-rbb-verificador' ),
				'address_rastreabilidade'           => __( 'Rastreabilidade (Lotes)', 'acieg-rbb-verificador' ),
				'address_certificados_conformidade' => __( 'Certificados de Conformidade', 'acieg-rbb-verificador' ),
			);
			foreach ( $addr_fields as $key => $label ) :
				?>
				<tr>
					<th scope="row">
						<label for="<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $label ); ?></label>
					</th>
					<td>
						<input
							type="text"
							id="<?php echo esc_attr( $key ); ?>"
							name="<?php echo esc_attr( Acieg_Rbb_Plugin::OPTION_KEY . '[' . $key . ']' ); ?>"
							value="<?php echo esc_attr( $settings[ $key ] ); ?>"
							class="regular-text code"
							placeholder="0x0000000000000000000000000000000000000000"
							pattern="^0x[a-fA-F0-9]{40}$"
						/>
					</td>
				</tr>
			<?php endforeach; ?>
		</table>

		<?php submit_button(); ?>
	</form>

	<h2><?php esc_html_e( 'Como usar', 'acieg-rbb-verificador' ); ?></h2>
	<p><?php esc_html_e( 'Depois de configurar, insira um dos shortcodes abaixo em qualquer página/post:', 'acieg-rbb-verificador' ); ?></p>
	<ul>
		<li><code>[verificar_selo_acieg cnpj="05.613.301/0001-92"]</code></li>
		<li><code>[verificar_certificado]</code> &mdash; <?php esc_html_e( 'aceita upload de PDF ou hash colado pelo visitante.', 'acieg-rbb-verificador' ); ?></li>
		<li><code>[rastrear_lote id="1"]</code></li>
	</ul>
</div>
