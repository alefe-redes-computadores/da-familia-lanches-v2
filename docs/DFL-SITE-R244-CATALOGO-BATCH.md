# R244 — Personalização de múltiplos combos com catálogo (LAB OFF)

**Projeto:** DFL SITE · **base:** `7bb00d36c983834a65097aa8e9dfb72835ad2d2f` (R243) · **status:** pacote de homologação, sem ativação comercial.

## Evolução técnica

O editor R243 tratava `comboQuantity` como multiplicador: todos os combos recebiam a mesma configuração. A R244 cria `ComboBatchDraft` com **uma configuração R237 independente por combo**. Cada cópia recebe chave `c1:1:1`, `c2:1:1` etc.; adicionais, remoções e notas não vazam de um combo para outro. Há operações distintas para copiar escolhas, aumentar/reduzir a quantidade, definir uma observação e aplicar mudanças a uma/todas/várias unidades de um grupo.

O adaptador `comboUnitCatalogDraft.ts` usa diretamente os produtos e adicionais fornecidos pelo catálogo atual, respeitando disponibilidade, preços exatos em centavos, composição estruturada `bundleItems`, `addonIds`, limites e grupos configurados. **É apenas uma tradução de um snapshot de catálogo do cliente para laboratório, nunca uma confirmação de preço no servidor.** Produtos e bebidas respeitam as regras já existentes em `availableAddonsForProduct`.

### Remoções

O Site ainda não tem autorização estruturada para remover cada ingrediente de cada lanche. Portanto o adaptador **não inventa** permissões a partir de `detailsItems` ou `description`: o padrão é não oferecer remoções. Uma allowlist experimental explícita pode ser fornecida em testes. Antes da ativação será necessário cadastro administrável, validação no servidor e impressão homologada.

### UI isolada

O novo `ComboUnitBatchConfiguratorDraft.tsx` traz abas *Combo 1, Combo 2...*, seleção Um/Vários/Todos, informações dos adicionais e seus valores de catálogo, observações por unidade, operação de cópia e prévia de totais. Não está importado em página ou modal público. Botão adicionar permanece desabilitado e o modo é destacado como simulação. Usa CSS próprio com foco visível, rolagem horizontal, safe area e preferência por movimento reduzido.

### Cenário de teste

Dois Combos 7 Uai: primeiro com bacon apenas no Uai 1; segundo com bacon nos Uai 3, 4 e 5 e nota no Uai 7. As 14 unidades continuam distintas. O total é demonstrativo e calculado com preços do *catálogo recebido*, não é cobrável, nem persistido ou enviado. Há testes para cópia explícita, resets, limite de quantidade, alteração inválida, bebida Kuat, suplemento indisponível, preço com fração de centavo, composição inválida e dados alterados.

## Proteções

- Flags **OFF** (`COMBO_UNIT_CATALOG_LAB_ENABLED`, `COMBO_UNIT_BATCH_LAB_ENABLED`, R237–R243 continuam OFF).
- `canCheckout=false`, `canPrint=false`, `canRelay=false`, `canSubmit=false`.
- Sem mudança na API de pedidos, Firestore, subtotal oficial, desconto, pagamento, carrinho real, impressão ou integração.
- Sem implementação de endpoint público, habilitação dinâmica, chamadas de rede nem persistência do laboratório.
- Installer com SHA-256 de todos os componentes, HEAD obrigatório R243, backup, restauração e exclusão seletivas, allowlist explícita, suíte completa, TypeScript e commit/push seletivo.

## Próximas etapas

1. **R245 — Homologação cruzada de contrato:** validar também o receptor Entregas em cenários com diferentes escolhas por combo e linhas de cozinha, sem autorização de pedido.
2. **R246 — Catálogo de ingredientes removíveis:** cadastro estruturado e autorização no servidor para cada lanche.
3. **R247 — Preparação de checkout e pedido versionados:** reconciliação servidor, teste ponta a ponta em ambiente controlado, cozinha e impressoras. Abrir flag só quando tudo estiver homologado.
4. **DFL Assist A1–A4:** evolução contextual independente; não interferir no checkout nem no fluxo comercial.

**Não assumir que a R244 habilita personalização para clientes.** Primeiro precisamos completar preço e persistência na autoridade servidor e a compatibilidade de ponta a ponta com Entregas.
