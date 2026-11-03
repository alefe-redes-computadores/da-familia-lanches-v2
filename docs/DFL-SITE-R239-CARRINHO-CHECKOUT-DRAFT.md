# DFL SITE R239 — Ponte de carrinho e checkout para personalização por lanche (DESLIGADA)

**Base obrigatória:** `4ed95e78d51329873637fc6d945a4ebc9494080b` (R238). **Branch:** `main`.

## Objetivo

Preparar um contrato determinístico de **rascunho de carrinho** para a futura personalização individual de cada lanche, sem ligar o recurso comercial, sem trocar o contrato de pedidos V1 e sem alterar o catálogo, design, preços, frete, horários ou Firestore. O motor R237 (planos por unidade) e o motor R238 (prévia comercial por unidade) permanecem OFF.

### Mudanças concretas

1. `src/lib/comboUnitCartDraft.ts` (novo, puro): prepara e revalida rascunho versionado; gera identificação local determinística por escolhas (independente da quantidade); preserva composição, instruções da cozinha e prévia de preço marcada **NÃO COBRAR**. Se a composição do combo mudar, o rascunho antigo é recusado. O handoff para checkout é explicitamente `blocked_for_checkout`, jamais `payable`.
2. `src/components/ui/CartModal.tsx`: guarda contra campos experimentais vindos de carrinho persistido/alterado. Mostra aviso, desabilita Continuar e preserva os itens. Itens normais seguem iguais.
3. `src/components/ui/CheckoutModal.tsx`: recusa itens experimentais antes de iniciar qualquer tentativa de pedido e verifica o carrinho vivo. Um item experimental adicionado enquanto um pedido legítimo estava sendo confirmado também impede limpeza indevida do carrinho.
4. `src/app/api/orders/route.ts`: amplia a recusa V1 para as novas chaves reconhecidas de rascunhos/unidades. Mantém erro `CART_INVALID` e o motor transacional original.
5. `scripts/test-site-r239-combo-cart-bridge.cjs` (novo): verifica o modelo puro, o resultado não cobrável, invalidade de campos, escolhas do Combo 7 Uai e Combo Família Uai com bebida, e os contratos de proteção da UI, API e CI.
6. `.github/workflows/site-sales-protection.yml`: acrescenta R239 antes do gate completo existente.

## Cálculo demonstrativo (NÃO É TABELA DA LOJA)

Com valores **fictícios** apenas para exercitar a regra: Combo 7 Uai R$ 69,99; dois lanches sem cebola; dois com bacon de R$ 3,75 cada; um com queijo de R$ 2,25. Extras por combo: R$ 9,75. Em dois combos: R$ 159,48. Esse número não é cobrável, não vai ao carrinho real e não é enviado à API.

## Proteções comerciais

- O checkout real continua com o contrato V1: `selectedAddons`, `quantity`, `observation`, autorização e revalidação de preços no servidor.
- Se alguém adulterar o armazenamento e inserir campos `comboUnitPlan`, `comboUnitCartDraft`, `unitPlan`, `unitSelections`, `unitOverrides` ou aliases antigos, não haverá registro parcial ou desaparecimento silencioso das escolhas.
- Não há ação de gravação de pedidos, Firestore ou integração Entregas pelo novo módulo.
- Compatibilidade com carrinhos anteriores é preservada. Regressões de venda e TypeScript devem passar antes de commit seletivo e push.

## Homologação

**Em Termux:** SHA-256 de todos os arquivos, HEAD/branch/status Git; backup só dos quatro arquivos alterados; teste R239, R238, R237, regressões transacionais de vendas, gate global, `tsc --noEmit`, `git diff --check`, stage seletivo dos sete caminhos. Em falha antes do commit, rollback seletivo usando backup sem `reset --hard`.

**Em Android real:** adicionar combos V1 normais, confirmar que preço e checkout continuam iguais. O novo recurso por lanche deve permanecer invisível. Não criar pedido fictício em produção. Após CI/produção, a próxima fase envolve **contrato V2 no servidor** e transporte no Entregas/cozinha, sempre com ativação explícita, nunca por inferência.
