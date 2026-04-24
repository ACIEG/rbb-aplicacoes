#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down -v
echo "Rede parada e volumes removidos (dados apagados)."
