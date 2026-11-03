# DFL SITE R238 — Regras comerciais do motor de combos (simulação fechada)

**Base:** R237 `da3fee3eba22656b201027f59072612c71b4761a` (branch `main`).

## Objetivo

Criar um contrato de *prévia comercial*, puramente em memória, para escolhas diferentes em cada lanche de um combo, com limites de adicionais e remoções **por unidade**. Nenhum checkout, pedido real, carrinho, frete, campanha ou regra de preço é alterado nesta cirurgia.

## O que entra

- `src/lib/comboUnitCommercial.ts`: contrato de política versionada e explicitamente **draft**, referenciada a um produto e a uma composição (`blueprintFingerprint`).
- `scripts/test-site-r238-combo-commerce.cjs`: regressão de precificação por unidade, regras por componente, grupos opcionais/obrigatórios e dados adulterados.
- `.github/workflows/site-sales-protection.yml`: adiciona a execução do teste R238, preservando todos os testes anteriores.
- Documento técnico e instalador com rollback seletivo.

## Invariantes de cálculo (somente demonstração)

1. O preço base é o preço **por combo**, não a soma dos preços avulsos dos seus componentes.
2. Cada adicional selecionado em um lanche cobra **uma vez por aquela unidade** e por combo adquirido; uma bebida não herda bacon ou outros adicionais de lanches.
3. Quantidade de combos repete integralmente a composição e a seleção de suas unidades: `total = (preçoBaseComboCentavos + extrasPorComboCentavos) × quantidadeCombos`.
4. A remoção de um ingrediente não concede desconto automático.
5. Todos os valores de cobrança são inteiros em centavos; não inventar preço para adicional não tarifado.
6. `minAddonsPerUnit`, `maxAddonsPerUnit`, `maxRemovalsPerUnit` e `groups[].min/max` são aplicados a **cada lanche**, não à linha inteira do pedido.
7. Só aceita política `status: 'draft'`; qualquer suposta política `approved`, composição alterada, preço negativo, dados não autorizados ou preço ausente são bloqueados.
8. Todo resultado disponível é identificado `state: 'draft_preview_only'` + `isPayable: false`; o relatório gerado avisa **NÃO COBRAR / NÃO ENVIAR À COZINHA**.
9. O módulo não efetua `fetch`, escrita em Firestore, requisição de pedidos, leitura do browser ou operação com o armazenamento local.
10. `COMBO_UNIT_COMMERCE_ENABLED = false` e `COMBO_UNIT_CUSTOMIZATION_ENABLED = false`. A API de pedidos R237 continua rejeitando qualquer payload v2 até as etapas seguintes.

## Importante: estes preços NÃO estão configurados na loja

Os valores de `R$ 3,75` para bacon e `R$ 2,25` para queijo nos testes são **dados fictícios de fixture**, usados para demonstrar `2 × (69,99 + 9,75) = R$ 159,48`, onde os extras por combo seriam dois bacons e um queijo. Eles NÃO representam os valores do catálogo atual nem autorização comercial. **A origem oficial futura deverá ser a configuração de adicionais e preços confirmada pelo servidor.**

## Interface comercial que será ativada depois (R239/R240)

Quando houver contrato de produção, a seleção será entre **um lanche**, **todos os lanches daquele tipo** ou **unidades selecionadas**; a cozinha receberá composição por unidade. A seleção e a cobrança deverão viajar pelo carrinho, checkout, revalidação transacional, integração Entregas, impressão e recompra. Não alterar o contrato de pedido v1 antes dessa integração completa.

## Arquivos de produção inalterados

`src/components/ui/ProductDetailsModal.tsx`, `src/store/cart.store.ts`, `src/app/api/orders/route.ts`, `src/lib/integration/orderEvents.ts`, `src/data/products.ts`, `src/lib/storeSchedule.ts`, `src/lib/visualCampaigns.ts` e todos os CSS. O cliente continua pagando e comprando pelo fluxo já homologado.

## Validação

O instalador verifica commit, branch, árvore limpa, SHA-256 do pacote, allowlist, testes R238, R237, R236, regressões de vendas e TypeScript. Se houver falha antes de commit, restaura unicamente o workflow alterado e exclui apenas os três novos arquivos. Não usa `git add -A` nem `git reset --hard`.
