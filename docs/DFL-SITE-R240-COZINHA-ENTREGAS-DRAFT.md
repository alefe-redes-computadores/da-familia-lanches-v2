# DFL SITE — R240 | Contrato de preparo, bobina e Entregas (somente simulação)

**Branch:** `main` · **base obrigatória:** `6972581eff3072281c151f90b8c845c96f5f15ca` (R239).
**Objetivo:** completar o caminho *de modelagem*, ainda não operacional, do Combo 7 Uai: plano R237 → cobrança R238 → rascunho de carrinho R239 → projeção individualizada de cozinha/recibo/Entregas R240.

## Evolução entregue

- `src/lib/comboUnitOperationalDraft.ts` novo, puro e determinístico, gera três visões do mesmo conjunto de escolhas validadas: linhas da cozinha, prévia textual/HTML de bobina, espelho de unidades para futura integração com DFL Entregas.
- IDs estáveis por unidade e por combo, por exemplo `c1:1:4` = combo 1, primeiro grupo, quarto lanche. Com dois combos, gera 14 linhas distintas e reproduz com clareza as mesmas modificações em cada combo.
- Total simulado reconciliado em **centavos**, nunca utilizável para cobrança. A política de preço explicitamente em `draft` é exigida; valores ausentes ou composição divergente impedem a projeção.
- `labels` exige nome do catálogo de referência; se faltar um nome, exibe ID e marca a projeção como não completamente resolvida, sem inventar ingredientes ou produtos.
- Notas e rótulos são normalizados, sem controles de linha, e **escapados** antes de entrar na prévia HTML; formato HTML não inclui botão, JS ou gatilho de impressão.
- Objetos retornados trazem `checkout:false`, `print:false`, `relay:false`, `production:false`, `chargeAuthorized:false` e `sendAllowed:false`. Não existe `orderId`/`eventId` real.
- Teste R240 registrado na Action crítica de vendas junto a R237–R239.

## Exemplo de produção **ainda não habilitada**

2× Combo 7 Uai, preço-base de teste R$ 69,99 por combo, bacon de teste R$ 3,75, mussarela de teste R$ 2,25.

| Unidade | Escolha | Extras por combo |
|---|---|---|
| Uai 1 e 2 | Sem cebola | R$ 0,00 |
| Uai 3 | + Bacon | R$ 3,75 |
| Uai 4 | + Bacon e mussarela | R$ 6,00 |
| Uai 5 e 6 | Padrão | R$ 0,00 |
| Uai 7 | Molho separado | R$ 0,00 |

Total simulado para dois combos: **R$ 159,48** (base R$ 139,98 + extras R$ 19,50). Valores dos adicionais são fictícios e somente de teste. **NÃO COBRAR; NÃO ENVIAR À COZINHA.**

## Integração auditada

- A integração atual do Site (`src/lib/integration/orderEvents.ts`) emite itens `DflSiteOrderItemSnapshotV1`, com componentes agregados por linha. **Não deve** receber a prévia R240, pois não tem como expressar escolhas específicas por lanche sem revisão de contrato com Entregas.
- A impressão real (`src/lib/thermalReceipt.ts`) lê `getOrderItems(order)`, com adicionais da linha e observação. Não é modificada.
- O Admin (`src/components/layout/OrderCard.tsx`) continua lendo o pedido real, não uma simulação.
- A API de pedidos tem guardas R237/R239 para rejeitar campos experimentais; a R240 não modifica a API e não gera `order.created` ou escrita Firestore.
- O checkout, carrinho, WhatsApp, impressão e o aplicativo Entregas continuam operando com os mesmos contratos. Não há flag comercial ligada ou novo campo persistido.

## Homologação

No Termux o instalador executa nova suíte, regressões R237–R239, proteção crítica de vendas, compatibilidade de checkout, TypeScript completo e `git diff --check`, em sequência. Base divergiu? bloqueia. Suíte falhou? rollback seletivo. Commit e push só após todas passarem.

## Próximas cirurgias coordenadas

**R241 — Compatibilidade versionada Site ↔ Entregas:** acordo explícito sobre contrato de cada unidade; criar testes conjuntos de consumidor antes de qualquer alteração de evento de produção.

**R242 — Impressão e preparo:** renderização real por unidade, ordem de montagem, duplicação de combos e notas; testes em bobinas 58/80 mm; ativação ainda em modo de teste.

**R243 — Interface de configuração:** seleção de uma, várias ou todas as unidades, resumo com valor por lanche, validação de itens indisponíveis; abordagem acessível e leve no Android.

**R244 — Homologação ponta a ponta:** teste controlado sem pedidos fictícios em produção, critérios de ativação e rollback por feature flag. A autoridade do preço permanece no servidor.

**Assist Contextual A1–A4:** trilho independente usando DFL Assist existente, não concorrente com o checkout nem com esta cirurgia.

### Escopo estrito

Um arquivo de CI alterado, três novos (`src/lib/comboUnitOperationalDraft.ts`, `scripts/test-site-r240-kitchen-handoff.cjs`, documento). Sem UI, preços, catálogo, Auth, regras Firestore, `orderEvents`, `thermalReceipt` ou módulos ativos do Entregas modificados.
