# DFL SITE R228 — Transporte e mensageria desacoplados

Data: 31/10/2026. Base: 5becdbf22f6147b9465cde062fd458c2943f7ed2 (R107).

## Alterações
- Outbox continua persistida e idempotente, com HMAC e retry.
- POST ao Entregas começa em paralelo à projeção do intento de mensagem comercial.
- Para novos pedidos, o intento de WhatsApp é criado na mesma transação do pedido, da outbox e da fila de push.
- Só após 2xx do Entregas grava `transport_acknowledged_at`; ao tentar novamente a projeção da mensagem não repete o POST.
- Fast-lane e analytics deixam de bloquear o reconhecimento de entrega; analytics falhou? Não reapresentar pedido como novo.
- Registro de tempos sem PII no log: momento original do evento, duração e status HTTP.
- Contratos R228 entram nas Actions de protecao de vendas e APK Admin.
- Protecao de checkout usa os testes vigentes R4/R5 (o gate V88 R3 exigia expressao removida por evolucao R5).

## Não alterado
- Idempotência do pedido e do Entregas; chave HMAC; fila de push admin; UI; autenticação; cobrança; regras Firestore.
- Frequência do cron externo: depende da configuração efetivamente implantada. A tentativa imediata `after()` já existe; verificar monitoramento do worker real separadamente.
- Sons no APK admin/Entregas e a classificação de notificações históricas no destino: requerem correção no respectivo aplicativo, não nesta cirurgia do Site.

## Teste real pós-publicação (manual, com operação assistida)
Conferir pedido legítimo já existente ou monitorar próximo pedido real sem gerar venda sintética. Comparar timestamps do checkout, do 2xx do Entregas, da entrada na Inbox e da notificação. Observar retries do relay e fila de mensagens, sem duplicados. Não divulgar logs com telefone/nome.

## R229 proposta
1. APK independente do cliente com appId/assinatura próprios, TWA no domínio público, caminho e flavor próprio, workflow acionado por mudanças relevantes; manter assinatura do Admin e evitar builds desnecessários.
2. Correção do alarme do Admin: `ack`/aceite cancelam ringtone tanto nativo quanto na WebView; apagar jobs/service/background, deduplicar comando e resolver ao retomar app; testes para atualização, deep link, cold start e múltiplos pedidos.
3. Coordenação com DFL Entregas para descartar som de eventos antigos, sem descartar pedidos pendentes.
