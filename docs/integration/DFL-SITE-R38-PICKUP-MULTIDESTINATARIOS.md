# DFL Site R38 — Retirada manual v2 para múltiplos destinatários (PREPARAÇÃO, OFF)

**Motivo verificado:** O Site R37 e o Entregas R302 possuem envios v1 históricos, mas a nova política R33 valida exclusivamente o telefone piloto. O teste de retirada manual com outro número não comprova falha de integração; era bloqueado por contrato.

## Escopo estrito deste patch

- Alterar apenas `src/lib/messaging/r33ManualPickupPolicy.ts` e `src/app/api/integration/manual-messaging/route.ts`.
- Preservar autenticação HMAC, opt-in duplo, formato `manual-msg-v2__`, TTL de cadastro 15m/prontidão 7m, controles antigos v1, idempotência, Supabase existente e worker wake.
- Adicionar escopo v2 `authorized_clients` com `DFL_MANUAL_PICKUP_APPROVED_PHONES_E164`: lista CSV de 1–12 telefones E.164, exclusivamente com consentimento e flags novas ligadas.
- Preparar escopo v2 `consented_customers`: além de opt-in individual, só fica autorizado com `DFL_MANUAL_PICKUP_ROLLOUT_APPROVED=true`, uma aprovação NOVA e independente da mensageria antiga. Esta variável não é criada ou alterada pelo pacote.
- Manter escopo `canary` anterior com número piloto único sem nenhuma mudança.
- Separar, somente para retirada v2, o gate de destinatário antigo R8. **R8 permanece idêntico para as mensagens v1 e próxima parada.** Retirada v2 continua dependente de `DFL_MANUAL_MESSAGING_ENABLED=true` e kill switch antigo em `false`, além do escopo de retirada.
- Nenhuma alteração de credencial, Site comercial, ingest, Supabase, Evolution, bot Finance, `whatsapp-webhook` ou NEXT_STOP.

## Dependência indispensável do Entregas

A preparação Site sozinha **não habilita** múltiplos destinatários. O produtor Entregas R301/R302 também contém `plan.phone !== DFL_MESSAGING_PILOT_PHONE_E164` e `DFL_MANUAL_MESSAGING_SCOPE === 'canary'`. O outro chat deve evoluir os guards de modo compatível, sem retirar proteções contra pedido interno/sem consentimento, e verificar Firestore e reserva do pedido anterior. Não tocar no projeto Entregas por este patch.

## Status de publicação

**SOMENTE LOCAL.** O instalador exige HEAD Site R37 exato e árvore dos quatro arquivos limpa. Faz backup seletivo, aplica patch, executa teste R33 histórico, R38 novo, TypeScript e git diff --check; rollback somente arquivos R38 em falha. Não commit, push, deploy, flag ou WhatsApp. Aprovação de rollout continua separada.

## Homologação futura controlada

1. Aprovar testes puros e verificar consistência com Entregas. Manter Site/Entregas OFF.
2. Após autorização específica, ativar SOMENTE lista restrita de números consentidos e observar pedido novo, POST Entregas→Site, ingest, outbox, worker/ACK Evolution e recebimento WhatsApp.
3. Restaurar os controles específicos de homologação, sem alterar serviços antigos.
4. Somente então considerar `consented_customers`, que exige autorização independente e observabilidade de duplicações, opt-out e dead letters. Não é ativado por este pacote.
