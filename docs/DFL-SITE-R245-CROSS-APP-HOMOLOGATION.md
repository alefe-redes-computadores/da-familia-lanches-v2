# DFL SITE R245 — Fechamento cruzado dos combos independentes (laboratório OFF)

**Projeto:** `~/projects/da-familia-lanches-v2` · `main` · base obrigatória `e1c73a2ad223e5fd068d2a220c2c79a26431b3e5` (R244).
**Entregas:** apenas leitura do parser R242 em `~/projects/dfl-entregas`; nenhum arquivo é alterado nesse repositório.

## O que entregamos nesta cirurgia

1. **Conferência completa por combo:** o novo `comboUnitBatchHandoffDraft.ts` liga os motores da R237–R244: plano individual → política comercial de simulação → prévia operacional → contrato versionado R241. Cada combo físico vira um **segmento independente com quantidade 1**.
2. **Compatibilidade real de leitura:** o parser R242 do Entregas foi desenvolvido para combinações repetidas. Portanto, dois combos diferentes não podem ser enviados como um único contrato R241 repetido. A R245 os projeta em dois rascunhos isolados, que o leitor R242 consegue conferir sem perder alterações. **Isso NÃO significa que a integração comercial esteja habilitada.**
3. **Regras explícitas de remoção:** `comboUnitIngredientRulesDraft.ts` aceita somente ingredientes que tenham sido declarados individualmente por produto e que correspondam a itens da composição `detailsItems` do catálogo fornecido. Não concede remoções automaticamente. No fallback atual, o Uai inclui bacon e alface, mas não cebola. Não acrescentamos cebola ao cardápio.
4. **Interface de laboratório de conferência:** novo painel mobile-first `ComboUnitBatchAuditDraft.tsx` e CSS, integrado **somente** ao editor já desativado da R244. Mostra por combo os lanches e suas escolhas e reforça que é simulação. Nada aparece no fluxo público.
5. **Regressões do Site e Entregas:** `test-site-r245-combo-joint.cjs` executa o parser R242 congelado em uma fixture versionada na Action. No Termux também executa o parser disponível no repositório irmão, detectando divergência de contrato antes do commit. Os testes verificam dezenas de casos, valores em centavos, rejeição de adulterações, XSS e falhas de autorização.

## Exemplo da homologação

- **Combo 1:** Uai 1 sem bacon; Uai 2 sem alface; Uai 7 com observação “Molho separado”.
- **Combo 2:** Uai 3, 4 e 5 com bacon adicional; demais unidades padrão.
- Dois rascunhos R241 com `quantity=1`, total de 14 linhas individuais; preço-base mais apenas os adicionais do Combo 2. Remoções não dão desconto automático.
- Leitor R242 preserva as unidades e seus preços; todo o retorno permanece sem autorização comercial.

## Escopo rígido

**Arquivos alterados (2):** `.github/workflows/site-sales-protection.yml`, `src/components/ui/ComboUnitBatchConfiguratorDraft.tsx`.
**Arquivos novos (7):** dois módulos TypeScript, painel TSX + CSS, teste, fixture versionada do receptor R242 e documentação.
**Fora de escopo e inalterados:** `src/app/api/orders/route.ts`, `CartModal`, `CheckoutModal`, `orderEvents.ts`, `thermalReceipt.ts`, Firebase Rules, Firestore, catálogo comercial, impressão e repositório Entregas.

## Instalação, testes e rollback

O instalador exige HEAD/base exatos e Git rastreado limpo. Valida SHA-256 interno, cria backup dos dois arquivos originais em `~/storage/downloads/dfl-site-backups/R245-*`, modifica somente a allowlist, executa teste R245, regressões R237–R244, proteção de vendas, TypeScript e `git diff --check`. Só depois faz `git add -- <allowlist>`, commit seletivo e push. Em falha antes do commit, restaura os dois arquivos originais, remove só os sete arquivos criados e limpa o stage seletivamente, sem `git reset --hard`. Em falha após o commit/push, preserva o commit para diagnóstico.

**Ativação:** não há feature flag comercial habilitada, pedido real, evento ou impressão. O resultado é pré-homologação técnica, não uma liberação para vendas.

## Próxima cirurgia grande

**R246:** cadastro administrativo seguro de removíveis por produto + validação no catálogo autoritativo + testes de bobina 58/80mm e preparo humano. Depois, **R247**: circuito versionado em ambiente de teste com recálculo servidor, validação transacional, idempotência e gates de produção. A evolução do **DFL Assist contextual** segue como trilho paralelo.
