#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Subindo rede Besu local (QBFT, 3 validators)..."
docker compose up -d
echo ""
echo "Aguardando o bloco genesis..."
until curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545 | grep -q '"result":"0x'; do
  sleep 2
done
echo "Rede no ar!"
echo "  node01 RPC: http://127.0.0.1:8545"
echo "  node02 RPC: http://127.0.0.1:8555"
echo "  node03 RPC: http://127.0.0.1:8565"
echo "  WebSocket:  ws://127.0.0.1:8546"
echo ""
echo "Verifique status com: docker compose logs -f node01"
