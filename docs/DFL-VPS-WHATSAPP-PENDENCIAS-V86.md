# DFL Site ↔ Entregas ↔ VPS/bot: pendências posteriores ao fechamento do Admin

Registrado em 23/10/2026 por solicitação do operador. **Não implementar nesta macrocirurgia (V86 R6)** e não modificar o bot de terceiros.

## Situações operacionais a reproduzir

1. **Primeira parada da rota:** imediatamente após o despacho, o cliente do primeiro endereço deve receber mensagem coerente: pedido saiu para entrega e é a primeira parada; informar "nos próximos minutos" apenas se o estado/ETA realmente sustentar, sem horário inventado. Não dizer que motoboy está terminando uma entrega anterior se não há anterior.
2. **Próxima parada:** após a entrega anterior ter sido concluída, a mensagem deve comunicar que a próxima entrega é a daquele cliente. Nunca afirmar simultaneamente que é a próxima e que o motoboy "ainda está finalizando a anterior". Garantir que a mensagem depende do evento de conclusão anterior, não só da posição na rota.
3. **Despacho realizado diretamente no Site:** não depender de abrir DFL Entregas, despachar uma segunda vez ou apertar "Sincronizar site" para WhatsApp sair. Inspecionar caminho de publicação do evento Site → camada de integração → Entregas/VPS/bot, estados de ack, retries, duplicatas e logs. O Site é dono do pedido; Entregas é dono da execução logística.
4. **Despacho no Entregas com pedido ainda não marcado Pronto no Site:** envio de "Saiu para entrega" não pode ficar preso exclusivamente à transição de preparo/Pronto do Site. Evento logístico autorizado deve determinar o aviso, sem rebaixar status do pedido nem anunciar despacho fictício.

## Critérios de aceite antes de publicar alteração de mensagens

- Matriz de estados: aguardando preparo, pronto, despachado, em rota (primeira/próxima/demais), parada anterior concluída, entregue, cancelado e devolução/reagendamento.
- Separar **evento ocorrido** de **projeção de posição da rota**: só afirmar "finalizou a entrega anterior" após conclusão real; ETA apenas baseado em dado confiável.
- Idempotência por pedido + evento + estágio/versão; registrar tentativas, confirmações e erro; retries com backoff e fila de reprocessamento sem spam.
- Cobrir despacho pelo Site, despacho pelo Entregas e sincronização automática, sem necessidade de "Sincronizar site" manual e sem reabrir cancelados.
- Endpoints autenticados e contratos versionados; Site/Entregas/VPS sem acoplamento direto entre bancos. Firebase → Supabase é trabalho posterior, não pré-requisito.
- Validar no ambiente real e em dry-run antes de usar WhatsApp verdadeiro. Não modificar o serviço PM2/bot de terceiros sem autorização expressa.
- **Arquivos protegidos já modificados localmente:** `src/lib/integration/contracts.ts`, `src/lib/integration/server/reversePersistence.ts`. NÃO SOBRESCREVER na R6.

## Eventos para inspecionar

`delivery.dispatched`, `delivery.pickup_ready`, `delivery.stop_completed`, `delivery.delivered` (nomes de referência; conferir nomes reais antes de mapear). A mensagem de primeira ou próxima parada deve ter seu gatilho confirmado por rastreio. Evitar assumir que esses nomes são todos contratos atuais.
