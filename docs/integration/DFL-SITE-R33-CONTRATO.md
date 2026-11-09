# DFL 360 R33 — Contratos do Site e Supabase (OFF por padrão)

## Sem alteração no bot e número existentes

Site R32 publicada: commit `cfd9163e82be57b7cda739a225f37b2a123bbf2e`, Vercel READY.
Esta R33 adiciona receptor de **retirada manual**, além de preparar correções do ingest/worker para next-stop manual.
Entregas R300 P1/P2 ainda dependem de homologação/publicação própria; NÃO presumir produtor ativo.

## Contrato de retirada manual v2 — PRODUÇÃO BLOQUEADA

Emissor: servidor do Entregas, mesmo HMAC da ponte manual já existente.
POST `/api/integration/manual-messaging`. Receptor Site, depois Supabase ingest + worker.

Envelope criado:
```
source: manual
order_id: entregas:dfl-{delivery_id sem prefixo duplicado}
event_type: order.created
event_id: manual-msg-v2__order.created__{delivery_id}__{transition_key}
occurred_at: created_at
payload: {
  delivery_id, fulfillment_mode:'pickup', manual_pickup_v1:true,
  manual_messaging_opt_in_v1:true, notify_whatsapp:true,
  created_at: occurred_at, transition_key: lowercase_SHA256_64hex, completed:false
}
```

Envelope pronto: mesmos campos, mas `event_type=order.ready`, `event_id=manual-msg-v2__order.ready__{delivery_id}__{transition_key}` e `payload.pickup_ready_at=occurred_at`, sem `created_at` obrigatório. Criar evento SOMENTE após `pickup_ready_at` persistido no Entregas. Prontidão != baixa. Transição derivada de um registro autoritativo, nunca de polling; expiração de 7 min. Cadastro (order.created) expira em 15 min. Carimbos ISO UTC idênticos.

O campo `transition_key` deve ser calculado com SHA-256 determinístico com domínio por evento, por exemplo `sha256('dfl-manual-pickup-v1|'+event_type+'|'+delivery_id+'|'+occurred_at)`. Na reexecução do mesmo fato, reusar a mesma identidade. O Site valida o formato, correspondência com o `event_id`, integridade pelo HMAC de transporte e idade; a autenticação de origem fica exclusivamente no segredo S2S.

Consentimento exige dois campos explícitos verdadeiros + telefone válido, aprovação manual existente e canário exato. Os testes nunca enviam mensagens reais. Emissão nova no Site exigirá `DFL_MANUAL_PICKUP_ENABLED=true`, `DFL_MANUAL_PICKUP_KILL_SWITCH=false`, `DFL_MANUAL_PICKUP_SCOPE=canary`. Esses valores são ausentes/OFF após publicação.

Supabase, se implementado, ainda exigirá `DFL_MANUAL_PICKUP_INGEST_ENABLED=true`, `DFL_MANUAL_PICKUP_INGEST_KILL_SWITCH=false`, `DFL_MANUAL_PICKUP_WORKER_ENABLED=true`, `DFL_MANUAL_PICKUP_WORKER_KILL_SWITCH=false`. NUNCA ativar automaticamente; não é uma autorização de envio para clientes reais.

## Next-stop manual R32 × Entregas R300 P2

Site exige `delivery.next_stop`, `source=manual`, `event_id=manual-msg-v2__delivery.next_stop__{delivery_id}__{transition_key}` e o contrato físico de parada com `pending_stop_rank=1`, `previous_stop_completed_at=occurred_at` e `snapshot_version` válido.

R33 corrige a dedupe do Supabase para reter o `source_event_id` original v2 em `source=manual,event_type=delivery.next_stop` em vez do antigo `msg-v2__delivery.next_stop__{order_id}`, preservando o índice UNIQUE `(source,source_event_id)` e as regras dos demais eventos.

Worker de next-stop manual deve falhar definitivamente se o transporte estiver OFF, se a transição for antiga, se o evento estiver terminal, se a Evolution não devolver ACK confiável, se houver timeout ou estado incerto. Não recuperar locks antigos desse tipo para `pending`. Fora desse tipo, as políticas preexistentes ficam preservadas.

## Aceite e observabilidade

- V1 `order.created`, `delivery.started`, `delivery.completed` em entrega manual ficam intactos.
- Retirada manual não tem `delivery.started`, `delivery.next_stop` nem `delivery.completed` de entrega.
- `order.ready` do Site fica sob autoridade comercial do Site; manual pickup usa `source=manual` e ordem `entregas:dfl-*`.
- Nunca registrar telefone, link P9, conteúdo, tokens, segredos em logs novos.
- Índices persistentes e resultado do worker não provam mensagem recebida/lida pelo cliente.
- Um canário deve comprovar: cadastro -> ingest -> status worker -> ACK provedor -> recebimento real de teste; depois `Pronto` -> mesmo fluxo; opt-out e replays bloqueados; sem pedidos financeiros tocados.

Antes de homologar next-stop, o Supabase exige **DFL_MANUAL_NEXT_STOP_INGEST_ENABLED=true** e **DFL_MANUAL_NEXT_STOP_INGEST_KILL_SWITCH=false** no ingest, e **DFL_MANUAL_NEXT_STOP_WORKER_ENABLED=true**, **DFL_MANUAL_NEXT_STOP_WORKER_KILL_SWITCH=false** no worker. OFF até liberação coordenada. Nenhum flag é provisionado automaticamente.
