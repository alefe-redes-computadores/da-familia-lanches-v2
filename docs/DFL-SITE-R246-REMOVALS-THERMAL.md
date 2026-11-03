# DFL SITE — R246 | Cirurgia grande: ingredientes removíveis + bobina 58/80 mm

**Projeto:** `~/projects/da-familia-lanches-v2` (`main`)

**Base exata:** `2f35bea1bcf9b47fc1e9510a2a37d6da65ce84e2` (R245). **Condição:** HEAD sem divergências; instalador bloqueia se houver mudanças rastreadas ou stage preexistente. Nunca faz `git add -A`, `reset --hard` nem sobrescreve alterações de outros desenvolvedores.

## Conteúdo da cirurgia

1. **Cadastro administrativo de ingredientes removíveis.** O editor de produto apresenta uma lista de caixas de seleção associada a linhas reais de `detailsItems`. Nenhum ingrediente é permitido só porque consta na descrição: é necessária seleção explícita. Os IDs são gerados de forma determinística a partir da linha individual; nomes que colidem após normalização não podem configurar autorização. Se a composição mudar, um ingrediente autorizado que não exista mais bloqueia a gravação até revisão. Para bebidas e combos montados, a configuração é recusada.
2. **Validação comercial na API administrativa.** `src/app/api/admin/catalog/route.ts` valida o campo `removableIngredients` com a mesma função pura que o Admin. Não lê preço de cliente e não libera a modalidade de combos. O campo somente é atualizado/excluído quando aparece explicitamente no payload, para preservar políticas existentes em alterações administrativas antigas que não enviam esse campo. O toggle de disponibilidade envia a política preservada. Ações legadas de padronização que não incluem o campo não o apagam.
3. **Leitura segura do catálogo público.** O leitor de `CatalogoProdutos` traz apenas regras válidas, rejeitando silenciosamente permissões inconsistentes ou antigas (sem tornar toda a página indisponível). Nenhuma permissão é inferida da descrição. O motor experimental R244 passa a consultar as permissões explícitas por produto quando existirem; continua aceitando as declarações isoladas de laboratório R245 para testes, mas não permite misturar as duas fontes para o mesmo produto.
4. **Bobina de laboratório em 58 e 80 mm.** `comboUnitBatchThermalLab.ts` usa o objeto R245 já conferido, identifica fisicamente cada unidade, exibe adicionais, remoções, observações e totais simulados. Faz quebra de texto conservadora e escape HTML. **Sem botão imprimir, chamada de impressão, conexão Bluetooth/ESC-POS ou acesso à operação.** Nenhum cupom ou evento real é gerado.
5. **Regressões do fluxo antigo.** A integração v1, o registro de pedidos na API e a impressão atual (`thermalReceipt.ts`) não são alterados. A suíte R246 entra na Action de proteção crítica de vendas e executa as anteriores.

## Escopo

**Seis alterados:** `src/data/products.ts`, `src/lib/catalog.ts`, `src/lib/comboUnitCatalogDraft.ts`, `src/components/admin/CatalogAdmin.tsx`, `src/app/api/admin/catalog/route.ts`, `.github/workflows/site-sales-protection.yml`.

**Seis novos:** `src/lib/catalogRemovableIngredients.ts`, `src/lib/comboUnitBatchThermalLab.ts`, `src/components/admin/CatalogRemovalOptions.tsx`, `src/components/admin/CatalogRemovalOptions.module.css`, `scripts/test-site-r246-removals-thermal.cjs`, `docs/DFL-SITE-R246-REMOVALS-THERMAL.md`.

Nenhuma alteração em `src/app/api/orders/route.ts`, `src/components/ui/CheckoutModal.tsx`, `src/lib/integration/orderEvents.ts`, `src/lib/thermalReceipt.ts`, Auth, regras do Firestore, banco ou repositório Entregas.

## Exemplos de homologação

Para o Uai do catálogo de referência, `detailsItems` contém Bacon e Alface, mas não Cebola. No Admin pode-se autorizar retirada de **Bacon/Alface** (sem desconto automático); o motor não pode deduzir autorização para retirar Cebola. Um Combo 7 Uai #1 pode ter unidades sem ingredientes, e o Combo #2 pode ter bacon extra em outras unidades: o leitor e a bobina de testes preservam a distinção.

**Preços para adicionais:** derivados do catálogo carregado e convertidos em centavos. No laboratório eles continuam demonstrativos e **não são autoridade do servidor de pedidos**.

## Critérios para ativação futura

- Revisão dos itens autorizados no Admin em produção, por produto, sem ativar o editor público.
- Implementar contrato transacional de preço no backend e persistência por lanche, homologado com o consumidor de Entregas; o receptor atual não pode descartar seleções silenciosamente.
- Testar visualizações reais da cozinha/Entregas e impressão nas duas larguras em ambiente controlado.
- Somente então ligar uma feature flag comercial, com liberação progressiva e rollback.

## Homologação técnica

A suíte R246 valida o esquema e as permissões, as representações 58/80, a independência entre combos, o fechamento de total em centavos, HTML inerte, resistência a dados adulterados e a manutenção dos contratos legados. O instalador faz backup dos seis arquivos originais, aplica patch com âncoras exatas, valida TypeScript e regressões no **repositório real do Termux**, e somente depois faz commit e push seletivos. Um erro antes do commit dispara rollback dos seis alterados e exclusão apenas dos seis novos. Falha de push **preserva** o commit local para diagnóstico, sem reset.
