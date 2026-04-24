# Selo Digital de Associado ACIEG

Contrato Solidity que emite um **Selo Digital de Associado** (SBT — *Soulbound Token*) on-chain para cada empresa ou pessoa associada à ACIEG. O selo permite que **qualquer terceiro** — bancos, órgãos públicos, fornecedores — confirme em tempo real se uma entidade é associada ativa da ACIEG, sem papel, sem intermediação e sem custo.

## Problema que resolve

Hoje, quando um banco oferece linha de crédito exclusiva para associados ACIEG ou um órgão público exige comprovação de vínculo, o fluxo típico é:

1. O associado solicita declaração em papel à ACIEG
2. A ACIEG emite em 2-5 dias úteis
3. O associado entrega fisicamente ou digitalmente à contraparte
4. A contraparte liga para a ACIEG ou confia no papel

Com o Selo Digital on-chain:

1. A ACIEG emite **uma vez** o selo para o endereço do associado
2. Qualquer contraparte verifica em `statusAtivo()` ou `verificarPorCnpj()` **instantaneamente**, sem precisar contactar a ACIEG

## Arquitetura

### Soulbound

O token é **não-transferível**: `SeloIntransferivel` é revertido em qualquer transferência. Apenas emissão (mint pela ACIEG) e burn (via revogação futura) são permitidos. Isso impede que um selo seja vendido ou transferido — ele fica sempre atrelado ao endereço do associado original.

### Papéis (AccessControl)

- `ADMIN_ROLE` — emite novos selos (operado pela secretaria da ACIEG)
- `REVOGADOR_ROLE` — revoga selos (pode ser delegado a auditoria interna)
- `DEFAULT_ADMIN_ROLE` — gerencia os papéis acima

### Estados de um selo

| Status | Condição |
|---|---|
| `ATIVO` | Não revogado E `block.timestamp <= validoAte` |
| `EXPIRADO` | Não revogado E `block.timestamp > validoAte` |
| `REVOGADO` | `revogado == true` (irreversível) |

### Metadados on-chain

`tokenURI` retorna um JSON codificado em Base64 data URI contendo:
- CNPJ/CPF, razão social, setor
- Emitido em, Válido até
- Status atual (calculado)

Isso permite que **carteiras** (MetaMask, etc.) e **exploradores de bloco** (Blockscout) mostrem automaticamente informações legíveis sobre o selo.

## Casos de uso reais

### 1. Linha de crédito de banco associado

O Banco X oferece linha de crédito a 1.5% a.m. exclusiva para associados ACIEG. No portal do banco, após o cliente informar CNPJ, a API do banco consulta `verificarPorCnpj("05613301000192")` no Selo da ACIEG. Se retornar `true`, a oferta é liberada. Fraude (cliente se passa por associado sem ser) fica impossível.

### 2. Licitação com cota para associações

Edital de licitação reserva lote para empresas associadas a câmaras/federações. A Comissão de Licitação roda o CNPJ do licitante no selo — resposta em segundos, arquivável como evidência on-chain da verificação.

### 3. Benefícios em fornecedores parceiros

Fornecedor oferece desconto para associados. Seu e-commerce consulta o Selo no checkout, aplica desconto automaticamente. Sem precisar digitalizar carteirinha, sem precisar que ACIEG mantenha uma API própria.

## Como rodar

### Pré-requisitos

- Node.js 20+
- pnpm 9+

### Instalar dependências (na raiz `contratos/`)

```bash
cd ..
pnpm install
```

### Compilar

```bash
pnpm hardhat compile
```

### Testes

```bash
pnpm hardhat test selo-digital-associado/test/**
```

### Cobertura de código

```bash
pnpm hardhat coverage --testfiles "selo-digital-associado/test/**/*.ts"
```

### Deploy em rede local Besu (RBB-compatible)

```bash
# 1. Subir rede local (em outro terminal)
cd ../rede-local && ./scripts/start.sh

# 2. Deploy
pnpm hardhat run selo-digital-associado/scripts/deploy.ts --network rbbLocal
```

### Verificação via CLI

```bash
CONSULTA=05613301000192 pnpm hardhat run selo-digital-associado/scripts/verificar.ts --network rbbLocal
```

Saída exemplo:

```json
{
  "consulta": "05613301000192",
  "endereco": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "status": "ATIVO",
  "cnpjOuCpf": "05613301000192",
  "razaoSocial": "Empresa Exemplo Ltda",
  "setor": "Comercio",
  "emitidoEm": "2026-04-24T00:00:00.000Z",
  "validoAte": "2027-04-24T00:00:00.000Z",
  "revogado": false
}
```

## Integração

- **Plugin WordPress** `acieg-rbb-verificador` (em [`../../wordpress-plugin/`](../../wordpress-plugin/)) expõe `[verificar_selo_acieg cnpj="..."]` e Gutenberg block equivalente.
- **Interface pública** `ISelo` ([`contracts/interfaces/ISelo.sol`](contracts/interfaces/ISelo.sol)) é o contrato que deve ser importado por integradores que queiram consultar selos.

## Limitações conhecidas

- A emissão é centralizada na ACIEG (role `ADMIN_ROLE`). Isso é intencional — a ACIEG é a autoridade sobre quem é associado. Descentralização não faz sentido aqui.
- Não há rotação automática de validade. Selos expiram por `validoAte` e precisam ser re-emitidos (após burn + mint) no próximo ciclo anual.
- Revogação é permanente. Para "reativar" após revogação, a ACIEG precisa emitir novo selo (novo tokenId).

## Licença

[Apache-2.0](../../LICENSE)
