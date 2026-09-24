# Arquitetura da ACIEG na Rede Blockchain Brasil

Modelo [C4](https://c4model.com) da participação da ACIEG na RBB, escrito no DSL do [LikeC4](https://likec4.dev): os nós operados pela ACIEG (boot, validator, writer, observer-boot, observer archive e Prometheus), como eles se comunicam com a rede (portas e protocolos), onde cada um roda (Magalu Cloud, `br-se1`) e onde fica a chave de Administrador Global (AWS KMS, `sa-east-1`).

Vistas:

| Vista | Conteúdo |
|---|---|
| `index` | Contexto: ACIEG, RBB (outras organizações e permissionamento gen02), governança, operação técnica, observers do público |
| `nodes` | Nós da ACIEG e como se comunicam (topologia núcleo/satélite do roteiro da RBB) |
| `monitoring` | Prometheus: coleta dos nós e federação mTLS com os demais partícipes |
| `lab` | Implantação da testnet (rede lab): VMs, VPC, NAT, KMS e estado |

## Como visualizar

```bash
npx -y likec4@latest start docs/arquitetura/c4     # site interativo local
npx -y likec4@latest export png docs/arquitetura/c4 -o /tmp/c4   # PNG das vistas
npx -y likec4@latest validate docs/arquitetura/c4
```

Também exporta para SVG, draw.io e Markdown. O modelo é a fonte de verdade de arquitetura: ao mudar a infraestrutura (novos nós, IPs, mainnet), atualize os arquivos `.c4`.

## Decisões de arquitetura

### Formato de armazenamento do Besu: Bonsai nos nós da rede, Forest só no archive

- **boot01, validator01, writer01 e observer-boot01** usam **Bonsai**, o padrão do Besu 25.5.0 e o que o `docker-compose.yml.hbs` da RBB produz. Esses nós só precisam do estado atual da cadeia; Bonsai consome menos disco e memória e é mais rápido para o consenso e para a propagação de blocos.
- **observer01** usa **Forest com sincronização FULL** (archive): guarda o estado histórico completo, necessário para consultas a blocos antigos, verificação de contratos, `debug_traceTransaction` e indexação por explorador de blocos. Bonsai não atende a esse uso (retém por padrão apenas os últimos 512 blocos de estado).
- O archive **não é o validator nem o observer-boot** por decisão: Forest é mais pesado, a sincronização FULL reexecuta cada bloco desde o gênesis, e o RPC de um archive não deve ficar exposto. Colocá-lo no validator arriscaria a produção de blocos; no observer-boot, misturaria a superfície pública com dados internos.
- O observer01 é um **nó interno de leitura, fora do núcleo da RBB** (modelo do `instanciar_observer.md`): conecta-se só ao observer-boot01, não participa do consenso, não entra no `nodes.json`, não exige permissionamento e pode ser desligado a qualquer momento sem afetar a rede nem os demais nós da ACIEG.
- O formato é definido no primeiro start do nó e **não pode ser trocado** sem descartar o volume e ressincronizar. Por isso o archive foi criado na testnet primeiro, com 300 GB, para medir disco e tempo de sincronização antes de dimensionar o da mainnet.

### Custódia da chave de Administrador Global

A chave que representa a ACIEG na governança on chain vive no **AWS KMS** (`sa-east-1`), não exportável, com assinatura restrita a um papel dedicado e todo uso registrado em CloudTrail com retenção imutável. Nenhuma chave privada existe fora do KMS ou das VMs dos nós.

A infraestrutura em si (OpenTofu) está no fork [`ACIEG/rbb`](https://github.com/ACIEG/rbb), diretório `infra/`.
