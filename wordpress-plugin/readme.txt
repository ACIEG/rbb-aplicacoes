=== ACIEG RBB Verificador ===
Contributors: acieg
Tags: blockchain, rbb, acieg, verificação, soulbound, goiás, rastreabilidade
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 0.1.0
License: Apache-2.0
License URI: https://www.apache.org/licenses/LICENSE-2.0.txt

Shortcodes e Gutenberg blocks para verificar on-chain selos de associados ACIEG, certificados de capacitação e rastreabilidade "Feito em Goiás" diretamente no site WordPress.

== Descrição ==

Este plugin foi desenvolvido pela ACIEG (Associação Comercial, Industrial e de Serviços do Estado de Goiás) para permitir que qualquer visitante do site ACIEG consulte diretamente a blockchain pública da Rede Blockchain Brasil (RBB) e confirme:

* Se uma empresa é associada ativa da ACIEG (Selo Digital de Associado)
* Se um certificado de curso da ACIEG é autêntico (hash SHA-256 do PDF on-chain)
* A cadeia completa de custódia de um lote rastreável "Feito em Goiás"

O plugin é **somente leitura** — não mantém chaves privadas e não pode emitir ou alterar registros on-chain.

== Shortcodes ==

* `[verificar_selo_acieg cnpj="..."]` — renderiza campo de consulta por CNPJ/CPF ou endereço
* `[verificar_certificado]` — aceita upload de PDF (calcula SHA-256 no browser) ou hash colado
* `[rastrear_lote id="1"]` — timeline completa da cadeia de custódia

== Instalação ==

1. Upload do ZIP via Painel WordPress → Plugins → Adicionar Novo → Enviar Plugin
2. Ativar
3. Configurações → ACIEG RBB — preencher RPC URL e endereços dos contratos (obtidos após deploy)

== Licença ==

Apache License 2.0. Código-fonte em https://github.com/ACIEG/rbb-aplicacoes
