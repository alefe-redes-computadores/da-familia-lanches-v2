# DFL Site V19C — Secure Outbox Relay Foundation

## Estado

A V19C prepara o transporte privilegiado da `integration_outbox`, mas o transporte deve permanecer DESATIVADO até existir um endpoint V19C compatível no DFL Entregas.

O navegador não drena a outbox e não recebe credenciais administrativas. O Firebase Admin SDK existe apenas em módulos `server-only` e na Route Handler Node.js.

## Fluxo preparado

1. `Pedido` + evento de outbox continuam sendo criados atomicamente pela V19A.
2. Um chamador servidor autenticado aciona `POST /api/integration/outbox/drain`.
3. O relay faz claim transacional de eventos `pending`/`failed` ou locks `processing` expirados.
4. O mesmo `event_id` é enviado ao destino; retry nunca cria novo ID.
5. O POST ao destino leva `x-dfl-event-id`, `x-dfl-timestamp` e `x-dfl-signature` HMAC-SHA256 sobre `<timestamp>.<body>`.
6. HTTP 2xx marca `sent`; falha marca `failed`, agenda backoff exponencial e, ao atingir o limite, `dead_letter`.
7. Locks são associados a `workerId` e só o worker dono conclui a tentativa.

## Variáveis de ambiente

Todas são SERVER-ONLY. Nenhuma deve usar prefixo `NEXT_PUBLIC_`.

- `DFL_INTEGRATION_RELAY_ENABLED=false` — chave mestre. Manter `false` até o consumidor do Entregas existir.
- `DFL_ENTREGAS_INTEGRATION_URL` — URL HTTPS futura do endpoint inbound do Entregas.
- `DFL_INTEGRATION_SIGNING_SECRET` — segredo compartilhado para assinatura HMAC.
- `DFL_RELAY_TRIGGER_SECRET` — bearer secret para acionar o drain.
- `DFL_RELAY_WORKER_ID` — opcional.
- `DFL_RELAY_BATCH_SIZE` — padrão 10, máximo 25.
- `DFL_RELAY_MAX_ATTEMPTS` — padrão 8.
- `DFL_RELAY_TIMEOUT_MS` — padrão 8000.
- `DFL_RELAY_LOCK_TIMEOUT_MS` — padrão 120000.
- `FIREBASE_SERVICE_ACCOUNT_JSON` — JSON completo da service account, somente servidor. Em ambiente com Application Default Credentials pode ser omitida.

## Ativação futura

Antes de trocar `DFL_INTEGRATION_RELAY_ENABLED` para `true`:

1. implementar e testar o persistence boundary V19C do DFL Entregas;
2. validar assinatura HMAC e janela temporal no receptor;
3. provar idempotência real com `integration_inbox`;
4. configurar credenciais/segredos somente no ambiente servidor;
5. testar um evento sintético controlado;
6. só então liberar drenagem da fila real.

## Fora de escopo desta fase

- polling no navegador;
- credencial Admin no bundle cliente;
- escrita direta do Site nas coleções operacionais do Entregas;
- sincronização reversa `delivery.*`;
- mudança automática de status comercial do Site;
- cron/worker permanente. O endpoint está preparado para um scheduler/VPS posterior.

## V19D.1 — commissioning seletivo

Durante o commissioning, `POST /api/integration/outbox/drain` aceita opcionalmente:

```json
{"event_id":"<event_id exato>"}
```

Quando `event_id` é informado, somente esse evento pode ser claimed e enviado. Evento
inexistente ou não disponível retorna conflito e **nunca** faz fallback para drenagem em
lote. Sem `event_id`, o comportamento V19C de lote permanece inalterado.

Esse modo existe para validar a ponte com um `order.created` conhecido antes de liberar
eventos históricos ou tipos ainda não consumidos, como `order.updated`.
