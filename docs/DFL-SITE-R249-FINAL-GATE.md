# DFL SITE R249 — Fechamento técnico V3 / decisão de liberação

Base exata: `479a6f717d07ca376454574364034f254e17346e` (R248 publicada).

## O que fica pronto

1. **Contrato candidato V3** de pedido com unidades individualizadas, gerado apenas a partir do **R248 server quote** autenticado. Preserva cada combo, componente, unidade, adicionais (preço em centavos), remoções e observações. Reconcilia o preço de cada unidade, de cada combo e o total.
2. **Painel premium no laboratório administrativo** com contagem de combos/unidades, escolhas por lanche e um checklist transparente do que passou e do que está bloqueando a ativação.
3. O mesmo endpoint administrativo da R248 devolve `releaseGate` além de `quote`. Os mesmos dados de catálogo já consultados são reutilizados: **nenhuma leitura remota adicional** para esta conferência.
4. **Gates de regressão R248 + R249**, conferência explícita de preservação do checkout V2 e do receptor R242 do Entregas instalado no Termux. No CI, sem o repositório irmão, usa a fixture versionada já existente; isso NÃO equivale à homologação em produção.

## O que NÃO fica ativado

- Nada é adicionado ao carrinho público; a API `/api/orders` continua bloqueando unit customization.
- O contrato criado é `certification_only`; `orderId`, `eventId` e `idempotencyKey` permanecem `null`.
- **Nenhum pedido V3 é persistido em Firestore**, nenhuma mensagem `order.created` é publicada e nenhuma impressora física é comandada.
- O receptor Entregas atual (R242 no escopo de combos) **rejeita V3**. Não deve ser liberado por mera declaração de capability.
- NENHUMA alteração em `firestore.rules`, permissões, checkout, outbox, impressoras ou Entregas.

## Bloqueios remanescentes para liberar clientes

1. `SITE_ORDER_API_V2_REJECTS_UNIT_LINES`: implementar validação de pedido V3 **dentro da transação**, com catálogo atual e total oficial, identidade idempotente e captura de promoções/cupons conforme política de negócio.
2. `ENTREGAS_RECEIVER_V1_REJECTS_ORDER_V3`: implantar primeiro o receptor atualizado do Entregas, com persistência integral de linhas por unidade, detalhes no app e impressora homologada.
3. `SERVER_TRANSACTIONAL_PERSISTENCE_V3_NOT_CERTIFIED`: confirmar Firestore e rollback em transação, sem aceitar preço de cliente nem romper a linha V2.
4. `SIGNED_RELAY_AND_IDEMPOTENCY_V3_NOT_CERTIFIED`: confirmar assinatura/HMAC, recuperação sem duplicar entrega e rejeição de eventos divergentes.
5. `PHYSICAL_KITCHEN_PRINT_V3_NOT_CERTIFIED`: homologar impressoras reais 58/80 mm, inclusive nomes longos, adicionais/removíveis e múltiplos combos.

**Critério de GO:** todos os cinco contratos acima implementados e testados, primeiro em homologação isolada e depois em ativação controlada. Até lá, `COMBO_V3_*_ENABLED = false` em todas as frentes.

## Como conferir no aplicativo

Admin → Catálogo → Produtos → Editar combo já cadastrado → Conteúdo → Abrir demonstração → Conferir com o servidor → **R249 · Fechamento técnico**.

A seção aparece apenas após a resposta administrativa validada; seus dados não se confundem com uma cobrança.

## Arquivos (9)

- Novos: `src/lib/comboUnitOrderV3Candidate.ts`, `src/components/admin/ComboUnitV3AcceptancePanel.tsx`, `src/components/admin/ComboUnitV3AcceptancePanel.module.css`, `scripts/test-site-r249-v3-gate.cjs`, `docs/DFL-SITE-R249-FINAL-GATE.md`.
- Modificados: `src/app/api/admin/combo-unit-quote/route.ts`, `src/components/admin/ComboUnitServerQuotePanel.tsx`, `scripts/test-site-r248-server-quote.cjs`, `.github/workflows/site-sales-protection.yml`.

Instalador exige branch `main`, SHA-base exato, árvore rastreada limpa e caminho novo inexistente. Permite arquivos antigos não rastreados fora do escopo, que nunca são tocados. Faz backup/rollback seletivo, testes e commit seletivo; o push acontece apenas após todas as verificações locais.
