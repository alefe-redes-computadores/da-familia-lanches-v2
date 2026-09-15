# DFL V21 — Tracking, worker e notification intents
- UI do cliente consome tracking operacional reverso sem substituir status comercial.
- `stopsAhead` representa paradas físicas pendentes; não é ETA.
- pagamento/troco são lidos somente do Pedido do Site.
- reverse consumer cria `integration_notification_intents` idempotentes por source_event_id; nenhum WhatsApp é disparado nesta versão.
- `/api/integration/worker` executa o drain Site -> Entregas e aceita `DFL_INTEGRATION_WORKER_SECRET` ou `CRON_SECRET` via Bearer.
- O endpoint está pronto para scheduler/VPS. A frequência deve ser configurada fora do código conforme a infraestrutura disponível.


## V21.1 — projeção operacional segura no status comercial

Eventos reversos agora projetam marcos inequívocos no status comercial: posição/next-stop/saída podem avançar delivery para `Saiu para Entrega`; `delivery.completed` pode avançar para `Finalizado`. A projeção é monotônica, ignora pickup e Cancelado, não cria `order.updated` no outbox do Site (evita eco) e preserva a concessão idempotente da fidelidade na conclusão operacional. O Inbox registra status anterior/posterior e origem da projeção.
