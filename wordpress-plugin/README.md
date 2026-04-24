# ACIEG RBB Verificador — Plugin WordPress

Plugin oficial que integra o site `acieg.com.br` à Rede Blockchain Brasil (RBB), permitindo que visitantes verifiquem on-chain, em tempo real:

1. **Selos Digitais de Associado** — confirma vínculo ativo por CNPJ/CPF ou endereço
2. **Certificados de Capacitação** — verifica autenticidade de PDF por hash SHA-256
3. **Rastreabilidade "Feito em Goiás"** — exibe cadeia de custódia completa de um lote

## Arquitetura

```
┌──────────────────────────────────────────┐
│  WordPress (acieg.com.br)                │
│  ┌────────────────────────────────────┐  │
│  │ [verificar_selo_acieg cnpj="..."]  │  │
│  │ → markup HTML renderizado pelo PHP │  │
│  └──────────────┬─────────────────────┘  │
│                 │                        │
│                 ▼                        │
│  ┌────────────────────────────────────┐  │
│  │ verificador.js (ethers.js v6)      │  │
│  │ → chama view functions via RPC     │  │
│  └──────────────┬─────────────────────┘  │
└─────────────────┼────────────────────────┘
                  ▼
            ┌──────────────────┐
            │ Nó Observer RBB  │
            │ (JSON-RPC HTTP)  │
            └────────┬─────────┘
                     ▼
           ┌────────────────────┐
           │ Smart Contracts    │
           │ (Besu / RBB)       │
           └────────────────────┘
```

**Segurança**: o plugin é 100% read-only. Nenhuma chave privada é armazenada ou usada. Emissão, revogação e registros on-chain são feitos por scripts offline operados pela equipe técnica da ACIEG.

## Shortcodes

### `[verificar_selo_acieg]`

Atributos opcionais:
- `cnpj="05.613.301/0001-92"` — pré-preenche e consulta automaticamente
- `endereco="0x..."` — pré-preenche com endereço Ethereum
- `mostrar="completo"` ou `"resumido"`

### `[verificar_certificado]`

Atributos opcionais:
- `hash="0x..."` — pré-preenche o hash SHA-256
- `token_id="123"` — consulta direta por tokenId

Por padrão oferece duas abas: upload de PDF (cálculo do SHA-256 no browser via `crypto.subtle.digest`) ou colagem direta do hash.

### `[rastrear_lote]`

Atributos opcionais:
- `id="1"` — tokenId do lote
- `codigo="RIV-2026-S-0042"` — código interno (futuro: resolver via indexer)

Renderiza timeline cronológica da cadeia de custódia, com GPS e hashes de documentos, e lista de certificados de conformidade (EUDR, ESG, etc.) do lote.

## Configuração

Após ativar o plugin, acesse **Configurações → ACIEG RBB** e preencha:

| Campo | Exemplo | Descrição |
|---|---|---|
| RPC URL | `http://127.0.0.1:8545` ou URL de nó observer da RBB | Endpoint JSON-RPC |
| Chain ID | `121200149999` (local) ou `12120014` (RBB produção) | Valida compatibilidade |
| Block explorer | `https://blockscout.rbb.bndes.gov.br` | Opcional — linka endereços |
| Endereços dos 5 contratos | `0x...` | Obtidos após deploy |

## Instalação

### Via ZIP (recomendado)

```bash
cd wordpress-plugin
zip -r acieg-rbb-verificador.zip . -x "*.md" "README.md"
# Upload no Painel WordPress → Plugins → Adicionar Novo → Enviar Plugin
```

### Via symlink (desenvolvimento)

```bash
ln -s "$(pwd)/wordpress-plugin" /caminho/do/wordpress/wp-content/plugins/acieg-rbb-verificador
```

## Desenvolvimento local

Ambiente recomendado: `@wordpress/env` (wp-env) ou [Local by Flywheel](https://localwp.com/).

```bash
# Pré-requisito: Docker + npm
npm install -g @wordpress/env

cd wordpress-plugin
cat > .wp-env.json << EOF
{
  "plugins": ["."]
}
EOF

wp-env start
# WordPress disponível em http://localhost:8888 (admin/password)
```

Em paralelo, suba a rede Besu local (`../rede-local/scripts/start.sh`) e faça deploy dos contratos (`../contratos`), depois preencha os endereços no painel de configuração.

## Qualidade

- Segue convenções WordPress PHP: prefixo `Acieg_Rbb_`, escape de saída, sanitização de input
- JavaScript em vanilla (sem jQuery); ethers.js v6 via CDN
- `crypto.subtle.digest` usado para SHA-256 de PDFs client-side (sem enviar arquivo ao servidor)
- Assets só carregados em páginas que contêm os shortcodes (`has_shortcode()` check)
- i18n via `__()` e `load_plugin_textdomain`
- CSS scoped com prefixo `.acieg-rbb-`

## Roadmap

- [ ] Gutenberg blocks nativos (atualmente só shortcodes)
- [ ] Cache de respostas RPC via transients (reduzir chamadas repetidas)
- [ ] Integração direta com MetaMask para associados confirmarem posse do endereço
- [ ] Widget de "contador": "X associados verificados on-chain"
- [ ] Submissão ao diretório WordPress.org

## Licença

[Apache License 2.0](LICENSE)
