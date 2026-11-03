# DFL SITE — R243 | Editor individual por lanche (laboratório OFF)

**Projeto:** `~/projects/da-familia-lanches-v2`
**Base exata:** `7c19aa5635bcef976934254cc04c2bfbd6a84e2b` (R241)
**Escopo:** 5 novos arquivos e 1 arquivo alterado de CI.
**Estado:** laboratório isolado, `COMBO_UNIT_EDITOR_ENABLED = false`; NÃO existe entrada na vitrine, no produto, no checkout ou no carrinho.

## O que foi preparado

1. **`src/lib/comboUnitEditorDraft.ts`**: adaptador imutável da R237 para agrupar componentes por tipo, alterar uma unidade, várias ou todas e preservar notas individuais. Reaproveita R238 e R239 para produzir **prévia não cobrável**; ausência de política comercial resulta em preço indisponível, nunca em um valor fictício apresentado como verdadeiro.
2. **`src/components/ui/ComboUnitConfiguratorDraft.tsx`**: protótipo React mobile-first para escolher o alcance (Um / Selecionados / Todos), ativar adicionais e remoções por grupo, acrescentar observação exclusiva a cada lanche e conferir estado individual. Não é montado por nenhuma tela de produção; **não** tem botão funcional de adicionar, salvar ou cobrar.
3. **`src/components/ui/ComboUnitConfiguratorDraft.module.css`**: cartões de cor neutra, detalhes progressivos, toque mínimo de 44 px, foco acessível, cores douradas controladas, safe-area Android, comportamento em 370 px e `prefers-reduced-motion`.
4. **`scripts/test-site-r243-combo-editor.cjs`**: suíte isolada do editor, preços em centavos, atributos TSX, ausência de importações operacionais e retenção dos gates R237–R241.
5. **`docs/DFL-SITE-R243-COMBO-UNIT-EDITOR.md`**: este relatório. Workflow de vendas passa a rodar a suíte.

## Exemplo reprodutível (preços adicionais apenas de teste)

**Combo 7 Uai:** Uai 1/2 sem cebola; Uai 3 + bacon; Uai 4 + bacon e mussarela; Uai 5/6 padrão; Uai 7 molho separado. O modelo mantém sete chaves distintas (`1:1`…`1:7`), consegue aplicar ou remover escolhas individualmente e registra que **2 combos repetem a mesma configuração** da composição experimental. Motor R238: base de teste R$ 69,99 por combo, extras de teste R$ 9,75 por combo → R$ 159,48 no total de dois combos. Nenhum valor é autoridade comercial.

**Bebida como componente:** a arquitetura mantém o Kuat como grupo separado: o botão de bacon para o Uai não aparece no grupo da bebida, e o motor rejeita tentativas de cruzar os componentes.

## Restrições comerciais e de release

- Não cria documentos, eventos, delivery, pagamentos, carrinhos ou pedidos.
- Não chama `fetch`, Firestore ou APIs; não usa sessão/localStorage; não faz impressão.
- Componentes novos NÃO são importados por `AppShell`, `ProductDetailsModal`, `CartModal`, `CheckoutModal`, `orderEvents`, `thermalReceipt` ou API de pedidos.
- Políticas de preço continuam com status `draft`; funcionalidade pública OFF, embora controles do laboratório permitam simular escolhas.
- R242 do Entregas ainda não autoriza persistir personalizações individuais em pedidos reais.
- Antes da ativação: reconciliar regras comerciais reais por produto, estado de unidades de combos múltiplos (alterações distintas por combo), leitura do Entregas, cozinha, recibo, API e end-to-end.

## Instalação

No Termux, partir exatamente do SHA acima, branch `main`, árvore rastreada e stage limpos. O instalador confirma hashes internos, salva snapshot da única modificação do workflow, cria arquivos dentro da allowlist, executa a suíte nova e regressões R237–R241, TypeScript total, diff check, commit seletivo e push somente após aprovação. Qualquer falha antes do commit restaura somente os arquivos do pacote; não usa `git reset --hard`.

## Próxima etapa sugerida

**R244** — Homologar a UI com catálogo real, autorização comercial de preço no servidor e estados de *combos com configurações diferentes por quantidade*. Só então acoplar o componente à compra pública em release coordenado com Entregas, com ativação controlada e rollback. O DFL Assist contextual segue como trilho independente.
