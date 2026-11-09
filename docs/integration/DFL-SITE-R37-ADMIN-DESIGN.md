# DFL SITE R37 — Sistema Visual do Admin (Cozinha, Expedição, Histórico, Gestão)

Base obrigatória: `fac9a0595a5cbfd45defd79c34d7b89d9f67c98e` (R36 publicada e READY).

## Alterações
- Workspace recebe `data-r37-stage={tab}` para escopar identidade por seção sem introduzir listeners, efeito ou estado novo.
- Cores, superfícies, tipografia, tabs, ferramentas, filtros, indicadores e espaços harmonizados para áreas operacionais e Gestão.
- Cards de pedidos com status e cliente como primeiro nível visual, logística como apoio, ações com mínimo 44 px e contraste controlado.
- Inspector mantém detalhes, ações, abas e safe-area; Gestão mantém todas as ferramentas.
- Painel de lembretes sem eventos perde destaque e agendamentos efetivos continuam evidentes.
- Etiqueta `WHATSAPP` vira `CANAL WHATSAPP` para não sugerir que uma mensagem foi realmente enviada/autorizada. Não altera consentimento ou backend.

## Não alterado
- Status, idempotência, dados Firestore, mensageria/WhatsApp, Supabase, Entregas, checkout, pagamento, roteamento e listener de pedidos.
- Botões: Aceitar, Iniciar, Marcar pronto, Despachar, Detalhes, Cancelar, filtros e operações no inspector.
- `src/lib/adminDeliveryPosition.ts` da R36: 0 desconhecido não é posição zero; nenhuma posição é recalculada pela R37.

## Limitações e QA
- Os testes são estáticos/herméticos e não substituem uma prova visual Android real.
- Confira no celular: Cozinha (novo e preparo), Agendados, Expedição (um e vários pedidos), Histórico, Gestão, modal/inspector, teclado aberto e safe-area.
- Testar contraste, busca, limpar filtro, retorno entre abas e cancelamento em modo de visualização, sem tocar em pedido real somente para QA.
- Verificação global obrigatória: `npx tsc --noEmit`, testes históricos R22/R24/R30/R34/R35/R36 e `git diff --check`.

## Revisão R37-R2 — 08/11/2026
O pacote R37 inicial foi bloqueado por um teste que exigia `"Cancelar"` e `"Abrir no Entregas"` como *strings JavaScript*, quando esses rótulos aparecem em JSX (`>Cancelar</button>` e `>Abrir no Entregas</button>`).
A revisão corrige **ambas** as asserções e valida os respectivos handlers. Não altera os fragmentos de CSS, o JSX, a semântica operacional nem a base R36. O instalador continua exigindo o HEAD `fac9a0595a5cbfd45defd79c34d7b89d9f67c98e` e aplica apenas sete caminhos sob stage explícito.
Se a primeira execução fez rollback seletivo, execute este ZIP normalmente, sem `git reset`.
