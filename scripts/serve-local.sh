#!/usr/bin/env bash
# Sobe toda a stack da demo local a partir de um estado COMPLETAMENTE limpo:
#   0. Wipe de tudo que poderia estar cacheado (wp-now rodando, DB do WP,
#      artefatos locais de deploy). Isso garante reprodutibilidade.
#   1. Besu: reset + start (3 nós QBFT)
#   2. Contratos: deploy determinístico + povoamento do lote #1
#   3. WordPress: @wp-now com blueprint que configura RPC, endereços e cria a home
#
# Uso:
#   ./scripts/serve-local.sh
#
# Depois:
#   http://localhost:8881  → WP com plugin carregado e página demo
#   http://127.0.0.1:8545  → RPC do Besu

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> 0/3  Wipe do estado local (wp-now, DB do WP, deployments locais)"
# Mata qualquer wp-now anterior (se não matar, o novo não consegue abrir :8881).
pkill -f "wp-now" 2>/dev/null || true
# Estado do wp-now (WP + SQLite por projeto).
rm -rf "$HOME/.wp-now" 2>/dev/null || true
# Artefatos locais de deploy (regenerados pela etapa 2; não ignorar com rede real).
rm -f "$ROOT/contratos/deployments/"*rbbLocal*.json 2>/dev/null || true
rm -f "$ROOT/contratos/deployments/"relatorio-*.json 2>/dev/null || true
sleep 1

echo ""
echo "==> 1/3  Reset + start da rede Besu local"
cd "$ROOT/rede-local"
./scripts/reset.sh
./scripts/start.sh
# Espera a rede realmente começar a produzir blocos antes de tentar o deploy.
echo "    aguardando primeiro bloco QBFT..."
until [ "$(curl -s -X POST -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://127.0.0.1:8545 | sed -E 's/.*"result":"0x([0-9a-f]+)".*/\1/')" != "0" ]; do
  sleep 2
done
echo "    rede no ar."

echo ""
echo "==> 2/3  Deploy dos contratos + povoamento da rede"
# Ordem determinística (nonce 0..4 do deployer, após reset):
#   deploy:selo          → nonce 0   → address_selo do blueprint
#   deploy:certificados  → nonce 1   → address_certificado do blueprint
#   demo:cadeia-soja     → nonces 2,3,4 → Registro / Lote / CertificadosConformidade
#                          + cadastra produtor, cria lote #1, registra eventos
#                          e emite certificado EUDR. É o povoamento que o WP lê.
cd "$ROOT/contratos"
pnpm deploy:selo --network rbbLocal
pnpm deploy:certificados --network rbbLocal
pnpm demo:cadeia-soja --network rbbLocal

echo ""
echo "==> 3/3  Subindo @wp-now com blueprint"
echo "    (primeira vez pode demorar para baixar PHP/WP — ~1 min)"
cd "$ROOT/wordpress-plugin"
exec pnpm dlx @wp-now/wp-now start --blueprint=./blueprint.json
