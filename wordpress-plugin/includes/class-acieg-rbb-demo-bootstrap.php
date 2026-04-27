<?php
/**
 * Cria a página de demonstração com os 3 shortcodes e define como home.
 * Carregado APENAS quando a constante ACIEG_RBB_DEMO_MODE está definida
 * (setada pelo blueprint do @wp-now — nunca existe em produção).
 *
 * @package AciegRbbVerificador
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ACIEG_RBB_DEMO_MODE' ) || ! ACIEG_RBB_DEMO_MODE ) {
	return;
}

add_action(
	'init',
	function () {
		// Força configuração do plugin com RPC local + endereços determinísticos
		// (setSiteOptions do Playground não serializa arrays aninhados corretamente
		// no SQLite — por isso escrevemos aqui, em PHP com WP já bootstrapped).
		$demo_settings = array(
			'rpc_url'                           => 'http://127.0.0.1:8545',
			'chain_id'                          => '121200149999',
			'explorer_base'                     => '',
			'address_selo'                      => '0x5FbDB2315678afecb367f032d93F642f64180aa3',
			'address_certificado'               => '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
			'address_registro_produtores'       => '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
			'address_rastreabilidade'           => '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
			'address_certificados_conformidade' => '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
		);
		$atual = get_option( Acieg_Rbb_Plugin::OPTION_KEY, array() );
		if ( ! is_array( $atual ) || empty( $atual['address_selo'] ) ) {
			update_option( Acieg_Rbb_Plugin::OPTION_KEY, $demo_settings );
		}

		$existente = get_page_by_path( 'demo-rbb' );
		if ( $existente ) {
			$post_id = $existente->ID;
		} else {
			$conteudo  = "<h2>Selo Digital de Associado</h2>\n";
			$conteudo .= "<p>Verifique se uma empresa é associada da ACIEG pelo CNPJ ou endereço.</p>\n";
			$conteudo .= "[verificar_selo_acieg]\n\n";
			$conteudo .= "<h2>Certificado de Capacitação</h2>\n";
			$conteudo .= "<p>Consulte a autenticidade de um certificado emitido pela ACIEG.</p>\n";
			$conteudo .= "[verificar_certificado]\n\n";
			$conteudo .= "<h2>Rastreabilidade Feito em Goiás</h2>\n";
			$conteudo .= "<p>Trilha completa da origem (semente RENASEM) à entrega final no comprador europeu (DDS EUDR), com CFO/PTV, monitoramento satelital MapBiomas e árvore parent-child entre lotes.</p>\n";
			$conteudo .= "[rastrear_lote id=\"2\"]\n";

			$post_id = wp_insert_post(
				array(
					'post_title'   => 'Demo RBB · Verificador ACIEG',
					'post_content' => $conteudo,
					'post_status'  => 'publish',
					'post_type'    => 'page',
					'post_name'    => 'demo-rbb',
				)
			);
		}

		// Garante que a home sempre aponta pra esta página — mesmo em sessões
		// seguintes onde o ID da página pode ser diferente do valor do blueprint.
		if ( $post_id && ! is_wp_error( $post_id ) ) {
			if ( (int) get_option( 'page_on_front' ) !== (int) $post_id ) {
				update_option( 'show_on_front', 'page' );
				update_option( 'page_on_front', (int) $post_id );
			}
		}
	}
);
