# DFL SITE — R241 | Contrato versionado Site ↔ Entregas (OFF)

**Base Git obrigatória:** `e6523d6b7424c40e9b7195a4a043df0f00e74702` (R240). **Data da auditoria:** 03/11/2026.

## O que foi auditado de fato

**Site:** `src/lib/integration/orderEvents.ts` ainda emite `DflSiteOrderItemSnapshotV1`: linha comercial com `selectedAddons`, `components` e `observation`; eventos usam envelope de integração schema 1, atualmente `orderSchemaVersion=2` quando a criação aplica o valor padrão. `src/app/api/orders/route.ts` rejeita campos experimentais da R237/R239; o pedido real e o outbox continuam transacionais.

**Entregas** (`alefe-redes-computadores/dfl-entregas`, verificado diretamente no repositório):
- `lib/integration/site-order.ts` recebe `order.created`/`order.updated` no envelope `schema_version=1` e aceita `orderSchemaVersion>=1`, **mas isso não declara suporte ao recurso por unidade**.
- `commercialSnapshotFromSite` normaliza cada item para `unit_price`, `line_total`, `selected_addons` e `observation`, **sem retenção de escolhas internas por lanche**.
- `siteOrderItemsFromPayload` também projeta adicionais e observações da linha, não a identidade e modificações de cada Uai do combo.
- `lib/integration/server/siteOrderPersistence.ts` salva o snapshot comercial em `site_order_commercial` e a lista em `site_order_items`, usando a identidade determinística do pedido. Não alterar a idempotência nem criar pedidos duplicados.

**Conclusão:** enviar extras por unidade em um campo desconhecido no evento V1 **poderia ser aceito pelo receptor e descartado**. Apenas subir a versão numérica do pedido não resolve isso. A R241 impede declarar falso suporte e exige contrato consumidor real antes de ativar.

## Entregável técnico

- **Novo módulo puro:** `src/lib/comboUnitReceiverDraft.ts`, sem I/O, rede, estado persistente, chamadas Firebase ou integração. Transforma a prévia R240 validada em um rascunho versionado `dfl_site_combo_units_preview_v1`, com todas as unidades, adicionais, remoções, observações e centavos.
- **Versão e capacidades:** constante explícita `dfl_site_combo_unit_lines_v1` exigida no futuro receptor. Distingue versão do *envelope* (1) de versão do *pedido* (2 atual / 3 proposta, **não aplicada**) e versão da prévia (1).
- **Barreiras fechadas:** `order/checkout/payment/relay/print/production=false`, `sendAllowed=false`, `orderId=null`, `eventId=null`; uma declaração falsa de capacidade no receptor **não libera envio** sem homologação conjunta posterior.
- **Validador:** confere identidades únicas `c<combo>:<grupo>:<unidade>`, quantidade de combos, IDs, nomes resolvidos, preços em centavos, soma por unidade/linha, versão, fingerprint, JSON pós-transporte e equivalência das duas representações de saída R240. Não aceita instruções parciais.
- **Testes:** `scripts/test-site-r241-receiver-compat.cjs` cobrindo combos múltiplos, sete Uai, Combo Família com refrigerante, tentativas de forjar identificadores/preços/permissões, alteração de quantidade, ausência de campos, atraso de composição e incompatibilidade V1.
- **CI:** nova suíte no gate de proteção crítica das vendas depois da R240; os testes anteriores continuam ativos.

## Compatibilidade: nunca confundir aceitação de envelope com processamento de conteúdo

| Elemento | Hoje | Futuro necessário |
|---|---|---|
| Envelope de evento | schema 1, operacional | Pode continuar schema 1 se compatível |
| Pedido do Site | schema 2, operacional | Versão 3 proposta para explicitar unidade |
| Consumidor Entregas | snapshot comercial V1 | Consumidor com capacidade testada `dfl_site_combo_unit_lines_v1` |
| Itens do combo | Quantidades agregadas e extras da linha | Linhas separadas e vinculadas a cada unidade |
| Cobrança | Backend do Site autoriza V1 | Backend revalida composição, adicionais e preço por unidade |
| Idempotência | Identidade `orderId` existente | A mesma identidade, sem duplicar delivery |
| Impressão | Ticket do pedido real | Impressão individual homologada em 58/80 mm |
| Status desta entrega | **OFF** | Somente depois de Site + Entregas + cozinha aprovados |

## Como será a próxima cirurgia coordenada

1. **Entregas — consumidor de teste (sem ativação):** introduzir parser explícito para `dfl_site_combo_unit_lines_v1`, guardar snapshot estruturado sem perda, rejeitar contratos desconhecidos, preservar entrega única por `orderId` e isolar autorização de recebimento de autorização de preparo.
2. **Site — geração em modo homologação:** após aprovação do consumidor, criar evento de teste com `orderSchemaVersion=3` e payload realmente compatível; **não enviar como pedido real** até testes de serialização, assinatura, transação, outbox, retry, reenvio e impressora.
3. **Impressão + visual:** validar ordem de montagem, notas, extras, quantidade de combos, labels e segurança nas bobinas e no aplicativo Entregas.
4. **Ativação posterior:** preços reais autorizados pelo catálogo remoto e política comercial aprovada, UI acessível, teste ponta a ponta e flag OFF por padrão com plano de rollback.

## Limite desta cirurgia

**Não modifica:** DFL Entregas; checkout, carrinho, página de produto, Admin, descontos, preços, catálogo, banco, regras Firebase, envio de pedidos, `orderEvents`, impressão, WhatsApp, assistente contextual ou indicadores do cliente. Não chama APIs externas. **É planejamento e certificação executável, não uma integração ativa.**

O instalador exige HEAD exato, `main`, stage e diff rastreado vazios; faz backup seletivo, valida SHA-256 por arquivo, executa testes de segurança anteriores e TypeScript, cria commit seletivo e tenta push somente após sucesso. Falha antes do commit realiza rollback de escopo, sem `git reset --hard` ou `git add -A`.
