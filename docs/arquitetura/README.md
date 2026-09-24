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

A infraestrutura em si (OpenTofu) está no fork [`ACIEG/rbb`](https://github.com/ACIEG/rbb), diretório `infra/`.
