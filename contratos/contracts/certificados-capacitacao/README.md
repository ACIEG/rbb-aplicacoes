# Certificados de Capacitação Verificáveis ACIEG

Contrato Solidity que emite certificados de cursos, workshops e programas da ACIEG como **SBTs verificáveis**, com hash SHA-256 do PDF original gravado on-chain. Qualquer empregador, órgão regulador ou pessoa interessada pode confirmar a autenticidade de um certificado em segundos — sem contactar a ACIEG, sem risco de falsificação.

## Problema que resolve

O mercado brasileiro sofre com **fraude massiva de certificados**. Empresas de recrutamento relatam que 15-30% dos certificados apresentados em processos seletivos são adulterados ou totalmente falsos. O processo atual de verificação é inviável em escala:

1. Empregador recebe PDF do candidato
2. Liga para a instituição emissora
3. Aguarda resposta por e-mail (horas ou dias)
4. Institui confiança no processo apenas por conveniência

Com certificados on-chain:

1. ACIEG emite o certificado on-chain no momento da conclusão do curso, gravando o **hash SHA-256** do PDF original
2. Empregador recebe PDF do candidato e calcula seu próprio SHA-256 (uma linha de código ou `sha256sum arquivo.pdf`)
3. Empregador consulta o contrato com esse hash → resposta em 1 segundo, irrefutável

## Arquitetura

### Hash on-chain, conteúdo off-chain

Certificados podem conter informações pessoais sensíveis (CPF, fotos, dados acadêmicos). Gravar o certificado inteiro on-chain seria inadequado (LGPD) e caro. A abordagem adotada:

- O **PDF completo** fica em poder do aluno (e da ACIEG, como arquivo interno)
- Apenas o **hash SHA-256** do PDF é gravado on-chain
- O empregador verifica: "o PDF que recebi bate com o hash on-chain?"

Isso torna impossível:
- Adulterar o PDF (qualquer byte alterado muda completamente o hash)
- Criar um certificado falso do zero (hash não vai bater com nenhum registro on-chain)
- A ACIEG negar ter emitido (evento `CertificadoEmitido` fica on-chain permanentemente)

### Soulbound

Como o Selo, certificado é não-transferível. Ele fica vinculado ao endereço do aluno que concluiu o curso.

### Papéis

- `EMISSOR_ROLE` — atribuível por programa de capacitação. Cada coordenação de curso pode ter sua própria carteira com este papel.
- `REVOGADOR_ROLE` — revoga certificados (ex: curso cancelado retroativamente, fraude na inscrição detectada).

## Casos de uso reais

### 1. Processo seletivo automatizado

Ficha de candidato no sistema da empresa tem campo "anexar certificado". Ao anexar, o sistema calcula SHA-256 do arquivo e consulta `verificarPorHash` no contrato. Marca o candidato como **"verificado"** automaticamente. Certificados falsos são rejeitados no upload.

### 2. Concessão de desconto em MBA parceiro

Instituição parceira oferece desconto de 20% no MBA para quem concluiu cursos da ACIEG. Formulário de inscrição aceita o certificado, verifica on-chain, aplica desconto automaticamente.

### 3. Auditoria reversa

Em audiência trabalhista, testemunha afirma ter feito curso na ACIEG. O juiz pede a prova: consulta o endereço da pessoa em `certificadosDe(address)` e vê todos os certificados emitidos. Irrefutável.

## Como rodar

```bash
# Na raiz contratos/
pnpm install
pnpm hardhat compile
pnpm hardhat test certificados-capacitacao/test/**
pnpm hardhat coverage --testfiles "certificados-capacitacao/test/**/*.ts"
```

### Emitir um certificado real

```bash
ALUNO=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
PDF_PATH=./certificado-maria.pdf \
NOME_CURSO="Blockchain para Gestao" \
NOME_ALUNO="Maria da Silva" \
CARGA_HORARIA=40 \
pnpm hardhat run certificados-capacitacao/scripts/emitir.ts --network rbbLocal
```

### Verificar um PDF recebido

```bash
PDF_PATH=./certificado-suspeito.pdf \
pnpm hardhat run certificados-capacitacao/scripts/verificar.ts --network rbbLocal
```

Saída exemplo:

```json
{
  "tokenId": 1,
  "hashPdf": "0x3a4...",
  "valido": true,
  "status": "VALIDO",
  "nomeCurso": "Blockchain para Gestao",
  "nomeAluno": "Maria da Silva",
  "cargaHorariaHoras": 40,
  "dataConclusao": "2026-02-15T00:00:00.000Z",
  "emissor": "0xf39..."
}
```

## Integração

- **Plugin WordPress** expõe `[verificar_certificado hash="0x..."]` e Gutenberg block equivalente em páginas como `/verificar-certificado/` no site da ACIEG.
- **API externa**: qualquer sistema que faça chamada RPC ao nó observer da RBB pode verificar hashes sem autenticação.

## Licença

[Apache-2.0](../../LICENSE)
