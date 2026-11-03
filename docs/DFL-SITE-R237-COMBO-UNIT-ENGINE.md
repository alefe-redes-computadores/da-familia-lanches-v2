# DFL SITE R237 — Motor de personalização individual de combos (isolado)

**Base exigida:** `d8431bf884c570b06259b58ea7afca285f341a4d` (R236). **Branch:** `main`.
**Ativação comercial:** DESLIGADA. **Nenhuma modificação** de preço, catálogo, checkout visual, carrinho, notas fiscais, Firestore, regras de agenda ou Entregas.

## Diagnóstico real

O `Combo 7 Uai` possui `bundleItems: [{productId:"uai",quantity:7}]` e preço-base cadastrado de R$ 69,99. O modal atual usa apenas `selectedAddons: Addon[]` por linha de combo; o carrinho monta uma linha com `cartId` e o backend revalida extras por linha. O evento `order.created` existente também carrega extras por linha, não por lanche individual. Mudar só os botões criaria inconsistência entre o que o cliente seleciona e o que a cozinha recebe.

## O que a R237 acrescenta

1. **`src/lib/comboUnitPlan.ts`:** motor puro e sem efeitos colaterais para especificar escolhas de cada unidade com chaves determinísticas (`1:1`, `1:2`, ...), inclusive combos mistos como 5 Uai + Kuat. Fingerprint detecta composição de catálogo modificada. Modalidade OFF por contrato.
2. **Ações explícitas:** `one`, `all`, `selected`, sempre restritas ao mesmo componente; adicionar extras, marcar remoções e registrar observação por unidade. Listas de extras/removíveis devem ser autorizadas por componente; o motor não decide isso sozinho.
3. **Parsing rigoroso:** contrato `version:2`, ID e fingerprint corretos, sem índices inexistentes/repetidos, limites de itens, observações e quantidades, sem reaproveitar planos antigos sem revisão.
4. **Prévia para cozinha:** linhas distintas para cada unidade, **não enviadas à produção** nesta etapa.
5. **Prévia de preço somente com política comercial explícita:** sem aprovação retorna `requires_commercial_approval`, nunca um preço presumido. Preço em **centavos inteiros** quando política demonstrativa é fornecida; remoções não dão desconto automaticamente.
6. **Proteção real do endpoint `/api/orders`:** se uma requisição trouxer campos v2 (`comboUnitPlan`, `unitCustomization` ou `comboCustomization`), o servidor responde `CART_INVALID` antes de qualquer transação. Isso evita pedidos em que a UI promete personalização que a API descartaria silenciosamente. Pedidos v1 seguem sem mudanças.
7. **Suíte de regressão no CI:** motor, combos reais do catálogo, escopos, preços, fronteira v1, operação legada e impedimento de ativação acidental. Teste sem rede, Firebase ou criação de pedidos.

## Exemplo APENAS didático — nunca anúncio de preço

Configuração futura: 7 Uai, dois sem cebola, dois com bacon, três normais. Em uma **simulação** na qual um bacon hipotético custa R$ 3,75 por unidade, seriam R$ 69,99 + R$ 7,50 = R$ 77,49 por combo, ou R$ 154,98 por dois combos idênticos. **Não é a política nem o valor comercial aprovado da loja.** Sem definição explícita de cobrança por unidade, a função não retorna esse preço.

## Etapas antes de ativar para clientes

- **R238:** formalizar regras comerciais por adicional e componente e aprovação na administração. Determinar quando o adicional se aplica a uma ou várias unidades, limites por lanche, grupos obrigatórios, itens inclusos e remoções sem desconto.
- **R239:** carrinho v2 com `cartId` versionado por configuração, API recalculando preços a partir do catálogo e revalidando cada unidade, idempotência e agendamento.
- **R240:** evento de integração e impressão Entregas/cozinha com instruções unitárias, tratamento por pedido múltiplo, recompra e recibo.
- **Ativação controlada:** UI mobile por unidade e por seleção, testes de não regressão e rollback; ligar flag somente depois de todos os passos estarem homologados.

## Escopo e segurança

Modificados SOMENTE:
- `src/app/api/orders/route.ts` (rejeição explícita de campos v2 ainda indisponíveis)
- `.github/workflows/site-sales-protection.yml` (regressão do motor)

Novos SOMENTE:
- `src/lib/comboUnitPlan.ts`
- `scripts/test-site-r237-combo-unit-engine.cjs`
- `docs/DFL-SITE-R237-COMBO-UNIT-ENGINE.md`

O instalador confere hashes, branch, HEAD exato, ausência de modificações rastreadas/stage, gera backup, roda testes legados + TypeScript, faz commit/push seletivos **apenas se tudo passar**. Falha antes do commit aciona rollback seletivo sem `reset --hard`.
