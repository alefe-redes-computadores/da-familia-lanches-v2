# DFL SITE R36 — Expedição premium + posição física verificada

## Incidente de produção (08/11/2026)
No Admin, a entrega aparecia como “0 parada(s) antes”, embora o operador soubesse de três paradas anteriores.
O Site fazia `Number(pedido.deliveryStopsAhead)`; JavaScript transforma `null` em `0`, logo `Number.isFinite(Number(null))` é `true`. Esse valor desconhecido virava afirmação operacional errada. Fonte da posição: Entregas (grupo físico, persistência de rota). Um vínculo com a rota não demonstra que houve saída real.

## Macrocirurgia Site R36
- Nova regra pura `src/lib/adminDeliveryPosition.ts`: aceita apenas inteiros válidos de `deliveryStopsAhead`; rejeita null, undefined, strings, inconsistência `isNextStop`, posição acima do total e contagem acima do total.
- Antes da saída real: `Rota vinculada · posição aguardando saída`, nunca “0 antes”.
- Após a saída com estado autoritativo e contagem válida: “3 paradas físicas antes” ou “Próxima parada confirmada”.
- Acompanhamento público também não infere próxima parada pelo `0` em `delivery.assigned`. O evento `delivery.next_stop` continua reconhecido para preservar contrato anterior.
- Refino da Expedição mobile: hierarquia dos botões e contadores, densidade da navegação, filtros horizontais scrolláveis, cartões mais legíveis, logística secundária, lembretes vazios discretos.
- Nenhum botão de aceitação, produção, despacho, cancelamento, histórico ou abertura do Entregas foi removido. Não há consultas ou listeners adicionais.

## Limites e homologação
O Site não calcula por conta própria quantas paradas físicas estão antes de um pedido. Só apresenta o valor confiável recebido do Entregas. A informação de que eram 3 paradas naquele pedido não foi verificada diretamente na base do Entregas. Não há ETA/GPS prometido.

## Validação após deploy
1. `delivery.assigned` com `stopsAhead=null` → sem número e sem “próxima parada”.
2. Rota iniciada, total 6, 3 paradas pendentes antes → 3 paradas físicas antes.
3. Rota iniciada, 0 antes e total conhecido → próxima parada confirmada.
4. Retirada e pedido concluído → sem aviso logístico falso.
5. Expedição mobile 360–430px → legibilidade dos cards, botões e filtros; inspector/ações preservadas.
6. Acompanhamento público do pedido → nenhuma alegação de primeira parada sem estado autoritativo.
7. Validar correções em rota com múltiplos pedidos no mesmo endereço (1 grupo físico = 1 parada), apenas após R300 Entregas.
