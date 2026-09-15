# DFL V21 — Tracking, worker e notification intents
- UI do cliente consome tracking operacional reverso sem substituir status comercial.
- `stopsAhead` representa paradas físicas pendentes; não é ETA.
- pagamento/troco são lidos somente do Pedido do Site.
- reverse consumer cria `integration_notification_intents` idempotentes por source_event_id; nenhum WhatsApp é disparado nesta versão.
- `/api/integration/worker` executa o drain Site -> Entregas e aceita `DFL_INTEGRATION_WORKER_SECRET` ou `CRON_SECRET` via Bearer.
- O endpoint está pronto para scheduler/VPS. A frequência deve ser configurada fora do código conforme a infraestrutura disponível.
