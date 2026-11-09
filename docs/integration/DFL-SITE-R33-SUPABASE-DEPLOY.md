# DFL Site R33 — Estado real das Edge Functions Supabase Finance

Data: 08/11/2026. Projeto Supabase compartilhado: `bwggczkzsqcdeayyysmx` (DFL - Finance).

## Alterações já aplicadas e verificadas

- `dfl-messaging-ingest` **v11 ACTIVE**. Mantém as regras de autorização e a deduplicação semântica para todos os eventos antigos, mas preserva o `source_event_id` v2 completo em `source=manual,event_type=delivery.next_stop`. Valida `transition_key`, `delivery_id`, consentimento, posição atual, timestamp de conclusão de até 7 min e o gate novo independente `DFL_MANUAL_NEXT_STOP_INGEST_ENABLED=true` + `DFL_MANUAL_NEXT_STOP_INGEST_KILL_SWITCH=false`. Para `order.created/order.ready` de pickup manual v2, exige marcação `manual_pickup_v1`, idade e `DFL_MANUAL_PICKUP_INGEST_ENABLED=true` com kill switch false.
- `dfl-messaging-worker` **v22 ACTIVE**. Para `source=manual` e `delivery.next_stop`, exige o mesmo ID de transição completo, posição, consentimento e janela de 7 min. OFF por padrão via `DFL_MANUAL_NEXT_STOP_WORKER_ENABLED` e `DFL_MANUAL_NEXT_STOP_WORKER_KILL_SWITCH`.
- Worker de retirada manual exige `DFL_MANUAL_PICKUP_WORKER_ENABLED` e `DFL_MANUAL_PICKUP_WORKER_KILL_SWITCH`; reconhece `payload.fulfillment_mode=pickup` e usa os templates existentes `order.created` (confirmação de retirada) e `order.ready` (pronto para retirar). Quando não há número comercial, a mensagem usa “PEDIDO DA LOJA”, não trechos de UUID.
- Os eventos manuais v2 com timeout, erro de provider, ACK incerto ou lock antigo são destinados à revisão permanente (`dead_letter`), sem retransmissão automática; outros eventos continuam com a política antiga.
- Índice único já existente no banco: `(source,source_event_id)` para impedir duplicidade em múltiplas instâncias.
- `whatsapp-webhook`, receptor P9 e demais funções antigas não foram substituídas; **o banco financeiro não foi alterado**.
- **Nenhuma nova flag foi configurada**. Toda modalidade nova continua OFF. Não executar canário ou replay de mensagens reais sem autorização de número e Entregas homologado.

## Revisão de segurança e evidências

Fonte: funções lidas pelo conector Supabase após deploy, sem executar eventos reais. Os deploys publicados foram validados pelo serviço Supabase, mas **não equivalem a homologação de entrega do WhatsApp**.

- Ingest v11 SHA de deploy `d3e02b0f499865de7ac0b2284ba5c75dd3005d87903501ec55496b593afc6b05`.
- Worker v22 SHA de deploy `b8c71b806bd1199b7ffc9f109fb9795faaa79a93430e85f5d28e7af46cd254da`.
- Antecessores: ingest v10, worker v19. Versões v20–v21 foram etapas internas da mesma cirurgia; a versão final certificada é v22.

## Atenção para operação

- O índice UNIQUE impede duplicidade de uma mesma identidade de evento, mas não demonstra recebimento nem leitura no WhatsApp.
- Com os flags da R33 OFF, o ingest rejeita eventos manual-next-stop/pickup-v2 e o worker se recusa a enviar caso um desses eventos consiga entrar na fila. Replays incertos desses eventos não são reativados.
- Ao habilitar canário posteriormente, usar a mesma identidade imutável nas retentativas. NÃO reprocessar backlog ao mudar flags.
- O serviço de mensagens já existente usa Evolution API; não criar outro bot/instância/telefone.

## Gates para depois da R300

1. Verificar o produtor Entregas com dois pedidos na mesma parada e conclusão do último membro; confirmar *uma* transição física.
2. Com número canário autorizado, Site aceitar exatamente um evento HMAC v2; Supabase registrar uma identidade, worker apresentar um ACK real.
3. Validar injeção, consentimento negado, telefone inválido, reordenação, alteração de versão, timestamp vencido, HMAC inválido, timeout, crash e duplicidade.
4. Registrar recebimento real no número canário e desligar flags após teste. Nunca considerar `sent` como prova de leitura.
5. Executar o mesmo fluxo para cadastro e prontidão de retirada manual, sem confundir com conclusão da retirada.

**O caminho Site R33 ainda precisa ser publicado pelo Termux**. A alteração do Supabase já está ativa, com os envios novos bloqueados.
