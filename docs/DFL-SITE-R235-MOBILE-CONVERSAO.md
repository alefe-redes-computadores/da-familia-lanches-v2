# DFL SITE R235 — Refinamento Mobile e Segurança de Conversão

Base: `e0645079abee37ade65e1bd8ad9d8512c503c7df` (R234 homologada). Escopo intencionalmente limitado a componentes visuais, offline e suíte de regressão. **Sem alteração de preços, IDs, regras comerciais, Firestore ou contratos de integração.**

## Auditoria de combos

`ProductDetailsModal` seleciona um vetor de `selectedAddons` por **linha de produto** e `useCartStore.addItem` salva preço unitário base mais soma de extras, multiplicado por `quantity` (quantidade de combos). O backend também revalida extras por linha. Não existe representação tipada de extras/remoções diferentes para cada um dos sete Uai dentro do combo. Nesta cirurgia não se tenta inventar esse recurso; a UI explica claramente a limitação e a necessidade de detalhar pedidos especiais em Observação, sujeito a conferência operacional. `bundleItems` continua sendo a composição administrativa.

## Mobile

- Informação de escopo acima de adicionais no modal; resumo fixo de quantidade, base e extras; estado acessível nos botões.
- Carrinho diferencia adicionais do combo e personalização individual (ainda inexistente).
- Shell público reserva altura da navegação + safe area Android; shell Admin permanece separado.
- Carrossel Black Friday mantém 6 itens e rótulos/cores existentes. Apenas centralização da imagem e espaço do scroll foram ajustados.

## Conexão e status

- `navigator.onLine` é consultado após hidratação e retomada (`focus`, `pageshow`), com limpeza de listeners. O aviso de offline continua condicionado à desconexão; não é inferido de conteúdo capturado por crawlers.
- `storeSchedule.ts` **não foi modificado**. Segunda-feira 02/11/2026 está desabilitada no padrão. Se a loja operar extraordinariamente, configure uma exceção real em **Admin → Funcionamento/Agenda** ou abertura manual, confirmando horários e conflito com fechamento manual. R235 testa somente a lógica, sem criar a exceção em produção.

## Limitações e teste físico

- A captura textual pública com “OFERTA” e aviso offline, isoladamente, não prova bug: campanha e conexão dependem de estado no navegador.
- A personalização lanche por lanche exige nova entidade (atribuições por índice de componente), precificação validada no servidor, serialização de pedido, impressão e integração Entregas. Não ativar sem migração/testes completos e regra comercial aprovada.
- Testar Android pequeno, teclado aberto, quantidade 1 e 2 de Combo 7 Uai, extras, observação, rolagem final, ida e volta do segundo plano e segunda-feira especial; **não fazer pedido de teste em produção**.

## Gate

`node scripts/test-site-r235-mobile-conversion.cjs`, suítes comerciais R1/R2/R3, R233, R234, campanhas R104/R106, gate V88-V90, TypeScript, `git diff --check`, commit e push seletivo após sucesso. Em falha antes do commit, rollback restaura somente allowlist, sem `reset --hard`.
