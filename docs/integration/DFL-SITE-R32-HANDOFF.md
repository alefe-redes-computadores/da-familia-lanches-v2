# DFL SITE R32 — next-stop manual + order.ready audit · 08/11/2026

## Fonte
Handoff Entregas: `DFL-R300-P1-HANDOFF-SITE-PRONTO-NEXT-STOP.md`.
O aviso manual `delivery.next_stop` NÃO existia no contrato completo. `order.ready` é uma investigação comercial distinta.

## Alterações no Site (somente código, OFF)
- O endpoint `POST /api/integration/manual-messaging` preserva **todos** os eventos manuais v1 já existentes.
- Reconhece adicionalmente envelope **v2 estrito** para `delivery.next_stop` em pedidos `entregas:dfl-*`, com assinatura HMAC original obrigatória.
- Gate novo e independente: `DFL_MANUAL_NEXT_STOP_ENABLED=true`, `DFL_MANUAL_NEXT_STOP_KILL_SWITCH=false`, `DFL_MANUAL_NEXT_STOP_SCOPE=canary`; o telefone deve ser exatamente o piloto existente `DFL_MESSAGING_PILOT_PHONE_E164`, além de passar pela autorização manual original e consentimento explícito. Nada dessas flags é ativado pela R32.
- Apenas a conclusão comprovada de uma parada **física** pode gerar um envelope v2. O Site exige `pending_stop_rank=1`, `stops_ahead=0`, `planned_stop` entre 2 e total, `previous_stop_completed=true`, rota iniciada/aberta, IDs de grupo anterior e atual distintos, snapshot_version >0 e carimbo de conclusão dentro de 7 minutos.
- Identidade persistente de evento: `manual-msg-v2__delivery.next_stop__{delivery_id}__{transition_key_sha256_64_hex}`; derivar no Entregas da transição AUTORITATIVA, nunca de um polling ou reordenação. Retentativa de resposta incerta **não** autoriza um evento distinto.
- Site entrega ao Supabase existente (ingest + worker): o worker v19 e ingest v10 já têm template/allowlist de `delivery.next_stop` para outros fluxos. Isso não equivale à homologação do caso manual: manter OFF até prova conjunta.
- Sem GPS, ETA, endereço ou promessas de minutos no novo contrato. `manual_order_items` não faz parte dele.

## Exemplo de envelope V2 (somente fixture sem dados reais)
```json
{
  "source":"manual",
  "event_type":"delivery.next_stop",
  "order_id":"entregas:dfl-12345678-1234-1234-1234-123456789abc",
  "event_id":"manual-msg-v2__delivery.next_stop__dfl-12345678-1234-1234-1234-123456789abc__aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "customer_phone":"5534999999999",
  "customer_name":"Cliente de teste",
  "occurred_at":"2026-11-08T21:00:00.000Z",
  "payload":{
    "delivery_id":"dfl-12345678-1234-1234-1234-123456789abc",
    "fulfillment_mode":"delivery",
    "manual_messaging_opt_in_v1":true,
    "notify_whatsapp":true,
    "route_id":"route_12345678",
    "route_started":true,
    "route_closed":false,
    "previous_stop_completed":true,
    "previous_stop_group_id":"stop_01",
    "next_stop_group_id":"stop_02",
    "previous_stop_completed_at":"2026-11-08T21:00:00.000Z",
    "planned_stop":2,
    "total_stops":6,
    "pending_stop_rank":1,
    "stops_ahead":0,
    "snapshot_version":12,
    "transition_key":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```
Observe que `occurred_at` deve ser a mesma data autoritativa em `previous_stop_completed_at`. A rota deve ter sido gravada antes de assinar. O Site não pode verificar sozinho a verdade física: Entregas é a autoridade dessa prova.

## Diagnóstico `order.ready`
- Admin > Central de Mensageria > Ferramentas avançadas > rastreio de pedido Pronto.
- Endpoint GET administrativo `/api/admin/messaging-ready-audit?orderId=...` com Firebase revocation check e `isAdminEmail`, cache privado desativado, **três leituras dirigidas e limitadas** ao pedido, aos eventos outbox e às intenções; sem alteração de banco.
- Apresenta consentimento/telefone somente como booleanos; estado comercial, `gateReason` da R11, eventos `order.updated` com status Pronto, `order.ready` intents e motivo de supressão. Não retorna telefone, nome, endereço, payloads completos, link, token ou segredo.
- Supabase comprovou, em agregado nos últimos 14 dias, 10 `order.ready` Site e 11 `delivery.next_stop` Entregas com `sent`, mas isso NÃO diagnostica os casos específicos do handoff. Para esses, analisar o ID com o novo painel.
- `queued` / provider ACK != entregue ao cliente. Não reenviar `order.ready` sem auditoria de estado e consentimento.

## Operação
Nenhuma flag nova é criada no deploy, nenhuma função existente do Supabase é alterada e nenhum WhatsApp é enviado pelo teste. A fase posterior deve implantar **o produtor Entregas** (após concluir parada física) e executar canário autorizado antes de ativar `DFL_MANUAL_NEXT_STOP_*` no Site.
