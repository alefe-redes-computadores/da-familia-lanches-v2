# DFL SITE R60 — Reparar Actions Android R57–R59

## Falhas comprovadas via GitHub

- Run 43118093730 / job 130851259370: `R252 BLOQUEADO: FileProvider ja existe`, na geração Cliente (antes do Gradle).
- Run 43118093531 / job 130851192405: `V21.4: cold start voltou a depender de splash/FileProvider`, gate Sales Critical (contrato anterior ao updater).
- Repetem desde R56/R57, não foram criadas pelo card visual R59.

## Correções cirúrgicas

1. Gerador Cliente: valida que o provider de atualização R57 já existe e é privado, com sua própria autoridade `\${applicationId}.updates.fileprovider` e `@xml/dfl_update_paths`. Depois inclui, em separado, o provider de splash antigo. A verificação final exige **exatamente dois**, com isolamento de caminhos.
2. Gate V21.4: cold start continua sem metadata de splash no Admin; aceita exclusivamente o provider privado e restrito do atualizador nativo.
3. Gate R252: a proibição absoluta de FileProvider no Admin deixa de bloquear o atualizador; continua proibido usar o provider de splash do Cliente no Admin.
4. CI: executa regressão R60 nos dois jobs. Alterar o workflow provoca o rebuild de ambos.

## NÃO alterado

Web Checkout, PIX, pedidos, promoções, tracking 360, WhatsApp, Finanças, Firebase, Supabase, secrets, assinatura, Android package IDs, versão do PWA, links existentes, `UpdateActivity.java`, providers no template Android.

## Gate e publicação

- R60 exige HEAD base da R59 publicada e verifica os blobs exatos dos quatro caminhos originais.
- Backup seletivo, testes legados, R60 e TypeScript antes de commit. Em falha restaura somente quatro arquivos e remove só os dois novos.
- Publicação explicitamente separada, com `git add --` só seis caminhos, validação de hash/HEAD e push. Nunca habilita Releases públicas; APK gerado continuará como artefato temporário, sujeito a build Gradle no GitHub.
- A homologação dos APKs reais continua necessária. Não declarar Android aprovado apenas por gate local.


## FIX1 — contrato V32 local
- Restaura `haptic("success")` somente depois de `writeAdminNotificationPrefs` bem-sucedido na Central.
- Preserva `haptic("error")` nas falhas; nao altera push remoto, pedido, mensagens ou permissao.
- Executa `test-admin-inspector-v32.mjs` antes da regressao global e do push.
- Inclui o arquivo da Central no backup, SHA, lint e commit seletivo (sete caminhos).


## FIX2 — V87 R3 x R58 (busca ponderada)
- O gate legado ainda exigia as expressões `simplify(` e `tokens.every(`, removidas legitimamente pela R58.
- O teste agora valida o motor `quickSearchScore`, a normalização de acentos, a combinação de termos e o descarte de falsos positivos usando transpile TS e execução real da função.
- Não altera a UI da busca nem reduz proteção: novo arquivo original entra no backup, SHA, rollback e publicação seletiva (oito caminhos).
- `test-site-v87-r3-premium.cjs` executa imediatamente após V32, antes das 69 suítes globais.
