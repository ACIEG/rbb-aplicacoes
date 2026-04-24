# Rede Besu Local para Desenvolvimento

Ambiente Docker com **3 nós Besu em consenso QBFT** — mesma configuração usada pela Rede Blockchain Brasil (RBB) em produção. Permite deploy, teste e demonstração das aplicações da ACIEG sem custo e sem depender de conexão com a RBB.

## Topologia

| Nó | Papel | RPC HTTP | P2P | Endereço validador |
|---|---|---|---|---|
| `node01` | validator + seed | `http://127.0.0.1:8545` | `30303` | `0x2a63b115b170e0d90067c4ef2abfdb5ca022a797` |
| `node02` | validator | `http://127.0.0.1:8555` | `30304` | `0x4dab62846d49232773e33d75ba9705533c0769ee` |
| `node03` | validator | `http://127.0.0.1:8565` | `30305` | `0xf80f8555c707f820183c4d6e7709fe5a97e89b3d` |

Todos os 3 nós participam do consenso QBFT. `node01` também serve de *bootnode* para descoberta dos demais. WebSocket disponível em `ws://127.0.0.1:8546` pelo node01.

## Configurações-chave

- **Consenso**: QBFT (mesmo da RBB)
- **`chainId`**: `121200149999` (distinto da RBB real — `12120014` — para evitar confusão em carteiras)
- **Block time**: 4 segundos (mesmo da RBB)
- **Gas price mínimo**: 0 (transações gratuitas, como na RBB)
- **Permissionamento on-chain**: **desativado** (diferente da RBB em produção; simplifica testes)

As diferenças conscientes com a RBB real estão documentadas acima. Nenhuma delas afeta a compatibilidade EVM — contratos deployados aqui funcionam idênticos na RBB.

## Contas pré-financiadas

As mesmas contas determinísticas do Hardhat são pré-financiadas com 200 ETH cada (em `genesis.json > alloc`):

| Role | Endereço | Chave privada |
|---|---|---|
| `Hardhat #0` (ACIEG admin) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| `Hardhat #1` | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| `Hardhat #2` | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| `Hardhat #3` | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| `Hardhat #4` | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |

> ⚠️ **Nunca use estas chaves em rede real.** Elas são públicas e documentadas em toda a internet.

## Requisitos

- Docker v20.10+
- Docker Compose v2+
- 4 GB RAM livres (os 3 nós Besu consomem ~1.2 GB cada)

## Uso

```bash
# Subir rede (~30 segundos até produzir o bloco 1)
./scripts/start.sh

# Ver logs do node01
./scripts/logs.sh node01

# Parar rede (mantém dados)
./scripts/stop.sh

# Reset completo (apaga blockchain local)
./scripts/reset.sh
```

## Integração com Hardhat

O `contratos/hardhat.config.ts` já define a rede `rbbLocal` apontando para `http://127.0.0.1:8545`. Uso:

```bash
cd ../contratos
pnpm hardhat compile
pnpm hardhat run selo-digital-associado/scripts/deploy.ts --network rbbLocal
```

## Verificar saúde via curl

```bash
# Último bloco
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545

# Saldo da conta admin ACIEG
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","latest"],"id":1}' \
  http://127.0.0.1:8545

# Validadores ativos (QBFT)
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"qbft_getValidatorsByBlockNumber","params":["latest"],"id":1}' \
  http://127.0.0.1:8545
```

## Block Explorer opcional (Blockscout)

Para visualizar transações em uma UI amigável, siga as instruções do [Blockscout RBB](https://github.com/RBBNet/rbb/blob/master/roteiro_acesso_leitura.md) apontando para `http://node01:8545`. Alternativa leve: [Chainlens](https://github.com/web3labs/chainlens-free).

## Alternativa rápida: Hardhat Network

Para testes unitários durante desenvolvimento, use `npx hardhat node` (sem Docker). Mesma API JSON-RPC, porém:
- Instantâneo (sem tempo de subida)
- Auto-mining por transação (sem 4s blocktime)
- Sem QBFT (consenso trivial)

Essa é a rede padrão dos testes em `pnpm hardhat test`.

## Migração para a RBB real

Quando a adesão da ACIEG for aceita pela Governança da RBB:

1. Substitua o `genesis.json` por `artefatos/observer/genesis.json` oficial do RBBNet/rbb
2. Siga [roteiro_adicao_nos.md](https://github.com/RBBNet/rbb/blob/master/roteiro_adicao_nos.md) do RBB
3. Contrate um servidor na Magalu Cloud (BV2-4-100, R$153/mês para nó registrador)
4. Use o `start-network` oficial: `RBBNet/start-network`

Os **contratos deployados localmente não precisam de qualquer alteração** para rodar na RBB real — a EVM é a mesma.

## Licença

[Apache-2.0](../LICENSE)
