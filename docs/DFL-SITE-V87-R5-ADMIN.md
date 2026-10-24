# DFL SITE — V87 R5 · Admin operacional e qualidade

## Entregas

- Painel Experiência do Cliente: relatório sob demanda com estados confiáveis,
  timeout, amostra claramente rotulada, agrupamento de motivos, 3 métricas
  e filtros positivos/melhoria; mesma API autenticada com máximo de 100 registros.
- Cupons: pesquisa acento-insensível e por múltiplos termos; filtros por
  ativo, pausado, agendado e expirado; contadores derivados dos cupons carregados.
- Qualidade do catálogo: acesso a todos os apontamentos paginados e
  filtro por urgência e texto; sem novas leituras ou mutações.
- Operação: maior acessibilidade do fluxo de cancelamento e foco de teclado,
  preservando motivos e regras já existentes.
- Interface: alvos de toque 44–52 px, CSS móvel e `prefers-reduced-motion`.

## Segurança e desempenho

Não adiciona onSnapshot, Firestore reads, nem backends.
Todos os dados de feedback exibidos são limitados e tratados como strings;
não apresenta identificadores privados do cliente.
O diagnóstico do catálogo não pausa ou altera produto automaticamente.
O estado do cupom exibido não muda validação/autorização no checkout.

## Gates

Teste dedicado V87 R5, regressões comerciais, de qualidade, push e TypeScript
sem build; rollback apenas nos arquivos R5.
