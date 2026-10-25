# DFL Site V88 R3 — Recuperação de pedido ambíguo

- Erro incerto não autoriza iniciar pedido paralelo; a UI agora recomenda consultar Meus Pedidos com um toque.
- Mantém clientRequestId, carrinho, rascunho e proteção de idempotência. Não muda persistência, backend ou WhatsApp.
- Códigos comerciais explicitamente rejeitados não recebem aviso de possível pedido criado.
- QA real: simular timeout e conexão caída; verificar histórico antes de repetir; não repetir pedido pelo WhatsApp.
