# VHS script: demo end-to-end da cadeia de soja Rio Verde/GO -> Rotterdam
# Gera o GIF/MP4 demonstrando a aplicacao "Rastreabilidade Feito em Goias"
# rodando em rede Besu local compativel com RBB.
#
# Uso (de qualquer lugar):
#   vhs contratos/scripts/rastreabilidade/demo.tape

Output demo-rastreabilidade-feito-em-goias.mp4

Set FontSize 12
Set Width 1280
Set Height 780
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set Margin 16
Set MarginFill "#1e1e2e"
Set BorderRadius 10
Set Shell "zsh"

Hide
Type "cd /Users/renansantana/conductor/workspaces/rbb-aplicacoes/buffalo/contratos"
Enter
Type "setopt INTERACTIVE_COMMENTS"
Enter
Type "export DEMO_PAUSE_MS=2500"
Enter
Type "clear"
Enter
Sleep 500ms
Show

Type "# ACIEG na Rede Blockchain Brasil"
Sleep 800ms
Enter
Type "# Demo: lote de 50t de soja de Rio Verde/GO rumo a Rotterdam"
Sleep 800ms
Enter
Type "# Rastreabilidade on-chain + certificado EUDR verificavel"
Sleep 1500ms
Enter
Enter

Type "pnpm demo:cadeia-soja --network rbbLocal"
Sleep 500ms
Enter

# ~10 transacoes em Besu QBFT (~3-4s cada) + 6 pausas de 2,5s entre secoes.
# Demo fecha com sumario formatado (sem JSON bruto em tela).
Sleep 70s
# Respira no sumario final
Sleep 3s
